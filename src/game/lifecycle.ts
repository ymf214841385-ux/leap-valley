import type { Phase } from "./store";

/** Cancels in-flight async startup so a destroyed instance cannot finish booting. */
export class StartupGuard {
  private seq = 0;
  private cancelled = false;

  begin(): { stale: () => boolean } {
    const token = ++this.seq;
    this.cancelled = false;
    return {
      stale: () => this.cancelled || token !== this.seq,
    };
  }

  cancel() {
    this.cancelled = true;
    this.seq += 1;
  }
}

/** Pause input must be applied before deciding whether this frame simulates. */
export function phaseAfterPauseInput(phase: Phase, pausePressed: boolean): Phase {
  if (!pausePressed) return phase;
  if (phase === "playing") return "paused";
  if (phase === "paused") return "playing";
  return phase;
}
