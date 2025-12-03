import { generateChatCompletion } from "../openai";
import type { AgentContext, DomainExpertOutput } from "./types";
import { CAUSE_EFFECT_RULES } from "./types";

const DOMAIN_EXPERT_SYSTEM_PROMPT = `You are the BusinessLogicEngine agent for SIMULEARN, a business simulation engine.
Your role is to calculate the quantitative impact of the student's decision on KPIs.

You MUST output valid JSON with no markdown formatting.

The 5 Core KPIs:
1. revenue - Financial health (absolute value in dollars)
2. morale - Team morale (percentage 0-100)
3. reputation - Brand reputation (percentage 0-100)
4. efficiency - Operational efficiency (percentage 0-100)
5. trust - Stakeholder trust (percentage 0-100)

Rules:
- Any KPI below 20% triggers a game-over condition
- Decisions have both immediate and secondary effects
- Consider cascading impacts (e.g., low morale → lower efficiency)

Common Cause-Effect Patterns:
${JSON.stringify(CAUSE_EFFECT_RULES, null, 2)}

Output Schema:
{
  "kpiDeltas": {
    "revenue": <delta as absolute value or percentage for %-based KPIs>,
    "morale": <delta as percentage points>,
    "reputation": <delta as percentage points>,
    "efficiency": <delta as percentage points>,
    "trust": <delta as percentage points>
  },
  "reasoning": "<brief explanation of why these changes occur>"
}

Be realistic and consequential. Bad decisions should have negative impacts.
Typical delta ranges: -20 to +15 for percentage KPIs, -50000 to +30000 for revenue.`;

export async function calculateKPIImpact(context: AgentContext): Promise<DomainExpertOutput> {
  const userPrompt = `
Scenario: ${context.scenario.title} (${context.scenario.domain})
Student Role: ${context.scenario.role}

Current KPIs:
- Revenue: $${context.currentKpis.revenue.toLocaleString()}
- Morale: ${context.currentKpis.morale}%
- Reputation: ${context.currentKpis.reputation}%
- Efficiency: ${context.currentKpis.efficiency}%
- Trust: ${context.currentKpis.trust}%

Student's Decision: "${context.studentInput}"

Recent Context:
${context.history
  .slice(-3)
  .map((h) => `${h.role}: ${h.content}`)
  .join("\n")}

Calculate the KPI impact of this decision. Consider direct and indirect effects.`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: DOMAIN_EXPERT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 512 }
    );

    const parsed = JSON.parse(response);
    return {
      kpiDeltas: parsed.kpiDeltas || {
        revenue: 0,
        morale: 0,
        reputation: 0,
        efficiency: 0,
        trust: 0,
      },
      reasoning: parsed.reasoning || "Impact calculated based on decision analysis.",
    };
  } catch (error) {
    console.error("Domain expert agent error:", error);
    return {
      kpiDeltas: {
        revenue: -5000,
        morale: -2,
        reputation: -2,
        efficiency: -2,
        trust: -2,
      },
      reasoning: "Uncertainty in the decision led to minor negative impacts across metrics.",
    };
  }
}
