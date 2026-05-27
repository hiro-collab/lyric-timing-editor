import {
  LYRIC_TIMING_PROJECT_SCHEMA,
  type LyricTextParseMode,
  type LyricTimingAudioRef,
  type LyricTimingPhrase,
  type LyricTimingProject,
  type LyricTimingProjectLine,
  type LyricTimingSongleRef
} from "./lyricTimingTypes";

export type ParseLyricTextOptions = {
  mode?: LyricTextParseMode;
};

export type CreateLyricTimingProjectOptions = {
  slug?: string;
  title?: string;
  artist?: string;
  durationMs?: number | null;
  songUrl?: string;
  songleUrl?: string;
  textAliveUrl?: string;
  songle?: LyricTimingSongleRef | null;
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

export type TransferReparsedPhraseTimingResult = {
  project: LyricTimingProject;
  kept: number;
};

export type NormalizeLyricTimingProjectInputResult =
  | { ok: true; project: LyricTimingProject }
  | {
      ok: false;
      reason:
        | "not-object"
        | "unsupported-schema"
        | "missing-source"
        | "source-too-large"
        | "too-many-phrases";
    };

export const MAX_IMPORTED_PROJECT_SOURCE_LENGTH = 1_000_000;
export const MAX_IMPORTED_PROJECT_PHRASES = 5_000;

const MAX_IMPORTED_PROJECT_LINES = 10_000;
const MAX_METADATA_LENGTH = 500;
const MAX_URL_LENGTH = 2_048;
const MAX_NOTES_LENGTH = 10_000;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_SLUG_LENGTH = 64;
const MAX_SONGLE_CODE_LENGTH = 128;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type UnknownRecord = Record<string, unknown>;
type ImportedProjectSourceResult =
  | { ok: true; sourceText: string }
  | {
      ok: false;
      reason:
        | "missing-source"
        | "source-too-large"
        | "too-many-phrases";
    };

const padId = (value: number) => String(value).padStart(4, "0");

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const normalizeOptionalString = (value: string | undefined, maxLength = MAX_METADATA_LENGTH) => {
  const trimmed = value?.replace(/\u0000/g, "").trim().slice(0, maxLength);
  return trimmed ? trimmed : undefined;
};

export const normalizeSlug = (value: string | undefined) => {
  const trimmed = value?.trim().toLowerCase().slice(0, MAX_SLUG_LENGTH);
  return trimmed && SLUG_PATTERN.test(trimmed) ? trimmed : undefined;
};

const normalizeNullableMs = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
};

const normalizeNullableMsInput = (value: unknown) => (
  typeof value === "number" || value === null ? normalizeNullableMs(value) : null
);

