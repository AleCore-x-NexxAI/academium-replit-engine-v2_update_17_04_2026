import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DomainExpertOutput } from "./types";
import { CAUSE_EFFECT_RULES } from "./types";

export const DEFAULT_DOMAIN_EXPERT_PROMPT = `You are a BUSINESS SIMULATION ENGINE calculating realistic consequences of management decisions.

YOUR MISSION: Calculate precise, realistic KPI impacts that make the simulation feel authentic and educational. Every decision should have meaningful, logical consequences.

THE 5 CORE KPIs:
1. **revenue** - Company financial health (in dollars, typically $100K-$500K range)
   - Affected by: sales, costs, efficiency, reputation
   - Typical deltas: -50000 to +30000 per decision

2. **morale** - Team emotional state and engagement (0-100%)
   - Affected by: workload, recognition, leadership, fairness
   - Typical deltas: -20 to +15 per decision
   - CRITICAL: Below 20% triggers game over

3. **reputation** - Brand and market perception (0-100%)
   - Affected by: public actions, quality, ethical behavior
   - Typical deltas: -25 to +10 per decision
   - CRITICAL: Below 20% triggers game over

4. **efficiency** - Operational productivity (0-100%)
   - Affected by: processes, resources, team health, tools
   - Typical deltas: -15 to +10 per decision
   - CRITICAL: Below 20% triggers game over

5. **trust** - Stakeholder confidence (0-100%)
   - Affected by: transparency, follow-through, consistency
   - Typical deltas: -20 to +10 per decision
   - CRITICAL: Below 20% triggers game over

IMPACT CALCULATION PRINCIPLES:

1. **Logical Causation**: Every impact must make business sense
   - Overtime → short-term efficiency UP, morale DOWN
   - Cost cuts → revenue UP, morale/efficiency at RISK
   - Transparency → trust UP, possible short-term costs

2. **Cascading Effects**: Major impacts cause ripples
   - Severely damaged morale → efficiency also drops
   - Loss of trust → reputation also suffers
   - Poor reputation → revenue affected

3. **Proportional Response**: Match impact to decision severity
   - Minor adjustments: ±2-5 points
   - Significant changes: ±5-12 points
   - Major/risky decisions: ±10-25 points

4. **Trade-offs Are Real**: Good decisions still have costs
   - Investing in team = short-term cost, long-term gain
   - Aggressive deadlines = short-term results, team burnout risk
   - Transparency = trust building but may expose vulnerabilities

5. **Unconventional Decisions**: Calculate real-world impacts
   - If someone suggests extreme measures, show realistic consequences
   - Don't prevent "bad" decisions - let consequences teach
   - Even well-intentioned risky moves should show realistic effects

COMMON PATTERNS:
${JSON.stringify(CAUSE_EFFECT_RULES, null, 2)}

OUTPUT FORMAT (strict JSON only):
{
  "kpiDeltas": {
    "revenue": <number in dollars, e.g., -15000 or 10000>,
    "morale": <percentage points change, e.g., -10 or 5>,
    "reputation": <percentage points change>,
    "efficiency": <percentage points change>,
    "trust": <percentage points change>
  },
  "reasoning": "<2-3 sentences explaining WHY these specific changes occur, connecting decision to consequences logically>"
}

EXAMPLES:

Decision: "Push the team to work overtime to meet the deadline"
{
  "kpiDeltas": {"revenue": 5000, "morale": -12, "reputation": 2, "efficiency": 8, "trust": -3},
  "reasoning": "The overtime push delivers short-term results and impresses stakeholders, but the team feels the strain. Some employees are quietly updating their LinkedIn profiles. Efficiency spikes temporarily but burnout risks are mounting."
}

Decision: "Be transparent with customers about the delay"
{
  "kpiDeltas": {"revenue": -8000, "morale": 5, "reputation": 8, "efficiency": 0, "trust": 12},
  "reasoning": "Some customers cancel, causing revenue loss, but the honest communication builds lasting trust. The team respects the ethical choice, boosting morale. Industry observers note the integrity."
}

Decision: "Give everyone coffee and a 2 month vacation"
{
  "kpiDeltas": {"revenue": -45000, "morale": 20, "reputation": 5, "efficiency": -30, "trust": -10},
  "reasoning": "The generous gesture dramatically boosts team happiness, but operations grind to a halt during the extended break. Stakeholders question the fiscal responsibility. The business loses momentum while competitors advance."
}

Remember: Your job is to make decisions FEEL consequential and realistic, not to punish or reward. Show cause and effect.`;

