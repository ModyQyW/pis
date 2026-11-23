export type QuestionOption = {
  label: string;
  description?: string;
};

export type Question = {
  header?: string;
  question: string;
  options: QuestionOption[];
};

export type QuestionAnswer = {
  questionIndex: number;
  answer: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function strings(value: unknown): value is string {
  return typeof value === "string";
}

export function parseQuestions(args: Record<string, unknown>): Question[] {
  const raw = args["questions"];
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const item of raw) {
    const entry = record(item);
    if (!entry) continue;
    const question = strings(entry["question"]) ? entry["question"] : "";
    if (!question) continue;
    const options: QuestionOption[] = [];
    if (Array.isArray(entry["options"])) {
      for (const value of entry["options"]) {
        const option = record(value);
        const label = option && strings(option["label"]) ? option["label"] : "";
        if (!label) continue;
        options.push({
          label,
          description:
            option && strings(option["description"]) ? option["description"] : undefined,
        });
      }
    }
    out.push({
      header: strings(entry["header"]) ? entry["header"] : undefined,
      question,
      options,
    });
  }
  return out;
}

export function parseAnswers(details: unknown): QuestionAnswer[] {
  const source = record(details);
  if (!source || !Array.isArray(source["answers"])) return [];
  const out: QuestionAnswer[] = [];
  for (const value of source["answers"]) {
    const answer = record(value);
    if (!answer) continue;
    const index = answer["questionIndex"];
    const text = answer["answer"];
    if (typeof index !== "number" || !strings(text)) continue;
    out.push({ questionIndex: index, answer: text });
  }
  return out;
}
