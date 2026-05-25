import {
  LYRIC_TIMING_EXPORT_SCHEMA,
  LYRIC_TIMING_PROJECT_SCHEMA,
  type LyricTimingExportV2,
  type LyricTimingExportPhrase,
  type LyricTimingIssue,
  type LyricTimingPhrase,
  type LyricTimingProject
} from "./lyricTimingTypes";

export const LYRIC_TIMING_RIGHTS_NOTICE =
  "Before publishing, distributing, uploading, or committing files that include lyric text, confirm the lyric rights and the destination terms.";

export type LyricTimingExportOptions = {
  includeLyrics: boolean;
  includeSourceLine?: boolean;
  generatedAt?: Date;
  fallbackLastDurationMs?: number;
};

export type LyricTimingExportResult =
  | { ok: true; exportData: LyricTimingExportV2; issues: LyricTimingIssue[] }
  | { ok: false; issues: LyricTimingIssue[] };

const isNonNegativeInteger = (value: unknown): value is number => (
  typeof value === "number" && Number.isInteger(value) && value >= 0
);

export const validateLyricTimingProject = (project: LyricTimingProject): LyricTimingIssue[] => {
  const issues: LyricTimingIssue[] = [];
  if (project.schema !== LYRIC_TIMING_PROJECT_SCHEMA) {
    issues.push({
      level: "error",
      code: "schema",
      message: `Unsupported project schema: ${String(project.schema)}`,
      path: "schema"
    });
  }
  if (project.durationMs !== null && !isNonNegativeInteger(project.durationMs)) {
    issues.push({
      level: "error",
      code: "duration-unit",
      message: "durationMs must be a non-negative integer or null.",
      path: "durationMs"
    });
  }

  const phraseIds = new Set<string>();
  project.phrases.forEach((phrase, index) => {
    const path = `phrases[${index}]`;
    if (phraseIds.has(phrase.id)) {
      issues.push({ level: "error", code: "duplicate-id", message: `Duplicate phrase id: ${phrase.id}`, path: `${path}.id` });
    }
    phraseIds.add(phrase.id);
    if (phrase.index !== index) {
      issues.push({ level: "warning", code: "index-order", message: "Phrase index does not match array order.", path: `${path}.index` });
    }
    if (!phrase.text.trim()) {
      issues.push({ level: "warning", code: "empty-phrase", message: "Phrase text is empty.", path: `${path}.text` });
    }
    if (phrase.startTimeMs !== null && !isNonNegativeInteger(phrase.startTimeMs)) {
      issues.push({ level: "error", code: "start-unit", message: "startTimeMs must be a non-negative integer or null.", path: `${path}.startTimeMs` });
    }
    if (phrase.endTimeMs !== null && !isNonNegativeInteger(phrase.endTimeMs)) {
      issues.push({ level: "error", code: "end-unit", message: "endTimeMs must be a non-negative integer or null.", path: `${path}.endTimeMs` });
    }
    if (phrase.startTimeMs !== null && phrase.endTimeMs !== null && phrase.endTimeMs <= phrase.startTimeMs) {
      issues.push({ level: "error", code: "end-before-start", message: "endTimeMs must be later than startTimeMs.", path });
    }
    if (project.durationMs !== null && phrase.startTimeMs !== null && phrase.startTimeMs > project.durationMs) {
      issues.push({ level: "warning", code: "start-after-duration", message: "startTimeMs is later than project durationMs.", path: `${path}.startTimeMs` });
    }
  });

  return issues;
};

const computeEndTimeMs = (
  phrase: LyricTimingPhrase,
  nextPhrase: LyricTimingPhrase | undefined,
  projectDurationMs: number | null,
  fallbackLastDurationMs: number
) => {
  if (phrase.startTimeMs === null) return null;
  if (phrase.endTimeMs !== null) return phrase.endTimeMs;
  if (nextPhrase?.startTimeMs !== null && nextPhrase?.startTimeMs !== undefined) return nextPhrase.startTimeMs;
  if (projectDurationMs !== null && projectDurationMs > phrase.startTimeMs) return projectDurationMs;
  return phrase.startTimeMs + fallbackLastDurationMs;
};

export const makeLyricTimingExport = (
  project: LyricTimingProject,
  options: LyricTimingExportOptions
): LyricTimingExportResult => {
  const issues = validateLyricTimingProject(project);
  const blockingIssues: LyricTimingIssue[] = [...issues.filter((issue) => issue.level === "error")];
  const fallbackLastDurationMs = options.fallbackLastDurationMs ?? 3500;
  const phrases: LyricTimingExportPhrase[] = [];

  project.phrases.forEach((phrase, index) => {
    if (phrase.startTimeMs === null) {
      blockingIssues.push({
        level: "error",
        code: "missing-start",
        message: `Phrase ${index + 1} has no startTimeMs.`,
        path: `phrases[${index}].startTimeMs`
      });
      return;
    }

    const endTimeMs = computeEndTimeMs(phrase, project.phrases[index + 1], project.durationMs, fallbackLastDurationMs);
    if (endTimeMs === null || endTimeMs <= phrase.startTimeMs) {
      blockingIssues.push({
        level: "error",
        code: "missing-end",
        message: `Phrase ${index + 1} needs an endTimeMs later than startTimeMs.`,
        path: `phrases[${index}].endTimeMs`
      });
      return;
    }

    phrases.push({
      id: phrase.id,
      index: phrase.index,
      startTimeMs: phrase.startTimeMs,
      endTimeMs,
      ...(options.includeLyrics ? { text: phrase.text } : {}),
      ...(options.includeSourceLine ? { sourceLine: phrase.sourceLine } : {})
    });
  });

  if (blockingIssues.length) return { ok: false, issues: blockingIssues };

  return {
    ok: true,
    issues: issues.filter((issue) => issue.level === "warning"),
    exportData: {
      schema: LYRIC_TIMING_EXPORT_SCHEMA,
      title: project.title,
      artist: project.artist,
      durationMs: project.durationMs,
      generatedAt: (options.generatedAt ?? new Date()).toISOString(),
      sourceProjectSchema: LYRIC_TIMING_PROJECT_SCHEMA,
      timeUnit: "ms",
      includesLyrics: options.includeLyrics,
      rightsNotice: LYRIC_TIMING_RIGHTS_NOTICE,
      phrases
    }
  };
};
