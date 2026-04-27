import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  canConvertImagePreview,
} from "@/lib/attachments";
import { RequestValidationError, getErrorMessage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 15;

const execFileAsync = promisify(execFile);

function parseDataUrl(dataUrl: string, fallbackMediaType: string) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);

  if (!match) {
    throw new RequestValidationError("Image preview could not be read.");
  }

  const mediaType = match[1]?.trim() || fallbackMediaType;
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  if (!canConvertImagePreview(mediaType)) {
    throw new RequestValidationError("This image format does not need conversion.");
  }

  if (bytes.byteLength === 0) {
    throw new RequestValidationError("Image preview is empty.");
  }

  if (bytes.byteLength > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new RequestValidationError("Image preview is larger than 4MB.");
  }

  return { bytes, mediaType };
}

function getExtension(mediaType: string) {
  return mediaType.toLowerCase().includes("heif") ? "heif" : "heic";
}

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    const body = (await request.json()) as {
      dataUrl?: unknown;
      filename?: unknown;
      mediaType?: unknown;
    };

    if (typeof body.dataUrl !== "string" || typeof body.mediaType !== "string") {
      throw new RequestValidationError("Image preview request is invalid.");
    }

    const { bytes, mediaType } = parseDataUrl(body.dataUrl, body.mediaType);
    tempDir = await mkdtemp(join(tmpdir(), "tl-chat-preview-"));

    const inputPath = join(tempDir, `input.${getExtension(mediaType)}`);
    const outputPath = join(tempDir, "preview.jpg");

    await writeFile(inputPath, bytes);
    await execFileAsync(
      "/usr/bin/sips",
      ["-s", "format", "jpeg", inputPath, "--out", outputPath],
      {
        timeout: 12_000,
      },
    );

    const previewBytes = await readFile(outputPath);

    return Response.json({
      mediaType: "image/jpeg",
      previewUrl: `data:image/jpeg;base64,${previewBytes.toString("base64")}`,
    });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 415;

    return new Response(getErrorMessage(error), { status });
  } finally {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
    }
  }
}
