import {
  MAX_ATTACHMENTS,
  MAX_IMAGE_ATTACHMENT_BYTES,
  MAX_PDF_ATTACHMENT_BYTES,
  MAX_TEXT_ATTACHMENT_CHARS,
  isPdfFile,
  isTextLikeFile,
  prepareComposerAttachments,
} from "./attachments";

describe("attachment helpers", () => {
  it("detects text-like files by media type and extension", () => {
    expect(
      isTextLikeFile(new File(["hello"], "notes.md", { type: "" })),
    ).toBe(true);
    expect(
      isTextLikeFile(new File(["hello"], "notes.bin", { type: "text/plain" })),
    ).toBe(true);
    expect(
      isTextLikeFile(new File(["hello"], "archive.zip", { type: "application/zip" })),
    ).toBe(false);
  });

  it("detects PDF files by media type and extension", () => {
    expect(
      isPdfFile(new File(["pdf"], "paper.pdf", { type: "" })),
    ).toBe(true);
    expect(
      isPdfFile(new File(["pdf"], "paper.bin", { type: "application/pdf" })),
    ).toBe(true);
    expect(
      isPdfFile(new File(["pdf"], "paper.txt", { type: "text/plain" })),
    ).toBe(false);
  });

  it("converts small images into AI SDK file parts", async () => {
    const file = new File(["abc"], "photo.png", { type: "image/png" });

    await expect(prepareComposerAttachments([file])).resolves.toMatchObject({
      attachments: [
        {
          filename: "photo.png",
          kind: "image",
          part: {
            filename: "photo.png",
            mediaType: "image/png",
            type: "file",
            url: "data:image/png;base64,YWJj",
          },
        },
      ],
      rejected: [],
    });
  });

  it("rejects oversized images", async () => {
    const file = new File(
      [new Uint8Array(MAX_IMAGE_ATTACHMENT_BYTES + 1)],
      "huge.png",
      { type: "image/png" },
    );

    await expect(prepareComposerAttachments([file])).resolves.toMatchObject({
      attachments: [],
      rejected: ["huge.png: image is larger than 4MB."],
    });
  });

  it("converts PDFs into PDF data attachment parts", async () => {
    const file = new File(["%PDF-1.7"], "paper.pdf", { type: "application/pdf" });

    await expect(prepareComposerAttachments([file])).resolves.toMatchObject({
      attachments: [
        {
          filename: "paper.pdf",
          kind: "pdf",
          mediaType: "application/pdf",
          part: {
            data: {
              dataUrl: "data:application/pdf;base64,JVBERi0xLjc=",
              filename: "paper.pdf",
              mediaType: "application/pdf",
            },
            type: "data-attachment-pdf",
          },
        },
      ],
      rejected: [],
    });
  });

  it("rejects oversized PDFs", async () => {
    const file = new File(
      [new Uint8Array(MAX_PDF_ATTACHMENT_BYTES + 1)],
      "huge.pdf",
      { type: "application/pdf" },
    );

    await expect(prepareComposerAttachments([file])).resolves.toMatchObject({
      attachments: [],
      rejected: ["huge.pdf: PDF is larger than 10MB."],
    });
  });

  it("truncates text-like attachments to the supported context limit", async () => {
    const file = new File(
      ["x".repeat(MAX_TEXT_ATTACHMENT_CHARS + 100)],
      "context.md",
      { type: "text/markdown" },
    );
    const result = await prepareComposerAttachments([file]);
    const part = result.attachments[0]?.part;

    expect(part).toMatchObject({
      type: "data-attachment-text",
    });

    if (part?.type !== "data-attachment-text") {
      throw new Error("Expected text attachment part.");
    }

    expect(part.data.text).toHaveLength(MAX_TEXT_ATTACHMENT_CHARS);
  });

  it("rejects files beyond the attachment count limit", async () => {
    const files = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, index) =>
      new File([`file ${index}`], `notes-${index}.md`, {
        type: "text/markdown",
      }),
    );
    const result = await prepareComposerAttachments(files);

    expect(result.attachments).toHaveLength(MAX_ATTACHMENTS);
    expect(result.rejected).toEqual([
      `notes-${MAX_ATTACHMENTS}.md: only ${MAX_ATTACHMENTS} attachments can be queued at once.`,
    ]);
  });
});
