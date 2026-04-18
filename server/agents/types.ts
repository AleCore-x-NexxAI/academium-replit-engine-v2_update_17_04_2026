import type { KPIs, TurnResponse, SimulationState, Rubric, RubricCriterion, AgentPrompts, LLMModel, Indicator, DecisionPoint, DecisionEvidenceLogEntry } from "@shared/schema";
import type { SupportedModel } from "../openai";

export enum SignalQuality {
  STRONG = 3,
  PRESENT = 2,
  WEAK = 1,
  ABSENT = 0,
}

export enum RDSBand {
  SURFACE = "SURFACE",
  ENGAGED = "ENGAGED",
  INTEGRATED = "INTEGRATED",
}

export interface SignalScore {
  quality: SignalQuality;
  extracted_text: string;
}

export interface SignalExtractionResult {
  intent: SignalScore;
  justification: SignalScore;
  tradeoffAwareness: SignalScore;
  stakeholderAwareness: SignalScore;
  ethicalAwareness: SignalScore;
}

export type EvidenceLevel = "demonstrated" | "emerging" | "not_evidenced";

export interface CompetencyEvidence {
  C1: EvidenceLevel; // Analytical Reasoning
  C2: EvidenceLevel; // Strategic Decision-Making
  C3: EvidenceLevel; // Stakeholder Consideration
  C4: EvidenceLevel; // Ethical Reasoning
  C5: EvidenceLevel; // Systems Awareness
}

export interface DecisionEvidenceLog {
  signals_detected: SignalExtractionResult;
  rds_score: number | null;
  rds_band: RDSBand | null;
  competency_evidence: CompetencyEvidence;
  raw_signal_scores: {
    intent: number;
    justification: number;
    tradeoffAwareness: number;
    stakeholderAwareness: number;
    ethicalAwareness: number;
  };
  isMcq?: boolean;
}

export type InputClassificationType = "PASS" | "NUDGE" | "BLOCK";
export type BlockReason = "empty" | "safety" | "integrity" | "off_topic" | "insufficient_engagement";

export interface InputClassificationResult {
  classification: InputClassificationType;
  block_reason?: BlockReason;
  classification_rationale: string;
  nudge_questions?: string[];
  redirect_message?: string;
  integrity_flag?: boolean;
}

export function computeRDS(signals: SignalExtractionResult): number {
  return (
    signals.intent.quality +
    signals.justification.quality +
    signals.tradeoffAwareness.quality +
    signals.stakeholderAwareness.quality +
    signals.ethicalAwareness.quality
  );
}

export function classifyRDSBand(rds: number): RDSBand {
  if (rds >= 10) return RDSBand.INTEGRATED;
  if (rds >= 5) return RDSBand.ENGAGED;
  return RDSBand.SURFACE;
}

export function signalToEvidence(quality: SignalQuality): EvidenceLevel {
  if (quality >= SignalQuality.PRESENT) return "demonstrated";
  if (quality === SignalQuality.WEAK) return "emerging";
  return "not_evidenced";
}

export function mapCompetencyEvidence(signals: SignalExtractionResult): CompetencyEvidence {
  return {
    C1: signalToEvidence(signals.justification.quality),
    C2: signalToEvidence(Math.max(signals.intent.quality, signals.justification.quality) as SignalQuality),
    C3: signalToEvidence(Math.max(signals.stakeholderAwareness.quality, signals.ethicalAwareness.quality) as SignalQuality),
    C4: signalToEvidence(signals.ethicalAwareness.quality),
    C5: signalToEvidence(Math.max(signals.tradeoffAwareness.quality, signals.stakeholderAwareness.quality) as SignalQuality),
  };
}

export interface AgentContext {
  sessionId: string;
  turnCount: number;
  currentKpis: KPIs;
  indicators?: Indicator[];
  history: { role: string; content: string; speaker?: string }[];
  studentInput: string;
  rubric?: Rubric;
  llmModel?: SupportedModel;
  agentPrompts?: AgentPrompts;
  language?: "es" | "en";
  totalDecisions?: number;
  currentDecision?: number;
  decisionPoints?: DecisionPoint[];
  rdsBand?: RDSBand;
  signalExtractionResult?: SignalExtractionResult;
  nudgeCounters?: Record<number, number>;
  decisionEvidenceLogs?: DecisionEvidenceLogEntry[];
  integrityFlags?: boolean[];
  indicatorAccumulation?: Record<string, IndicatorAccumulation>;
  hintCounters?: Record<number, number>;
  framework_detections?: import("@shared/schema").FrameworkDetection[][];
  dashboard_summary?: import("@shared/schema").DashboardSummary;
  lastTurnNarrative?: string;
  scenario: {
    title: string;
    domain: string;
    role: string;
    objective: string;
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
    subjectMatterContext?: string;
    frameworks?: import("@shared/schema").CaseFramework[];
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

// POC Tier classification for metric changes
export type MetricTier = 1 | 2 | 3;
// Tier 1: ±1-3, Tier 2: ±4-7, Tier 3: ±8-12 (rare, event-level)

export interface MetricExplanation {
  shortReason: string; // One-line visible explanation
  causalChain: string[]; // 2-4 bullet expandable chain: what→why→effect→magnitude
  tier: MetricTier;
}

export type TurnPosition = "FIRST" | "INTERMEDIATE" | "FINAL";

export type KPITrajectory = "positive" | "negative" | "mixed" | "neutral";

export interface IndicatorAccumulation {
  trajectory: KPITrajectory;
  consecutiveNegativeTurns: number;
  consecutivePositiveTurns: number;
  lastTier: MetricTier | null;
  totalMovements: number;
  firstAppearanceTurn: number | null;
}

export interface DisplayKPI {
  indicatorId: string;
  label: string;
  direction: "up" | "down";
  magnitude: "Ligero" | "Moderado" | "Significativo";
  magnitudeEn: "Slight" | "Moderate" | "Significant";
  tier: MetricTier;
  delta: number;
  shortReason: string;
}

export interface CausalExplanation {
  indicatorId: string;
  decisionReference: string;
  causalMechanism: string;
  directionalConnection: string;
  dashboardReasoningLink?: string;
}

export interface DomainExpertOutput {
  kpiDeltas: Record<string, number>;
  indicatorDeltas?: Record<string, number>;
  reasoning: string;
  expertInsight?: string;
  metricExplanations?: Record<string, MetricExplanation>;
  displayKPIs?: DisplayKPI[];
  indicatorAccumulation?: Record<string, IndicatorAccumulation>;
  antiPatternCorrections?: string[];
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

export interface DepthEvaluatorOutput {
  isDeepEnough: boolean;
  revisionPrompt?: string;
  missingConsiderations?: string[];
  strengthsAcknowledged?: string;
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
