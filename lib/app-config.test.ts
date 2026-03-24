import { APP_NAME, DEFAULT_THEME, THEME_OPTIONS } from "./app-config";

describe("app config", () => {
  it("keeps the product name stable", () => {
    expect(APP_NAME).toBe("Own AI Chat");
  });

  it("offers a default theme that exists in the option list", () => {
    expect(THEME_OPTIONS.some((option) => option.value === DEFAULT_THEME)).toBe(
      true,
    );
  });
});
