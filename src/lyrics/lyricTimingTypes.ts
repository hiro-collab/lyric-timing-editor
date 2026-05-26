export const LYRIC_TIMING_PROJECT_SCHEMA = "lyric-timing-editor.project.v1" as const;
export const LYRIC_TIMING_EXPORT_SCHEMA = "music-effect.lyrics-timing.v2" as const;

export type LyricTextParseMode = "textalive" | "literal";

export type LyricTimingAudioRef = {
  fileName?: string;
  durationMs?: number | null;
};

export type LyricTimingSongleRef = {
  id?: number;
  artistId?: number;
  url?: string;
  permalink?: string;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
  recognizedAt?: string;
};

export type LyricTimingProjectLineKind = "phrase" | "sectionBreak" | "comment";

export type LyricTimingProjectLine = {
  id: string;
  kind: LyricTimingProjectLineKind;
  sourceLine: number;
  rawText: string;
  text?: string;
  phraseId?: string;
  displayMode?: "blank";
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
  displayMode?: "blank";
  startTimeMs: number | null;
  endTimeMs: number | null;
  words?: LyricTimingWord[];
};

export type LyricTimingProject = {
  schema: typeof LYRIC_TIMING_PROJECT_SCHEMA;
  slug?: string;
  title: string;
  artist: string;
  durationMs: number | null;
  songUrl?: string;
  songleUrl?: string;
  textAliveUrl?: string;
  songle?: LyricTimingSongleRef | null;
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
  displayMode?: "blank";
  sourceLine: number;
};

export type LyricTimingExportV2 = {
  schema: typeof LYRIC_TIMING_EXPORT_SCHEMA;
  slug?: string;
  title: string;
  artist: string;
  durationMs: number | null;
  generatedAt: string;
  sourceProjectSchema: typeof LYRIC_TIMING_PROJECT_SCHEMA;
  timeUnit: "ms";
  includesLyrics: boolean;
  rightsNotice: string;
  songle?: LyricTimingSongleRef | null;
  phrases: LyricTimingExportPhrase[];
};
