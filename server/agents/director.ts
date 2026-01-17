import type { AgentContext, DirectorOutput } from "./types";
import type { KPIs, SimulationState, TurnResponse, HistoryEntry } from "@shared/schema";
import { evaluateDecision } from "./evaluator";
import { calculateKPIImpact } from "./domainExpert";
import { generateNarrative } from "./narrator";
import { generateChatCompletion, SupportedModel } from "../openai";

export const DEFAULT_DIRECTOR_PROMPT = `You are an INTENT INTERPRETER for an immersive business simulation game.

YOUR CRITICAL MISSION: Accept and interpret virtually ANYTHING the student says as a valid decision or action within the simulation context. You are NOT a gatekeeper - you are a creative interpreter.

CORE PRINCIPLES:
1. ASSUME POSITIVE INTENT - The student is trying to engage with the simulation
2. BE MAXIMALLY PERMISSIVE - Accept typos, casual language, partial sentences, unconventional ideas
3. INTERPRET CREATIVELY - Find the business decision hidden in any statement
4. NEVER REJECT - Transform unclear inputs into actionable interpretations

EXAMPLES OF VALID INTERPRETATIONS:
- "ush developers to finish" → VALID: "Push developers to finish on deadline" (obvious typo)
- "give them coffee everyday" → VALID: Improve workplace amenities/morale
- "i dunno maybe delay it" → VALID: Consider delaying the project/deadline
- "fire everyone lol" → VALID: Dramatic cost-cutting/restructuring (explore consequences)
- "what if we just lie" → VALID: Questionable ethical approach (explore consequences)
- "push through no matter what" → VALID: Aggressive deadline pursuit strategy
- "that above is my decision" → VALID: Referencing their previous statement as their decision
- "i just answered the question" → VALID: Their previous message was their intended action
- Random/silly answers → VALID: Interpret as an unconventional business approach and show consequences

INPUTS TO FLAG FOR CLARIFICATION (still rare):
- Complete gibberish with zero interpretable meaning: "asdfghjkl"
- Content promoting violence, illegal activities, or harassment that cannot be reframed as a business decision
- Content completely unrelated to any professional/business context

Note: Risky or ethically questionable BUSINESS decisions are VALID (e.g., "fire everyone", "lie to customers") - let consequences teach. Only flag truly harmful/off-topic content.

OUTPUT FORMAT (JSON only):
{
  "isValid": true,
  "interpretedAction": "<clear description of what the student is trying to do>",
  "confidence": "high" | "medium" | "low"
}

For the extremely rare invalid case:
{
  "isValid": false,
  "helpfulPrompt": "<engaging question to get them back on track>"
}

Remember: A creative business simulation should be able to handle ANY decision and show interesting consequences. Your job is to enable play, not block it.`;

async function interpretIntent(
  input: string,
  history: HistoryEntry[],
  scenario: { title: string; context: string },
  options?: { customPrompt?: string; model?: SupportedModel }
): Promise<{ isValid: boolean; interpretedAction?: string; helpfulPrompt?: string }> {
  try {
    const recentContext = history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");
    const systemPrompt = options?.customPrompt || DEFAULT_DIRECTOR_PROMPT;
    
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `
SCENARIO: ${scenario.title}
SCENARIO CONTEXT: ${scenario.context}

RECENT CONVERSATION:
${recentContext}

STUDENT'S LATEST INPUT: "${input}"

Interpret this input as a simulation action. Find the business decision in their words.` },
      ],
      { responseFormat: "json", maxTokens: 256, model: options?.model }
    );
    
    const parsed = JSON.parse(response);
    
    if (parsed.isValid === false && parsed.helpfulPrompt) {
      return { isValid: false, helpfulPrompt: parsed.helpfulPrompt };
    }
    
    return { 
      isValid: true, 
      interpretedAction: parsed.interpretedAction || input 
    };
  } catch {
    return { isValid: true, interpretedAction: input };
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

function checkGameOver(kpis: KPIs, context?: AgentContext): boolean {
  // Check for KPI-based game over
  const kpiGameOver = (
    kpis.morale < 20 ||
    kpis.reputation < 20 ||
    kpis.efficiency < 20 ||
    kpis.trust < 20 ||
    kpis.revenue < 10000
  );
  
  // Check for POC-style decision limit
  if (context?.totalDecisions && context.totalDecisions > 0) {
    const nextDecision = (context.currentDecision || 1) + 1;
    if (nextDecision > context.totalDecisions) {
      return true; // All decisions made
    }
  }
  
  return kpiGameOver;
}

export async function processStudentTurn(context: AgentContext): Promise<DirectorOutput> {
  const intentResult = await interpretIntent(
    context.studentInput,
    context.history as HistoryEntry[],
    { title: context.scenario.title, context: `${context.scenario.domain} - ${context.scenario.objective}` },
    { customPrompt: context.agentPrompts?.director, model: context.llmModel }
  );

  if (!intentResult.isValid) {
    const helpPrompt = intentResult.helpfulPrompt || 
      "I want to help you navigate this situation! What action would you like to take? You can try anything - negotiate, investigate, make bold moves, or even unconventional approaches.";
    
    const updatedHistory: HistoryEntry[] = [
      ...context.history as HistoryEntry[],
      {
        role: "user",
        content: context.studentInput,
        timestamp: new Date().toISOString(),
      },
      {
        role: "system",
        content: helpPrompt,
        timestamp: new Date().toISOString(),
      },
    ];
    
    return {
      narrative: {
        text: helpPrompt,
        mood: "neutral",
      },
      kpiUpdates: {},
      feedback: {
        score: 0,
        message: "Tell me what you want to do - I'll make it happen in the simulation!",
      },
      isGameOver: false,
      updatedState: {
        turnCount: context.turnCount,
        kpis: context.currentKpis,
        history: updatedHistory,
        flags: [],
        rubricScores: {},
      },
    };
  }

  const interpretedContext = {
    ...context,
    studentInput: intentResult.interpretedAction || context.studentInput,
  };

  const [evaluation, kpiImpact] = await Promise.all([
    evaluateDecision(interpretedContext),
    calculateKPIImpact(interpretedContext),
  ]);

  const newKpis = applyKPIDeltas(context.currentKpis, kpiImpact.kpiDeltas);

  const narrativeContext = {
    ...interpretedContext,
    currentKpis: newKpis,
  };
  const narrative = await generateNarrative(narrativeContext, kpiImpact, evaluation);

  const isGameOver = checkGameOver(newKpis, interpretedContext);

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

  const currentDecisionNum = context.currentDecision || context.turnCount + 1;
  const nextDecision = currentDecisionNum + 1;
  const totalDecisions = context.totalDecisions || 0;
  const simulationComplete = totalDecisions > 0 && nextDecision > totalDecisions;

  const updatedState: SimulationState = {
    turnCount: context.turnCount + 1,
    kpis: newKpis,
    indicators: context.indicators, // Preserve indicators (updated by frontend for now)
    history: newHistory,
    flags: [...(context.history as any).flags || [], ...evaluation.flags],
    rubricScores: evaluation.competencyScores,
    currentDecision: simulationComplete ? totalDecisions : nextDecision,
    isComplete: simulationComplete || isGameOver,
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
