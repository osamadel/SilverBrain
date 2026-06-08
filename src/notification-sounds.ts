// Pomodoro session-end notification presets (Web Audio synthesis).

export type NotificationSoundId = "chime" | "bell" | "digital" | "pop" | "gentle";

export const NOTIFICATION_SOUND_IDS: readonly NotificationSoundId[] = [
  "chime",
  "bell",
  "digital",
  "pop",
  "gentle",
];

const PEAK = 0.42;
const PEAK_SOFT = 0.3;

export function normalizeSoundId(id: unknown): NotificationSoundId {
  if (typeof id === "string" && (NOTIFICATION_SOUND_IDS as readonly string[]).includes(id)) {
    return id as NotificationSoundId;
  }
  return "digital";
}

function playTone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  peak = PEAK,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const attack = Math.min(0.025, duration * 0.08);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.06);
}

/** Four-note ascending arpeggio — ding-dong-ding-DONG. */
function playChime(ctx: AudioContext, t0: number) {
  playTone(ctx, 523.25, t0, 0.38, PEAK);
  playTone(ctx, 659.25, t0 + 0.32, 0.38, PEAK * 0.92);
  playTone(ctx, 523.25, t0 + 0.64, 0.38, PEAK * 0.88);
  playTone(ctx, 783.99, t0 + 0.96, 0.55, PEAK);
}

/** Double bell strike with a long shared decay. */
function playBell(ctx: AudioContext, t0: number) {
  for (const [offset, peak, freq] of [
    [0, PEAK, 880],
    [0.55, PEAK * 0.72, 988],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = t0 + offset;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.75);
    osc.start(start);
    osc.stop(start + 1.8);
  }
}

/** Classic beep-beep · beep-beep notification pattern. */
function playDigital(ctx: AudioContext, t0: number) {
  for (const offset of [0, 0.18, 0.72, 0.9]) {
    playTone(ctx, 660, t0 + offset, 0.28, PEAK, "square");
  }
}

/** Three bubbly pops with a short echo tail. */
function playPop(ctx: AudioContext, t0: number) {
  for (const [offset, peak, startHz, endHz, dur] of [
    [0, PEAK, 880, 220, 0.22],
    [0.38, PEAK * 0.82, 760, 200, 0.2],
    [0.72, PEAK * 0.65, 640, 180, 0.18],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = t0 + offset;
    osc.frequency.setValueAtTime(startHz, start);
    osc.frequency.exponentialRampToValueAtTime(endHz, start + dur * 0.65);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
}

/** Two slow ascending swells — calm but unmistakable. */
function playGentle(ctx: AudioContext, t0: number) {
  for (const [offset, startHz, endHz, peak] of [
    [0, 220, 440, PEAK_SOFT],
    [0.82, 330, 523.25, PEAK_SOFT * 0.88],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = t0 + offset;
    const dur = 0.72;
    osc.frequency.setValueAtTime(startHz, start);
    osc.frequency.linearRampToValueAtTime(endHz, start + dur * 0.85);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.06);
  }
}

const PRESETS: Record<NotificationSoundId, (ctx: AudioContext, t0: number) => void> = {
  chime: playChime,
  bell: playBell,
  digital: playDigital,
  pop: playPop,
  gentle: playGentle,
};

export function playNotificationSound(id: NotificationSoundId | string): void {
  const sound = normalizeSoundId(id);
  try {
    const ctx = new AudioContext();
    void ctx.resume();
    PRESETS[sound](ctx, ctx.currentTime);
  } catch {
    /* audio not available */
  }
}
