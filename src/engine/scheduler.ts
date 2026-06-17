import type { ScheduledBlock, TaskDef, SkipReason, Energy, Tier } from "../types";
import { TASKS, commitmentForTier } from "../tasks";
import { addDays, minutes, fromMinutes, nowMinutes, todayYmd } from "./dates";

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
    locked: !!task.fixedSlots && !task.relocatable,
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

const RANK: Record<Tier, number> = { P0: 0, P1: 1, P2: 2, Flex: 3, Upkeep: 4, Optional: 5 };
// Coaching policy: a top-priority task may displace P2 and below (walks, hobbies,
// errands, chores) — but never work, class, or fitness (P0/P1).
const SACRIFICE_FROM = 2;
const DSA_MIN_DURATIONS = [120, 90, 60]; // never-zero: shrink before skipping

function dayIntervals(blocks: ScheduledBlock[], date: string, excludeId?: string): Interval[] {
  return blocks
    .filter((b) => b.date === date && b.id !== excludeId && b.status !== "skipped" && b.status !== "moved")
    .map((b) => ({ start: minutes(b.startTime), end: minutes(b.startTime) + b.durationMin }));
}

/** Move a weekly/biweekly task to another day this week. Daily tasks just drop — they recur tomorrow. */
function relocateAway(blocks: ScheduledBlock[], block: ScheduledBlock, fromDate: string, tired: boolean): void {
  const task = TASKS.find((t) => t.id === block.taskId);
  if (!task || task.cadence === "daily") {
    block.status = "skipped"; // recurs tomorrow — no duplicate, no cross-day move
    return;
  }
  block.status = "moved";
  const eMin = task.earliest ? minutes(task.earliest) : DAY_START;
  const lMin = task.latest ? minutes(task.latest) : DAY_END;
  const avoid = new Set(task.avoidDays ?? []);
  const weekStart = addDays(fromDate, -new Date(fromDate + "T00:00:00").getDay());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d > fromDate);
  for (const date of dates) {
    const day = new Date(date + "T00:00:00").getDay();
    if (avoid.has(day)) continue;
    if (tired && block.physicalLoad === "high") continue;
    const slot = findFreeSlot(dayIntervals(blocks, date), task.durationMin, eMin, lMin);
    if (slot != null) {
      const moved = blockFromTask(task, date, fromMinutes(slot));
      moved.id = `${date}__${task.id}__resched`;
      moved.movedFromDate = fromDate;
      blocks.push(moved);
      return;
    }
  }
  block.status = "skipped";
}

/** Keep a top-priority relocatable task (DSA) TODAY: use a gap, else displace P2-and-below, else shrink. */
function keepTopPriorityToday(
  blocks: ScheduledBlock[],
  target: ScheduledBlock,
  task: TaskDef,
  fromDate: string,
  tired: boolean
): RescheduleResult {
  const rawAfter = fromDate === todayYmd() ? Math.max(DAY_START, nowMinutes() + 5) : DAY_START;
  const afterMin = Math.ceil(rawAfter / 15) * 15; // snap to a clean 15-min grid
  target.status = "moved"; // free its slot; we re-add a placed block

  const tryPlace = (dur: number): RescheduleResult | null => {
    for (let s = afterMin; s + dur <= DAY_END; s += 15) {
      const e = s + dur;
      const overlap = blocks.filter(
        (b) =>
          b.date === fromDate &&
          b.id !== target.id &&
          b.status === "planned" &&
          minutes(b.startTime) < e &&
          minutes(b.startTime) + b.durationMin > s
      );
      // window is usable only if everything in it is low-priority and movable
      if (overlap.some((b) => b.locked || RANK[b.tier] < SACRIFICE_FROM)) continue;
      const freed: string[] = [];
      for (const o of overlap) {
        relocateAway(blocks, o, fromDate, tired);
        freed.push(o.title);
      }
      const placed = blockFromTask(task, fromDate, fromMinutes(s));
      placed.id = `${fromDate}__${task.id}__resched`;
      placed.durationMin = dur;
      placed.movedFromDate = target.movedFromDate ?? target.date;
      blocks.push(placed);
      const shortened = dur < task.durationMin ? ` (shortened to ${dur}m to fit)` : "";
      const cleared = freed.length ? ` — cleared ${freed.join(", ")}` : "";
      return { blocks, message: `${task.title} → today ${fromMinutes(s)}${shortened}${cleared}.` };
    }
    return null;
  };

  for (const dur of [task.durationMin, ...DSA_MIN_DURATIONS]) {
    const res = tryPlace(dur);
    if (res) return res;
  }
  target.status = "planned"; // genuinely no room — keep it owed, don't pretend it's done
  return { blocks, message: `No room for ${task.title} today even after clearing lower-priority — it stays owed. A short session tonight?` };
}

/** Skip/miss a block — priority-aware: DSA stays today (displacing fluff); fluff just yields. */
export function skipBlock(
  all: ScheduledBlock[],
  blockId: string,
  reason: SkipReason,
  fromDate: string
): RescheduleResult {
  const blocks = all.map((b) => ({ ...b }));
  const target = blocks.find((b) => b.id === blockId);
  if (!target) return { blocks, message: "" };

  target.skipReason = reason;
  target.updatedAt = stamp();
  const tired = reason === "tired";

  // Truly fixed must-dos (class, work, appointments) can't be time-shifted.
  if (target.commitment === "must" && target.locked) {
    target.status = "skipped";
    return { blocks, message: `${target.title} is a fixed commitment — logged as missed.` };
  }

  const task = TASKS.find((t) => t.id === target.taskId);
  if (!task) {
    target.status = "skipped";
    return { blocks, message: `Skipped ${target.title}.` };
  }

  // Relocatable top-priority work (DSA) is protected: it stays today.
  if (task.relocatable) return keepTopPriorityToday(blocks, target, task, fromDate, tired);

  // Everything else: weekly tasks move to another day; daily tasks recur tomorrow.
  const cadenceLabel = task.cadence === "daily" ? "it's back tomorrow" : "moved to a free slot this week";
  relocateAway(blocks, target, fromDate, tired);
  return { blocks, message: `${target.title} — ${cadenceLabel}.` };
}

/** On app open: auto-move overdue, movable/relocatable tasks to a later gap today. */
export function rolloverOverdue(all: ScheduledBlock[]): ScheduledBlock[] {
  const today = todayYmd();
  const now = nowMinutes();
  let blocks = all.map((b) => ({ ...b }));
  const overdue = blocks.filter(
    (b) =>
      b.date === today &&
      b.status === "planned" &&
      !(b.commitment === "must" && b.locked) && // leave fixed class/work alone
      minutes(b.startTime) + b.durationMin <= now // fully elapsed, untouched
  );
  for (const b of overdue) {
    const res = skipBlock(blocks, b.id, "notime", today);
    blocks = res.blocks;
  }
  return blocks;
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
