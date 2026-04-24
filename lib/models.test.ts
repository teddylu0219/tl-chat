import {
  AUTO_MODEL_ID,
  DEFAULT_MODEL_ID,
  FEATURED_MODELS,
  getFeaturedModel,
  getMemoryManagerModelId,
  getModelOption,
  getModelOptions,
  isSupportedModel,
} from "./models";

describe("model registry", () => {
  it("keeps the default model inside the featured list", () => {
    expect(
      FEATURED_MODELS.some((model) => model.id === DEFAULT_MODEL_ID),
    ).toBe(true);
  });

  it("returns the expected featured model metadata", () => {
    expect(getFeaturedModel("anthropic/claude-sonnet-4")?.provider).toBe(
      "Anthropic",
    );
  });

  it("accepts featured models and rejects unknown ids", () => {
    expect(isSupportedModel("openai/gpt-5.4-mini")).toBe(true);
    expect(isSupportedModel(AUTO_MODEL_ID)).toBe(true);
    expect(isSupportedModel("not-real/model")).toBe(false);
  });

  it("appends a custom model option when needed", () => {
    const options = getModelOptions("meta-llama/llama-custom");

    expect(options.at(-1)).toMatchObject({
      id: "meta-llama/llama-custom",
      provider: "Custom",
    });
    expect(getModelOption("meta-llama/llama-custom", "meta-llama/llama-custom"))
      .toBeTruthy();
  });

  it("resolves Auto Router to a concrete memory manager model", () => {
    expect(getMemoryManagerModelId(AUTO_MODEL_ID)).toBe(DEFAULT_MODEL_ID);
    expect(getMemoryManagerModelId("meta-llama/custom")).toBe("meta-llama/custom");
  });
});
