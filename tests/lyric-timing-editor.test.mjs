import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourceRoot = new URL("../src/lyrics/", import.meta.url);

const transpile = async (fileName) => {
  const source = await readFile(new URL(fileName, sourceRoot), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
    .replaceAll('from "./lyricTimingTypes"', 'from "./lyricTimingTypes.js"')
    .replaceAll('from "./lyricTimingProject"', 'from "./lyricTimingProject.js"');
};

const loadLyricsModules = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "lyric-timing-test-"));
  await writeFile(join(tempDir, "package.json"), JSON.stringify({ type: "module" }));
  for (const fileName of ["lyricTimingTypes.ts", "lyricTimingProject.ts", "lyricTimingExport.ts"]) {
    await writeFile(join(tempDir, fileName.replace(".ts", ".js")), await transpile(fileName));
  }
  return {
    project: await import(new URL(`file:///${join(tempDir, "lyricTimingProject.js").replaceAll("\\", "/")}`)),
    exportModule: await import(new URL(`file:///${join(tempDir, "lyricTimingExport.js").replaceAll("\\", "/")}`))
  };
};

test("TextAlive parse mode preserves comments, section breaks, and escaped hash lyrics", async () => {
  const { project } = await loadLyricsModules();
  const parsed = project.parseLyricText("# intro\n\\#hash lyric\n\n青い空へ行く", { mode: "textalive" });

  assert.equal(parsed.phrases.length, 2);
  assert.equal(parsed.lines[0].kind, "comment");
  assert.equal(parsed.lines[1].kind, "phrase");
  assert.equal(parsed.lines[1].text, "#hash lyric");
  assert.equal(parsed.lines[2].kind, "sectionBreak");
  assert.equal(parsed.phrases[0].id, "phrase-0001");
  assert.equal(parsed.phrases[0].sourceLine, 2);
});

test("Literal parse mode treats leading hash as lyric text", async () => {
  const { project } = await loadLyricsModules();
  const parsed = project.parseLyricText("# not a comment", { mode: "literal" });

  assert.equal(parsed.phrases.length, 1);
  assert.equal(parsed.lines[0].kind, "phrase");
  assert.equal(parsed.phrases[0].text, "# not a comment");
});

test("Blank phrase markers create intentional no-lyric phrases", async () => {
  const { project, exportModule } = await loadLyricsModules();
  const workbenchProject = project.createLyricTimingProject({
    title: "Demo",
    artist: "Tester",
    durationMs: 10000,
    lyricText: "first\n[blank]\nsecond"
  });

  assert.equal(workbenchProject.phrases.length, 3);
  assert.equal(workbenchProject.phrases[1].text, "");
  assert.equal(workbenchProject.phrases[1].displayMode, "blank");
  assert.equal(workbenchProject.phrases[1].sourceLine, 2);
  assert.equal(workbenchProject.lines[1].displayMode, "blank");
  assert.equal(exportModule.validateLyricTimingProject(workbenchProject).some((issue) => issue.code === "empty-phrase"), false);

  workbenchProject.phrases[0].startTimeMs = 1000;
  workbenchProject.phrases[1].startTimeMs = 3000;
  workbenchProject.phrases[2].startTimeMs = 5000;
  const result = exportModule.makeLyricTimingExport(workbenchProject, { includeLyrics: true, generatedAt: new Date(0) });

  assert.equal(result.ok, true);
  assert.equal(result.exportData.phrases[1].displayMode, "blank");
  assert.equal(result.exportData.phrases[1].sourceLine, 2);
  assert.equal(result.exportData.phrases[1].text, "");
});

test("Reparsed lyric timing follows unchanged phrases across line edits", async () => {
  const { project } = await loadLyricsModules();
  const original = project.createLyricTimingProject({
    lyricText: "alpha\nbeta\ngamma"
  });
  original.phrases[0].startTimeMs = 1000;
  original.phrases[1].startTimeMs = 2000;
  original.phrases[2].startTimeMs = 3000;

  const inserted = project.createLyricTimingProject({
    lyricText: "alpha\ninserted\nbeta\ngamma"
  });
  const insertedTransfer = project.transferReparsedPhraseTiming(original, inserted);
  assert.equal(insertedTransfer.kept, 3);
  assert.deepEqual(
    insertedTransfer.project.phrases.map((phrase) => phrase.startTimeMs),
    [1000, null, 2000, 3000]
  );

  const edited = project.createLyricTimingProject({
    lyricText: "alpha\nchanged\ngamma"
  });
  const editedTransfer = project.transferReparsedPhraseTiming(original, edited);
  assert.equal(editedTransfer.kept, 2);
  assert.deepEqual(
    editedTransfer.project.phrases.map((phrase) => phrase.startTimeMs),
    [1000, null, 3000]
  );
});

test("v2 export blocks incomplete phrases and omits text for timing-only export", async () => {
  const { project, exportModule } = await loadLyricsModules();
  const workbenchProject = project.createLyricTimingProject({
    slug: "demo-song",
    title: "Demo",
    artist: "Tester",
    durationMs: 10000,
    lyricText: "first\nsecond",
    songle: {
      id: 123,
      url: "https://songle.jp/songs/example"
    }
  });

  assert.equal(exportModule.makeLyricTimingExport(workbenchProject, { includeLyrics: false }).ok, false);

  workbenchProject.phrases[0].startTimeMs = 1000;
  workbenchProject.phrases[1].startTimeMs = 4000;
  const result = exportModule.makeLyricTimingExport(workbenchProject, { includeLyrics: false, generatedAt: new Date(0) });

  assert.equal(result.ok, true);
  assert.equal(result.exportData.schema, "music-effect.lyrics-timing.v2");
  assert.equal(result.exportData.sourceProjectSchema, "lyric-timing-editor.project.v1");
  assert.equal(result.exportData.slug, "demo-song");
  assert.equal(result.exportData.timeUnit, "ms");
  assert.equal(result.exportData.includesLyrics, false);
  assert.equal(result.exportData.rightsNotice.includes("does not include lyric text"), true);
  assert.equal(result.exportData.songle.id, 123);
  assert.equal(result.exportData.phrases[0].endTimeMs, 4000);
  assert.equal(result.exportData.phrases[0].sourceLine, 1);
  assert.equal("text" in result.exportData.phrases[0], false);
});

