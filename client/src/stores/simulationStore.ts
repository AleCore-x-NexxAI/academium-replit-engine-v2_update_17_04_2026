import { create } from "zustand";
import type { KPIs, HistoryEntry, TurnResponse, Indicator, DecisionPoint } from "@shared/schema";

interface ThinkingStep {
  message: string;
  completed: boolean;
}

interface SimulationStore {
  sessionId: string | null;
  history: HistoryEntry[];
  kpis: KPIs;
  indicators: Indicator[];
  previousIndicators: Indicator[];
  isProcessing: boolean;
  thinkingSteps: ThinkingStep[];
  competencyScores: Record<string, number>;
  currentFeedback: {
    score: number;
    message: string;
    hint?: string;
  } | null;
  isGameOver: boolean;
  mode: "guided" | "assessment";
  options: string[];
  currentDecision: number;
  totalDecisions: number;
  decisionPoints: DecisionPoint[];
  // Revision state for weak answer handling
  pendingRevision: boolean;
  revisionPrompt: string | null;
  revisionAttempts: number;
  maxRevisions: number;

  setSessionId: (id: string | null) => void;
  addTurn: (userInput: string, response: TurnResponse) => void;
  handleRevisionRequest: (response: TurnResponse) => void;
  clearRevision: () => void;
  updateKPIs: (updates: Record<string, { value: number; delta: number }>) => void;
  setProcessing: (status: boolean) => void;
  setThinkingSteps: (steps: ThinkingStep[]) => void;
  updateThinkingStep: (index: number, completed: boolean) => void;
  setFeedback: (feedback: { score: number; message: string; hint?: string } | null) => void;
  setGameOver: (isOver: boolean) => void;
  setMode: (mode: "guided" | "assessment") => void;
  setOptions: (options: string[]) => void;
  initializeSession: (
    sessionId: string,
    initialKpis: KPIs,
    history: HistoryEntry[],
    mode?: "guided" | "assessment",
    indicators?: Indicator[],
    totalDecisions?: number,
    decisionPoints?: DecisionPoint[]
  ) => void;
  resetStore: () => void;
}

const defaultKPIs: KPIs = {
  revenue: 100000,
  morale: 75,
  reputation: 75,
  efficiency: 75,
  trust: 75,
};

export const useSimulationStore = create<SimulationStore>((set) => ({
  sessionId: null,
  history: [],
  kpis: defaultKPIs,
  indicators: [],
  previousIndicators: [],
  isProcessing: false,
  thinkingSteps: [],
  competencyScores: {},
  currentFeedback: null,
  isGameOver: false,
  mode: "guided",
  options: [],
  currentDecision: 1,
  totalDecisions: 0,
  decisionPoints: [],
  pendingRevision: false,
  revisionPrompt: null,
  revisionAttempts: 0,
  maxRevisions: 2,

  setSessionId: (id) => set({ sessionId: id }),

  addTurn: (userInput, response) =>
    set((state) => {
      const newHistory: HistoryEntry[] = [
        ...state.history,
        {
          role: "user",
          content: userInput,
          timestamp: new Date().toISOString(),
        },
        {
          role: response.narrative.speaker ? "npc" : "system",
          content: response.narrative.text,
          speaker: response.narrative.speaker,
          timestamp: new Date().toISOString(),
        },
      ];

      const newKpis = { ...state.kpis };
      Object.entries(response.kpiUpdates).forEach(([key, update]) => {
        if (key in newKpis) {
          (newKpis as Record<string, number>)[key] = update.value;
        }
      });

      const newIndicators = state.indicators.map((indicator) => {
        const delta = response.indicatorDeltas?.[indicator.id] || 0;
        return {
          ...indicator,
          value: Math.max(0, Math.min(100, indicator.value + delta)),
        };
      });

      const newDecision = state.currentDecision + 1;
      const isComplete = state.totalDecisions > 0 && newDecision > state.totalDecisions;

      return {
        history: newHistory,
        kpis: newKpis,
        previousIndicators: state.indicators,
        indicators: newIndicators,
        currentFeedback: response.feedback,
        isGameOver: response.isGameOver || isComplete,
        competencyScores: response.competencyScores || state.competencyScores,
        options: response.options || [],
        currentDecision: newDecision,
        // Clear revision state on successful turn
        pendingRevision: false,
        revisionPrompt: null,
        revisionAttempts: 0,
      };
    }),

  handleRevisionRequest: (response) =>
    set((state) => {
      // Add the revision prompt to history
      const newHistory: HistoryEntry[] = [
        ...state.history,
        {
          role: "system",
          content: response.revisionPrompt || response.narrative?.text || "",
          timestamp: new Date().toISOString(),
        },
      ];

      return {
        history: newHistory,
        pendingRevision: true,
        revisionPrompt: response.revisionPrompt || null,
        revisionAttempts: response.revisionAttempts || state.revisionAttempts + 1,
        maxRevisions: response.maxRevisions || 2,
        currentFeedback: response.feedback ? {
          score: 0,
          message: response.feedback.message,
        } : state.currentFeedback,
      };
    }),

  clearRevision: () =>
    set({
      pendingRevision: false,
      revisionPrompt: null,
    }),

  updateKPIs: (updates) =>
    set((state) => {
      const newKpis = { ...state.kpis };
      Object.entries(updates).forEach(([key, update]) => {
        if (key in newKpis) {
          (newKpis as Record<string, number>)[key] = update.value;
        }
      });
      return { kpis: newKpis };
    }),

  setProcessing: (status) => set({ isProcessing: status }),

  setThinkingSteps: (steps) => set({ thinkingSteps: steps }),

  updateThinkingStep: (index, completed) =>
    set((state) => {
      const newSteps = [...state.thinkingSteps];
      if (newSteps[index]) {
        newSteps[index] = { ...newSteps[index], completed };
      }
      return { thinkingSteps: newSteps };
    }),

  setFeedback: (feedback) => set({ currentFeedback: feedback }),

  setGameOver: (isOver) => set({ isGameOver: isOver }),

  setMode: (mode) => set({ mode }),

  setOptions: (options) => set({ options }),

  initializeSession: (sessionId, initialKpis, history, mode = "guided", indicators = [], totalDecisions = 0, decisionPoints = []) =>
    set({
      sessionId,
      kpis: initialKpis,
      history,
      mode,
      isGameOver: false,
      currentFeedback: null,
      competencyScores: {},
      options: [],
      indicators,
      previousIndicators: [],
      totalDecisions,
      decisionPoints,
      currentDecision: history.filter(h => h.role === "user").length + 1,
    }),

  resetStore: () =>
    set({
      sessionId: null,
      history: [],
      kpis: defaultKPIs,
      indicators: [],
      previousIndicators: [],
      isProcessing: false,
      thinkingSteps: [],
      competencyScores: {},
      currentFeedback: null,
      isGameOver: false,
      mode: "guided",
      options: [],
      currentDecision: 1,
      totalDecisions: 0,
      decisionPoints: [],
      pendingRevision: false,
      revisionPrompt: null,
      revisionAttempts: 0,
      maxRevisions: 2,
    }),
}));
