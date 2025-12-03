import type { AgentContext, DirectorOutput } from "./types";
import type { KPIs, SimulationState, TurnResponse, HistoryEntry } from "@shared/schema";
import { evaluateDecision } from "./evaluator";
import { calculateKPIImpact } from "./domainExpert";
import { generateNarrative } from "./narrator";
import { generateChatCompletion } from "../openai";

const INTENT_VALIDATION_PROMPT = `You are validating a student's input in a business simulation.
Determine if the input is:
1. A valid attempt to make a decision or take action
2. A clarifying question about the scenario
3. Gibberish, off-topic, or inappropriate

Output JSON:
{
  "isValid": true/false,
  "type": "decision" | "question" | "invalid",
  "clarificationNeeded": "<if invalid, what clarification to request>"
}`;

async function validateIntent(input: string): Promise<{ isValid: boolean; type: string; clarificationNeeded?: string }> {
  try {
    const response = await generateChatCompletion(
      [
        { role: "system", content: INTENT_VALIDATION_PROMPT },
        { role: "user", content: `Student input: "${input}"` },
      ],
      { responseFormat: "json", maxTokens: 256 }
    );
    return JSON.parse(response);
  } catch {
    return { isValid: true, type: "decision" };
  }
}

function applyKPIDeltas(currentKpis: KPIs, deltas: Record<string, number>): KPIs {
  const newKpis: KPIs = { ...currentKpis };

  if (deltas.revenue) {
    newKpis.revenue = Math.max(0, currentKpis.revenue + deltas.revenue);
  }
  if (deltas.morale !== undefined) {
    newKpis.morale = Math.max(0, Math.min(100, currentKpis.morale + deltas.morale));
  }
  if (deltas.reputation !== undefined) {
    newKpis.reputation = Math.max(0, Math.min(100, currentKpis.reputation + deltas.reputation));
  }
  if (deltas.efficiency !== undefined) {
    newKpis.efficiency = Math.max(0, Math.min(100, currentKpis.efficiency + deltas.efficiency));
  }
  if (deltas.trust !== undefined) {
    newKpis.trust = Math.max(0, Math.min(100, currentKpis.trust + deltas.trust));
  }

  return newKpis;
}

function checkGameOver(kpis: KPIs): boolean {
  return (
    kpis.morale < 20 ||
    kpis.reputation < 20 ||
    kpis.efficiency < 20 ||
    kpis.trust < 20 ||
    kpis.revenue < 10000
  );
}

export async function processStudentTurn(context: AgentContext): Promise<DirectorOutput> {
  const intentCheck = await validateIntent(context.studentInput);

  if (!intentCheck.isValid) {
    return {
      narrative: {
        text: intentCheck.clarificationNeeded || "Could you please clarify your intended action? I need to understand what decision you'd like to make.",
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "Please provide a clear business decision or action.",
      },
      isGameOver: false,
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        history: context.history as HistoryEntry[],
        flags: [],
        rubricScores: {},
      },
    };
  }

  const [evaluation, kpiImpact] = await Promise.all([
    evaluateDecision(context),
    calculateKPIImpact(context),
  ]);

  const newKpis = applyKPIDeltas(context.currentKpis, kpiImpact.kpiDeltas);

  const narrativeContext = {
    ...context,
    currentKpis: newKpis,
  };
  const narrative = await generateNarrative(narrativeContext, kpiImpact, evaluation);

  const isGameOver = checkGameOver(newKpis);

  const kpiUpdates: Record<string, { value: number; delta: number }> = {};
  const kpiKeys: (keyof KPIs)[] = ["revenue", "morale", "reputation", "efficiency", "trust"];
  
  for (const key of kpiKeys) {
    const delta = kpiImpact.kpiDeltas[key] || 0;
    kpiUpdates[key] = {
      value: newKpis[key],
      delta: delta,
    };
  }

  const newHistory: HistoryEntry[] = [
    ...context.history as HistoryEntry[],
    {
      role: "user",
      content: context.studentInput,
      timestamp: new Date().toISOString(),
    },
    {
      role: narrative.speaker ? "npc" : "system",
      content: narrative.text,
      speaker: narrative.speaker,
      timestamp: new Date().toISOString(),
    },
  ];

  const updatedState: SimulationState = {
    turnCount: context.turnCount + 1,
    kpis: newKpis,
    history: newHistory,
    flags: [...(context.history as any).flags || [], ...evaluation.flags],
    rubricScores: evaluation.competencyScores,
  };

  return {
    narrative: {
      text: narrative.text,
      speaker: narrative.speaker,
      mood: narrative.mood,
    },
    kpiUpdates,
    feedback: evaluation.feedback,
    options: narrative.suggestedOptions,
    isGameOver,
    competencyScores: evaluation.competencyScores,
    updatedState,
  };
}
