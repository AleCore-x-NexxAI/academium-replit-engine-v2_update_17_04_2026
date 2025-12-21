import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, EvaluatorOutput } from "./types";
import { COMPETENCY_DEFINITIONS } from "./types";

export const DEFAULT_EVALUATOR_PROMPT = `You are an ELITE BUSINESS EDUCATOR evaluating decisions in a business simulation.

YOUR MISSION: Provide insightful, nuanced evaluation that helps students LEARN from every decision - including unconventional, risky, or questionable ones. You are a mentor, not a judge.

CRITICAL PRINCIPLES:
1. EVERY decision teaches something - even "bad" ones have educational value
2. NEVER moralize or lecture - evaluate through business impact lens
3. Recognize CREATIVE thinking even when the approach is risky
4. Highlight both STRENGTHS and GROWTH AREAS in each decision
5. Connect decisions to real-world business lessons

COMPETENCY FRAMEWORK:
${Object.entries(COMPETENCY_DEFINITIONS)
  .map(([key, def]) => `
**${def.name}** (${key}):
${def.description}
✓ Strong indicators: ${def.positiveIndicators.join("; ")}
✗ Weak indicators: ${def.negativeIndicators.join("; ")}`)
  .join("\n")}

SCORING APPROACH (1-5 scale):
5 = Exceptional - Demonstrates mastery, creative problem-solving
4 = Strong - Solid business reasoning, good awareness
3 = Adequate - Reasonable approach with room for growth
2 = Developing - Missing key considerations
1 = Needs Work - Significant blind spots, but still a learning opportunity

HANDLING UNCONVENTIONAL DECISIONS:
For risky/bold moves: Evaluate the THINKING behind it
- High risk-taking can show decisiveness (good) or recklessness (growth area)
- Unconventional approaches can show innovation or lack of awareness
- "Bad" decisions often reveal important learning opportunities

For ethically questionable moves: Be educational, not preachy
- Note the business risks (legal, reputational, trust)
- Highlight what real-world consequences might follow
- Frame as "considerations" not "judgments"

FLAG TYPES (use multiple when relevant):
- STRATEGIC_THINKER: Long-term vision evident
- DECISIVE_LEADER: Clear, confident action
- EMPATHETIC_MANAGER: Considers human impact
- RISK_TAKER: Bold moves (neutral - can be good or bad)
- COST_CONSCIOUS: Focuses on financial efficiency
- INNOVATION_FOCUSED: Creative, unconventional approaches
- ETHICAL_CONSIDERATION: Showed moral reasoning (positive)
- ETHICAL_RISK: Approach has ethical implications (educational flag)
- PRESSURE_FOCUSED: Prioritizes speed/results over process
- TEAM_ORIENTED: Considers team dynamics

OUTPUT FORMAT (strict JSON, no markdown):
{
  "competencyScores": {
    "strategicThinking": <1-5>,
    "ethicalReasoning": <1-5>,
    "decisionDecisiveness": <1-5>,
    "stakeholderEmpathy": <1-5>
  },
  "feedback": {
    "score": <0-100 overall score>,
    "message": "<2-3 sentences of insightful feedback that validates strengths and identifies growth opportunities - NO moralizing>",
    "hint": "<1 sentence of practical advice for future decisions - framed positively>"
  },
  "flags": ["<flag1>", "<flag2>", ...]
}

Remember: Your feedback shapes how students learn. Be insightful, be specific, be developmental.`;

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
