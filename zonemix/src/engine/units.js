// Level arithmetic. Levels are in dB; "power" is the linear energy
// quantity 10^(dB/10), which is what adds up when sounds combine.

export const OFF = -Infinity;

export function dbToPower(db) {
  return db === OFF ? 0 : 10 ** (db / 10);
}

export function powerToDb(power) {
  return power > 0 ? 10 * Math.log10(power) : OFF;
}

export function sumDb(levels) {
  let total = 0;
  for (const db of levels) total += dbToPower(db);
  return powerToDb(total);
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// Moves `current` toward `target` by at most `maxUp` or `maxDown` (both >= 0).
export function slew(current, target, maxUp, maxDown) {
  return current + clamp(target - current, -maxDown, maxUp);
}

// Fraction to move an exponential average for a step of dt seconds.
export function smoothing(dt, tauS) {
  return tauS > 0 ? 1 - Math.exp(-dt / tauS) : 1;
}

export const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