const normalizeOptionalHttpUrl = (value: string | undefined) => {
  const trimmed = normalizeOptionalString(value, MAX_URL_LENGTH);
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const normalizeAudioRef = (value: LyricTimingAudioRef | UnknownRecord | undefined) => {
  if (!value) return undefined;
  const record = value as UnknownRecord;
  const fileName = typeof record.fileName === "string"
    ? normalizeOptionalString(record.fileName, MAX_FILE_NAME_LENGTH)
    : undefined;
  const durationMs = normalizeNullableMsInput(record.durationMs);
  if (!fileName && durationMs === null) return undefined;
  return { ...(fileName ? { fileName } : {}), durationMs };
};

const normalizeIntegerField = (value: unknown) => (
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined
);

const phraseHasTiming = (phrase: LyricTimingPhrase) => (
  phrase.startTimeMs !== null ||
  phrase.endTimeMs !== null ||
  (phrase.words ?? []).some((word) => word.startTimeMs !== null || word.endTimeMs !== null)
);

const phraseTimingSignature = (phrase: LyricTimingPhrase) => [
  phrase.displayMode ?? "text",
  phrase.text.trim()
].join("\u0000");

const copyPhraseTiming = (phrase: LyricTimingPhrase, previous: LyricTimingPhrase): LyricTimingPhrase => ({
  ...phrase,
  startTimeMs: previous.startTimeMs,
  endTimeMs: previous.endTimeMs,
  words: structuredClone(previous.words ?? [])
});

const matchPhraseSignatures = (previousPhrases: LyricTimingPhrase[], nextPhrases: LyricTimingPhrase[]) => {
  const previousSignatures = previousPhrases.map(phraseTimingSignature);
  const nextSignatures = nextPhrases.map(phraseTimingSignature);
  const width = nextSignatures.length + 1;
  const scores = new Uint16Array((previousSignatures.length + 1) * width);

  for (let previousIndex = previousSignatures.length - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let nextIndex = nextSignatures.length - 1; nextIndex >= 0; nextIndex -= 1) {
      const scoreIndex = previousIndex * width + nextIndex;
      scores[scoreIndex] = previousSignatures[previousIndex] === nextSignatures[nextIndex]
        ? scores[(previousIndex + 1) * width + nextIndex + 1] + 1
        : Math.max(scores[(previousIndex + 1) * width + nextIndex], scores[scoreIndex + 1]);
    }
  }

  const matches: Array<[number, number]> = [];
  let previousIndex = 0;
  let nextIndex = 0;
  while (previousIndex < previousSignatures.length && nextIndex < nextSignatures.length) {
    if (previousSignatures[previousIndex] === nextSignatures[nextIndex]) {
      matches.push([previousIndex, nextIndex]);
      previousIndex += 1;
      nextIndex += 1;
      continue;
    }
    if (scores[(previousIndex + 1) * width + nextIndex] > scores[previousIndex * width + nextIndex + 1]) {
      previousIndex += 1;
    } else {
      nextIndex += 1;
    }
  }

  return matches;
};

const normalizeSongleRef = (value: LyricTimingSongleRef | UnknownRecord | null | undefined) => {
  if (!value) return null;
  const record = value as UnknownRecord;
  const id = normalizeIntegerField(record.id);
  const artistId = normalizeIntegerField(record.artistId);
  const url = typeof record.url === "string" ? normalizeOptionalHttpUrl(record.url) : undefined;
  const permalink = typeof record.permalink === "string" ? normalizeOptionalHttpUrl(record.permalink) : undefined;
  const code = typeof record.code === "string" ? normalizeOptionalString(record.code, MAX_SONGLE_CODE_LENGTH) : undefined;
  const createdAt = typeof record.createdAt === "string" ? normalizeOptionalString(record.createdAt) : undefined;
  const updatedAt = typeof record.updatedAt === "string" ? normalizeOptionalString(record.updatedAt) : undefined;
  const recognizedAt = typeof record.recognizedAt === "string" ? normalizeOptionalString(record.recognizedAt) : undefined;
  const result: LyricTimingSongleRef = {
    ...(id !== undefined ? { id } : {}),
    ...(artistId !== undefined ? { artistId } : {}),
    ...(url ? { url } : {}),
    ...(permalink ? { permalink } : {}),
    ...(code ? { code } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(recognizedAt ? { recognizedAt } : {})
  };
  return Object.keys(result).length ? result : null;
};

const getStringField = (record: UnknownRecord, key: string, maxLength = MAX_METADATA_LENGTH) => (
  typeof record[key] === "string" ? normalizeOptionalString(record[key], maxLength) : undefined
);

const normalizeTimestamp = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
};

const sourceTextFromImportedProject = (record: UnknownRecord): ImportedProjectSourceResult => {
  if (Array.isArray(record.lines)) {
    if (record.lines.length > MAX_IMPORTED_PROJECT_LINES) return { ok: false, reason: "source-too-large" };
    const sourceText = record.lines.map((line) => (
      isRecord(line) && typeof line.rawText === "string" ? line.rawText : ""
    )).join("\n");
    return { ok: true, sourceText };
  }

  if (Array.isArray(record.phrases)) {
    if (record.phrases.length > MAX_IMPORTED_PROJECT_PHRASES) return { ok: false, reason: "too-many-phrases" };
    const sourceText = record.phrases.map((phrase) => (
      isRecord(phrase) && typeof phrase.text === "string" ? phrase.text : ""
    )).join("\n");
    return { ok: true, sourceText };
  }

  return { ok: false, reason: "missing-source" };
};

