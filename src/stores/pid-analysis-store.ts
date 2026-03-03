/**
 * Zustand store for PID analysis state.
 *
 * Manages the analysis worker lifecycle, AI recommendation requests,
 * wizard navigation, and comparison snapshots.
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type {
  PidAnalysisResult,
  AiRecommendation,
  AiAnalysisResponse,
  AiAnalysisRequest,
  WizardStep,
  AnalysisMode,
  WorkerOutMessage,
} from "@/lib/analysis/types";
import type { VehicleType } from "@/components/fc/pid-constants";

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

interface PidAnalysisState {
  // Analysis state
  analysisResult: PidAnalysisResult | null;
  aiRecommendations: AiRecommendation[];
  aiSummary: string;

  // Loading states
  analyzing: boolean;
  analyzeProgress: { stage: string; percent: number } | null;
  aiLoading: boolean;
  error: string | null;

  // AI usage tracking
  aiRemainingUses: number | null;
  aiWeeklyLimit: number | null;

  // UI state
  wizardStep: WizardStep;
  analysisMode: AnalysisMode;
  logFileName: string | null;

  // Comparison
  previousResult: PidAnalysisResult | null;
}

interface PidAnalysisActions {
  // Core actions
  startAnalysis: (file: File) => void;
  loadMockAnalysis: () => void;
  requestAiAnalysis: (
    vehicleType: VehicleType,
    currentParams: Record<string, number>,
  ) => Promise<void>;

  // Recommendation actions
  applyRecommendation: (
    id: string,
    setLocalValue: (name: string, value: number) => void,
  ) => void;
  applyAllRecommended: (
    setLocalValue: (name: string, value: number) => void,
  ) => void;

  // Usage tracking
  setAiUsageInfo: (remaining: number | null, weeklyLimit: number | null) => void;

  // UI actions
  setWizardStep: (step: WizardStep) => void;
  setAnalysisMode: (mode: AnalysisMode) => void;
  saveAsComparison: () => void;

  // Reset
  reset: () => void;
  clearRecommendations: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: PidAnalysisState = {
  analysisResult: null,
  aiRecommendations: [],
  aiSummary: "",
  analyzing: false,
  analyzeProgress: null,
  aiLoading: false,
  error: null,
  aiRemainingUses: null,
  aiWeeklyLimit: null,
  wizardStep: "upload",
  analysisMode: "wizard",
  logFileName: null,
  previousResult: null,
};

// ---------------------------------------------------------------------------
// Worker ref (module-level, not in state — Workers are not serializable)
// ---------------------------------------------------------------------------

let activeWorker: Worker | null = null;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePidAnalysisStore = create<PidAnalysisState & PidAnalysisActions>(
  (set, get) => ({
    ...initialState,

    // ── Core actions ──────────────────────────────────────────────────────

    startAnalysis: (file: File) => {
      // Terminate any running worker
      if (activeWorker) {
        activeWorker.terminate();
        activeWorker = null;
      }

      set({
        analyzing: true,
        analyzeProgress: { stage: "Reading file", percent: 0 },
        error: null,
        analysisResult: null,
        aiRecommendations: [],
        aiSummary: "",
        logFileName: file.name,
        wizardStep: "analysis",
      });

      const worker = new Worker(
        new URL("../lib/analysis/pid-analysis-worker.ts", import.meta.url),
      );
      activeWorker = worker;

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const msg = e.data;
        switch (msg.type) {
          case "progress":
            set({ analyzeProgress: { stage: msg.stage, percent: msg.percent } });
            break;
          case "result":
            set({
              analysisResult: msg.data,
              analyzing: false,
              analyzeProgress: null,
              wizardStep: "recommendations",
            });
            activeWorker = null;
            worker.terminate();
            break;
          case "error":
            set({
              error: msg.message,
              analyzing: false,
              analyzeProgress: null,
            });
            activeWorker = null;
            worker.terminate();
            break;
        }
      };

      worker.onerror = (e) => {
        set({
          error: e.message || "Analysis worker crashed",
          analyzing: false,
          analyzeProgress: null,
        });
        activeWorker = null;
      };

      // Read file and send buffer to worker
      file.arrayBuffer().then((buffer) => {
        worker.postMessage({ type: "analyze", buffer }, [buffer]);
      });
    },

    loadMockAnalysis: () => {
      set({
        analyzing: true,
        analyzeProgress: { stage: "Loading mock data", percent: 50 },
        error: null,
        logFileName: "demo-flight.bin",
        wizardStep: "analysis",
      });

      // Dynamic import to avoid bundling mock data in production
      import("@/mock/mock-pid-analysis").then(
        ({ MOCK_PID_ANALYSIS_RESULT, MOCK_AI_RECOMMENDATIONS, MOCK_AI_SUMMARY }) => {
          set({
            analysisResult: MOCK_PID_ANALYSIS_RESULT,
            aiRecommendations: MOCK_AI_RECOMMENDATIONS,
            aiSummary: MOCK_AI_SUMMARY,
            analyzing: false,
            analyzeProgress: null,
            wizardStep: "recommendations",
          });
        },
      ).catch((err) => {
        set({
          error: `Failed to load mock data: ${err instanceof Error ? err.message : String(err)}`,
          analyzing: false,
          analyzeProgress: null,
        });
      });
    },

    requestAiAnalysis: async (
      vehicleType: VehicleType,
      currentParams: Record<string, number>,
    ) => {
      const { analysisResult } = get();
      if (!analysisResult) return;

      set({ aiLoading: true, error: null });

      // Build condensed metrics for the AI request
      const fftPeaks = (["roll", "pitch", "yaw"] as const).flatMap((axis) =>
        analysisResult.fft[axis].peaks.map((p) => ({
          axis,
          frequency: p.frequency,
          magnitudeDb: p.magnitudeDb,
          zone: p.zone,
        })),
      );

      const stepResponse = (["roll", "pitch", "yaw"] as const).map((axis) => {
        const events = analysisResult.stepResponse[axis];
        const count = events.length || 1;
        return {
          axis,
          avgOvershoot:
            events.reduce((s, e) => s + e.overshootPercent, 0) / count,
          avgRiseTime: events.reduce((s, e) => s + e.riseTimeMs, 0) / count,
          avgSettlingTime:
            events.reduce((s, e) => s + e.settlingTimeMs, 0) / count,
          avgDamping: events.reduce((s, e) => s + e.dampingRatio, 0) / count,
        };
      });

      const tracking = (["roll", "pitch", "yaw"] as const).map((axis) => ({
        axis,
        rmsError: analysisResult.tracking[axis].rmsError,
        score: analysisResult.tracking[axis].score,
      }));

      const body: AiAnalysisRequest = {
        vehicleType,
        currentParams,
        analysisMetrics: {
          tuneScore: analysisResult.tuneScore,
          fftPeaks,
          stepResponse,
          tracking,
          motorImbalance: analysisResult.motors.imbalanceScore,
          vibrationLevel: analysisResult.vibration.level,
          issues: analysisResult.issues.map((i) => ({
            severity: i.severity,
            title: i.title,
            description: i.description,
          })),
        },
      };

      try {
        const res = await fetch("/api/pid-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          set({ aiLoading: false });
          window.dispatchEvent(new CustomEvent("open-signin"));
          return;
        }

        const data: AiAnalysisResponse = await res.json();

        if (res.status === 429) {
          set({
            error: "Weekly AI analysis limit reached. Resets Monday.",
            aiLoading: false,
            aiRemainingUses: 0,
            aiWeeklyLimit: data.weeklyLimit ?? null,
          });
          return;
        }

        if (data.error) {
          set({ error: data.error, aiLoading: false });
          return;
        }

        set({
          aiRecommendations: data.recommendations,
          aiSummary: data.summary,
          aiLoading: false,
          aiRemainingUses: data.remaining ?? null,
          aiWeeklyLimit: data.weeklyLimit ?? null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI request failed";
        set({ error: message, aiLoading: false });
      }
    },

    // ── Recommendation actions ────────────────────────────────────────────

    applyRecommendation: (
      id: string,
      setLocalValue: (name: string, value: number) => void,
    ) => {
      const rec = get().aiRecommendations.find((r) => r.id === id);
      if (!rec) return;
      for (const p of rec.parameters) {
        setLocalValue(p.param, p.suggestedValue);
      }
    },

    applyAllRecommended: (
      setLocalValue: (name: string, value: number) => void,
    ) => {
      const recs = get().aiRecommendations.filter((r) => r.confidence >= 80);
      for (const rec of recs) {
        for (const p of rec.parameters) {
          setLocalValue(p.param, p.suggestedValue);
        }
      }
    },

    // ── Usage tracking ──────────────────────────────────────────────────

    setAiUsageInfo: (remaining: number | null, weeklyLimit: number | null) =>
      set({ aiRemainingUses: remaining, aiWeeklyLimit: weeklyLimit }),

    // ── UI actions ────────────────────────────────────────────────────────

    setWizardStep: (step: WizardStep) => set({ wizardStep: step }),

    setAnalysisMode: (mode: AnalysisMode) => set({ analysisMode: mode }),

    saveAsComparison: () => {
      const { analysisResult } = get();
      if (analysisResult) {
        set({ previousResult: analysisResult });
      }
    },

    // ── Reset ─────────────────────────────────────────────────────────────

    reset: () => {
      if (activeWorker) {
        activeWorker.terminate();
        activeWorker = null;
      }
      set(initialState);
    },

    clearRecommendations: () => {
      set({ aiRecommendations: [], aiSummary: "" });
    },
  }),
);
