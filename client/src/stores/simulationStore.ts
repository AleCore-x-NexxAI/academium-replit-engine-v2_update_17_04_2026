import { create } from "zustand";
import type { KPIs, HistoryEntry, TurnResponse } from "@shared/schema";

interface ThinkingStep {
  message: string;
  completed: boolean;
}

interface SimulationStore {
  sessionId: string | null;
  history: HistoryEntry[];
  kpis: KPIs;
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

  setSessionId: (id: string | null) => void;
  addTurn: (userInput: string, response: TurnResponse) => void;
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
    mode?: "guided" | "assessment"
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
  isProcessing: false,
  thinkingSteps: [],
  competencyScores: {},
  currentFeedback: null,
  isGameOver: false,
  mode: "guided",
  options: [],

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

      return {
        history: newHistory,
        kpis: newKpis,
        currentFeedback: response.feedback,
        isGameOver: response.isGameOver,
        competencyScores: response.competencyScores || state.competencyScores,
        options: response.options || [],
      };
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

  initializeSession: (sessionId, initialKpis, history, mode = "guided") =>
    set({
      sessionId,
      kpis: initialKpis,
      history,
      mode,
      isGameOver: false,
      currentFeedback: null,
      competencyScores: {},
      options: [],
    }),

  resetStore: () =>
    set({
      sessionId: null,
      history: [],
      kpis: defaultKPIs,
      isProcessing: false,
      thinkingSteps: [],
      competencyScores: {},
      currentFeedback: null,
      isGameOver: false,
      mode: "guided",
      options: [],
    }),
}));
