import { generateChatCompletion } from "../openai";
import type { AgentContext, NarratorOutput, DomainExpertOutput, EvaluatorOutput } from "./types";
import { NPC_PERSONAS } from "./types";

const NARRATOR_SYSTEM_PROMPT = `You are the ScenarioWeaver agent for SIMULEARN, a business simulation engine.
Your role is to generate immersive narrative responses that bring the simulation to life.

You MUST output valid JSON with no markdown formatting.

Style Guidelines:
- Professional, high-stakes business tone
- Immersive and engaging storytelling
- Show, don't tell - describe reactions and consequences
- Include NPC dialogue when appropriate
- Max 150 words for the narrative

Available NPCs:
${Object.entries(NPC_PERSONAS)
  .map(([name, npc]) => `- ${name} (${npc.role}): ${npc.trait}. ${npc.prompt}`)
  .join("\n")}

Mood Types:
- neutral: Standard business situation
- positive: Things are going well, progress being made
- negative: Challenges arise, tension increases
- crisis: Critical situation, high stakes

Output Schema:
{
  "text": "<narrative paragraph describing what happens next>",
  "speaker": "<NPC name if someone speaks, or null>",
  "mood": "<neutral|positive|negative|crisis>",
  "suggestedOptions": ["<option 1>", "<option 2>", "<option 3>"]
}

End narratives with a clear call to action for the next decision.`;

export async function generateNarrative(
  context: AgentContext,
  kpiImpact: DomainExpertOutput,
  evaluation: EvaluatorOutput
): Promise<NarratorOutput> {
  const selectNPC = (): string | null => {
    const input = context.studentInput.toLowerCase();
    const flags = evaluation.flags.join(" ").toLowerCase();

    if (input.includes("cost") || input.includes("budget") || input.includes("spend")) {
      return "Marcus";
    }
    if (input.includes("team") || input.includes("employee") || kpiImpact.kpiDeltas.morale < -5) {
      return "Sarah";
    }
    if (input.includes("performance") || input.includes("result") || input.includes("deadline")) {
      return "Victor";
    }
    if (flags.includes("ethical") || input.includes("right thing") || input.includes("honest")) {
      return "Alex";
    }
    return null;
  };

  const selectedNpc = selectNPC();
  const npcContext = selectedNpc ? NPC_PERSONAS[selectedNpc as keyof typeof NPC_PERSONAS] : null;

  const userPrompt = `
Scenario: ${context.scenario.title} (${context.scenario.domain})
Student Role: ${context.scenario.role}
Turn: ${context.turnCount + 1}

Student's Decision: "${context.studentInput}"

KPI Changes:
${Object.entries(kpiImpact.kpiDeltas)
  .filter(([_, v]) => v !== 0)
  .map(([k, v]) => `- ${k}: ${v > 0 ? "+" : ""}${v}`)
  .join("\n")}
Reasoning: ${kpiImpact.reasoning}

Evaluation Flags: ${evaluation.flags.join(", ") || "None"}

${
  npcContext
    ? `Include dialogue from ${npcContext.name} (${npcContext.role}): ${npcContext.prompt}`
    : "No specific NPC dialogue required."
}

Write the next scene describing the consequences of this decision.
Provide 2-3 suggested next actions the student might consider.`;

  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: NARRATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { responseFormat: "json", maxTokens: 1024 }
    );

    const parsed = JSON.parse(response);
    return {
      text: parsed.text || "The situation continues to develop...",
      speaker: parsed.speaker || undefined,
      mood: parsed.mood || "neutral",
      suggestedOptions: parsed.suggestedOptions || [],
    };
  } catch (error) {
    console.error("Narrator agent error:", error);
    return {
      text: "Your decision has been noted. The consequences are beginning to unfold. What will you do next?",
      mood: "neutral",
      suggestedOptions: [
        "Gather more information",
        "Consult with the team",
        "Take decisive action",
      ],
    };
  }
}
