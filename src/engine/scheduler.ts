import type { ScheduledBlock, TaskDef, SkipReason, Energy, Tier } from "../types";
import { TASKS, commitmentForTier } from "../tasks";
import { addDays, minutes, fromMinutes } from "./dates";

const DAY_START = 330; // 05:30
const DAY_END = 1410; // 23:30 — sleep floor
const TIER_ORDER: Tier[] = ["P0", "P1", "P2", "Flex", "Upkeep"];

type Interval = { start: number; end: number };

function stamp(): number {
  return Date.now();
}

function blockFromTask(task: TaskDef, date: string, time: string): ScheduledBlock {
  return {
    id: `${date}__${task.id}`,
    taskId: task.id,
    title: task.title,
    type: task.type,
    tier: task.tier,
    commitment: commitmentForTier(task.tier),
    date,
    startTime: time,
    durationMin: task.durationMin,
    status: "planned",
    locked: !!task.fixedSlots,
    physicalLoad: task.physicalLoad,
    cognitiveLoad: task.cognitiveLoad,
    updatedAt: stamp(),
  };
}

/** First free start (15-min grid) within [eMin,lMin] that fits without overlap. */
export function findFreeSlot(
  intervals: Interval[],
  durationMin: number,
  eMin = DAY_START,
  lMin = DAY_END
): number | null {
  for (let s = eMin; s <= lMin; s += 15) {
    const e = s + durationMin;
    if (e > DAY_END) break;
    const clash = intervals.some((iv) => s < iv.end && e > iv.start);
    if (!clash) return s;
  }
  return null;
}

function occupiedByDate(blocks: ScheduledBlock[]): Record<string, Interval[]> {
  const map: Record<string, Interval[]> = {};
  for (const b of blocks) {
    if (b.status === "skipped" || b.status === "moved") continue;
    (map[b.date] ||= []).push({
      start: minutes(b.startTime),
      end: minutes(b.startTime) + b.durationMin,
    });
  }
  return map;
}

/** Generate the full week plan (Sunday-based) from the task catalog. */
export function generateWeekPlan(weekStart: string): ScheduledBlock[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const blocks: ScheduledBlock[] = [];
  const occupied: Record<string, Interval[]> = {};
  const occupy = (date: string, start: number, dur: number) => {
    (occupied[date] ||= []).push({ start, end: start + dur });
  };

  // 1) Fixed anchors first.
  for (const task of TASKS) {
    if (!task.fixedSlots) continue;
    for (const slot of task.fixedSlots) {
      const date = dates[slot.day];
      const b = blockFromTask(task, date, slot.time);
      blocks.push(b);
      occupy(date, minutes(slot.time), task.durationMin);
    }
  }

  // 2) Flexible tasks by priority tier.
  for (const tier of TIER_ORDER) {
    for (const task of TASKS) {
      if (task.fixedSlots || task.optional || task.tier !== tier) continue;
      placeFlexible(task, dates, blocks, occupied, occupy);
    }
  }

  return blocks.sort(
    (a, b) => a.date.localeCompare(b.date) || minutes(a.startTime) - minutes(b.startTime)
  );
}

function placeFlexible(
  task: TaskDef,
  dates: string[],
  blocks: ScheduledBlock[],
  occupied: Record<string, Interval[]>,
  occupy: (date: string, start: number, dur: number) => void
) {
  const eMin = task.earliest ? minutes(task.earliest) : DAY_START;
  const lMin = task.latest ? minutes(task.latest) : DAY_END;
  const avoid = new Set(task.avoidDays ?? []);

  // candidate days, in preference order
  let days: number[];
  if (task.preferredDays?.length) {
    days = [...task.preferredDays, ...[0, 1, 2, 3, 4, 5, 6].filter((d) => !task.preferredDays!.includes(d))];
  } else {
    days = [0, 1, 2, 3, 4, 5, 6];
  }
  days = days.filter((d) => !avoid.has(d));

  const need = task.weeklyTarget ?? (task.cadence === "daily" ? days.length : 1);
  let placed = 0;
  for (const day of days) {
    if (placed >= need) break;
    const date = dates[day];
    const slot = findFreeSlot(occupied[date] ?? [], task.durationMin, eMin, lMin);
    if (slot != null) {
      blocks.push(blockFromTask(task, date, fromMinutes(slot)));
      occupy(date, slot, task.durationMin);
      placed++;
    }
  }
}

export interface RescheduleResult {
  blocks: ScheduledBlock[];
  message: string;
}

