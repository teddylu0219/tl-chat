import {
  extractMemoriesFromResponse,
  extractMemoriesFromUserInput,
  resolveMemoryCandidates,
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

  it("extracts durable facts from chinese user input", () => {
    expect(extractMemoriesFromUserInput("我是交大的學生")).toEqual([
      "User is a student at National Yang Ming Chiao Tung University (NYCU)",
    ]);
  });

  it("resolves memories from prior user facts when asked to remember in chinese", () => {
    expect(resolveMemoryCandidates("記住他", ["我是交大的學生"])).toEqual([
      "User is a student at National Yang Ming Chiao Tung University (NYCU)",
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
