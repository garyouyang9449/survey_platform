import type { Segment } from "@/lib/survey/questions";

export type GuideSegment = "all" | Segment;

export interface GuideQuestion {
  /** Stable id used by the agent's mark_question_answered client tool. */
  id: string;
  text: string;
  /** Short human topic used in progress UI and "welcome back" messaging. */
  topic: string;
  /** Which respondents this question applies to. */
  segment: GuideSegment;
  /** Whether it must be answered before the interview can be submitted. */
  required: boolean;
}

/**
 * The interview guide, verbatim from the assignment script. Ordering matches
 * the intended conversation flow: intro → core (all) → segment-specific →
 * closing (all). The intro is a readiness check and is NOT required for
 * completion; every substantive question is required.
 */
export const GUIDE: GuideQuestion[] = [
  // Introduction (all)
  {
    id: "intro_ready",
    text: "Thank you for participating in our survey. I'm going to ask you 10-15 questions about your car ownership experience. This should take about 10-15 minutes. Are you ready to begin?",
    topic: "getting started",
    segment: "all",
    required: false,
  },

  // Core questions (all)
  {
    id: "core_ownership_length",
    text: "How long have you owned your current vehicle?",
    topic: "how long you've owned your vehicle",
    segment: "all",
    required: true,
  },
  {
    id: "core_purchase_factors",
    text: "What were the main factors that influenced your decision to purchase this specific brand?",
    topic: "what influenced your purchase",
    segment: "all",
    required: true,
  },
  {
    id: "core_satisfaction",
    text: "On a scale of 1 to 10, how satisfied are you with your current vehicle?",
    topic: "your overall satisfaction",
    segment: "all",
    required: true,
  },
  {
    id: "core_valued_features",
    text: "What features or aspects of your car do you value most?",
    topic: "the features you value most",
    segment: "all",
    required: true,
  },
  {
    id: "core_issues",
    text: "Have you experienced any issues or concerns with your vehicle?",
    topic: "any issues or concerns",
    segment: "all",
    required: true,
  },

  // BMW customers (BMW owners)
  {
    id: "bmw_why_bmw",
    text: "What made you choose BMW over other luxury brands like Mercedes or Audi?",
    topic: "why you chose BMW",
    segment: "bmw_customer",
    required: true,
  },
  {
    id: "bmw_service_rating",
    text: "How would you rate BMW's customer service and dealership experience?",
    topic: "BMW's service and dealership experience",
    segment: "bmw_customer",
    required: true,
  },
  {
    id: "bmw_model_love",
    text: "Which BMW model do you own, and what do you love most about it?",
    topic: "your BMW model",
    segment: "bmw_customer",
    required: true,
  },
  {
    id: "bmw_repurchase",
    text: "How likely are you to purchase another BMW in the future? What would make you consider switching brands?",
    topic: "buying another BMW",
    segment: "bmw_customer",
    required: true,
  },
  {
    id: "bmw_improvements",
    text: "What could BMW improve to make your ownership experience even better?",
    topic: "what BMW could improve",
    segment: "bmw_customer",
    required: true,
  },

  // Potential BMW customers (Mercedes/Audi owners)
  {
    id: "pot_considered_bmw",
    text: "Have you ever considered purchasing a BMW? Why or why not?",
    topic: "whether you've considered a BMW",
    segment: "potential_customer",
    required: true,
  },
  {
    id: "pot_perceptions",
    text: "What perceptions or impressions do you have of the BMW brand?",
    topic: "your impressions of BMW",
    segment: "potential_customer",
    required: true,
  },
  {
    id: "pot_switch_trigger",
    text: "What would it take for you to switch to BMW for your next vehicle purchase?",
    topic: "what would make you switch to BMW",
    segment: "potential_customer",
    required: true,
  },
  {
    id: "pot_brand_advantage",
    text: "Compared to BMW, what do you think your current brand does better?",
    topic: "what your current brand does better",
    segment: "potential_customer",
    required: true,
  },
  {
    id: "pot_recommendation",
    text: "If you were to recommend a luxury car brand to a friend, which would you choose and why?",
    topic: "which luxury brand you'd recommend",
    segment: "potential_customer",
    required: true,
  },

  // Closing (all)
  {
    id: "closing_anything_else",
    text: "Is there anything else you'd like to share about your vehicle ownership experience?",
    topic: "anything else you'd like to share",
    segment: "all",
    required: true,
  },
];

/** Questions a given segment will be asked, in order (shared + segment-specific). */
export function guideForSegment(segment: Segment): GuideQuestion[] {
  return GUIDE.filter((q) => q.segment === "all" || q.segment === segment);
}

/** Ids of the questions that must be answered before submission for a segment. */
export function requiredQuestionIds(segment: Segment): string[] {
  return guideForSegment(segment)
    .filter((q) => q.required)
    .map((q) => q.id);
}

/** Whether a question id is valid for the given segment. */
export function isValidQuestionId(segment: Segment, id: string): boolean {
  return guideForSegment(segment).some((q) => q.id === id);
}
