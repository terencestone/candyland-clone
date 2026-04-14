/**
 * Procedural upbeat “candy / unicorn / bubblegum” loop via Web Audio.
 * No external assets — avoids licensing and hosting.
 */

const BPM = 122;

/** C major pentatonic: semitone offsets from C5 (MIDI 72) */
const PENT_OFF: readonly number[] = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

/** Indices into PENT_OFF — 32 eighth notes (4 bars), loops */
const MELODY: readonly number[] = [
  4, 5, 7, 5, 4, 2, 0, 3, 4, 5, 7, 6, 5, 4, 3, 2,
  0, 2, 4, 5, 7, 6, 5, 4, 4, 5, 7, 6, 5, 4, 2, 3,
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pentIndexToHz(i: number): number {
  const idx = ((i % PENT_OFF.length) + PENT_OFF.length) % PENT_OFF.length;
  return midiToHz(72 + PENT_OFF[idx]!);
}

function pluck(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  duration: number,
  gain: number,
  type: OscillatorType,
  detune: number,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  osc.detune.setValueAtTime(detune, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.018);
  g.gain.exponentialRampToValueAtTime(0.0008, when + duration);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + duration + 0.04);
}

function softKick(ctx: AudioContext, dest: AudioNode, when: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(165, when);
  osc.frequency.exponentialRampToValueAtTime(48, when + 0.07);
  g.gain.setValueAtTime(0.11, when);
  g.gain.exponentialRampToValueAtTime(0.0009, when + 0.11);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + 0.12);
}

function sparkle(ctx: AudioContext, dest: AudioNode, when: number, freq: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.038, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0005, when + 0.22);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + 0.25);
}

export type CandyMusicHandle = {
  start: () => void;
  stop: () => void;
  setMasterGain: (linear: number) => void;
};

export function createCandyDreamMusic(ctx: AudioContext): CandyMusicHandle {
  const master = ctx.createGain();
  master.gain.value = 0.2;
  master.connect(ctx.destination);

  const beatDur = 60 / BPM;
  const eighthDur = beatDur / 2;

  let running = false;
  let step = 0;
  let nextAt = 0;
  let raf = 0;

  const scheduleWindow = 0.35;

  function scheduleChunk() {
    const now = ctx.currentTime;
    const horizon = now + scheduleWindow;
    while (running && nextAt < horizon) {
      const t = nextAt;
      const i = step % MELODY.length;
      const pentIdx = MELODY[i] ?? 0;
      const hz = pentIndexToHz(pentIdx);

      pluck(ctx, master, t, hz, 0.22, 0.11, "sine", 0);
      pluck(ctx, master, t, hz * 2, 0.16, 0.04, "triangle", 6);

      if (step % 2 === 0) {
        const bassIdx = Math.max(0, pentIdx - 2);
        pluck(
          ctx,
          master,
          t,
          pentIndexToHz(bassIdx) * 0.5,
          0.35,
          0.038,
          "triangle",
          -3,
        );
      }

      if (step % 8 === 0) {
        softKick(ctx, master, t);
      }
      if (step % 8 === 4) {
        softKick(ctx, master, t + 0.001);
      }

      if (step % 7 === 3) {
        sparkle(ctx, master, t + 0.02, hz * 4);
      }

      nextAt += eighthDur;
      step += 1;
    }
  }

  function tick() {
    if (!running) return;
    scheduleChunk();
    raf = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      step = 0;
      nextAt = ctx.currentTime + 0.05;
      scheduleChunk();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setMasterGain(linear: number) {
      const g = Math.max(0, linear) * 0.2;
      const now = ctx.currentTime;
      if (g < 0.0001) {
        master.gain.setValueAtTime(0, now);
      } else {
        master.gain.setTargetAtTime(g, now, 0.02);
      }
    },
  };
}
