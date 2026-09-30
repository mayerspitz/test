import { OFF, dbToPower, powerToDb } from './units.js';

/**
 * Rolling equivalent continuous level (Leq) over a fixed window, fed one
 * block (normally 1 s) at a time. Used for sound-level limits written as
 * "no more than X dB(A) averaged over 15 or 60 minutes".
 */
export class RollingLeq {
  constructor(windowS, blockS = 1) {
    this.blockS = blockS;
    this.size = Math.max(1, Math.round(windowS / blockS));
    this.blocks = [];
  }

  push(levelDb) {
    this.blocks.push(dbToPower(levelDb));
    if (this.blocks.length > this.size) this.blocks.shift();
  }

  /** Leq over the time recorded so far, at most the window. */
  leqDb() {
    if (this.blocks.length === 0) return OFF;
    return powerToDb(this.blocks.reduce((s, p) => s + p, 0) / this.blocks.length);
  }

  /**
   * Highest steady level allowed for the next `lookaheadS` seconds so the
   * Leq over the full window stays at or below maxDb. Before the window has
   * filled, the missing time counts as quiet.
   */
  allowedDb(maxDb, lookaheadS = 60) {
    const look = Math.min(this.size, Math.max(1, Math.round(lookaheadS / this.blockS)));
    const keep = this.size - look;
    let used = 0;
    for (let i = Math.max(0, this.blocks.length - keep); i < this.blocks.length; i++) used += this.blocks[i];
    const budget = this.size * dbToPower(maxDb) - used;
    return budget > 0 ? powerToDb(budget / look) : OFF;
  }
}
