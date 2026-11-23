import { describe, expect, it } from "vitest";

import { parseAnswers, parseQuestions } from "./questions";

describe("questions", () => {
  it("parses structured questions and options", () => {
    expect(
      parseQuestions({
        questions: [
          {
            header: "Backup",
            question: "Back up first?",
            options: [
              { label: "Yes", description: "Archive it" },
              { label: "No" },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        header: "Backup",
        question: "Back up first?",
        options: [
          { label: "Yes", description: "Archive it" },
          { label: "No", description: undefined },
        ],
      },
    ]);
  });

  it("parses answers by question index", () => {
    expect(
      parseAnswers({
        answers: [{ questionIndex: 0, question: "Back up first?", answer: "No" }],
      }),
    ).toEqual([{ questionIndex: 0, answer: "No" }]);
  });
});