export async function calculateKPIImpact(context: AgentContext): Promise<DomainExpertOutput> {
  // Build rich context from enhanced scenario data
  const industryInfo = [];
  if (context.scenario.industry) industryInfo.push(`Industry: ${context.scenario.industry}`);
  if (context.scenario.companySize) industryInfo.push(`Company Size: ${context.scenario.companySize}`);
  if (context.scenario.companyName) industryInfo.push(`Company: ${context.scenario.companyName}`);
  
  const environmentInfo = [];
  if (context.scenario.industryContext) environmentInfo.push(`Industry dynamics: ${context.scenario.industryContext}`);
  if (context.scenario.competitiveEnvironment) environmentInfo.push(`Competition: ${context.scenario.competitiveEnvironment}`);
  if (context.scenario.regulatoryEnvironment) environmentInfo.push(`Regulations: ${context.scenario.regulatoryEnvironment}`);
  if (context.scenario.resourceConstraints) environmentInfo.push(`Resources: ${context.scenario.resourceConstraints}`);
  
  const constraintsInfo = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";

  const userPrompt = `
SIMULATION CONTEXT:
Scenario: "${context.scenario.title}"
Domain: ${context.scenario.domain}
${industryInfo.length > 0 ? industryInfo.join(" | ") : ""}
Student Role: ${context.scenario.role}
Difficulty: ${context.scenario.difficultyLevel || "intermediate"}

${environmentInfo.length > 0 ? `BUSINESS ENVIRONMENT:\n${environmentInfo.join("\n")}\n` : ""}
${constraintsInfo}

CURRENT KPI STATE:
- Revenue: $${context.currentKpis.revenue.toLocaleString()}
- Morale: ${context.currentKpis.morale}%
- Reputation: ${context.currentKpis.reputation}%
- Efficiency: ${context.currentKpis.efficiency}%
- Trust: ${context.currentKpis.trust}%

STUDENT'S DECISION: "${context.studentInput}"

RECENT CONTEXT:
${context.history.slice(-4).map((h) => `[${h.role}${h.speaker ? ` - ${h.speaker}` : ""}]: ${h.content}`).join("\n")}

TASK: Calculate the realistic business impact of this decision. Consider:
1. What would ACTUALLY happen in THIS specific industry/company context?
2. How do the BUSINESS ENVIRONMENT factors affect the impact?
3. What are the immediate effects on each KPI?
4. Are there cascading effects (e.g., morale affecting efficiency)?
5. Does this violate any CONSTRAINTS and what are the consequences?
6. Scale impacts to the ${context.scenario.difficultyLevel || "intermediate"} difficulty level

Provide your KPI calculations with clear business reasoning that references the specific context.`;

  // Use custom prompt if provided, otherwise use default
  const systemPrompt = context.agentPrompts?.domainExpert || DEFAULT_DOMAIN_EXPERT_PROMPT;
  
  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 768, model: context.llmModel }
    );

    const parsed = JSON.parse(response);
    
    const kpiDeltas = {
      revenue: typeof parsed.kpiDeltas?.revenue === 'number' ? parsed.kpiDeltas.revenue : 0,
      morale: typeof parsed.kpiDeltas?.morale === 'number' ? Math.max(-30, Math.min(25, parsed.kpiDeltas.morale)) : 0,
      reputation: typeof parsed.kpiDeltas?.reputation === 'number' ? Math.max(-30, Math.min(15, parsed.kpiDeltas.reputation)) : 0,
      efficiency: typeof parsed.kpiDeltas?.efficiency === 'number' ? Math.max(-25, Math.min(15, parsed.kpiDeltas.efficiency)) : 0,
      trust: typeof parsed.kpiDeltas?.trust === 'number' ? Math.max(-25, Math.min(15, parsed.kpiDeltas.trust)) : 0,
    };

    return {
      kpiDeltas,
      reasoning: parsed.reasoning || "The decision creates ripples across the organization, with effects varying by department and stakeholder group.",
    };
  } catch (error) {
    console.error("Domain expert agent error:", error);
    return {
      kpiDeltas: {
        revenue: -3000,
        morale: -2,
        reputation: -1,
        efficiency: -2,
        trust: -1,
      },
      reasoning: "The situation continues to evolve. While no major immediate impacts are apparent, the team is watching closely to see what happens next.",
    };
  }
}
