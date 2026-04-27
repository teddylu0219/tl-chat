import type { FilePart, TextPart, UIMessage } from "ai";

import { MAX_IMAGE_ATTACHMENT_BYTES } from "./attachments";
import { RequestValidationError } from "./openrouter";

type SerializableDataPart = {
  data: unknown;
  id?: string;
  type: string;
};

type AttachmentImageData = {
  dataUrl: string;
  filename?: string;
  mediaType: string;
};

export type AttachmentImagePart = {
  data: AttachmentImageData;
  id?: string;
  type: "data-attachment-image";
};

function isDataUrlImageFilePart(
  part: UIMessage["parts"][number],
): part is Extract<UIMessage["parts"][number], { type: "file" }> {
  return (
    part.type === "file" &&
    part.mediaType.startsWith("image/") &&
    part.url.startsWith("data:")
  );
}

export function prepareMessagesForModel(
  messages: Array<Omit<UIMessage, "id">>,
): Array<Omit<UIMessage, "id">> {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (!isDataUrlImageFilePart(part)) {
        return part;
      }

      return {
        data: {
          dataUrl: part.url,
          filename: part.filename,
          mediaType: part.mediaType,
        },
        id: crypto.randomUUID(),
        type: "data-attachment-image",
      } satisfies AttachmentImagePart;
    }),
  }));
}

function bytesFromBase64(base64: string) {
  const maybeBuffer = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from: (input: string, encoding: "base64") => Uint8Array;
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return new Uint8Array(maybeBuffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function parseDataUrl(dataUrl: string, fallbackMediaType: string) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);

  if (!match) {
    throw new RequestValidationError("Image attachment could not be read.");
  }

  const mediaType = match[1]?.trim() || fallbackMediaType;
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const bytes = isBase64
    ? bytesFromBase64(payload)
    : new TextEncoder().encode(decodeURIComponent(payload));

  if (!mediaType.startsWith("image/")) {
    throw new RequestValidationError("Only image attachments can be sent as vision input.");
  }

  if (bytes.byteLength === 0) {
    throw new RequestValidationError("Image attachment is empty.");
  }

  if (bytes.byteLength > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new RequestValidationError("Image attachment is larger than 4MB.");
  }

  return { bytes, mediaType };
}

function parseAttachmentImageData(data: unknown): AttachmentImageData {
  if (!data || typeof data !== "object") {
    throw new RequestValidationError("Image attachment metadata is invalid.");
  }

  const attachment = data as Partial<AttachmentImageData>;

  if (
    typeof attachment.dataUrl !== "string" ||
    typeof attachment.mediaType !== "string"
  ) {
    throw new RequestValidationError("Image attachment metadata is invalid.");
  }

  return {
    dataUrl: attachment.dataUrl,
    filename:
      typeof attachment.filename === "string" ? attachment.filename : undefined,
    mediaType: attachment.mediaType,
  };
}

export function convertAttachmentDataPart(
  part: SerializableDataPart,
): FilePart | TextPart | undefined {
  if (part.type === "data-attachment-text") {
    const attachment = part.data as {
      filename: string;
      mediaType: string;
      text: string;
    };

    return {
      text: [
        `Attached document: ${attachment.filename}`,
        `Media type: ${attachment.mediaType}`,
        "",
        attachment.text,
      ].join("\n"),
      type: "text",
    };
  }

  if (part.type !== "data-attachment-image") {
    return undefined;
  }

  const attachment = parseAttachmentImageData(part.data);
  const { bytes, mediaType } = parseDataUrl(
    attachment.dataUrl,
    attachment.mediaType,
  );

  return {
    data: bytes,
    filename: attachment.filename,
    mediaType,
    type: "file",
  };
}
