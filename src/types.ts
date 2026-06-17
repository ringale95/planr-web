// ---- Planr core data model ----

export type Tier = "P0" | "P1" | "P2" | "Flex" | "Upkeep" | "Optional";

export type TaskType =
  | "DSA" | "LeetCode" | "Class" | "Work"
  | "Gym" | "Walk"
  | "Painting" | "Reading" | "Social"
  | "Cook" | "Clean"
  | "Errand" | "Appointment" | "Rest";

export type Cadence = "daily" | "weekly" | "biweekly" | "oneoff";
export type Load = "low" | "med" | "high";
export type Commitment = "must" | "movable" | "optional";

export interface TaskDef {
  id: string;
  title: string;
  type: TaskType;
  tier: Tier;
  cadence: Cadence;
  durationMin: number;
  /** fixed-time anchors (day 0=Sun..6=Sat) */
  fixedSlots?: { day: number; time: string }[];
  /** for weekly-target tasks */
  weeklyTarget?: number;
  preferredDays?: number[];
  avoidDays?: number[];
  /** flexible placement window, "HH:MM" */
  earliest?: string;
  latest?: string;
  physicalLoad: Load;
  cognitiveLoad: Load;
  nonNegotiable?: boolean;
  /** Optional tier: soft, opportunistic suggestions */
  optional?: boolean;
}

export type BlockStatus = "planned" | "done" | "skipped" | "moved";
export type SkipReason = "tired" | "notime" | "notfeeling" | "cameup";
export type Energy = "full" | "low" | "exhausted";

export interface ScheduledBlock {
  id: string;
  taskId: string;
  title: string;
  type: TaskType;
  tier: Tier;
  commitment: Commitment;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  durationMin: number;
  status: BlockStatus;
  locked: boolean;    // fixed/appointments never move
  physicalLoad: Load;
  cognitiveLoad: Load;
  movedFromDate?: string;
  skipReason?: SkipReason;
  updatedAt: number;
}

export type ReviewAnswer = "yes" | "partly" | "no";

export interface WeeklyReview {
  weekStart: string;
  answers: Record<string, ReviewAnswer>;
  updatedAt: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  unit: string;
  metric: "leetcode" | "gym" | "classes" | "reading" | null;
  manualCurrent?: number;
}

export interface AppState {
  goalDeadline: string;          // YYYY-MM-DD (Feb 2027)
  weekStart: string;             // Sunday of the currently-generated week
  blocks: Record<string, ScheduledBlock>;
  energyByDate: Record<string, Energy>;
  reviews: Record<string, WeeklyReview>;
  goals: Goal[];
  weightLog: WeightEntry[];
  /** LeetCode counts logged manually, by difficulty */
  leetcode: { easy: number; medium: number; hard: number };
  /** rough pattern coverage: pattern -> count */
  patterns: Record<string, number>;
  updatedAt: number;
}
