import type { UIMessage } from "ai";

import {
  convertAttachmentDataPart,
  prepareMessagesForModel,
} from "./model-message-parts";
import { RequestValidationError } from "./openrouter";

describe("model message part conversion", () => {
  it("converts browser data URL image attachments into model file bytes", () => {
    const messages = prepareMessagesForModel([
      {
        parts: [
          {
            filename: "photo.png",
            mediaType: "image/png",
            type: "file",
            url: "data:image/png;base64,YWJj",
          },
          { type: "text", text: "Describe it." },
        ],
        role: "user",
      },
    ]);
    const [imagePart] = messages[0].parts;

    expect(imagePart).toMatchObject({
      data: {
        filename: "photo.png",
        mediaType: "image/png",
      },
      type: "data-attachment-image",
    });

    const modelPart = convertAttachmentDataPart(imagePart as {
      data: unknown;
      type: string;
    });

    expect(modelPart).toMatchObject({
      filename: "photo.png",
      mediaType: "image/png",
      type: "file",
    });

    if (!modelPart || modelPart.type !== "file") {
      throw new Error("Expected model file part.");
    }

    expect(Array.from(modelPart.data as Uint8Array)).toEqual([97, 98, 99]);
  });

  it("keeps hosted image URLs as regular UI file parts", () => {
    const sourcePart: UIMessage["parts"][number] = {
      filename: "hosted.png",
      mediaType: "image/png",
      type: "file",
      url: "https://example.com/hosted.png",
    };
    const messages = prepareMessagesForModel([
      {
        parts: [sourcePart],
        role: "user",
      },
    ]);

    expect(messages[0].parts[0]).toBe(sourcePart);
  });

  it("converts text attachment data parts into context text", () => {
    const modelPart = convertAttachmentDataPart({
      data: {
        filename: "notes.md",
        mediaType: "text/markdown",
        text: "# Notes",
      },
      type: "data-attachment-text",
    });

    expect(modelPart).toEqual({
      text: "Attached document: notes.md\nMedia type: text/markdown\n\n# Notes",
      type: "text",
    });
  });

  it("converts PDF attachment data parts into model file bytes", () => {
    const modelPart = convertAttachmentDataPart({
      data: {
        dataUrl: "data:application/pdf;base64,JVBERi0xLjc=",
        filename: "paper.pdf",
        mediaType: "application/pdf",
      },
      type: "data-attachment-pdf",
    });

    expect(modelPart).toMatchObject({
      filename: "paper.pdf",
      mediaType: "application/pdf",
      type: "file",
    });

    if (!modelPart || modelPart.type !== "file") {
      throw new Error("Expected model file part.");
    }

    expect(Array.from(modelPart.data as Uint8Array)).toEqual([
      37, 80, 68, 70, 45, 49, 46, 55,
    ]);
  });

  it("rejects malformed image attachment data URLs", () => {
    expect(() =>
      convertAttachmentDataPart({
        data: {
          dataUrl: "not-a-data-url",
          mediaType: "image/png",
        },
        type: "data-attachment-image",
      }),
    ).toThrow(RequestValidationError);
  });
});