const overlayImportedPhraseTiming = (
  phrase: LyricTimingPhrase,
  importedPhrase: unknown
): LyricTimingPhrase => {
  if (!isRecord(importedPhrase)) return phrase;
  const startTimeMs = normalizeNullableMsInput(importedPhrase.startTimeMs);
  const importedEndTimeMs = normalizeNullableMsInput(importedPhrase.endTimeMs);
  const endTimeMs = startTimeMs !== null && importedEndTimeMs !== null && importedEndTimeMs <= startTimeMs
    ? null
    : importedEndTimeMs;
  return { ...phrase, startTimeMs, endTimeMs, words: [] };
};

const unescapeTextAliveHash = (trimmedLine: string) => (
  trimmedLine.startsWith("\\#") ? trimmedLine.slice(1) : trimmedLine
);

const BLANK_PHRASE_MARKERS = new Set([
  "[blank]",
  "[no lyrics]",
  "[no lyric]",
  "[nolyrics]",
  "[instrumental]",
  "[歌詞なし]",
  "[無表示]"
]);

const isBlankPhraseMarker = (trimmedLine: string) => (
  BLANK_PHRASE_MARKERS.has(trimmedLine.toLowerCase())
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
    const isBlankPhrase = isBlankPhraseMarker(trimmed);
    const phraseText = isBlankPhrase ? "" : (mode === "textalive" ? unescapeTextAliveHash(trimmed) : trimmed);

    lines.push({
      id: `line-${padId(sourceLine)}`,
      kind: "phrase",
      sourceLine,
      rawText,
      text: phraseText,
      phraseId,
      ...(isBlankPhrase ? { displayMode: "blank" as const } : {})
    });
    phrases.push({
      id: phraseId,
      index: phraseIndex,
      sourceLine,
      text: phraseText,
      ...(isBlankPhrase ? { displayMode: "blank" as const } : {}),
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
    slug: normalizeSlug(options.slug),
    title: normalizeOptionalString(options.title) ?? "",
    artist: normalizeOptionalString(options.artist) ?? "",
    durationMs: normalizeNullableMs(options.durationMs),
    songUrl: normalizeOptionalHttpUrl(options.songUrl),
    songleUrl: normalizeOptionalHttpUrl(options.songleUrl),
    textAliveUrl: normalizeOptionalHttpUrl(options.textAliveUrl),
    songle: normalizeSongleRef(options.songle),
    audioRef: normalizeAudioRef(options.audioRef),
    parseMode,
    createdAt: now,
    updatedAt: now,
    notes: options.notes?.slice(0, MAX_NOTES_LENGTH) ?? "",
    lines: parsed.lines,
    phrases: parsed.phrases
  };
};

export const transferReparsedPhraseTiming = (
  previousProject: LyricTimingProject,
  nextProject: LyricTimingProject
): TransferReparsedPhraseTimingResult => {
  const matches = matchPhraseSignatures(previousProject.phrases, nextProject.phrases);
  let kept = 0;
  const previousByNextIndex = new Map<number, LyricTimingPhrase>();
  for (const [previousIndex, nextIndex] of matches) {
    const previous = previousProject.phrases[previousIndex];
    previousByNextIndex.set(nextIndex, previous);
    if (phraseHasTiming(previous)) kept += 1;
  }

  return {
    project: {
      ...nextProject,
      phrases: nextProject.phrases.map((phrase, index) => {
        const previous = previousByNextIndex.get(index);
        return previous ? copyPhraseTiming(phrase, previous) : phrase;
      })
    },
    kept
  };
};

export const updateLyricTimingProjectMetadata = (
  project: LyricTimingProject,
  updates: Partial<Pick<
    LyricTimingProject,
    "slug" | "title" | "artist" | "durationMs" | "songUrl" | "songleUrl" | "textAliveUrl" | "songle" | "audioRef" | "notes"
  >>,
  now = new Date()
): LyricTimingProject => ({
  ...project,
  ...updates,
  slug: "slug" in updates ? normalizeSlug(updates.slug) : project.slug,
  title: updates.title !== undefined ? (normalizeOptionalString(updates.title) ?? "") : project.title,
  artist: updates.artist !== undefined ? (normalizeOptionalString(updates.artist) ?? "") : project.artist,
  durationMs: "durationMs" in updates ? normalizeNullableMs(updates.durationMs) : project.durationMs,
  songUrl: "songUrl" in updates ? normalizeOptionalHttpUrl(updates.songUrl) : project.songUrl,
  songleUrl: "songleUrl" in updates ? normalizeOptionalHttpUrl(updates.songleUrl) : project.songleUrl,
  textAliveUrl: "textAliveUrl" in updates ? normalizeOptionalHttpUrl(updates.textAliveUrl) : project.textAliveUrl,
  songle: "songle" in updates ? normalizeSongleRef(updates.songle) : project.songle,
  audioRef: "audioRef" in updates ? normalizeAudioRef(updates.audioRef) : project.audioRef,
  notes: updates.notes !== undefined ? updates.notes.slice(0, MAX_NOTES_LENGTH) : project.notes,
  updatedAt: now.toISOString()
});

export const normalizeLyricTimingProjectInput = (
  value: unknown
): NormalizeLyricTimingProjectInputResult => {
  if (!isRecord(value)) return { ok: false, reason: "not-object" };
  if (value.schema !== LYRIC_TIMING_PROJECT_SCHEMA) return { ok: false, reason: "unsupported-schema" };

  const source = sourceTextFromImportedProject(value);
  if (!source.ok) return source;
  if (source.sourceText.length > MAX_IMPORTED_PROJECT_SOURCE_LENGTH) {
    return { ok: false, reason: "source-too-large" };
  }

  const parseMode: LyricTextParseMode = value.parseMode === "literal" ? "literal" : "textalive";
  const project = createLyricTimingProject({
    slug: getStringField(value, "slug", MAX_SLUG_LENGTH),
    title: getStringField(value, "title"),
    artist: getStringField(value, "artist"),
    durationMs: normalizeNullableMsInput(value.durationMs),
    songUrl: getStringField(value, "songUrl", MAX_URL_LENGTH),
    songleUrl: getStringField(value, "songleUrl", MAX_URL_LENGTH),
    textAliveUrl: getStringField(value, "textAliveUrl", MAX_URL_LENGTH),
    songle: isRecord(value.songle) ? normalizeSongleRef(value.songle as LyricTimingSongleRef) : null,
    audioRef: isRecord(value.audioRef) ? normalizeAudioRef(value.audioRef as LyricTimingAudioRef) : undefined,
    parseMode,
    lyricText: source.sourceText,
    notes: getStringField(value, "notes", MAX_NOTES_LENGTH)
  });

  if (project.phrases.length > MAX_IMPORTED_PROJECT_PHRASES) {
    return { ok: false, reason: "too-many-phrases" };
  }

  const importedPhrases = Array.isArray(value.phrases) ? value.phrases : [];
  return {
    ok: true,
    project: {
      ...project,
      createdAt: normalizeTimestamp(value.createdAt) ?? project.createdAt,
      updatedAt: normalizeTimestamp(value.updatedAt) ?? project.updatedAt,
      phrases: project.phrases.map((phrase, index) => overlayImportedPhraseTiming(phrase, importedPhrases[index]))
    }
  };
};
