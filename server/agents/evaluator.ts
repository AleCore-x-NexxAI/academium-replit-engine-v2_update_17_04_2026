import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, EvaluatorOutput } from "./types";
import { COMPETENCY_DEFINITIONS } from "./types";

export const DEFAULT_EVALUATOR_PROMPT = `You are a COMPETENCY OBSERVER for SIMULEARN, an experiential decision training platform.

YOUR ROLE: Silently track learning competencies as students make decisions. You are an INTERNAL evaluator - your scores are for professor/system use only, NOT shown to students.

CRITICAL RULES (NON-NEGOTIABLE):
- You are NOT a grader visible to students
- NEVER moralize, lecture, or judge in feedback messages
- Your internal scoring tracks competency development over time
- Feedback messages should be NEUTRAL observations, not evaluations
- NEVER reveal scores, rankings, or comparative assessments

COMPETENCY FRAMEWORK (internal tracking):
${Object.entries(COMPETENCY_DEFINITIONS)
  .map(([key, def]) => `
**${def.name}** (${key}):
${def.description}
✓ Strong indicators: ${def.positiveIndicators.join("; ")}
✗ Development areas: ${def.negativeIndicators.join("; ")}`)
  .join("\n")}

INTERNAL SCORING (1-5, never shown to student):
5 = Demonstrates sophisticated understanding
4 = Shows solid competency
3 = Adequate application
2 = Developing awareness
1 = Early stage learning

HANDLING WEAK OR INCOMPLETE ANSWERS:
When a decision is weak or incomplete, your internal notes should:
1. Acknowledge what the student DID address
2. Note what considerations were missing (for professor dashboard)
3. Track whether the student is showing growth across decisions

IMPORTANT: Do NOT try to "fix" weak answers through feedback. That's not your role.

FLAG TYPES (internal tracking):
- STRATEGIC_THINKER: Shows long-term thinking
- DECISIVE_LEADER: Acts with clarity
- EMPATHETIC_MANAGER: Considers human impact
- RISK_AWARE: Recognizes trade-offs
- COST_CONSCIOUS: Considers resource implications
- NEEDS_DEEPER_ANALYSIS: Decision lacks thorough reasoning
- INCOMPLETE_RESPONSE: Missing key considerations

OUTPUT FORMAT (strict JSON, no markdown):
{
  "competencyScores": {
    "strategicThinking": <1-5>,
    "ethicalReasoning": <1-5>,
    "decisionDecisiveness": <1-5>,
    "stakeholderEmpathy": <1-5>
  },
  "feedback": {
    "score": <0-100 internal tracking score>,
    "message": "<1-2 sentences of NEUTRAL observation about what the decision addressed - NOT evaluative>",
    "hint": null
  },
  "flags": ["<flag1>", "<flag2>", ...]
}

Remember: Students never see your scores or evaluative feedback. Your role is to track learning for the professor dashboard.`;

export async function evaluateDecision(context: AgentContext): Promise<EvaluatorOutput> {
  const recentHistory = context.history.slice(-6).map((h) => {
    const prefix = h.speaker ? `${h.speaker} (${h.role})` : h.role;
    return `${prefix}: ${h.content}`;
  }).join("\n");

  // Build rich context from enhanced scenario data
  const learningGoals = context.scenario.learningObjectives?.length
    ? `LEARNING OBJECTIVES: ${context.scenario.learningObjectives.join("; ")}`
    : "";
  const ethicsContext = context.scenario.ethicalDimensions?.length
    ? `ETHICAL DIMENSIONS TO CONSIDER: ${context.scenario.ethicalDimensions.join("; ")}`
    : "";
  const stakeholderContext = context.scenario.stakeholders?.length
    ? `KEY STAKEHOLDERS: ${context.scenario.stakeholders.map(s => `${s.name} (${s.role})`).join(", ")}`
    : "";
  const constraintsContext = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const userPrompt = `
SIMULATION CONTEXT:
Scenario: "${context.scenario.title}"
Domain: ${context.scenario.domain}
${context.scenario.companyName ? `Company: ${context.scenario.companyName}` : ""}
${context.scenario.industry ? `Industry: ${context.scenario.industry}` : ""}
Student Role: ${context.scenario.role}
Objective: ${context.scenario.objective}
Difficulty: ${context.scenario.difficultyLevel || "intermediate"}
Turn: ${context.turnCount + 1}

${learningGoals}
${ethicsContext}
${stakeholderContext}
${constraintsContext}
${context.scenario.situationBackground ? `SITUATION: ${context.scenario.situationBackground}` : ""}

STUDENT'S DECISION: "${context.studentInput}"

CONVERSATION CONTEXT:
${recentHistory}

EVALUATION TASK:
Assess this decision across all four competencies. Remember:
- Evaluate against the specific LEARNING OBJECTIVES if provided
- Consider the ETHICAL DIMENSIONS relevant to this scenario
- Note how well the student considered KEY STAKEHOLDERS
- Account for CONSTRAINTS the student had to work within
- Be specific about what the student did well
- Frame growth areas constructively
- Match evaluation rigor to the DIFFICULTY level

Provide your comprehensive evaluation.`;

  // Use custom prompt if provided, otherwise use default
  const systemPrompt = context.agentPrompts?.evaluator || DEFAULT_EVALUATOR_PROMPT;
  
  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 1024, model: context.llmModel }
    );

    const parsed = JSON.parse(response);
    
    const competencyScores = {
      strategicThinking: Math.max(1, Math.min(5, parsed.competencyScores?.strategicThinking || 3)),
      ethicalReasoning: Math.max(1, Math.min(5, parsed.competencyScores?.ethicalReasoning || 3)),
      decisionDecisiveness: Math.max(1, Math.min(5, parsed.competencyScores?.decisionDecisiveness || 3)),
      stakeholderEmpathy: Math.max(1, Math.min(5, parsed.competencyScores?.stakeholderEmpathy || 3)),
    };

    const feedback = {
      score: Math.max(0, Math.min(100, parsed.feedback?.score || 50)),
      message: parsed.feedback?.message || "Your decision has been noted. Consider how it might impact different stakeholders as the situation evolves.",
      hint: parsed.feedback?.hint,
    };

    return {
      competencyScores,
      feedback,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    };
  } catch (error) {
    console.error("Evaluator agent error:", error);
    return {
      competencyScores: {
        strategicThinking: 3,
        ethicalReasoning: 3,
        decisionDecisiveness: 3,
        stakeholderEmpathy: 3,
      },
      feedback: {
        score: 50,
        message: "Your approach shows initiative. Consider how various stakeholders might react to this decision and what ripple effects it could create.",
        hint: "Think about both the immediate impact and the longer-term implications of your choices.",
      },
      flags: ["DECISION_MAKER"],
    };
  }
}
