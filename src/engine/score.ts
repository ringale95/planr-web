import type { AppState, ScheduledBlock, Tier, ReviewAnswer } from "../types";
import { addDays, todayYmd, daysUntil } from "./dates";

export interface DimConfig {
  key: string;
  label: string;
  weight: number;
  tier: Tier;
  question: string;
}

export const DIMENSIONS: DimConfig[] = [
  { key: "dsa", label: "DSA", weight: 28, tier: "P0", question: "Did you do the DSA you meant to this week?" },
  { key: "switch", label: "Switch", weight: 12, tier: "P0", question: "Real progress toward the switch — applications, mocks, projects?" },
  { key: "class", label: "Class", weight: 10, tier: "P0", question: "Kept up with class and coursework?" },
  { key: "job", label: "Job", weight: 12, tier: "P1", question: "Held up your work at Burnes?" },
  { key: "gym", label: "Gym", weight: 16, tier: "P1", question: "Trained the way you intended?" },
  { key: "walks", label: "Walks", weight: 6, tier: "P2", question: "Got your walks / steps in?" },
  { key: "balance", label: "Enjoyment", weight: 16, tier: "Flex", question: "Actually rested and enjoyed — hobbies, friends, downtime?" },
];

const ANSWER_VALUE: Record<ReviewAnswer, number> = { yes: 100, partly: 60, no: 20 };

export interface Factor {
  key: string;
  label: string;
  tier: Tier;
  value: number; // 0..100
  symbol: "✓" | "◑" | "✗";
}

export type CoachState = "nudge" | "neutral" | "reward";

export interface ScoreResult {
  score: number;
  band: string;
  factors: Factor[];
  coachState: CoachState;
  coachFocus: string | null;
}

function symbolFor(v: number): "✓" | "◑" | "✗" {
  return v >= 75 ? "✓" : v >= 40 ? "◑" : "✗";
}

export function bandFor(score: number): string {
  if (score >= 85) return "Thriving";
  if (score >= 70) return "On track";
  if (score >= 50) return "Drifting";
  return "Off track";
}

function weekBlocks(state: AppState): ScheduledBlock[] {
  const start = state.weekStart;
  const end = addDays(start, 6);
  return Object.values(state.blocks).filter((b) => b.date >= start && b.date <= end);
}

/**
 * Credit ratio among elapsed blocks (date <= today). Done-on-time = full credit,
 * done-after-a-move = 0.85 (the small ding), missed = 0. Relocated originals
 * (status "moved") are excluded so a shifted task isn't double-counted.
 */
function ratioByTypes(blocks: ScheduledBlock[], types: string[]): number | null {
  const t = todayYmd();
  const considered = blocks.filter(
    (b) => types.includes(b.type) && b.date <= t && b.status !== "moved"
  );
  if (!considered.length) return null;
  let credit = 0;
  let denom = 0;
  for (const b of considered) {
    if (b.status === "done") {
      credit += b.movedFromDate ? 0.85 : 1;
      denom++;
    } else if (b.status === "skipped" || (b.status === "planned" && b.date < t)) {
      denom++;
    }
  }
  return denom ? credit / denom : null;
}

function countDone(blocks: ScheduledBlock[], types: string[]): number {
  return blocks.filter((b) => types.includes(b.type) && b.status === "done").length;
}

export function computeScore(state: AppState): ScoreResult {
  const wb = weekBlocks(state);
  const review = state.reviews[state.weekStart]?.answers ?? {};

  const dataValue = (key: string): number | null => {
    switch (key) {
      case "dsa": {
        const r = ratioByTypes(wb, ["DSA", "LeetCode"]);
        return r == null ? null : Math.round(r * 100);
      }
      case "class": {
        const r = ratioByTypes(wb, ["Class"]);
        return r == null ? null : Math.round(r * 100);
      }
      case "job": {
        const r = ratioByTypes(wb, ["Work"]);
        return r == null ? null : Math.round(r * 100);
      }
      case "gym":
        return Math.min(100, Math.round((countDone(wb, ["Gym"]) / 3) * 100));
      case "walks":
        return Math.min(100, Math.round((countDone(wb, ["Walk"]) / 3) * 100));
      case "balance": {
        const flex = countDone(wb, ["Painting", "Reading", "Social"]);
        const base = Math.min(100, Math.round((flex / 4) * 100));
        const exhausted = Object.entries(state.energyByDate).filter(
          ([d, e]) => d >= state.weekStart && d <= addDays(state.weekStart, 6) && e === "exhausted"
        ).length;
        return Math.max(0, base - exhausted * 10);
      }
      default:
        return null; // switch: no objective signal
    }
  };

  const factors: Factor[] = DIMENSIONS.map((d) => {
    const rv = review[d.key] != null ? ANSWER_VALUE[review[d.key]] : null;
    const dv = dataValue(d.key);
    let value: number;
    if (rv != null && dv != null) value = Math.round(0.5 * rv + 0.5 * dv);
    else if (rv != null) value = rv;
    else if (dv != null) value = dv;
    else value = 50; // unknown → neutral
    return { key: d.key, label: d.label, tier: d.tier, value, symbol: symbolFor(value) };
  });

  const totalW = DIMENSIONS.reduce((s, d) => s + d.weight, 0);
  const score = Math.round(
    factors.reduce((s, f) => {
      const w = DIMENSIONS.find((d) => d.key === f.key)!.weight;
      return s + f.value * w;
    }, 0) / totalW
  );

  // coaching: counter the user's known failure mode (under-protecting P0/P1)
  const p0p1 = factors.filter((f) => f.tier === "P0" || f.tier === "P1");
  const lowest = [...p0p1].sort((a, b) => a.value - b.value)[0];
  let coachState: CoachState = "neutral";
  let coachFocus: string | null = null;
  if (lowest && lowest.value < 50) {
    coachState = "nudge";
    coachFocus = lowest.label;
  } else if (p0p1.every((f) => f.value >= 70)) {
    coachState = "reward";
  }

  return { score, band: bandFor(score), factors, coachState, coachFocus };
}

export interface Projection {
  daysLeft: number;
  weeksLeft: number;
  total: number;
  perWeekNeeded: number;
  rag: "green" | "amber" | "red";
}

export function leetcodeProjection(state: AppState): Projection {
  const daysLeft = daysUntil(state.goalDeadline);
  const weeksLeft = Math.max(1, Math.floor(daysLeft / 7));
  const total = state.leetcode.easy + state.leetcode.medium + state.leetcode.hard;
  const remaining = Math.max(0, 300 - total);
  const perWeekNeeded = Math.ceil(remaining / weeksLeft);
  const rag: Projection["rag"] = perWeekNeeded <= 15 ? "green" : perWeekNeeded <= 22 ? "amber" : "red";
  return { daysLeft, weeksLeft, total, perWeekNeeded, rag };
}
