import { generateChatCompletion } from "../openai";
import type { AgentContext, EvaluatorOutput } from "./types";
import { COMPETENCY_DEFINITIONS } from "./types";

const EVALUATOR_SYSTEM_PROMPT = `You are the CompetencyAssessor agent for SIMULEARN, a business simulation engine.
Your role is to evaluate the student's decision against competency criteria.

You MUST output valid JSON with no markdown formatting.

Competency Framework:
${Object.entries(COMPETENCY_DEFINITIONS)
  .map(
    ([key, def]) =>
      `- ${def.name}: ${def.description}
   Positive: ${def.positiveIndicators.join(", ")}
   Negative: ${def.negativeIndicators.join(", ")}`
  )
  .join("\n")}

For each competency, assign a score from 1-5:
1 = Very Poor, 2 = Below Average, 3 = Average, 4 = Good, 5 = Excellent

Also identify any flags (e.g., RISK_TAKER, ETHICAL_LAPSE, STRONG_LEADER, COST_FOCUSED).

Output Schema:
{
  "competencyScores": {
    "strategicThinking": <number 1-5>,
    "ethicalReasoning": <number 1-5>,
    "decisionDecisiveness": <number 1-5>,
    "stakeholderEmpathy": <number 1-5>
  },
  "feedback": {
    "score": <number 0-100>,
    "message": "<constructive feedback about the decision>",
    "hint": "<optional guidance for improvement>"
  },
  "flags": ["<flag1>", "<flag2>"]
}`;

export async function evaluateDecision(context: AgentContext): Promise<EvaluatorOutput> {
  const userPrompt = `
Scenario: ${context.scenario.title} (${context.scenario.domain})
Student Role: ${context.scenario.role}
Objective: ${context.scenario.objective}

Current Turn: ${context.turnCount + 1}
Student's Decision: "${context.studentInput}"

Recent Context:
${context.history
  .slice(-4)
  .map((h) => `${h.role}: ${h.content}`)
  .join("\n")}

Evaluate this decision against the competency framework and provide structured feedback.`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 1024 }
    );

    const parsed = JSON.parse(response);
    return {
      competencyScores: parsed.competencyScores || {
        strategicThinking: 3,
        ethicalReasoning: 3,
        decisionDecisiveness: 3,
        stakeholderEmpathy: 3,
      },
      feedback: parsed.feedback || {
        score: 50,
        message: "Decision noted. Consider the broader implications.",
      },
      flags: parsed.flags || [],
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
        message: "Your decision has been recorded. Consider the impact on all stakeholders.",
      },
      flags: [],
    };
  }
}
