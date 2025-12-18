import { generateChatCompletion } from "../openai";
import type { AgentContext, NarratorOutput, DomainExpertOutput, EvaluatorOutput } from "./types";
import { NPC_PERSONAS } from "./types";

const NARRATOR_SYSTEM_PROMPT = `You are a BUSINESS SIMULATION narrator for SIMULEARN, an educational platform.

YOUR GOAL: Create short, clear responses that show the outcome of decisions through dialogue and direct consequences.

RESPONSE STRUCTURE (follow this order):
1. NPC DIALOGUE (1-2 sentences): The relevant person reacts to your decision
2. OUTCOME (1-2 sentences): What happened as a direct result - be specific about the business impact
3. NEXT SITUATION (1 sentence): A brief setup for what needs attention next

STYLE RULES:
- Keep it SHORT: 50-80 words maximum
- Be DIRECT: "This caused X" not "The weight of your decision hung in the air..."
- Use DIALOGUE: Let the NPC speak directly, not described third-person
- Show CONSEQUENCES: State clearly what changed - "Customers responded positively" not vague descriptions
- NO FANTASY: No dramatic prose, no "the room goes silent", no "eyes turn to you"
- EDUCATIONAL: The learner should understand cause and effect

EXAMPLE GOOD RESPONSE:
"Sarah nods. 'Good call on the transparency - I'll draft the customer notice now.' The early disclosure prevented media speculation, and your reputation score held steady. However, the legal team flagged that we need to notify regulators within 48 hours."

EXAMPLE BAD RESPONSE (too long, too dramatic):
"The room falls silent as your words hang in the air. Sarah's eyes widen slightly, her hands gripping the edge of the conference table. A mixture of surprise and respect crosses her face as she processes the implications of your bold decision..."

AVAILABLE NPCs:
${Object.entries(NPC_PERSONAS)
  .map(([name, npc]) => `${npc.name} (${npc.role}): ${npc.trait}`)
  .join("\n")}

MOOD:
- positive: Good outcome, progress
- negative: Problems, setbacks
- crisis: Urgent, critical
- neutral: Standard situation

OUTPUT FORMAT (strict JSON only):
{
  "text": "<50-80 word response: NPC dialogue + outcome + next situation>",
  "speaker": "<NPC name>",
  "mood": "positive" | "negative" | "crisis" | "neutral",
  "suggestedOptions": ["<option 1>", "<option 2>", "<option 3>"]
}`;

