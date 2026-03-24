import { describe, expect, it } from "vitest";

import {
  buildCouncilHostUserPrompt,
  formatCouncilTranscript,
  getCouncilPhaseLabel,
  splitCouncilResponse,
  type CouncilTranscriptEntry,
} from "./council";
import { FEATURED_MODELS } from "./models";

describe("council helpers", () => {
  it("formats transcript entries with phase labels", () => {
    const transcript = formatCouncilTranscript([
      {
        role: "user",
        round: 1,
        text: "Is AI companionship unhealthy?",
      },
      {
        modelLabel: "Claude 3.5 Haiku",
        phase: "reply",
        role: "assistant",
        round: 1,
        speakerRole: "panel",
        text: "I agree with GPT-5.4 Mini on dependency risk.",
      },
    ] satisfies CouncilTranscriptEntry[]);

    expect(transcript).toContain("User (round 1): Is AI companionship unhealthy?");
    expect(transcript).toContain(
      "Claude 3.5 Haiku (Panel reply, round 1): I agree with GPT-5.4 Mini on dependency risk.",
    );
  });

  it("builds a host synthesis prompt with the panel transcript", () => {
    const hostModel = FEATURED_MODELS[0];
    const panelModels = [FEATURED_MODELS[3], FEATURED_MODELS[4]];
    const prompt = buildCouncilHostUserPrompt({
      hostModel,
      panelModels,
      question: "Is AI companionship unhealthy?",
      round: 2,
      transcript:
        "Claude 3.5 Haiku (Opening take, round 2): It can help some lonely users.\n\nGemini 2.5 Flash (Opening take, round 2): It can also amplify avoidance.",
    });

    expect(prompt).toContain("Host: GPT-5.4 Mini");
    expect(prompt).toContain("Panel: Claude 3.5 Haiku, Gemini 2.5 Flash");
    expect(prompt).toContain("Full council transcript:");
  });

  it("labels host messages as host synthesis", () => {
    expect(getCouncilPhaseLabel("synthesis", "host")).toBe("Host synthesis");
  });

  it("strips hidden memory tags from council responses", () => {
    const result = splitCouncilResponse(
      "Final answer for the user.\n\n<memory>User is a student at NYCU</memory>",
    );

    expect(result.cleanText).toBe("Final answer for the user.");
    expect(result.memories).toEqual(["User is a student at NYCU"]);
  });
});
