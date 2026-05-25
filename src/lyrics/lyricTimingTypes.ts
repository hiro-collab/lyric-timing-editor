export const LYRIC_TIMING_PROJECT_SCHEMA = "music-effect.lyric-timing-workbench.project.v1" as const;
export const LYRIC_TIMING_EXPORT_SCHEMA = "music-effect.lyrics-timing.v2" as const;

export type LyricTextParseMode = "textalive" | "literal";

export type LyricTimingAudioRef = {
  fileName?: string;
  durationMs?: number | null;
};

export type LyricTimingProjectLineKind = "phrase" | "sectionBreak" | "comment";

export type LyricTimingProjectLine = {
  id: string;
  kind: LyricTimingProjectLineKind;
  sourceLine: number;
  rawText: string;
  text?: string;
  phraseId?: string;
};

export type LyricTimingCharacter = {
  id: string;
  index: number;
  text: string;
  startTimeMs: number | null;
  endTimeMs: number | null;
};

export type LyricTimingWord = {
  id: string;
  index: number;
  text: string;
  startTimeMs: number | null;
  endTimeMs: number | null;
  chars?: LyricTimingCharacter[];
};

export type LyricTimingPhrase = {
  id: string;
  index: number;
  sourceLine: number;
  text: string;
  startTimeMs: number | null;
  endTimeMs: number | null;
  words?: LyricTimingWord[];
};

export type LyricTimingProject = {
  schema: typeof LYRIC_TIMING_PROJECT_SCHEMA;
  title: string;
  artist: string;
  durationMs: number | null;
  songUrl?: string;
  songleUrl?: string;
  textAliveUrl?: string;
  audioRef?: LyricTimingAudioRef;
  parseMode: LyricTextParseMode;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  lines: LyricTimingProjectLine[];
  phrases: LyricTimingPhrase[];
};

export type LyricTimingIssueLevel = "error" | "warning";

export type LyricTimingIssue = {
  level: LyricTimingIssueLevel;
  code: string;
  message: string;
  path?: string;
};

export type LyricTimingExportPhrase = {
  id: string;
  index: number;
  startTimeMs: number;
  endTimeMs: number;
  text?: string;
  sourceLine?: number;
};

export type LyricTimingExportV2 = {
  schema: typeof LYRIC_TIMING_EXPORT_SCHEMA;
  title: string;
  artist: string;
  durationMs: number | null;
  generatedAt: string;
  sourceProjectSchema: typeof LYRIC_TIMING_PROJECT_SCHEMA;
  timeUnit: "ms";
  includesLyrics: boolean;
  rightsNotice: string;
  phrases: LyricTimingExportPhrase[];
};
