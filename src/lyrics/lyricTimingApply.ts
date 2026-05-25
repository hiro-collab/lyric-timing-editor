import type { LyricTimingExportV2 } from "./lyricTimingTypes";

export type LyricCue = {
  index?: number;
  time: number;
  end: number;
  text: string;
};

const msToSeconds = (value: number) => Math.round(value) / 1000;

export const lyricTimingExportToLyricCues = (
  exportData: LyricTimingExportV2,
  fallbackTexts: string[] = []
): LyricCue[] => exportData.phrases.map((phrase, arrayIndex) => ({
  index: phrase.index,
  time: msToSeconds(phrase.startTimeMs),
  end: msToSeconds(phrase.endTimeMs),
  text: phrase.text ?? fallbackTexts[phrase.index] ?? fallbackTexts[arrayIndex] ?? ""
}));
