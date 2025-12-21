import type { KPIs, TurnResponse, SimulationState, Rubric, RubricCriterion, AgentPrompts, LLMModel } from "@shared/schema";
import type { SupportedModel } from "../openai";

export interface AgentContext {
  sessionId: string;
  turnCount: number;
  currentKpis: KPIs;
  history: { role: string; content: string; speaker?: string }[];
  studentInput: string;
  rubric?: Rubric;
  // Per-scenario LLM configuration
  llmModel?: SupportedModel;
  agentPrompts?: AgentPrompts;
  scenario: {
    title: string;
    domain: string;
    role: string;
    objective: string;
    // Enhanced context for better AI tailoring
    companyName?: string;
    industry?: string;
    companySize?: string;
    situationBackground?: string;
    stakeholders?: Array<{ name: string; role: string; interests: string; influence: string }>;
    keyConstraints?: string[];
    learningObjectives?: string[];
    difficultyLevel?: string;
    timelineContext?: string;
    ethicalDimensions?: string[];
    industryContext?: string;
    competitiveEnvironment?: string;
    resourceConstraints?: string;
    culturalContext?: string;
    regulatoryEnvironment?: string;
  };
}

export interface EvaluatorOutput {
  competencyScores: Record<string, number>;
  feedback: {
    score: number;
    message: string;
    hint?: string;
  };
  flags: string[];
}

export interface DomainExpertOutput {
  kpiDeltas: Record<string, number>;
  reasoning: string;
}

export interface NarratorOutput {
  text: string;
  speaker?: string;
  mood: "neutral" | "positive" | "negative" | "crisis";
  suggestedOptions?: string[];
}

export interface DirectorOutput extends TurnResponse {
  updatedState: SimulationState;
}

export const NPC_PERSONAS = {
  Marcus: {
    name: "Marcus",
    role: "CFO",
    trait: "Skeptical about costs",
    trigger: "financial decisions",
    prompt: "Always questions the financial impact. Speaks with caution about spending.",
  },
  Sarah: {
    name: "Sarah",
    role: "Operations Manager",
    trait: "Represents team morale",
    trigger: "team-related decisions",
    prompt: "Voices concerns about the team. Speaks with empathy but urgency.",
  },
  Victor: {
    name: "Victor",
    role: "Board Member",
    trait: "Demands immediate results",
    trigger: "performance concerns",
    prompt: "Aggressive, impatient. Focused on outcomes and shareholder value.",
  },
  Alex: {
    name: "Alex",
    role: "Junior Analyst",
    trait: "Ethical conscience",
    trigger: "ethical dilemmas",
    prompt: "Idealistic, questions if actions are right. Represents moral perspective.",
  },
} as const;

export const COMPETENCY_DEFINITIONS = {
  strategicThinking: {
    name: "Strategic Thinking",
    description: "Balancing long-term vs short-term goals",
    positiveIndicators: ["Sacrifices short-term profit for long-term growth", "Considers multiple stakeholders"],
    negativeIndicators: ["Fixates on immediate quarterly numbers only", "Ignores long-term consequences"],
  },
  ethicalReasoning: {
    name: "Ethical Reasoning",
    description: "Adhering to moral and legal standards",
    positiveIndicators: ["Prioritizes safety and honesty over profit", "Transparent communication"],
    negativeIndicators: ["Hides data", "Lies to stakeholders", "Cuts corners on safety"],
  },
  decisionDecisiveness: {
    name: "Decision Decisiveness",
    description: "Acting with confidence and clarity",
    positiveIndicators: ["Clear instructions", "Owns the outcome", "Takes responsibility"],
    negativeIndicators: ["Vague language", "Blames others", "Delays action unnecessarily"],
  },
  stakeholderEmpathy: {
    name: "Stakeholder Empathy",
    description: "Understanding impact on others",
    positiveIndicators: ["Acknowledges team feelings", "Considers customer pain points"],
    negativeIndicators: ["Ignores human cost", "Treats people as numbers"],
  },
} as const;

export const CAUSE_EFFECT_RULES = {
  crisisManagement: {
    denyEverything: {
      reputation: -20,
      trust: -15,
      morale: -5,
      reasoning: "The lie was caught, damaging reputation and trust.",
    },
    apologizeCompensate: {
      revenue: -10,
      reputation: 5,
      trust: 5,
      reasoning: "Costly but builds long-term trust and reputation.",
    },
    transparent: {
      reputation: 10,
      trust: 10,
      morale: 5,
      reasoning: "Transparency strengthens stakeholder relationships.",
    },
  },
  teamLeadership: {
    forcedOvertime: {
      efficiency: 10,
      morale: -15,
      reasoning: "Short-term productivity gain but team burnout.",
    },
    delayLaunch: {
      revenue: -5,
      morale: 5,
      reputation: -2,
      reasoning: "Team relief but disappointed customers.",
    },
    hireContractors: {
      revenue: -8,
      efficiency: 5,
      morale: 0,
      reasoning: "Cost-effective solution with minimal team impact.",
    },
  },
  financial: {
    cutCosts: {
      revenue: 5,
      morale: -10,
      efficiency: -5,
      reasoning: "Improved margins but reduced capacity.",
    },
    investGrowth: {
      revenue: -10,
      morale: 5,
      reputation: 5,
      reasoning: "Short-term cost for long-term positioning.",
    },
  },
} as const;
