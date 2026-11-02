/**
 * Optional joy on a correct answer (§15.9): a two-note chime (only when Sounds is on, off by default)
 * and a short buzz (only when Vibration is on, mobile only). Both fail silently.
 */

let audio: AudioContext | undefined;

/** G5 → C6 sine chime, about half a second, quiet. */
export function chime(): void {
  try {
    const Ctx = typeof window === 'undefined' ? undefined : window.AudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    (
      [
        [784, 0],
        [1047, 0.14],
      ] as const
    ).forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const at = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.45);
      osc.start(at);
      osc.stop(at + 0.5);
    });
  } catch {
    /* no audio: that's fine */
  }
}

/** A 30 ms buzz where the device supports it. */
export function buzz(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(30);
  } catch {
    /* not supported */
  }
}
