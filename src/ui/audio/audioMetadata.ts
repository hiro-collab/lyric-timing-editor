import type { LyricTimingAudioRef } from "../../lyrics";

export const readAudioMetadata = (file: File): Promise<LyricTimingAudioRef> => new Promise((resolve) => {
  const audio = document.createElement("audio");
  const url = URL.createObjectURL(file);
  const cleanup = () => URL.revokeObjectURL(url);

  audio.preload = "metadata";
  audio.addEventListener("loadedmetadata", () => {
    const durationMs = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null;
    cleanup();
    resolve({ fileName: file.name, durationMs });
  }, { once: true });
  audio.addEventListener("error", () => {
    cleanup();
    resolve({ fileName: file.name, durationMs: null });
  }, { once: true });
  audio.src = url;
});
