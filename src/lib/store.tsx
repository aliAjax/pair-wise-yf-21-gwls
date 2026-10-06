import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppState, FieldRecord } from "./types";
import { loadState, saveState, clearState, uid } from "./storage";
import {
  mergeFieldRecord,
  saveStep as saveStepEngine,
  simulateColleagueSave,
  warehouseStep as warehouseStepEngine,
  updateColorCardBatch as updateColorCardBatchEngine,
} from "./sync";

interface StoreValue {
  state: AppState;
  online: boolean;
  setOnline: (online: boolean) => void;
  createFieldRecord: (input: {
    patternId: string;
    damageNote: string;
    threadColorCardIds: string[];
    evidenceNote: string;
  }) => FieldRecord;
  mergeRecord: (fieldRecordId: string) => void;
  resumeRecord: (fieldRecordId: string) => void;
  saveStep: (
    patternId: string,
    stepId: string,
    baseVersion: number,
    patch: { name?: string; status?: "pending" | "in-progress" | "done" | "warehoused"; assignee?: string; colorCardId?: string }
  ) => void;
  simulateColleagueSave: (patternId: string) => void;
  warehouseStep: (patternId: string, stepId: string) => void;
  updateColorCardBatch: (cardId: string) => void;
  resolveConflict: (conflictId: string) => void;
  setCurrentRestorer: (restorerId: string) => void;
  toggleSimulateFailure: () => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const createFieldRecord = useCallback<StoreValue["createFieldRecord"]>(
    ({ patternId, damageNote, threadColorCardIds, evidenceNote }) => {
      const fr: FieldRecord = {
        id: uid("fr"),
        patternId,
        damageNote: damageNote.trim(),
        threadColorCardIds,
        evidence: evidenceNote.trim()
          ? [{ kind: "note", content: evidenceNote.trim() }]
          : [],
        createdAt: Date.now(),
        synced: false,
      };
      setState((s) => ({ ...s, fieldRecords: [...s.fieldRecords, fr] }));
      return fr;
    },
    []
  );

  const mergeRecord = useCallback((fieldRecordId: string) => {
    setState((s) => {
      const { state: next } = mergeFieldRecord(s, fieldRecordId);
      return next;
    });
  }, []);

  const resumeRecord = useCallback((fieldRecordId: string) => {
    setState((s) => {
      const { state: next } = mergeFieldRecord(s, fieldRecordId);
      return next;
    });
  }, []);

  const saveStep = useCallback<StoreValue["saveStep"]>(
    (patternId, stepId, baseVersion, patch) => {
      setState((s) => {
        const { state: next } = saveStepEngine(s, patternId, stepId, baseVersion, patch);
        return next;
      });
    },
    []
  );

  const simulateColleague = useCallback((patternId: string) => {
    setState((s) => simulateColleagueSave(s, patternId));
  }, []);

  const warehouseStep = useCallback((patternId: string, stepId: string) => {
    setState((s) => warehouseStepEngine(s, patternId, stepId));
  }, []);

  const updateColorCardBatch = useCallback((cardId: string) => {
    setState((s) => updateColorCardBatchEngine(s, cardId));
  }, []);

  const resolveConflict = useCallback((conflictId: string) => {
    setState((s) => ({
      ...s,
      conflicts: s.conflicts.map((c) => (c.id === conflictId ? { ...c, resolved: true } : c)),
    }));
  }, []);

  const setCurrentRestorer = useCallback((restorerId: string) => {
    setState((s) => ({ ...s, currentRestorerId: restorerId }));
  }, []);

  const toggleSimulateFailure = useCallback(() => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, simulateMergeFailure: !s.settings.simulateMergeFailure },
    }));
  }, []);

  const resetAll = useCallback(() => {
    clearState();
    setState(loadState());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      online,
      setOnline,
      createFieldRecord,
      mergeRecord,
      resumeRecord,
      saveStep,
      simulateColleagueSave: simulateColleague,
      warehouseStep,
      updateColorCardBatch,
      resolveConflict,
      setCurrentRestorer,
      toggleSimulateFailure,
      resetAll,
    }),
    [
      state,
      online,
      createFieldRecord,
      mergeRecord,
      resumeRecord,
      saveStep,
      simulateColleague,
      warehouseStep,
      updateColorCardBatch,
      resolveConflict,
      setCurrentRestorer,
      toggleSimulateFailure,
      resetAll,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}
