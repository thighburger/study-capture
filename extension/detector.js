// Ignore small antialiasing/noise changes; compare the fraction of changed pixels.
export function difference(a, b, tolerance = 24) {
  if (!a || !b || a.length !== b.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])) > tolerance) changed++;
  }
  return changed / (a.length / 4);
}
export class Detector {
  constructor(threshold = .03, settleMs = 600) {
    this.threshold = threshold; this.settleMs = settleMs;
    this.saved = null; this.anchor = null; this.since = 0;
  }
  observe(pixels, now) {
    if (!this.anchor || difference(this.anchor, pixels) > .008) {
      this.anchor = pixels.slice(); this.since = now; return false;
    }
    return now - this.since >= this.settleMs && difference(this.saved, pixels) >= this.threshold;
  }
  commit(pixels) { this.saved = pixels.slice(); }
}
