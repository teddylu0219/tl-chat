import type { FileUIPart, UIMessage } from "ai";

export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_PDF_ATTACHMENT_BYTES = 10 * 1024 * 1024;
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

export type AttachmentPdfData = {
  dataUrl: string;
  filename: string;
  mediaType: "application/pdf";
};

export type AttachmentPdfPart = {
  data: AttachmentPdfData;
  id: string;
  type: "data-attachment-pdf";
};

export type ComposerAttachment = {
  filename: string;
  id: string;
  kind: "image" | "pdf" | "text";
  mediaType: string;
  part: AttachmentPdfPart | AttachmentTextPart | FileUIPart;
  previewUrl?: string;
};

export function canPreviewImageInBrowser(mediaType: string) {
  return /^image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)$/i.test(mediaType);
}

export function canConvertImagePreview(mediaType: string) {
  return /^image\/hei[cf]$/i.test(mediaType);
}

export async function createImagePreviewUrl({
  filename,
  mediaType,
  url,
}: {
  filename?: string;
  mediaType: string;
  url: string;
}) {
  if (canPreviewImageInBrowser(mediaType)) {
    return url;
  }

  if (!canConvertImagePreview(mediaType) || !url.startsWith("data:")) {
    return undefined;
  }

  try {
    const response = await fetch("/api/attachment-preview", {
      body: JSON.stringify({
        dataUrl: url,
        filename,
        mediaType,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as { previewUrl?: string };

    return payload.previewUrl;
  } catch {
    return undefined;
  }
}

export function isAttachmentTextPart(
  part: UIMessage["parts"][number],
): part is AttachmentTextPart {
  return part.type === "data-attachment-text";
}

export function isAttachmentPdfPart(
  part: UIMessage["parts"][number],
): part is AttachmentPdfPart {
  return part.type === "data-attachment-pdf";
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

export function buildAttachmentPdfPart({
  dataUrl,
  filename,
  mediaType,
}: AttachmentPdfData): AttachmentPdfPart {
  return {
    data: {
      dataUrl,
      filename,
      mediaType,
    },
    id: crypto.randomUUID(),
    type: "data-attachment-pdf",
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

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
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

export async function readFileAsDataUrl(file: File, mediaTypeOverride?: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = mediaTypeOverride || file.type || "application/octet-stream";

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
      const mediaType = file.type || "image/*";
      const previewUrl = await createImagePreviewUrl({
        filename: file.name,
        mediaType,
        url,
      });

      attachments.push({
        filename: file.name,
        id: crypto.randomUUID(),
        kind: "image",
        mediaType,
        part: {
          filename: file.name,
          mediaType,
          type: "file",
          url,
        },
        previewUrl,
      });
      continue;
    }

    if (isPdfFile(file)) {
      if (file.size === 0) {
        rejected.push(`${file.name}: PDF is empty.`);
        continue;
      }

      if (file.size > MAX_PDF_ATTACHMENT_BYTES) {
        rejected.push(`${file.name}: PDF is larger than 10MB.`);
        continue;
      }

      const mediaType = "application/pdf";
      const dataUrl = await readFileAsDataUrl(file, mediaType);

      attachments.push({
        filename: file.name,
        id: crypto.randomUUID(),
        kind: "pdf",
        mediaType,
        part: buildAttachmentPdfPart({
          dataUrl,
          filename: file.name,
          mediaType,
        }),
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

    rejected.push(`${file.name}: only images, PDFs, and text-like files are supported right now.`);
  }

  return { attachments, rejected };
}
