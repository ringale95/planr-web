import type { TaskDef, Goal, Commitment, Tier } from "./types";

// Days: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

export const GOAL_DEADLINE = "2027-02-01"; // offer in hand before Feb 2027

export function commitmentForTier(tier: Tier): Commitment {
  if (tier === "P0") return "must";
  if (tier === "Optional") return "optional";
  return "movable";
}

/** The confirmed weekly methodology, encoded as recurring task definitions. */
export const TASKS: TaskDef[] = [
  // ---- P0: the future ----
  {
    id: "dsa",
    title: "DSA + LeetCode",
    type: "DSA",
    tier: "P0",
    cadence: "daily",
    durationMin: 150,
    fixedSlots: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, time: "05:30" })),
    physicalLoad: "low",
    cognitiveLoad: "high",
    nonNegotiable: true,
  },
  {
    id: "class",
    title: "Scaler class",
    type: "Class",
    tier: "P0",
    cadence: "weekly",
    durationMin: 60,
    fixedSlots: [
      { day: 0, time: "21:30" },
      { day: 2, time: "21:30" },
      { day: 4, time: "21:30" },
    ],
    physicalLoad: "low",
    cognitiveLoad: "high",
    nonNegotiable: true,
  },
  {
    id: "leetcode-pm",
    title: "LeetCode (evening)",
    type: "LeetCode",
    tier: "P0",
    cadence: "daily",
    durationMin: 90,
    preferredDays: [1, 3, 5, 6],
    earliest: "19:00",
    latest: "21:00",
    physicalLoad: "low",
    cognitiveLoad: "high",
  },

  // ---- P1: job + fitness ----
  {
    id: "work",
    title: "Work (Burnes)",
    type: "Work",
    tier: "P1",
    cadence: "weekly",
    durationMin: 330,
    fixedSlots: [1, 2, 3, 4, 5].map((day) => ({ day, time: "10:30" })),
    physicalLoad: "low",
    cognitiveLoad: "high",
    nonNegotiable: true,
  },
  {
    id: "gym",
    title: "Gym",
    type: "Gym",
    tier: "P1",
    cadence: "weekly",
    durationMin: 90,
    weeklyTarget: 3,
    preferredDays: [1, 3, 5],
    avoidDays: [0, 2, 4], // keep heavy load off class nights
    earliest: "16:00",
    latest: "19:00",
    physicalLoad: "high",
    cognitiveLoad: "low",
  },

  // ---- P2: walks ----
  {
    id: "walk",
    title: "Walk (10k steps)",
    type: "Walk",
    tier: "P2",
    cadence: "weekly",
    durationMin: 90,
    weeklyTarget: 3,
    preferredDays: [2, 6, 0],
    earliest: "16:00",
    latest: "19:30",
    physicalLoad: "med",
    cognitiveLoad: "low",
  },

  // ---- Flex: life & growth ----
  {
    id: "painting",
    title: "Painting",
    type: "Painting",
    tier: "Flex",
    cadence: "weekly",
    durationMin: 90,
    weeklyTarget: 1,
    preferredDays: [6, 0],
    earliest: "14:00",
    latest: "20:00",
    physicalLoad: "low",
    cognitiveLoad: "low",
  },
  {
    id: "reading",
    title: "Reading",
    type: "Reading",
    tier: "Flex",
    cadence: "daily",
    durationMin: 30,
    earliest: "22:00",
    latest: "23:00",
    physicalLoad: "low",
    cognitiveLoad: "low",
  },
  {
    id: "social",
    title: "Friends / out",
    type: "Social",
    tier: "Flex",
    cadence: "biweekly",
    durationMin: 180,
    weeklyTarget: 1,
    preferredDays: [5, 6],
    earliest: "18:00",
    latest: "21:00",
    physicalLoad: "low",
    cognitiveLoad: "low",
  },

  // ---- Upkeep ----
  {
    id: "cook",
    title: "Cook / eat",
    type: "Cook",
    tier: "Upkeep",
    cadence: "daily",
    durationMin: 60,
    earliest: "18:00",
    latest: "20:00",
    physicalLoad: "low",
    cognitiveLoad: "low",
  },
  {
    id: "clean",
    title: "Tidy room",
    type: "Clean",
    tier: "Upkeep",
    cadence: "daily",
    durationMin: 15,
    earliest: "20:00",
    latest: "21:30",
    physicalLoad: "low",
    cognitiveLoad: "low",
  },

  // ---- Optional (opportunistic suggestions) ----
  {
    id: "grocery",
    title: "Grocery run",
    type: "Errand",
    tier: "Optional",
    cadence: "weekly",
    durationMin: 60,
    weeklyTarget: 2,
    earliest: "11:00",
    latest: "19:00",
    physicalLoad: "low",
    cognitiveLoad: "low",
    optional: true,
  },
  {
    id: "starbucks",
    title: "Starbucks / treat",
    type: "Errand",
    tier: "Optional",
    cadence: "weekly",
    durationMin: 45,
    weeklyTarget: 2,
    earliest: "11:00",
    latest: "18:00",
    physicalLoad: "low",
    cognitiveLoad: "low",
    optional: true,
  },
];

export const GOALS: Goal[] = [
  { id: "g-leetcode", title: "LeetCode problems", target: 300, unit: "problems", metric: "leetcode" },
  { id: "g-gym", title: "Gym sessions", target: 3, unit: "/ week", metric: "gym" },
  { id: "g-classes", title: "Classes attended", target: 90, unit: "classes", metric: "classes" },
  { id: "g-weight", title: "Weight → 54kg", target: 54, unit: "kg", metric: null, manualCurrent: 58 },
];
