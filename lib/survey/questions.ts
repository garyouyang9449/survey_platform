export type Segment = "bmw_customer" | "potential_customer";

export type OptionEffect =
  | { kind: "terminate" }
  | { kind: "qualify"; segment: Segment };

export interface QuestionOption {
  value: string;
  label: string;
  /** Undefined = neutral option (no branching consequence on its own). */
  effect?: OptionEffect;
}

export interface Question {
  id: string;
  prompt: string;
  type: "single" | "multi";
  options: QuestionOption[];
}

/**
 * Screening survey definition. Branching/terminate/qualify rules are encoded
 * declaratively here and interpreted by lib/survey/logic.ts. The server is the
 * sole authority for outcomes — the client only renders these.
 */
export const QUESTIONS: Question[] = [
  {
    id: "age",
    prompt: "How old are you?",
    type: "single",
    options: [
      { value: "under_18", label: "Under 18", effect: { kind: "terminate" } },
      { value: "18_24", label: "18–24" },
      { value: "25_34", label: "25–34" },
      { value: "35_44", label: "35–44" },
      { value: "45_54", label: "45–54" },
      { value: "55_64", label: "55–64" },
      { value: "65_plus", label: "65+" },
    ],
  },
  {
    id: "income",
    prompt: "What is your annual household income?",
    type: "single",
    options: [
      { value: "under_25k", label: "Under $25,000" },
      { value: "25k_49k", label: "$25,000–$49,999" },
      { value: "50k_74k", label: "$50,000–$74,999" },
      { value: "75k_99k", label: "$75,000–$99,999" },
      { value: "100k_149k", label: "$100,000–$149,999" },
      { value: "150k_plus", label: "$150,000+" },
    ],
  },
  {
    id: "owns_car",
    prompt: "Do you currently own a car?",
    type: "single",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No", effect: { kind: "terminate" } },
    ],
  },
  {
    id: "brand",
    prompt: "Which car brand do you currently own? (Select all that apply)",
    type: "multi",
    options: [
      {
        value: "bmw",
        label: "BMW",
        effect: { kind: "qualify", segment: "bmw_customer" },
      },
      {
        value: "mercedes",
        label: "Mercedes-Benz",
        effect: { kind: "qualify", segment: "potential_customer" },
      },
      {
        value: "audi",
        label: "Audi",
        effect: { kind: "qualify", segment: "potential_customer" },
      },
      { value: "toyota", label: "Toyota", effect: { kind: "terminate" } },
      { value: "honda", label: "Honda", effect: { kind: "terminate" } },
      { value: "ford", label: "Ford", effect: { kind: "terminate" } },
      { value: "tesla", label: "Tesla", effect: { kind: "terminate" } },
      { value: "other", label: "Other", effect: { kind: "terminate" } },
    ],
  },
];

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export const TOTAL_QUESTIONS = QUESTIONS.length;
