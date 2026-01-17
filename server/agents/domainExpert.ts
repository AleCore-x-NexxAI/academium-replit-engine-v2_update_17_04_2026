import { generateChatCompletion, SupportedModel } from "../openai";
import type { AgentContext, DomainExpertOutput } from "./types";
import { CAUSE_EFFECT_RULES } from "./types";

export const DEFAULT_DOMAIN_EXPERT_PROMPT = `You are a SUBJECT MATTER EXPERT and BUSINESS ANALYST for SIMULEARN, an educational decision-training platform.

YOUR DUAL ROLE:
1. **Subject Matter Expert**: You have deep expertise in the scenario's domain. You understand the real-world implications, industry standards, and best practices.
2. **Impact Analyst**: You calculate realistic consequences of decisions on key indicators.

CRITICAL RULES:
- ALWAYS justify your analysis with real-world reasoning
- CITE where your knowledge comes from (industry practice, research, common business logic)
- NEVER make arbitrary judgments - every impact must be explainable
- You are an EXPERT, not a judge - explain cause and effect, not "good" or "bad"

THE 5 POC INDICATORS (adjust impacts based on scenario context):
1. **teamMorale** (0-100) - Team emotional state and engagement
   - Affected by: workload, recognition, leadership decisions, fairness
   - Real-world basis: Employee satisfaction studies, organizational psychology

2. **budgetImpact** (0-100) - Financial health and resource availability
   - Affected by: spending decisions, revenue implications, cost management
   - Real-world basis: Business finance principles, budget management best practices

3. **operationalRisk** (0-100) - Level of operational uncertainty/danger
   - Affected by: process changes, compliance issues, execution challenges
   - Real-world basis: Risk management frameworks, operational excellence standards

4. **strategicAlignment** (0-100) - How well decisions align with organizational goals
   - Affected by: decision consistency, long-term thinking, stakeholder alignment
   - Real-world basis: Strategic management theory, corporate governance

5. **timePressure** (0-100) - Urgency and deadline stress
   - Affected by: schedule decisions, scope changes, resource allocation
   - Real-world basis: Project management principles, time-to-market dynamics

IMPACT CALCULATION PRINCIPLES:
1. **Logical Causation**: Every impact must make real-world sense
2. **Trade-offs Are Real**: Good decisions still have costs
3. **Proportional Response**: Match impact to decision severity (±2-5 minor, ±5-12 significant, ±10-25 major)
4. **Source Your Reasoning**: Explain WHY based on business/industry knowledge

OUTPUT FORMAT (strict JSON only):
{
  "indicatorDeltas": {
    "teamMorale": <number -25 to +25>,
    "budgetImpact": <number -25 to +25>,
    "operationalRisk": <number -25 to +25>,
    "strategicAlignment": <number -25 to +25>,
    "timePressure": <number -25 to +25>
  },
  "reasoning": "<2-3 sentences explaining WHY these changes occur, with real-world justification>",
  "expertInsight": "<1-2 sentences of domain expertise context - what a real professional would know about this situation>"
}

EXAMPLE:
Decision: "Delay the product launch by 2 weeks to fix quality issues"
{
  "indicatorDeltas": {"teamMorale": 5, "budgetImpact": -8, "operationalRisk": -15, "strategicAlignment": 10, "timePressure": -10},
  "reasoning": "Quality-focused delays typically reduce operational risk significantly (based on software industry post-mortems showing 3x cost of fixing issues after launch). Budget takes a hit from extended development costs, but team morale improves when quality is prioritized over rush.",
  "expertInsight": "In product management, the '1-10-100 rule' suggests fixing a defect in design costs $1, in development $10, and post-release $100. This decision follows established quality management principles."
}`;

export async function calculateKPIImpact(context: AgentContext): Promise<DomainExpertOutput> {
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

  const subjectMatterInfo = context.scenario.subjectMatterContext
    ? `SUBJECT MATTER CONTEXT:\n${context.scenario.subjectMatterContext}`
    : "";

  const currentIndicators = context.indicators
    ? `CURRENT INDICATORS:\n${context.indicators.map(i => `- ${i.label}: ${i.value}`).join("\n")}`
    : `CURRENT INDICATORS:\n- Team Morale: ${context.currentKpis.morale}\n- Budget Impact: 50\n- Operational Risk: 50\n- Strategic Alignment: 50\n- Time Pressure: 50`;

  const userPrompt = `
SIMULATION CONTEXT:
Scenario: "${context.scenario.title}"
Domain: ${context.scenario.domain}
${industryInfo.length > 0 ? industryInfo.join(" | ") : ""}
Student Role: ${context.scenario.role}
Difficulty: ${context.scenario.difficultyLevel || "intermediate"}

${environmentInfo.length > 0 ? `BUSINESS ENVIRONMENT:\n${environmentInfo.join("\n")}\n` : ""}
${constraintsInfo}
${subjectMatterInfo}

${currentIndicators}

DECISION NUMBER: ${context.turnCount + 1}${context.totalDecisions ? ` of ${context.totalDecisions}` : ""}

STUDENT'S DECISION:
"${context.studentInput}"

As the Subject Matter Expert, analyze this decision and calculate indicator impacts with real-world justification.
Return ONLY valid JSON matching the specified format.`;

  const systemPrompt = context.agentPrompts?.domainExpert || DEFAULT_DOMAIN_EXPERT_PROMPT;

  const response = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { responseFormat: "json", model: context.llmModel }
  );

  try {
    const parsed = JSON.parse(response);
    
    // Map new indicator format to legacy KPI format for backward compatibility
    const indicatorDeltas = parsed.indicatorDeltas || {};
    const kpiDeltas = {
      revenue: indicatorDeltas.budgetImpact ? indicatorDeltas.budgetImpact * 1000 : 0,
      morale: indicatorDeltas.teamMorale || 0,
      reputation: indicatorDeltas.strategicAlignment || 0,
      efficiency: -(indicatorDeltas.operationalRisk || 0),
      trust: indicatorDeltas.strategicAlignment || 0,
    };

    return {
      kpiDeltas,
      indicatorDeltas,
      reasoning: parsed.reasoning || "Impact calculated based on decision analysis.",
      expertInsight: parsed.expertInsight || "",
    };
  } catch {
    return {
      kpiDeltas: { revenue: 0, morale: 0, reputation: 0, efficiency: 0, trust: 0 },
      indicatorDeltas: {},
      reasoning: "Unable to calculate precise impact. Decision noted.",
      expertInsight: "",
    };
  }
}
