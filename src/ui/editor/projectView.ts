import type { LyricTimingIssue, LyricTimingProject } from "../../lyrics";

const formatMs = (value: number | null | undefined) => (
  typeof value === "number" && Number.isFinite(value)
    ? `${Math.max(0, Math.round(value))} ms (${(Math.max(0, Math.round(value)) / 1000).toFixed(3)}s)`
    : "unmarked"
);

const makeTimeEntry = (label: string, value: number | null | undefined) => {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = formatMs(value);
  wrapper.append(term, description);
  return wrapper;
};

export const renderLineList = (container: HTMLElement, project: LyricTimingProject) => {
  container.replaceChildren(...project.lines.map((line) => {
    const row = document.createElement("div");
    row.className = `line-row is-${line.kind}`;

    const marker = document.createElement("span");
    marker.className = "line-marker";
    marker.textContent = line.kind === "phrase" ? `#${line.phraseId?.replace("phrase-", "")}` : line.kind;

    const body = document.createElement("span");
    body.className = "line-body";
    body.textContent = line.text || line.rawText || "section break";

    const source = document.createElement("span");
    source.className = "line-source";
    source.textContent = `L${line.sourceLine}`;

    row.append(marker, body, source);
    return row;
  }));
};

export const renderPhraseList = (container: HTMLElement, project: LyricTimingProject) => {
  container.replaceChildren(...project.phrases.map((phrase) => {
    const row = document.createElement("div");
    row.className = "phrase-row";

    const head = document.createElement("div");
    head.className = "phrase-head";

    const id = document.createElement("strong");
    id.textContent = `${phrase.index + 1}. ${phrase.id}`;

    const source = document.createElement("span");
    source.textContent = `line ${phrase.sourceLine}`;
    head.append(id, source);

    const text = document.createElement("p");
    text.textContent = phrase.text;

    const times = document.createElement("dl");
    times.className = "time-grid";
    times.append(
      makeTimeEntry("startTimeMs", phrase.startTimeMs),
      makeTimeEntry("endTimeMs", phrase.endTimeMs)
    );

    row.append(head, text, times);
    return row;
  }));
};

export const renderIssues = (issues: LyricTimingIssue[]) => (
  issues.length
    ? issues.map((issue) => `${issue.level}: ${issue.message}`).join(" / ")
    : "No validation issues"
);