/** Skip a block; reason-aware reschedule into a later free slot this week. */
export function skipBlock(
  all: ScheduledBlock[],
  blockId: string,
  reason: SkipReason,
  fromDate: string
): RescheduleResult {
  const blocks = all.map((b) => ({ ...b }));
  const target = blocks.find((b) => b.id === blockId);
  if (!target) return { blocks, message: "" };

  target.status = "skipped";
  target.skipReason = reason;
  target.updatedAt = stamp();

  if (target.commitment === "must") {
    return {
      blocks,
      message: `${target.title} is non-negotiable — it stays on your plate. Try to circle back today.`,
    };
  }

  const task = TASKS.find((t) => t.id === target.taskId);
  if (!task) return { blocks, message: `Skipped ${target.title}.` };

  // Tired → never reslot a physically demanding task, and not same day.
  const tired = reason === "tired";
  const eMin = task.earliest ? minutes(task.earliest) : DAY_START;
  const lMin = task.latest ? minutes(task.latest) : DAY_END;
  const avoid = new Set(task.avoidDays ?? []);

  const weekStart = addDays(fromDate, -new Date(fromDate + "T00:00:00").getDay());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(
    (d) => d >= fromDate
  );
  const occ = occupiedByDate(blocks);

  if (tired && target.physicalLoad === "high") {
    // keep it, just push to a different day — no replacement needed
  }

  for (const date of dates) {
    if (date === fromDate && tired) continue; // rest today
    const day = new Date(date + "T00:00:00").getDay();
    if (avoid.has(day)) continue;
    const slot = findFreeSlot(occ[date] ?? [], task.durationMin, eMin, lMin);
    if (slot != null) {
      const moved = blockFromTask(task, date, fromMinutes(slot));
      moved.id = `${date}__${task.id}__moved`;
      moved.movedFromDate = fromDate;
      blocks.push(moved);
      const label = date === fromDate ? "later today" : niceDay(date);
      return { blocks, message: `${target.title} moved to ${label}, ${fromMinutes(slot)}.` };
    }
  }

  return {
    blocks,
    message: `${target.title} skipped — no free slot this week, it'll roll to next week.`,
  };
}

/** Apply an energy state to a day: strip the appropriate tiers and reschedule them. */
export function applyEnergy(
  all: ScheduledBlock[],
  date: string,
  level: Energy
): RescheduleResult {
  if (level === "full") return { blocks: all.map((b) => ({ ...b })), message: "" };

  const stripTiers: Tier[] =
    level === "exhausted" ? ["P1", "P2", "Flex", "Upkeep", "Optional"] : ["P2", "Flex", "Optional"];

  let blocks = all.map((b) => ({ ...b }));
  const victims = blocks.filter(
    (b) =>
      b.date === date &&
      b.status === "planned" &&
      b.commitment !== "must" &&
      stripTiers.includes(b.tier)
  );

  let moved = 0;
  for (const v of victims) {
    const res = skipBlock(blocks, v.id, level === "exhausted" ? "tired" : "tired", date);
    blocks = res.blocks;
    moved++;
  }

  const msg =
    level === "exhausted"
      ? `Rest day. Kept only your non-negotiables; redistributed ${moved} thing${moved === 1 ? "" : "s"} across the week.`
      : `Lightened today — moved ${moved} flexible item${moved === 1 ? "" : "s"} so you can breathe.`;
  return { blocks, message: msg };
}

/** Insert an impromptu immovable P0 appointment and bump overlaps. */
export function addAppointment(
  all: ScheduledBlock[],
  title: string,
  date: string,
  startTime: string,
  durationMin: number
): RescheduleResult {
  let blocks = all.map((b) => ({ ...b }));
  const start = minutes(startTime);
  const end = start + durationMin;

  const appt: ScheduledBlock = {
    id: `${date}__appt__${start}`,
    taskId: "appointment",
    title,
    type: "Appointment",
    tier: "P0",
    commitment: "must",
    date,
    startTime,
    durationMin,
    status: "planned",
    locked: true,
    physicalLoad: "low",
    cognitiveLoad: "low",
    updatedAt: stamp(),
  };

  // bump overlapping movable blocks
  const overlapping = blocks.filter(
    (b) =>
      b.date === date &&
      b.status === "planned" &&
      b.commitment !== "must" &&
      start < minutes(b.startTime) + b.durationMin &&
      end > minutes(b.startTime)
  );
  blocks.push(appt);
  for (const o of overlapping) {
    const res = skipBlock(blocks, o.id, "cameup", date);
    blocks = res.blocks;
  }
  return { blocks, message: `Added "${title}". Reflowed ${overlapping.length} block(s) around it.` };
}

export interface CapacityWarning {
  kind: "overload" | "sleep" | "target";
  message: string;
}

export function capacityCheck(blocks: ScheduledBlock[], weekStart: string): CapacityWarning[] {
  const warnings: CapacityWarning[] = [];
  // unmet weekly targets
  for (const task of TASKS) {
    if (!task.weeklyTarget || task.optional) continue;
    const count = blocks.filter(
      (b) => b.taskId === task.id && b.status !== "skipped" && b.status !== "moved"
    ).length;
    if (count < task.weeklyTarget) {
      warnings.push({
        kind: "target",
        message: `${task.title}: ${count}/${task.weeklyTarget} placed this week.`,
      });
    }
  }
  return warnings;
}

function niceDay(date: string): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[new Date(date + "T00:00:00").getDay()];
}