test("v2 export includes lyrics and lyric-specific rights notice when requested", async () => {
  const { project, exportModule } = await loadLyricsModules();
  const workbenchProject = project.createLyricTimingProject({
    title: "Demo",
    artist: "Tester",
    durationMs: 10000,
    lyricText: "first"
  });
  workbenchProject.phrases[0].startTimeMs = 1000;
  const result = exportModule.makeLyricTimingExport(workbenchProject, { includeLyrics: true, generatedAt: new Date(0) });

  assert.equal(result.ok, true);
  assert.equal(result.exportData.includesLyrics, true);
  assert.equal(result.exportData.rightsNotice.includes("includes lyric text"), true);
  assert.equal(result.exportData.phrases[0].text, "first");
});

test("v2 export derives contiguous end times from the next phrase start", async () => {
  const { project, exportModule } = await loadLyricsModules();
  const workbenchProject = project.createLyricTimingProject({
    title: "Demo",
    artist: "Tester",
    durationMs: 10000,
    lyricText: "first\nsecond\nthird"
  });
  workbenchProject.phrases[0].startTimeMs = 1000;
  workbenchProject.phrases[0].endTimeMs = 1500;
  workbenchProject.phrases[1].startTimeMs = 4000;
  workbenchProject.phrases[1].endTimeMs = 3500;
  workbenchProject.phrases[2].startTimeMs = 7000;

  const result = exportModule.makeLyricTimingExport(workbenchProject, { includeLyrics: false, generatedAt: new Date(0) });

  assert.equal(result.ok, true);
  assert.equal(result.exportData.phrases[0].endTimeMs, 4000);
  assert.equal(result.exportData.phrases[1].endTimeMs, 7000);
  assert.equal(result.exportData.phrases[2].endTimeMs, 10000);
  assert.equal(result.issues.some((issue) => issue.code === "explicit-end-derived-mismatch"), true);
  assert.equal(result.issues.some((issue) => issue.code === "explicit-end-before-start"), true);
});

test("WebVTT and LRC exports use completed phrase timings", async () => {
  const { project, exportModule } = await loadLyricsModules();
  const workbenchProject = project.createLyricTimingProject({
    title: "Demo <Song>",
    artist: "Tester",
    durationMs: 10000,
    lyricText: "first & line\nsecond line"
  });
  workbenchProject.phrases[0].startTimeMs = 1000;
  workbenchProject.phrases[1].startTimeMs = 4000;

  const vtt = exportModule.makeWebVttExport(workbenchProject);
  assert.equal(vtt.ok, true);
  assert.match(vtt.fileText, /^WEBVTT/);
  assert.match(vtt.fileText, /phrase-0001\n00:00:01\.000 --> 00:00:04\.000\nfirst &amp; line/);

  const lrc = exportModule.makeLrcExport(workbenchProject);
  assert.equal(lrc.ok, true);
  assert.match(lrc.fileText, /\[ti:Demo <Song>\]/);
  assert.match(lrc.fileText, /\[length:00:10\.00\]/);
  assert.match(lrc.fileText, /\[00:01\.00\]first & line/);
});

test("Project JSON import normalizes untrusted fields before use", async () => {
  const { project } = await loadLyricsModules();
  const original = project.createLyricTimingProject({
    slug: "safe-song",
    title: "Demo",
    artist: "Tester",
    durationMs: 10000,
    songUrl: "https://example.com/watch",
    lyricText: "first\nsecond"
  });
  const imported = {
    ...original,
    slug: "../../bad",
    songUrl: "javascript:alert(1)",
    audioRef: { fileName: "track.mp3", durationMs: "9999" },
    songle: { id: "123", url: "javascript:alert(1)" },
    phrases: original.phrases.map((phrase, index) => ({
      ...phrase,
      startTimeMs: index === 0 ? "<img src=x onerror=alert(1)>" : 4000,
      endTimeMs: index === 0 ? 3000 : 2000
    }))
  };

  const result = project.normalizeLyricTimingProjectInput(imported);

  assert.equal(result.ok, true);
  assert.equal(result.project.slug, undefined);
  assert.equal(result.project.songUrl, undefined);
  assert.deepEqual(result.project.songle, null);
  assert.deepEqual(result.project.audioRef, { fileName: "track.mp3", durationMs: null });
  assert.equal(result.project.phrases[0].startTimeMs, null);
  assert.equal(result.project.phrases[0].endTimeMs, 3000);
  assert.equal(result.project.phrases[1].startTimeMs, 4000);
  assert.equal(result.project.phrases[1].endTimeMs, null);
});

test("Project JSON import rejects unsupported and oversized inputs", async () => {
  const { project } = await loadLyricsModules();

  assert.deepEqual(
    project.normalizeLyricTimingProjectInput({ schema: "other", lines: [] }),
    { ok: false, reason: "unsupported-schema" }
  );
  const oversized = {
    schema: "lyric-timing-editor.project.v1",
    lines: [{ rawText: "x".repeat(project.MAX_IMPORTED_PROJECT_SOURCE_LENGTH + 1) }]
  };
  assert.deepEqual(project.normalizeLyricTimingProjectInput(oversized), { ok: false, reason: "source-too-large" });
});
