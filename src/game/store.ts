import { create } from "zustand";

export type Phase = "boot" | "title" | "playing" | "paused" | "dead" | "clear" | "win";
export type DeathCause = "fall" | "hit" | "time" | null;

export type GameUI = {
  phase: Phase;
  loading: boolean;
  loadError: string | null;
  score: number;
  coins: number;
  coinBank: number;
  lives: number;
  time: number;
  level: number;
  levelName: string;
  highScore: number;
  unlocked: number;
  lastLevel: number;
  muted: boolean;
  shake: boolean;
  hasHoney: boolean;
  toast: string;
  deathCause: DeathCause;
  canCheckpoint: boolean;
  deaths: number;
  banner: string;
  honeyHint: boolean;
  secrets: number;
  secretTotal: number;
  coinTotal: number;
  gliding: boolean;
  best: number[];
};

export const useGameUI = create<GameUI>(() => ({
  phase: "title",
  loading: true,
  loadError: null,
  score: 0,
  coins: 0,
  coinBank: 0,
  lives: 3,
  time: 240,
  level: 1,
  levelName: "银杏坡",
  highScore: 0,
  unlocked: 1,
  lastLevel: 1,
  muted: false,
  shake: true,
  hasHoney: false,
  toast: "",
  deathCause: null,
  canCheckpoint: false,
  deaths: 0,
  banner: "",
  honeyHint: false,
  secrets: 0,
  secretTotal: 0,
  coinTotal: 0,
  gliding: false,
  best: [0, 0, 0],
}));
