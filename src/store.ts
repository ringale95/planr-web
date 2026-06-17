import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppState, ScheduledBlock, SkipReason, Energy, ReviewAnswer } from "./types";
import { GOALS, GOAL_DEADLINE } from "./tasks";
import { generateWeekPlan, skipBlock, applyEnergy, addAppointment, rolloverOverdue } from "./engine/scheduler";
import { todayYmd, weekStartOf } from "./engine/dates";
import { pullState, pushState, apiBase } from "./sync";
import { isConnected as gcalConnected, pushEvent as gcalPush } from "./gcal";

const KEY = "planr.state.v2";

function toRecord(blocks: ScheduledBlock[]): Record<string, ScheduledBlock> {
  const r: Record<string, ScheduledBlock> = {};
  for (const b of blocks) r[b.id] = b;
  return r;
}

function freshState(): AppState {
  const ws = weekStartOf(todayYmd());
  return {
    goalDeadline: GOAL_DEADLINE,
    weekStart: ws,
    blocks: toRecord(generateWeekPlan(ws)),
    energyByDate: {},
    reviews: {},
    goals: GOALS,
    weightLog: [{ date: todayYmd(), kg: 58 }],
    leetcode: { easy: 0, medium: 0, hard: 0 },
    patterns: {},
    updatedAt: Date.now(),
  };
}

/** Roll the plan forward if a new week has started (keeps history). */
function ensureCurrentWeek(state: AppState): AppState {
  const ws = weekStartOf(todayYmd());
  if (ws === state.weekStart) return state;
  const fresh = generateWeekPlan(ws);
  const blocks = { ...state.blocks };
  for (const b of fresh) if (!blocks[b.id]) blocks[b.id] = b;
  return { ...state, weekStart: ws, blocks };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as AppState;
    const rolled = ensureCurrentWeek({ ...freshState(), ...parsed, goals: GOALS });
    return { ...rolled, blocks: toRecord(rolloverOverdue(Object.values(rolled.blocks))) };
  } catch {
    return freshState();
  }
}

export function useStore() {
  const [state, setState] = useState<AppState>(load);
  const [syncStatus, setSyncStatus] = useState<"idle" | "pending" | "synced" | "offline">("idle");

  // Persist locally (source of truth) + debounced push to home backend when reachable.
  useEffect(() => {
    const snap = { ...state, updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(snap));
    if (!apiBase()) {
      setSyncStatus("idle");
      return;
    }
    setSyncStatus("pending");
    const id = setTimeout(async () => {
      const ok = await pushState(snap);
      setSyncStatus(ok ? "synced" : "offline");
    }, 800);
    return () => clearTimeout(id);
  }, [state]);

  // On open: pull from the home backend; adopt it only if it's newer.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const server = await pullState();
      if (cancelled || !server) return;
      const raw = localStorage.getItem(KEY);
      const localUpdated = raw ? (JSON.parse(raw).updatedAt ?? 0) : 0;
      if (server.updatedAt > localUpdated) setState(ensureCurrentWeek(server.state));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [toast, setToast] = useState<string>("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const complete = useCallback((id: string) => {
    setState((s) => {
      const b = s.blocks[id];
      if (!b) return s;
      return { ...s, blocks: { ...s.blocks, [id]: { ...b, status: "done", updatedAt: Date.now() } } };
    });
  }, []);

  const skip = useCallback((id: string, reason: SkipReason) => {
    setState((s) => {
      const res = skipBlock(Object.values(s.blocks), id, reason, todayYmd());
      setToast(res.message);
      return { ...s, blocks: toRecord(res.blocks) };
    });
  }, []);

  const setEnergy = useCallback((date: string, level: Energy) => {
    setState((s) => {
      const res = applyEnergy(Object.values(s.blocks), date, level);
      if (res.message) setToast(res.message);
      return { ...s, energyByDate: { ...s.energyByDate, [date]: level }, blocks: toRecord(res.blocks) };
    });
  }, []);

  const addAppt = useCallback(
    (title: string, date: string, startTime: string, durationMin: number) => {
      setState((s) => {
        const res = addAppointment(Object.values(s.blocks), title, date, startTime, durationMin);
        setToast(res.message);
        return { ...s, blocks: toRecord(res.blocks) };
      });
      // mirror to Google Calendar if connected (fire-and-forget)
      if (gcalConnected()) {
        void gcalPush({ title, date, startTime, durationMin }).then((ok) => {
          if (ok) setToast(`"${title}" added to Google Calendar too.`);
        });
      }
    },
    []
  );

  const logLeetcode = useCallback((diff: "easy" | "medium" | "hard", pattern?: string) => {
    setState((s) => ({
      ...s,
      leetcode: { ...s.leetcode, [diff]: s.leetcode[diff] + 1 },
      patterns: pattern ? { ...s.patterns, [pattern]: (s.patterns[pattern] ?? 0) + 1 } : s.patterns,
    }));
  }, []);

  const saveReview = useCallback((answers: Record<string, ReviewAnswer>) => {
    setState((s) => ({
      ...s,
      reviews: {
        ...s.reviews,
        [s.weekStart]: { weekStart: s.weekStart, answers, updatedAt: Date.now() },
      },
    }));
    setToast("Weekly check-in saved.");
  }, []);

  const logWeight = useCallback((kg: number) => {
    setState((s) => ({ ...s, weightLog: [...s.weightLog, { date: todayYmd(), kg }] }));
  }, []);

  const blocksByDate = useCallback(
    (date: string) =>
      Object.values(state.blocks)
        .filter((b) => b.date === date && b.status !== "skipped" && b.status !== "moved")
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [state.blocks]
  );

  const actions = useMemo(
    () => ({ complete, skip, setEnergy, addAppt, logLeetcode, saveReview, logWeight, blocksByDate }),
    [complete, skip, setEnergy, addAppt, logLeetcode, saveReview, logWeight, blocksByDate]
  );

  return { state, toast, syncStatus, ...actions };
}

export type Store = ReturnType<typeof useStore>;