export async function generateNarrative(
  context: AgentContext,
  kpiImpact: DomainExpertOutput,
  evaluation: EvaluatorOutput
): Promise<NarratorOutput> {
  const selectNPC = (): string | null => {
    const input = context.studentInput.toLowerCase();
    const flags = evaluation.flags.join(" ").toLowerCase();
    const kpiDeltas = kpiImpact.kpiDeltas;

    if (kpiDeltas.morale && kpiDeltas.morale <= -10) return "Sarah";
    if (kpiDeltas.revenue && Math.abs(kpiDeltas.revenue) >= 10000) return "Marcus";
    if (flags.includes("ethical") || flags.includes("questionable") || flags.includes("risky")) return "Alex";
    if (kpiDeltas.efficiency && kpiDeltas.efficiency >= 5) return "Victor";
    
    if (input.includes("cost") || input.includes("budget") || input.includes("money") || input.includes("spend")) {
      return "Marcus";
    }
    if (input.includes("team") || input.includes("employee") || input.includes("people") || input.includes("work") || input.includes("overtime")) {
      return "Sarah";
    }
    if (input.includes("deadline") || input.includes("launch") || input.includes("deliver") || input.includes("push") || input.includes("faster")) {
      return "Victor";
    }
    if (input.includes("right") || input.includes("wrong") || input.includes("honest") || input.includes("lie") || input.includes("ethical")) {
      return "Alex";
    }
    
    const randomNPCs = ["Marcus", "Sarah", "Victor", "Alex"];
    return randomNPCs[Math.floor(Math.random() * randomNPCs.length)];
  };

  const selectedNpc = selectNPC();
  const npcContext = selectedNpc ? NPC_PERSONAS[selectedNpc as keyof typeof NPC_PERSONAS] : null;

  const kpiSummary = Object.entries(kpiImpact.kpiDeltas)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => {
      const direction = v > 0 ? "increased" : "decreased";
      const intensity = Math.abs(v) >= 10 ? "significantly" : "slightly";
      return `${k} ${intensity} ${direction}`;
    })
    .join(", ");

  // Build rich context from enhanced scenario data
  const scenarioContext = [];
  if (context.scenario.companyName) scenarioContext.push(`Company: ${context.scenario.companyName}`);
  if (context.scenario.industry) scenarioContext.push(`Industry: ${context.scenario.industry}`);
  if (context.scenario.companySize) scenarioContext.push(`Company Size: ${context.scenario.companySize}`);
  if (context.scenario.timelineContext) scenarioContext.push(`Timeline: ${context.scenario.timelineContext}`);
  
  const environmentContext = [];
  if (context.scenario.industryContext) environmentContext.push(`Industry Dynamics: ${context.scenario.industryContext}`);
  if (context.scenario.competitiveEnvironment) environmentContext.push(`Competitive Landscape: ${context.scenario.competitiveEnvironment}`);
  if (context.scenario.regulatoryEnvironment) environmentContext.push(`Regulations: ${context.scenario.regulatoryEnvironment}`);
  if (context.scenario.culturalContext) environmentContext.push(`Cultural Factors: ${context.scenario.culturalContext}`);
  if (context.scenario.resourceConstraints) environmentContext.push(`Resources: ${context.scenario.resourceConstraints}`);
  
  const stakeholderInfo = context.scenario.stakeholders?.length 
    ? `KEY STAKEHOLDERS:\n${context.scenario.stakeholders.map(s => `- ${s.name} (${s.role}): ${s.interests} [${s.influence} influence]`).join("\n")}`
    : "";
    
  const constraintsInfo = context.scenario.keyConstraints?.length
    ? `CONSTRAINTS: ${context.scenario.keyConstraints.join("; ")}`
    : "";
    
  const ethicsInfo = context.scenario.ethicalDimensions?.length
    ? `ETHICAL CONSIDERATIONS: ${context.scenario.ethicalDimensions.join("; ")}`
    : "";

  const userPrompt = `
SCENARIO: "${context.scenario.title}"
DOMAIN: ${context.scenario.domain}
${scenarioContext.length > 0 ? scenarioContext.join(" | ") : ""}
STUDENT ROLE: ${context.scenario.role}
OBJECTIVE: ${context.scenario.objective}
DIFFICULTY: ${context.scenario.difficultyLevel || "intermediate"}
TURN NUMBER: ${context.turnCount + 1}

${context.scenario.situationBackground ? `SITUATION BACKGROUND:\n${context.scenario.situationBackground}\n` : ""}
${environmentContext.length > 0 ? `ENVIRONMENT:\n${environmentContext.join("\n")}\n` : ""}
${stakeholderInfo}
${constraintsInfo}
${ethicsInfo}

THE STUDENT'S DECISION: "${context.studentInput}"

CONSEQUENCES HAPPENING:
- KPI Changes: ${kpiSummary || "Subtle shifts in the landscape"}
- Business Logic: ${kpiImpact.reasoning}
- Evaluation Flags: ${evaluation.flags.length ? evaluation.flags.join(", ") : "Standard business decision"}

RECENT HISTORY:
${context.history.slice(-3).map((h) => `[${h.role}${h.speaker ? ` - ${h.speaker}` : ""}]: ${h.content}`).join("\n")}

NPC TO USE: ${npcContext ? `${npcContext.name} (${npcContext.role})` : "Choose the most relevant person for this situation."}

WRITE: A short response (50-80 words) with:
1. The NPC's direct dialogue reaction
2. The specific outcome/consequence
3. What needs attention next`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: NARRATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 400 }
    );

    const parsed = JSON.parse(response);
    
    const text = parsed.text || "The team acknowledges your decision. The situation is developing, and the next steps will depend on how you choose to proceed.";
    const suggestedOptions = parsed.suggestedOptions?.length 
      ? parsed.suggestedOptions 
      : [
          "Take a moment to assess the situation carefully",
          "Address the most pressing concern head-on",
          "Make a bold, unexpected move"
        ];

    return {
      text,
      speaker: parsed.speaker || npcContext?.name || undefined,
      mood: parsed.mood || "neutral",
      suggestedOptions,
    };
  } catch (error) {
    console.error("Narrator agent error:", error);
    
    const fallbackNpc = npcContext?.name || "Sarah";
    return {
      text: `${fallbackNpc} considers your approach. "Let me look into that and get back to you with options." The team is processing the implications. Next step: decide how to communicate this to stakeholders.`,
      speaker: fallbackNpc,
      mood: "neutral",
      suggestedOptions: [
        "Follow up with clear direction to the team",
        "Gather more information before proceeding",
        "Move forward with the current plan",
      ],
    };
  }
}
