import {
  LYRIC_TIMING_PROJECT_SCHEMA,
  type LyricTextParseMode,
  type LyricTimingAudioRef,
  type LyricTimingPhrase,
  type LyricTimingProject,
  type LyricTimingProjectLine
} from "./lyricTimingTypes";

export type ParseLyricTextOptions = {
  mode?: LyricTextParseMode;
};

export type CreateLyricTimingProjectOptions = {
  title?: string;
  artist?: string;
  durationMs?: number | null;
  songUrl?: string;
  songleUrl?: string;
  textAliveUrl?: string;
  audioRef?: LyricTimingAudioRef;
  parseMode?: LyricTextParseMode;
  lyricText?: string;
  notes?: string;
  now?: Date;
};

export type ParsedLyricText = {
  mode: LyricTextParseMode;
  lines: LyricTimingProjectLine[];
  phrases: LyricTimingPhrase[];
};

const padId = (value: number) => String(value).padStart(4, "0");

const normalizeOptionalString = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeNullableMs = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
};

const unescapeTextAliveHash = (trimmedLine: string) => (
  trimmedLine.startsWith("\\#") ? trimmedLine.slice(1) : trimmedLine
);

export const parseLyricText = (
  lyricText: string,
  options: ParseLyricTextOptions = {}
): ParsedLyricText => {
  const mode = options.mode ?? "textalive";
  const normalized = lyricText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const sourceLines = normalized.split("\n");
  const lines: LyricTimingProjectLine[] = [];
  const phrases: LyricTimingPhrase[] = [];

  sourceLines.forEach((rawText, zeroBasedLine) => {
    const sourceLine = zeroBasedLine + 1;
    const trimmed = rawText.trim();

    if (!trimmed) {
      lines.push({
        id: `section-${padId(sourceLine)}`,
        kind: "sectionBreak",
        sourceLine,
        rawText
      });
      return;
    }

    if (mode === "textalive" && trimmed.startsWith("#")) {
      lines.push({
        id: `comment-${padId(sourceLine)}`,
        kind: "comment",
        sourceLine,
        rawText,
        text: trimmed.slice(1).trim()
      });
      return;
    }

    const phraseIndex = phrases.length;
    const phraseId = `phrase-${padId(phraseIndex + 1)}`;
    const phraseText = mode === "textalive" ? unescapeTextAliveHash(trimmed) : trimmed;

    lines.push({
      id: `line-${padId(sourceLine)}`,
      kind: "phrase",
      sourceLine,
      rawText,
      text: phraseText,
      phraseId
    });
    phrases.push({
      id: phraseId,
      index: phraseIndex,
      sourceLine,
      text: phraseText,
      startTimeMs: null,
      endTimeMs: null,
      words: []
    });
  });

  return { mode, lines, phrases };
};

export const createLyricTimingProject = (
  options: CreateLyricTimingProjectOptions = {}
): LyricTimingProject => {
  const now = (options.now ?? new Date()).toISOString();
  const parseMode = options.parseMode ?? "textalive";
  const parsed = parseLyricText(options.lyricText ?? "", { mode: parseMode });
  return {
    schema: LYRIC_TIMING_PROJECT_SCHEMA,
    title: options.title?.trim() ?? "",
    artist: options.artist?.trim() ?? "",
    durationMs: normalizeNullableMs(options.durationMs),
    songUrl: normalizeOptionalString(options.songUrl),
    songleUrl: normalizeOptionalString(options.songleUrl),
    textAliveUrl: normalizeOptionalString(options.textAliveUrl),
    audioRef: options.audioRef,
    parseMode,
    createdAt: now,
    updatedAt: now,
    notes: options.notes ?? "",
    lines: parsed.lines,
    phrases: parsed.phrases
  };
};

export const updateLyricTimingProjectMetadata = (
  project: LyricTimingProject,
  updates: Partial<Pick<
    LyricTimingProject,
    "title" | "artist" | "durationMs" | "songUrl" | "songleUrl" | "textAliveUrl" | "audioRef" | "notes"
  >>,
  now = new Date()
): LyricTimingProject => ({
  ...project,
  ...updates,
  title: updates.title?.trim() ?? project.title,
  artist: updates.artist?.trim() ?? project.artist,
  durationMs: "durationMs" in updates ? normalizeNullableMs(updates.durationMs) : project.durationMs,
  songUrl: "songUrl" in updates ? normalizeOptionalString(updates.songUrl) : project.songUrl,
  songleUrl: "songleUrl" in updates ? normalizeOptionalString(updates.songleUrl) : project.songleUrl,
  textAliveUrl: "textAliveUrl" in updates ? normalizeOptionalString(updates.textAliveUrl) : project.textAliveUrl,
  updatedAt: now.toISOString()
});
