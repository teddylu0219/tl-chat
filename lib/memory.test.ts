import {
  extractMemoriesFromResponse,
  extractMemoriesFromUserInput,
} from "./memory";

describe("memory helpers", () => {
  it("extracts durable facts from user input", () => {
    expect(extractMemoriesFromUserInput("i am a student from nycu")).toEqual([
      "User is a student from NYCU",
    ]);
  });

  it("extracts explicit preferences from user input", () => {
    expect(extractMemoriesFromUserInput("I prefer TypeScript over JavaScript.")).toEqual([
      "User prefers TypeScript over JavaScript",
    ]);
  });

  it("strips hidden memory tags from assistant output", () => {
    expect(
      extractMemoriesFromResponse(
        "Got it.<memory>User is a student from NYCU</memory>",
      ),
    ).toEqual({
      cleanText: "Got it.",
      memories: ["User is a student from NYCU"],
    });
  });
});
