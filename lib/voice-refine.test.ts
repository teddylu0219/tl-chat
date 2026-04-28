import {
  buildVoiceRefinePrompt,
  normalizeVoiceTranscriptForMock,
  voiceRefineRequestSchema,
} from "./voice-refine";

describe("voice refinement helpers", () => {
  it("builds a conservative correction prompt without asking for rewrites", () => {
    const prompt = buildVoiceRefinePrompt({
      language: "zh-TW",
      text: "請用配森寫 JSON",
    });

    expect(prompt).toContain("Return only the corrected transcript text");
    expect(prompt).toContain("Never rewrite, polish, summarize, translate");
    expect(prompt).toContain("Recognition language: zh-TW");
    expect(prompt).toContain("請用配森寫 JSON");
  });

  it("normalizes common mixed Chinese-English speech mistakes in mock mode", () => {
    expect(normalizeVoiceTranscriptForMock("請用配森處理杰森")).toBe(
      "請用Python處理JSON",
    );
  });

  it("validates voice refine requests", () => {
    expect(() =>
      voiceRefineRequestSchema.parse({
        apiKey: "sk-or-v1-test",
        modelId: "openai/gpt-5.4-mini",
        text: "hello",
      }),
    ).not.toThrow();

    expect(() =>
      voiceRefineRequestSchema.parse({
        apiKey: "",
        modelId: "openai/gpt-5.4-mini",
        text: "",
      }),
    ).toThrow();
  });
});
