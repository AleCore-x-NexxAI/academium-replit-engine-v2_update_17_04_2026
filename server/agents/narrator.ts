import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, NarratorOutput, DomainExpertOutput, EvaluatorOutput } from "./types";

export const DEFAULT_NARRATOR_PROMPT = `You are a CONSEQUENCE NARRATOR for SIMULEARN, an experiential decision training platform.

YOUR ROLE: Present the realistic outcomes of decisions in a professional, educational manner.

CRITICAL RULES (NON-NEGOTIABLE):
- You are NOT a grader, teacher, judge, or solution-giver
- NEVER reveal "optimal" decisions or correct answers
- NEVER moralize or lecture - present facts and consequences
- Maintain calm, professional, academically appropriate tone
- Present trade-offs, not "right/wrong" judgments

RESPONSE STRUCTURE:
1. CONSEQUENCE STATEMENT (1-2 sentences): What happened as a direct result of the decision
2. STAKEHOLDER REACTION (1 sentence): How affected parties responded
3. FORWARD PRESSURE (1 sentence): What new tension or situation this creates

TONE REQUIREMENTS:
- Calm and encouraging
- Constructive and realistic
- Academically professional
- Never emotional, sarcastic, or judgmental

HANDLING WEAK ANSWERS:
If a decision is incomplete or weak, do NOT correct it. Instead:
- Acknowledge the decision was made
- Show realistic consequences of that incomplete approach
- Create forward pressure that naturally prompts deeper thinking

OUTPUT FORMAT (strict JSON only):
{
  "text": "<60-100 word response following the structure above>",
  "mood": "neutral" | "positive" | "negative" | "crisis",
  "forwardPrompt": "<Optional: A brief setup for what needs attention next>"
}

EXAMPLE GOOD RESPONSE:
{
  "text": "The delay announcement reached key stakeholders before the press. Customer service received 15% fewer complaint calls than projected for an unannounced delay. However, the board is now requesting a detailed explanation of the root cause and prevention measures. The engineering team awaits direction on whether to prioritize the fix or continue with planned features.",
  "mood": "neutral",
  "forwardPrompt": "The board meeting is scheduled for tomorrow morning."
}

EXAMPLE BAD RESPONSE (too dramatic, NPC-focused):
"Sarah's eyes widen as she processes your bold decision. The room falls silent..."

Remember: You show CONSEQUENCES, not drama. Educational value comes from seeing cause and effect clearly.`;

export async function generateNarrative(
  context: AgentContext,
  kpiImpact: DomainExpertOutput,
  evaluation: EvaluatorOutput
): Promise<NarratorOutput> {
  const indicatorSummary = kpiImpact.indicatorDeltas
    ? Object.entries(kpiImpact.indicatorDeltas)
        .filter(([_, v]) => v !== 0)
        .map(([k, v]) => {
          const direction = v > 0 ? "increased" : "decreased";
          const intensity = Math.abs(v) >= 10 ? "significantly" : "slightly";
          return `${k} ${intensity} ${direction}`;
        })
        .join(", ")
    : Object.entries(kpiImpact.kpiDeltas)
        .filter(([_, v]) => v !== 0)
        .map(([k, v]) => {
          const direction = v > 0 ? "increased" : "decreased";
          const intensity = Math.abs(v) >= 10 ? "significantly" : "moderately";
          return `${k} ${intensity} ${direction}`;
        })
        .join(", ");

  const scenarioContext = [];
  if (context.scenario.companyName) scenarioContext.push(`Company: ${context.scenario.companyName}`);
  if (context.scenario.industry) scenarioContext.push(`Industry: ${context.scenario.industry}`);
  if (context.scenario.companySize) scenarioContext.push(`Company Size: ${context.scenario.companySize}`);
  if (context.scenario.timelineContext) scenarioContext.push(`Timeline: ${context.scenario.timelineContext}`);
  
  const constraintsInfo = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const decisionInfo = context.totalDecisions
    ? `DECISION: ${context.turnCount + 1} of ${context.totalDecisions}`
    : `TURN: ${context.turnCount + 1}`;

  const expertInsight = kpiImpact.expertInsight
    ? `EXPERT INSIGHT: ${kpiImpact.expertInsight}`
    : "";

  const userPrompt = `
SCENARIO: "${context.scenario.title}"
DOMAIN: ${context.scenario.domain}
${scenarioContext.length > 0 ? scenarioContext.join(" | ") : ""}
STUDENT ROLE: ${context.scenario.role}
OBJECTIVE: ${context.scenario.objective}
${decisionInfo}

${constraintsInfo}

STUDENT'S DECISION:
"${context.studentInput}"

IMPACT ANALYSIS:
${kpiImpact.reasoning}
Indicator changes: ${indicatorSummary || "No significant changes"}
${expertInsight}

EVALUATION NOTES:
${evaluation.feedback.message}
Observed patterns: ${evaluation.flags.join(", ") || "None specific"}

Generate a consequence-focused narrative response. Show what happened, how stakeholders reacted, and what tension exists going forward.
Return ONLY valid JSON matching the specified format.`;

  const systemPrompt = context.agentPrompts?.narrator || DEFAULT_NARRATOR_PROMPT;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", model: context.llmModel }
  );

  try {
    const parsed = JSON.parse(response);
    return {
      text: parsed.text || "Your decision has been recorded. The situation continues to evolve.",
      mood: parsed.mood || "neutral",
      suggestedOptions: parsed.suggestedOptions || [],
    };
  } catch {
    return {
      text: "Your decision has been recorded. The organization adjusts to your approach.",
      mood: "neutral",
      suggestedOptions: [],
    };
  }
}
