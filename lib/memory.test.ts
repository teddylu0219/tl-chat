import {
  extractMemoryOperationsFromToolParts,
  extractMemoriesFromResponse,
  extractMemoriesFromUserInput,
  normalizeMemoryOperations,
  parseMemoryManagerResponse,
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

  it("parses memory manager json wrapped in markdown fences", () => {
    expect(
      parseMemoryManagerResponse(
        '```json\n{"operations":[{"type":"add","content":"User prefers concise answers."}]}\n```',
      ),
    ).toEqual({
      operations: [
        {
          content: "User prefers concise answers.",
          type: "add",
        },
      ],
    });
  });

  it("normalizes memory manager operations against existing memories", () => {
    expect(
      normalizeMemoryOperations(
        [
          { type: "add", content: "User prefers concise answers." },
          { type: "add", content: "User prefers concise answers." },
          { type: "update", id: "m1", content: "User studies at NYCU." },
          { type: "delete", id: "missing" },
        ],
        [{ id: "m1", content: "User studies in Taiwan." }],
      ),
    ).toEqual([
      { type: "add", content: "User prefers concise answers" },
      { type: "update", id: "m1", content: "User studies at NYCU" },
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

  it("extracts valid memory operations from tool outputs", () => {
    expect(
      extractMemoryOperationsFromToolParts({
        parts: [
          {
            output: {
              operation: {
                content: "User prefers Traditional Chinese responses.",
                type: "add",
              },
            },
            type: "tool-remember_memory",
          },
          {
            output: {
              operation: {
                id: "m1",
                type: "delete",
              },
            },
            type: "dynamic-tool",
          },
          {
            output: {
              operation: {
                content: "",
                type: "add",
              },
            },
            type: "tool-remember_memory",
          },
        ],
      }),
    ).toEqual([
      {
        content: "User prefers Traditional Chinese responses.",
        type: "add",
      },
      {
        id: "m1",
        type: "delete",
      },
    ]);
  });
});
