import { useCallback, useEffect, useRef, useState } from "react";
import { createCandyDreamMusic, type CandyMusicHandle } from "./candyDreamMusic";

const STORAGE_KEY = "candyland-music";

function readPreference(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function writePreference(on: boolean) {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function useCandyBackgroundMusic() {
  const [enabled, setEnabled] = useState(readPreference);
  const ctxRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<CandyMusicHandle | null>(null);
  const startedRef = useRef(false);

  const ensureAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctx =
        globalThis.AudioContext ||
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
      musicRef.current = createCandyDreamMusic(ctxRef.current);
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return musicRef.current;
  }, []);

  const startPlayback = useCallback(async () => {
    const music = await ensureAudio();
    if (!music) return;
    music.setMasterGain(1);
    music.start();
    startedRef.current = true;
  }, [ensureAudio]);

  const stopPlayback = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    music.stop();
    music.setMasterGain(0);
    startedRef.current = false;
  }, []);

  const setEnabledAndPersist = useCallback(
    (on: boolean) => {
      setEnabled(on);
      writePreference(on);
    },
    [],
  );

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabledAndPersist(next);
    if (next) {
      await startPlayback();
    } else {
      stopPlayback();
    }
  }, [enabled, setEnabledAndPersist, startPlayback, stopPlayback]);

  useEffect(() => {
    if (!enabled) return;
    const onFirstGesture = async () => {
      if (startedRef.current) return;
      await startPlayback();
    };
    document.addEventListener("pointerdown", onFirstGesture, { passive: true });
    return () => document.removeEventListener("pointerdown", onFirstGesture);
  }, [enabled, startPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
      ctxRef.current?.close().catch(() => {});
    };
  }, [stopPlayback]);

  return { enabled, toggle };
}
