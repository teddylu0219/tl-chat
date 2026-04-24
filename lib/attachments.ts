import type { FileUIPart, UIMessage } from "ai";

export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_ATTACHMENT_CHARS = 12_000;

export type AttachmentTextData = {
  filename: string;
  mediaType: string;
  text: string;
};

export type AttachmentTextPart = {
  data: AttachmentTextData;
  id: string;
  type: "data-attachment-text";
};

export type ComposerAttachment = {
  filename: string;
  id: string;
  kind: "image" | "text";
  mediaType: string;
  part: AttachmentTextPart | FileUIPart;
  previewUrl?: string;
};

export function isAttachmentTextPart(
  part: UIMessage["parts"][number],
): part is AttachmentTextPart {
  return part.type === "data-attachment-text";
}

export function buildAttachmentTextPart({
  filename,
  mediaType,
  text,
}: AttachmentTextData): AttachmentTextPart {
  return {
    data: {
      filename,
      mediaType,
      text,
    },
    id: crypto.randomUUID(),
    type: "data-attachment-text",
  };
}

export function isTextLikeFile(file: File) {
  if (file.type.startsWith("text/")) {
    return true;
  }

  return /\.(?:txt|md|markdown|csv|json|jsonl|ts|tsx|js|jsx|css|html|xml|yml|yaml)$/i.test(
    file.name,
  );
}

function bytesToBase64(bytes: Uint8Array) {
  const maybeBuffer = (
    globalThis as typeof globalThis & {
      Buffer?: { from: (bytes: Uint8Array) => { toString: (encoding: "base64") => string } };
    }
  ).Buffer;

  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export async function readFileAsDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = file.type || "application/octet-stream";

  return `data:${mediaType};base64,${bytesToBase64(bytes)}`;
}

export async function prepareComposerAttachments(files: FileList | File[] | null) {
  const attachments: ComposerAttachment[] = [];
  const rejected: string[] = [];

  if (!files) {
    return { attachments, rejected };
  }

  for (const [index, file] of Array.from(files).entries()) {
    if (index >= MAX_ATTACHMENTS) {
      rejected.push(`${file.name}: only ${MAX_ATTACHMENTS} attachments can be queued at once.`);
      continue;
    }

    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_ATTACHMENT_BYTES) {
        rejected.push(`${file.name}: image is larger than 4MB.`);
        continue;
      }

      const url = await readFileAsDataUrl(file);

      attachments.push({
        filename: file.name,
        id: crypto.randomUUID(),
        kind: "image",
        mediaType: file.type || "image/*",
        part: {
          filename: file.name,
          mediaType: file.type || "image/*",
          type: "file",
          url,
        },
        previewUrl: url,
      });
      continue;
    }

    if (isTextLikeFile(file)) {
      const rawText = await file.text();
      const text = rawText.slice(0, MAX_TEXT_ATTACHMENT_CHARS).trim();

      if (!text) {
        rejected.push(`${file.name}: file is empty.`);
        continue;
      }

      attachments.push({
        filename: file.name,
        id: crypto.randomUUID(),
        kind: "text",
        mediaType: file.type || "text/plain",
        part: buildAttachmentTextPart({
          filename: file.name,
          mediaType: file.type || "text/plain",
          text,
        }),
      });
      continue;
    }

    rejected.push(`${file.name}: only images and text-like files are supported right now.`);
  }

  return { attachments, rejected };
}
