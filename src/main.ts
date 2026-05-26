import {
  createLyricTimingProject,
  makeLrcExport,
  makeLyricTimingExport,
  makeWebVttExport,
  normalizeLyricTimingProjectInput,
  updateLyricTimingProjectMetadata,
  validateLyricTimingProject,
  type LyricTimingIssue,
  type LyricTextParseMode,
  type LyricTimingPhrase,
  type LyricTimingProject
} from "./lyrics";
import { readAudioMetadata } from "./ui/audio/audioMetadata";
import { renderIssues } from "./ui/editor/projectView";
import "./styles.css";

type Language = "ja" | "en";
type FocusMode = "follow" | "manual";
type StatusMessage = {
  key: string;
  values?: Record<string, string | number>;
};
type ValidationUiState = "ok" | "warning" | "error";
type Snapshot = {
  project: LyricTimingProject;
  selectedPhraseIndex: number;
  focusMode: FocusMode;
  selectedPhraseIndexes: number[];
  selectionAnchorIndex: number | null;
};
type AutoSaveDraft = Snapshot & {
  id: string;
  schema: "lyric-timing-editor.autosave.v1";
  savedAt: string;
  sourceText: string;
};
type ParseLyricsOptions = {
  selectPhraseIndex?: number;
  focusMode?: FocusMode;
  statusKey?: string;
};
type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "unavailable";
type SaveFilePickerOptionsLike = {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
};
type FileSystemWritableFileStreamLike = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};
type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
};
type TrackGeometry = {
  left: number;
  width: number;
};
type SequenceDragState =
  | {
      type: "seek";
      pointerId: number;
      track: TrackGeometry;
    }
  | {
      type: "range";
      pointerId: number;
      startClientX: number;
      currentClientX: number;
      track: TrackGeometry;
      additive: boolean;
      subtractive: boolean;
    }
  | {
      type: "move";
      pointerId: number;
      startClientX: number;
      currentClientX: number;
      track: TrackGeometry;
      minOffsetMs: number;
      maxOffsetMs: number;
      previewOffsetMs: number;
      moved: boolean;
    };

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptionsLike) => Promise<FileSystemFileHandleLike>;
  }
}

const LANGUAGE_STORAGE_KEY = "lyric-timing-editor:language";
const VOLUME_STORAGE_KEY = "lyric-timing-editor:volume";
const AUTOSAVE_DB_NAME = "lyric-timing-editor";
const AUTOSAVE_STORE_NAME = "drafts";
const AUTOSAVE_RECORD_ID = "latest";
const AUTOSAVE_SCHEMA = "lyric-timing-editor.autosave.v1";
const AUTOSAVE_DELAY_MS = 600;
const MIN_TIMING_GAP_MS = 1;
const TIMING_NUDGE_MS = 10;
const SEEK_STEP_MS = 1000;
const SEEK_FINE_STEP_MS = 100;
const SEEK_LARGE_STEP_MS = 5000;
const DRAG_START_THRESHOLD_PX = 3;
const FINE_DRAG_SCALE = 0.16;
const MAX_LYRIC_TEXT_BYTES = 1_000_000;
const MAX_PROJECT_JSON_BYTES = 2_000_000;
const MAX_AUDIO_BYTES = 512 * 1024 * 1024;
const MAX_LYRIC_PHRASES = 5_000;
const LYRIC_FILE_EXTENSIONS = [".txt", ".lrc"];
const PROJECT_FILE_EXTENSIONS = [".json"];
const AUDIO_FILE_EXTENSIONS = [".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"];
const BLANK_SOURCE_MARKER = "[blank]";
const SAFE_DEMO_LYRIC_TEXT = [
  "# synthetic demo",
  "\\#hash marker stays lyric text",
  "",
  "架空の光が拍を数える",
  "Synthetic cue line one",
  "Synthetic cue line two"
].join("\n");

const i18n: Record<Language, Record<string, string>> = {
  ja: {
    appSubtitle: "ローカル歌詞タイミング編集ツール",
    actionGroupAudio: "音源",
    actionGroupLyrics: "歌詞",
    actionGroupProject: "作業Project",
    actionGroupExport: "書き出し",
    actionGroupUtility: "表示",
    loadAudio: "音源を読み込む",
    loadLyrics: "歌詞を読み込む",
    moreSource: "歌詞テキスト",
    parseMode: "解析モード",
    parseTextAlive: "TextAlive互換",
    parseLiteral: "そのまま",
    pasteLyrics: "歌詞テキスト",
    blankSourceHint: "改行ごとにフレーズが分かれます。空白行は区切りです。無表示区間は [blank] を1行として入れます。「表示中フレーズ」は左の現在のフレーズ、またはリストで選択中のフレーズです。",
    insertBlankLine: "カーソル位置に[blank]",
    insertBlankBeforeCurrent: "表示中フレーズの前に[blank]",
    insertBlankAfterCurrent: "表示中フレーズの後に[blank]",
    sourceSearchHint: "歌詞テキスト内の文字列を検索・置換します。正規表現は使いません。大文字小文字は区別します。",
    sourceSearchLabel: "検索",
    sourceReplaceLabel: "置換後",
    sourceFindPrev: "前へ",
    sourceFindNext: "次へ",
    sourceReplaceOne: "1件置換",
    sourceReplaceAll: "すべて置換",
    loadSafeDemo: "安全なデモ文",
    parseLyrics: "歌詞リストに反映",
    saveLyricsText: "歌詞TXT保存",
    projectDetails: "プロジェクト詳細",
    loadProject: "作業Project読込",
    saveProject: "作業Project保存",
    exportMenu: "Export",
    exportMusicEffect: "Music Effect v2",
    exportTimingOnly: "Timingのみ",
    exportTimingOnlyHint: "公開repo向け推奨。全フレーズの時刻が必要",
    exportWithLyrics: "歌詞込み",
    exportWithLyricsHint: "歌詞権利確認が必要",
    exportGeneralFormats: "汎用形式",
    exportWebVtt: "WebVTT",
    exportLrc: "LRC",
    exportLyricsRequiredHint: "歌詞権利確認が必要",
    help: "Help",
    clearLocalData: "下書き削除",
    volume: "音量",
    volumePercent: "音量 {percent}%",
    playbackPosition: "再生位置",
    sequenceSeekHint: "クリック/ドラッグで再生位置を移動。Ctrl+ドラッグで範囲選択。ホイールまたは←/→で微調整、Shiftで細かく調整。",
    audioFile: "音源",
    duration: "長さ",
    projectState: "Project",
    currentPhrase: "現在のフレーズ",
    nextTarget: "Next Target",
    nextPhrase: "次のフレーズ",
    followPlayback: "再生に追従",
    followPlaybackTitle: "再生位置に合わせて現在フレーズを切り替えます",
    returnToFollowPlayback: "追従に戻す",
    followModeActive: "再生に追従中",
    manualModeActive: "手動選択中",
    followModeHint: "現在フレーズは再生位置に合わせて切り替わります",
    manualModeHint: "選んだフレーズを固定表示中です。再生位置では切り替わりません",
    manualSelection: "手動選択",
    play: "再生",
    pause: "停止",
    audioRequiredHint: "再生には音源を読み込む",
    stampCurrent: "現在を打刻",
    stampNext: "次を打刻",
    shiftEarlier10: "-10 ms",
    shiftLater10: "+10 ms",
    evenSpacing: "均一化",
    evenSpacingWithUntimed: "未打刻も含めて均一配置",
    clearSelectionTiming: "未打刻に戻す",
    clearSelection: "選択解除",
    selectionSummary: "選択中: {count}件 / 打刻済み{timed} / 未打刻{untimed}",
    dragFineHint: "Shiftを押しながらドラッグすると細かく移動できます",
    localDraft: "下書き",
    autosaveIdle: "下書きなし",
    autosavePending: "自動保存待機中",
    autosaveSaving: "自動保存中",
    autosaveSaved: "自動保存済み {time}",
    autosaveError: "自動保存失敗",
    autosaveErrorDetail: "ブラウザのローカルストレージにアクセスできませんでした",
    autosaveSkippedLargeDraft: "歌詞テキストが大きすぎるため自動保存を停止しました",
    autosaveUnavailable: "自動保存不可",
    draftAvailableTitle: "前回の未保存作業があります",
    draftAvailableBody: "{time} の自動保存下書きがあります。音源ファイル本体は含まれません。",
    restoreDraft: "復元",
    discardDraft: "破棄",
    downloadDraft: "作業Projectとして保存",
    followList: "リスト追従",
    phrases: "フレーズ",
    status: "ステータス",
    validation: "検証",
    shortcuts: "ショートカット",
    shortcutPlay: "再生 / 停止",
    shortcutCurrent: "現在のフレーズを打刻",
    shortcutNext: "次のフレーズを打刻",
    shortcutUndo: "元に戻す",
    shortcutRedo: "やり直す",
    shortcutSelect: "フレーズ選択",
    title: "曲名",
    artist: "アーティスト",
    slugFileId: "Slug / File ID",
    durationMs: "長さ (ms)",
    songUrl: "曲URL",
    songleUrl: "Songle URL",
    textAliveUrl: "TextAlive URL",
    notes: "メモ",
    titleHelp: "表示用の曲名です。Export JSONにも保存されます。",
    artistHelp: "表示用のアーティスト名です。Export JSONにも保存されます。",
    slugHelp: "ファイル名や連携先の曲IDに使う英数字IDです。手入力できます。",
    durationHelp: "曲の長さを整数ミリ秒で保存します。",
    songUrlHelp: "元動画や配信元のURLです。",
    songleUrlHelp: "Songle登録ページのURLです。metadata取得や照合に使います。",
    textAliveUrlHelp: "TextAlive関連ページがある場合の任意URLです。",
    notesHelp: "作業メモです。作業用Project JSONだけに保存されます。",
    helpTitle: "Editor Help",
    helpIntro: "ローカル音源とUTF-8の歌詞テキストを読み込み、曲を再生しながら現在/次のフレーズを打刻します。",
    helpRights: "歌詞本文を含むファイルを公開、配布、アップロード、GitHubへコミットする前に、歌詞の権利と配布先の利用条件を確認してください。",
    helpAudio: "音源はブラウザ内で再生するだけです。Projectにはファイル名と任意の長さ情報だけを保存します。",
    helpLocalDraft: "自動保存下書きはこのブラウザのIndexedDBに保存され、歌詞テキストを含むことがあります。",
    lyricsPlaceholder: "# verse\\n\\#歌詞の先頭に#を出したい場合\\n[blank]\\n\\n歌詞の1行が1フレーズになります",
    blankPhraseLabel: "（無表示）",
    untitled: "Untitled",
    unknownArtist: "Unknown artist",
    audioNotSelected: "未選択",
    durationUnknown: "不明",
    noPhraseLoaded: "歌詞を読み込むと、ここに現在のフレーズが表示されます",
    noNextPhrase: "次のフレーズはありません",
    unmarked: "未打刻",
    line: "行",
    phrase: "phrase",
    summary: "{timed} timed / {total} total",
    tableNote: "{timed} timed / {total} phrases",
    tableNumber: "#",
    tablePhrase: "フレーズ",
    tableStart: "start",
    tableEnd: "end",
    tableLine: "line",
    ready: "Ready",
    noValidationIssues: "検証エラーはありません",
    lyricsParsed: "歌詞を {count} フレーズとして読み込みました",
    lyricsParsedWithTiming: "歌詞を {count} フレーズとして読み込み、{kept} 件の打刻を保持しました",
    blankLineInserted: "[blank]を歌詞テキストに挿入しました。「歌詞リストに反映」でフレーズに追加できます",
    blankPhraseInserted: "無表示フレーズを追加し、{kept} 件の打刻を保持しました",
    sourceSearchEmpty: "検索文字列を入力してください",
    sourceSearchNoMatch: "一致する文字列はありません",
    sourceSearchMatch: "{current}/{total} 件目: {query}",
    sourceReplaceDone: "1件置換しました。「歌詞リストに反映」でProjectに反映できます",
    sourceReplaceAllDone: "{count} 件置換しました。「歌詞リストに反映」でProjectに反映できます",
    sourceReplaceTooLarge: "置換後の歌詞テキストが大きすぎます。上限は {limit} です",
    safeDemoLoaded: "権利確認不要のデモ文を {count} フレーズとして読み込みました",
    followModeEnabled: "再生に追従する表示へ戻しました",
    audioUpdated: "音源参照を更新しました。音源本体は保存しません",
    lyricsTextSaved: "歌詞テキストを保存しました。次回の歌詞TXT保存は同じファイルへ上書きします",
    lyricsTextDownloaded: "歌詞テキストをダウンロードしました",
    lyricsTextSaveCanceled: "歌詞テキスト保存をキャンセルしました",
    lyricsTextSaveFailed: "歌詞テキストを保存できませんでした。保存先の権限を確認するか、もう一度保存先を選んでください",
    lyricsTextEmpty: "保存する歌詞テキストがありません",
    metadataUpdated: "プロジェクト詳細を更新しました",
    projectSaved: "Editor再開用の作業JSONを保存しました。次回は同じファイルへ上書きします。Music Effect用はExport > Music Effect v2です",
    projectSaveCanceled: "作業Project保存をキャンセルしました",
    projectSaveFailed: "作業用Project JSONを保存できませんでした。保存先の権限を確認するか、もう一度保存先を選んでください",
    projectDownloaded: "Editor再開用の作業JSONをダウンロードしました。Music Effect用はExport > Music Effect v2です",
    projectLoaded: "Projectを読み込みました",
    draftRestored: "自動保存下書きを復元しました。音源ファイルは再読み込みしてください",
    draftDiscarded: "自動保存下書きを削除しました",
    draftDownloaded: "自動保存下書きをEditor再開用の作業JSONとしてダウンロードしました",
    draftSaveFailed: "自動保存に失敗しました。ブラウザのストレージ権限と空き容量を確認してください",
    unsupportedProject: "対応していないProject schemaです",
    invalidProjectFile: "作業用Project JSONを読み込めませんでした。ファイル形式を確認してください",
    unsafeProjectFile: "作業用Project JSONに、このEditorで安全に扱えない値が含まれていました",
    projectTooLarge: "作業用Project JSONが大きすぎます。上限は {limit} です",
    sourceTextTooLarge: "歌詞テキストが大きすぎます。上限は {limit} です",
    tooManyPhrases: "フレーズ数が多すぎます。上限は {limit} 件です",
    unsupportedLyricsFile: "歌詞ファイルは .txt または .lrc のUTF-8テキストだけ読み込めます",
    unsupportedAudioFile: "音源ファイルは一般的なaudio形式だけ読み込めます",
    fileTooLarge: "{name} は大きすぎます。上限は {limit} です",
    fileReadFailed: "ファイルを読み込めませんでした。別のファイルを選択してください",
    localDraftCleared: "このブラウザの自動保存下書きを削除しました",
    exportedWithLyrics: "歌詞込みJSONを書き出しました",
    exportedTimingOnly: "TimingのみJSONを書き出しました",
    exportedWebVtt: "WebVTTを書き出しました",
    exportedLrc: "LRCを書き出しました",
    loadAudioFirst: "再生には音源ファイルを読み込んでください。Project内の音源名だけでは再生できません",
    audioPlaybackFailed: "再生できませんでした。別の音源ファイルを選択してください",
    selectionEmpty: "フレーズが選択されていません",
    selectedAll: "すべてのフレーズを選択しました",
    selectedPhrases: "{count} 件を選択しました",
    selectionMoveEmpty: "移動できる打刻済みフレーズが選択されていません",
    selectionMoved: "{count} 件の時刻を {offset} ms 移動しました",
    selectionMoveBlocked: "歌詞順を保つため、これ以上移動できません",
    spacingTooSmall: "アンカー間隔が狭すぎるため均一配置できません",
    evenSpacingNeedsDuration: "未打刻を均一配置するには、音源を読み込むか、Project Detailsで曲の長さ(ms)を入力してください。Ctrl-Zで元に戻せます。",
    selectionEvened: "{count} 件を均一配置しました",
    selectionTimingCleared: "{count} 件を未打刻に戻しました",
    orderLockNoSpace: "前後の時刻が近すぎるため、このフレーズを打刻できません",
    projectOrderViolationConfirm: "読み込んだProjectには、歌詞順に時刻が進んでいない箇所があります。同じ時刻の連続も含まれます。このEditorでは、各歌詞の時刻が前の歌詞より少なくとも1ms後になる前提で編集します。問題のある時刻だけ未打刻に戻して読み込みますか？",
    projectLoadCanceled: "Projectの読み込みを中止しました。JSONファイルの時刻を手動修正してから読み込んでください",
    projectLoadedWithTimingFixes: "Projectを読み込み、問題のある {count} 件の時刻を未打刻に戻しました",
    replaceSourceConfirm: "現在の歌詞テキストや打刻をデモ文で置き換えます。続けますか？",
    reparseLosesTimingConfirm: "解析モードを変更して歌詞テキストを再解析します。対応できる打刻は保持しますが、対応できない行は未打刻になることがあります。続けますか？",
    parseModeKept: "解析モードの変更を取り消しました",
    noCurrentPhrase: "打刻する現在フレーズがありません",
    noNextTarget: "打刻する次フレーズがありません",
    stampedCurrent: "#{index} を {time} に打刻しました",
    stampedNext: "#{index} を {time} に打刻しました",
    clearedTiming: "#{index} の時刻をクリアしました",
    undoDone: "元に戻しました",
    redoDone: "やり直しました",
    undoEmpty: "戻せる操作がありません",
    redoEmpty: "やり直せる操作がありません",
    languageChanged: "表示言語を切り替えました",
    rightsConfirm: "この出力には歌詞本文が含まれる場合があります。公開・配布・アップロード・コミット前に権利と配布先の条件を確認してください。続行しますか?",
    validationExportMissingTiming: "作業JSON保存は可能です。Exportには全フレーズの時刻が必要です。シーケンスバーの未打刻の点を確認してください。未打刻: {count}件。",
    exportReadinessMissingTiming: "Export前に未打刻を解消してください。シーケンスバーの未打刻の点が残っています。未打刻: {count}件。",
    exportReadinessValidationIssue: "Export前に検証エラーを確認してください。",
    exportBlockedMissingTiming: "Exportには全フレーズのstartTimeMsが必要です。未打刻が{count}件あります。選択バーの「未打刻も含めて均一配置」で仮配置するか、打刻後に再度Exportしてください。途中作業は作業JSON保存で保存できます。",
    exportMenuClosed: "Exportメニューを閉じました"
  },
  en: {
    appSubtitle: "Local lyric timing editor",
    actionGroupAudio: "Audio",
    actionGroupLyrics: "Lyrics",
    actionGroupProject: "Work Project",
    actionGroupExport: "Output",
    actionGroupUtility: "Tools",
    loadAudio: "Load Audio",
    loadLyrics: "Load Lyrics",
    moreSource: "Lyric Text",
    parseMode: "Parse mode",
    parseTextAlive: "TextAlive compatible",
    parseLiteral: "Literal",
    pasteLyrics: "Lyric text",
    blankSourceHint: "Each newline splits lyrics into phrases. Blank lines are section breaks. Add [blank] as its own line for an empty lyric display. The shown phrase is the left Current Phrase or the phrase selected in the list.",
    insertBlankLine: "Insert [blank] at cursor",
    insertBlankBeforeCurrent: "[blank] before shown phrase",
    insertBlankAfterCurrent: "[blank] after shown phrase",
    sourceSearchHint: "Find and replace plain text in the lyric text editor. Regex is not used. Search is case-sensitive.",
    sourceSearchLabel: "Find",
    sourceReplaceLabel: "Replace with",
    sourceFindPrev: "Previous",
    sourceFindNext: "Next",
    sourceReplaceOne: "Replace",
    sourceReplaceAll: "Replace all",
    loadSafeDemo: "Safe demo text",
    parseLyrics: "Apply to lyric list",
    saveLyricsText: "Save Lyric TXT",
    projectDetails: "Project Details",
    loadProject: "Load Work Project",
    saveProject: "Save Work Project",
    exportMenu: "Export",
    exportMusicEffect: "Music Effect v2",
    exportTimingOnly: "Timing only",
    exportTimingOnlyHint: "Recommended for public repos; all phrase timings required",
    exportWithLyrics: "With lyrics",
    exportWithLyricsHint: "Requires lyric rights confirmation",
    exportGeneralFormats: "General formats",
    exportWebVtt: "WebVTT",
    exportLrc: "LRC",
    exportLyricsRequiredHint: "Requires lyric rights confirmation",
    help: "Help",
    clearLocalData: "Clear Draft",
    volume: "Volume",
    volumePercent: "Volume {percent}%",
    playbackPosition: "Playback position",
    sequenceSeekHint: "Click/drag to seek. Ctrl-drag selects a range. Use wheel or left/right arrows to nudge; Shift makes it fine.",
    audioFile: "Audio",
    duration: "Duration",
    projectState: "Project",
    currentPhrase: "Current Phrase",
    nextTarget: "Next Target",
    nextPhrase: "Next Phrase",
    followPlayback: "Follow Playback",
    followPlaybackTitle: "Switch the current phrase according to playback position",
    returnToFollowPlayback: "Return to Follow",
    followModeActive: "Following playback",
    manualModeActive: "Manual selection",
    followModeHint: "The current phrase changes with playback position",
    manualModeHint: "A selected phrase is pinned. Playback position will not change it",
    manualSelection: "Manual Selection",
    play: "Play",
    pause: "Pause",
    audioRequiredHint: "Load audio to play",
    stampCurrent: "Stamp Current",
    stampNext: "Stamp Next",
    shiftEarlier10: "-10 ms",
    shiftLater10: "+10 ms",
    evenSpacing: "Even spacing",
    evenSpacingWithUntimed: "Even with unmarked",
    clearSelectionTiming: "Set unmarked",
    clearSelection: "Clear selection",
    selectionSummary: "Selected: {count} / timed {timed} / unmarked {untimed}",
    dragFineHint: "Hold Shift while dragging to move more finely",
    localDraft: "Draft",
    autosaveIdle: "no draft",
    autosavePending: "autosave pending",
    autosaveSaving: "autosaving",
    autosaveSaved: "autosaved {time}",
    autosaveError: "autosave failed",
    autosaveErrorDetail: "Browser local storage could not be accessed",
    autosaveSkippedLargeDraft: "Autosave paused because the lyric text is too large",
    autosaveUnavailable: "autosave unavailable",
    draftAvailableTitle: "Unsaved local draft found",
    draftAvailableBody: "A local autosave draft from {time} is available. Audio file content is not included.",
    restoreDraft: "Restore",
    discardDraft: "Discard",
    downloadDraft: "Save as Work Project",
    followList: "Follow List",
    phrases: "Phrases",
    status: "Status",
    validation: "Validation",
    shortcuts: "Shortcuts",
    shortcutPlay: "Play / Pause",
    shortcutCurrent: "Stamp current phrase",
    shortcutNext: "Stamp next phrase",
    shortcutUndo: "Undo",
    shortcutRedo: "Redo",
    shortcutSelect: "Select phrase",
    title: "Title",
    artist: "Artist",
    slugFileId: "Slug / File ID",
    durationMs: "Duration (ms)",
    songUrl: "Song URL",
    songleUrl: "Songle URL",
    textAliveUrl: "TextAlive URL",
    notes: "Notes",
    titleHelp: "Display song title. Saved into exported JSON.",
    artistHelp: "Display artist name. Saved into exported JSON.",
    slugHelp: "Editable ID used for file names and downstream song matching.",
    durationHelp: "Song duration in integer milliseconds.",
    songUrlHelp: "Original video or source URL.",
    songleUrlHelp: "Songle registration URL for metadata lookup and matching.",
    textAliveUrlHelp: "Optional TextAlive reference URL.",
    notesHelp: "Working notes saved only in Work Project JSON.",
    helpTitle: "Editor Help",
    helpIntro: "Load a local audio file and a UTF-8 lyric text file, then stamp the current or next phrase while playing the song.",
    helpRights: "Before publishing, distributing, uploading, or committing files that include lyric text, confirm the lyric rights and the destination terms.",
    helpAudio: "Audio only plays in the browser session. The project stores only file name and optional duration metadata.",
    helpLocalDraft: "Autosave drafts are stored in this browser's IndexedDB and may include lyric text.",
    lyricsPlaceholder: "# verse\\n\\#hash can be lyric text\\n[blank]\\n\\nEach lyric line becomes one phrase",
    blankPhraseLabel: "(no lyrics)",
    untitled: "Untitled",
    unknownArtist: "Unknown artist",
    audioNotSelected: "not selected",
    durationUnknown: "unknown",
    noPhraseLoaded: "Load lyrics to show the current phrase here",
    noNextPhrase: "No next phrase",
    unmarked: "unmarked",
    line: "line",
    phrase: "phrase",
    summary: "{timed} timed / {total} total",
    tableNote: "{timed} timed / {total} phrases",
    tableNumber: "#",
    tablePhrase: "Phrase",
    tableStart: "start",
    tableEnd: "end",
    tableLine: "line",
    ready: "Ready",
    noValidationIssues: "No validation issues",
    lyricsParsed: "Loaded {count} lyric phrases",
    lyricsParsedWithTiming: "Loaded {count} lyric phrases and kept {kept} timings",
    blankLineInserted: "Inserted [blank] into the lyric text. Apply to lyric list to add it as a phrase",
    blankPhraseInserted: "Inserted a blank phrase and kept {kept} timings",
    sourceSearchEmpty: "Enter text to find",
    sourceSearchNoMatch: "No matches",
    sourceSearchMatch: "Match {current}/{total}: {query}",
    sourceReplaceDone: "Replaced 1 match. Apply to lyric list to update the project",
    sourceReplaceAllDone: "Replaced {count} matches. Apply to lyric list to update the project",
    sourceReplaceTooLarge: "Replacement would make the lyric text too large. Limit: {limit}",
    safeDemoLoaded: "Loaded {count} rights-safe demo phrases",
    followModeEnabled: "Returned to playback-following display",
    audioUpdated: "Audio reference updated; file content was not stored",
    lyricsTextSaved: "Lyric text saved. The next Save Lyric TXT will overwrite the same file",
    lyricsTextDownloaded: "Lyric text downloaded",
    lyricsTextSaveCanceled: "Lyric text save canceled",
    lyricsTextSaveFailed: "Could not save lyric text. Check file permission or choose the save location again",
    lyricsTextEmpty: "There is no lyric text to save",
    metadataUpdated: "Project metadata updated",
    projectSaved: "Editor work JSON saved. The next save will overwrite the same file. Use Export > Music Effect v2 for Music Effect",
    projectSaveCanceled: "Work Project save canceled",
    projectSaveFailed: "Could not save Work Project JSON. Check file permission or choose the save location again",
    projectDownloaded: "Editor work JSON downloaded. Use Export > Music Effect v2 for Music Effect",
    projectLoaded: "Project loaded",
    draftRestored: "Autosave draft restored. Load the audio file again before playback",
    draftDiscarded: "Autosave draft deleted",
    draftDownloaded: "Autosave draft downloaded as editor work JSON",
    draftSaveFailed: "Autosave failed. Check browser storage permissions and free space",
    unsupportedProject: "Unsupported project schema",
    invalidProjectFile: "Could not load Work Project JSON. Check the file format",
    unsafeProjectFile: "Work Project JSON contained values this editor cannot safely handle",
    projectTooLarge: "Work Project JSON is too large. Limit: {limit}",
    sourceTextTooLarge: "Lyric text is too large. Limit: {limit}",
    tooManyPhrases: "Too many phrases. Limit: {limit}",
    unsupportedLyricsFile: "Lyrics files must be UTF-8 .txt or .lrc text",
    unsupportedAudioFile: "Audio files must use a common audio format",
    fileTooLarge: "{name} is too large. Limit: {limit}",
    fileReadFailed: "Could not read the file. Choose another file",
    localDraftCleared: "Deleted this browser's autosave draft",
    exportedWithLyrics: "Exported with lyrics",
    exportedTimingOnly: "Exported timing only",
    exportedWebVtt: "Exported WebVTT",
    exportedLrc: "Exported LRC",
    loadAudioFirst: "Load the audio file before playback. A project can store the audio name, but not the audio itself",
    audioPlaybackFailed: "Could not play the audio. Choose another audio file",
    selectionEmpty: "No phrases are selected",
    selectedAll: "Selected all phrases",
    selectedPhrases: "Selected {count} phrases",
    selectionMoveEmpty: "No selected timed phrases can move",
    selectionMoved: "Shifted {count} timings by {offset} ms",
    selectionMoveBlocked: "Cannot move farther while preserving lyric order",
    spacingTooSmall: "The anchor range is too small for even spacing",
    evenSpacingNeedsDuration: "Load audio or enter Duration (ms) in Project Details before evenly placing unmarked phrases. You can undo with Ctrl-Z.",
    selectionEvened: "Evenly placed {count} phrases",
    selectionTimingCleared: "Set {count} phrases back to unmarked",
    orderLockNoSpace: "This phrase cannot be stamped because neighboring timings are too close",
    projectOrderViolationConfirm: "The loaded project has timings that do not advance in lyric order, including repeated identical times. This editor edits timings with each lyric at least 1 ms after the previous lyric. Set only the problematic timings back to unmarked and load it?",
    projectLoadCanceled: "Project load canceled. Edit the timing values in the JSON file before loading it again",
    projectLoadedWithTimingFixes: "Project loaded and {count} problematic timings were set back to unmarked",
    replaceSourceConfirm: "Replace the current lyric text and any timing with the demo text?",
    reparseLosesTimingConfirm: "Changing parse mode reparses the lyric text. Matched timings are kept where possible, but unmatched lines may become unmarked. Continue?",
    parseModeKept: "Parse mode change was canceled",
    noCurrentPhrase: "No current phrase to stamp",
    noNextTarget: "No next phrase to stamp",
    stampedCurrent: "Stamped #{index} at {time}",
    stampedNext: "Stamped #{index} at {time}",
    clearedTiming: "Cleared timing for #{index}",
    undoDone: "Undid the last action",
    redoDone: "Redid the last action",
    undoEmpty: "Nothing to undo",
    redoEmpty: "Nothing to redo",
    languageChanged: "Language switched",
    rightsConfirm: "This file may include lyric text. Confirm rights and destination terms before publishing, distributing, uploading, or committing it. Continue?",
    validationExportMissingTiming: "Editor work JSON save is available. Export requires timings for every phrase. Check the unmarked dots in the sequence bar. Unmarked: {count}.",
    exportReadinessMissingTiming: "Resolve unmarked phrases before export. Unmarked dots remain in the sequence bar. Unmarked: {count}.",
    exportReadinessValidationIssue: "Check validation errors before export.",
    exportBlockedMissingTiming: "Export requires startTimeMs for every phrase. {count} phrases are unmarked. Use Even with unmarked in the selection bar, or stamp timings before exporting again. Save incomplete work with Work Project Save.",
    exportMenuClosed: "Export menu closed"
  }
};

const byId = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
};

const elements = {
  title: byId<HTMLInputElement>("title-input"),
  artist: byId<HTMLInputElement>("artist-input"),
  slug: byId<HTMLInputElement>("slug-input"),
  duration: byId<HTMLInputElement>("duration-input"),
  songUrl: byId<HTMLInputElement>("song-url-input"),
  songleUrl: byId<HTMLInputElement>("songle-url-input"),
  textAliveUrl: byId<HTMLInputElement>("textalive-url-input"),
  notes: byId<HTMLTextAreaElement>("notes-input"),
  audioInput: byId<HTMLInputElement>("audio-input"),
  audioPlayer: byId<HTMLAudioElement>("audio-player"),
  audioFileName: byId<HTMLElement>("audio-file-name"),
  audioDuration: byId<HTMLElement>("audio-duration"),
  songTitle: byId<HTMLElement>("song-title"),
  songArtist: byId<HTMLElement>("song-artist"),
  projectInput: byId<HTMLInputElement>("project-input"),
  saveProject: byId<HTMLButtonElement>("save-project"),
  lyricsInput: byId<HTMLInputElement>("lyrics-input"),
  parseMode: byId<HTMLSelectElement>("parse-mode"),
  loadSafeDemo: byId<HTMLButtonElement>("load-safe-demo"),
  parseLyrics: byId<HTMLButtonElement>("parse-lyrics"),
  saveLyricsText: byId<HTMLButtonElement>("save-lyrics-text"),
  lyricsText: byId<HTMLTextAreaElement>("lyrics-text"),
  insertBlankLine: byId<HTMLButtonElement>("insert-blank-line"),
  insertBlankBeforeCurrent: byId<HTMLButtonElement>("insert-blank-before-current"),
  insertBlankAfterCurrent: byId<HTMLButtonElement>("insert-blank-after-current"),
  sourceSearchInput: byId<HTMLInputElement>("source-search-input"),
  sourceReplaceInput: byId<HTMLInputElement>("source-replace-input"),
  sourceFindPrev: byId<HTMLButtonElement>("source-find-prev"),
  sourceFindNext: byId<HTMLButtonElement>("source-find-next"),
  sourceReplaceOne: byId<HTMLButtonElement>("source-replace-one"),
  sourceReplaceAll: byId<HTMLButtonElement>("source-replace-all"),
  sourceSearchStatus: byId<HTMLElement>("source-search-status"),
  exportWithLyrics: byId<HTMLButtonElement>("export-with-lyrics"),
  exportTimingOnly: byId<HTMLButtonElement>("export-timing-only"),
  exportWebVtt: byId<HTMLButtonElement>("export-webvtt"),
  exportLrc: byId<HTMLButtonElement>("export-lrc"),
  exportMenu: byId<HTMLDetailsElement>("export-menu"),
  exportReadiness: byId<HTMLElement>("export-readiness"),
  languageToggle: byId<HTMLButtonElement>("language-toggle"),
  helpOpen: byId<HTMLButtonElement>("help-open"),
  clearLocalData: byId<HTMLButtonElement>("clear-local-data"),
  helpDialog: byId<HTMLDialogElement>("help-dialog"),
  projectDetails: byId<HTMLButtonElement>("project-details"),
  projectDetailsDialog: byId<HTMLDialogElement>("project-details-dialog"),
  currentPhraseCard: byId<HTMLElement>("current-phrase-card"),
  followPlayback: byId<HTMLButtonElement>("follow-playback"),
  currentPhraseText: byId<HTMLElement>("current-phrase-text"),
  currentPhraseId: byId<HTMLElement>("current-phrase-id"),
  currentPhraseTime: byId<HTMLElement>("current-phrase-time"),
  currentPhraseLine: byId<HTMLElement>("current-phrase-line"),
  nextPhraseText: byId<HTMLElement>("next-phrase-text"),
  nextPhraseId: byId<HTMLElement>("next-phrase-id"),
  nextPhraseTime: byId<HTMLElement>("next-phrase-time"),
  playToggle: byId<HTMLButtonElement>("play-toggle"),
  audioGuidance: byId<HTMLElement>("audio-guidance"),
  playbackTime: byId<HTMLElement>("playback-time"),
  playbackDuration: byId<HTMLElement>("playback-duration"),
  volumeSlider: byId<HTMLInputElement>("volume-slider"),
  volumeValue: byId<HTMLOutputElement>("volume-value"),
  seekBar: byId<HTMLInputElement>("seek-bar"),
  stampCurrent: byId<HTMLButtonElement>("stamp-current"),
  stampNext: byId<HTMLButtonElement>("stamp-next"),
  undoAction: byId<HTMLButtonElement>("undo-action"),
  redoAction: byId<HTMLButtonElement>("redo-action"),
  draftBanner: byId<HTMLElement>("draft-banner"),
  draftBannerText: byId<HTMLElement>("draft-banner-text"),
  restoreDraft: byId<HTMLButtonElement>("restore-draft"),
  downloadDraft: byId<HTMLButtonElement>("download-draft"),
  discardDraft: byId<HTMLButtonElement>("discard-draft"),
  autoSaveStatus: byId<HTMLElement>("autosave-status"),
  selectionEditBar: byId<HTMLElement>("selection-edit-bar"),
  selectionSummary: byId<HTMLElement>("selection-summary"),
  sequenceDragHint: byId<HTMLElement>("sequence-drag-hint"),
  selectionShiftEarlier: byId<HTMLButtonElement>("selection-shift-earlier"),
  selectionShiftLater: byId<HTMLButtonElement>("selection-shift-later"),
  selectionEven: byId<HTMLButtonElement>("selection-even"),
  selectionClearTiming: byId<HTMLButtonElement>("selection-clear-timing"),
  selectionClear: byId<HTMLButtonElement>("selection-clear"),
  sequenceModeLabel: byId<HTMLElement>("sequence-mode-label"),
  sequenceModeHint: byId<HTMLElement>("sequence-mode-hint"),
  sequenceBar: byId<HTMLElement>("sequence-bar"),
  phraseTable: byId<HTMLElement>("phrase-table"),
  phraseTableNote: byId<HTMLElement>("phrase-table-note"),
  followList: byId<HTMLButtonElement>("follow-list"),
  summary: byId<HTMLElement>("project-summary"),
  status: byId<HTMLElement>("status-message"),
  validationSection: byId<HTMLElement>("validation-section"),
  validation: byId<HTMLElement>("validation-message")
};

const detectInitialLanguage = (): Language => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "ja" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
};

let language = detectInitialLanguage();
let project = createLyricTimingProject();
let selectedPhraseIndex = 0;
let selectedPhraseIndexes = new Set<number>();
let selectionAnchorIndex: number | null = null;
let focusMode: FocusMode = "follow";
let statusMessage: StatusMessage = { key: "ready" };
let previewTimeMs = 0;
let audioVolumePercent = 100;
let audioObjectUrl: string | null = null;
let audioGuidanceAlert = false;
let sequenceDragState: SequenceDragState | null = null;
let hitDebugEnabled = new URLSearchParams(window.location.search).get("hitdebug") === "1";
let hitDebugOverlay: HTMLDivElement | null = null;
let hitDebugHoverRow: HTMLElement | null = null;
let autoSaveStatus: AutoSaveStatus = "idle";
let autoSaveSavedAt: string | null = null;
let autoSaveError: string | null = null;
let autoSaveTimer: number | null = null;
let pendingDraft: AutoSaveDraft | null = null;
let availableDraft: AutoSaveDraft | null = null;
let lastAutoSaveKey = "";
let projectSaveFileHandle: FileSystemFileHandleLike | null = null;
let lyricsTextSaveFileHandle: FileSystemFileHandleLike | null = null;
const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];

const text = (key: string, values: Record<string, string | number> = {}) => {
  const template = i18n[language][key] ?? key;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  );
};

const setStatus = (key: string, values?: Record<string, string | number>) => {
  statusMessage = { key, values };
  render();
};

const textEncoder = new TextEncoder();

const clampVolumePercent = (value: number) => (
  Math.max(0, Math.min(100, Math.round(value)))
);

const readStoredVolumePercent = () => {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (stored === null) return 100;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clampVolumePercent(parsed) : 100;
  } catch {
    return 100;
  }
};

const applyAudioVolume = (nextPercent: number, persist = false) => {
  audioVolumePercent = clampVolumePercent(nextPercent);
  elements.audioPlayer.volume = audioVolumePercent / 100;
  elements.audioPlayer.muted = audioVolumePercent === 0;
  elements.volumeSlider.value = String(audioVolumePercent);
  elements.volumeValue.textContent = `${audioVolumePercent}%`;
  elements.volumeSlider.setAttribute("aria-label", text("volumePercent", { percent: audioVolumePercent }));
  if (!persist) return;
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(audioVolumePercent));
  } catch {
    // Volume is a convenience preference; playback should still work if storage is unavailable.
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const utf8ByteLength = (value: string) => textEncoder.encode(value).length;

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const fileNameHasExtension = (file: File, extensions: string[]) => {
  const lowerName = file.name.toLowerCase();
  return extensions.some((extension) => lowerName.endsWith(extension));
};

const validateSelectedFile = (
  file: File,
  options: {
    maxBytes: number;
    extensions: string[];
    acceptsType: (type: string) => boolean;
    invalidStatus: string;
  }
) => {
  if (file.size > options.maxBytes) {
    setStatus("fileTooLarge", { name: file.name, limit: formatBytes(options.maxBytes) });
    return false;
  }
  const hasAllowedType = file.type ? options.acceptsType(file.type.toLowerCase()) : false;
  if (!hasAllowedType && !fileNameHasExtension(file, options.extensions)) {
    setStatus(options.invalidStatus, { name: file.name });
    return false;
  }
  return true;
};

const projectImportStatusKey = (reason: string) => {
  switch (reason) {
    case "unsupported-schema":
      return "unsupportedProject";
    case "source-too-large":
      return "sourceTextTooLarge";
    case "too-many-phrases":
      return "tooManyPhrases";
    case "not-object":
    case "missing-source":
    default:
      return "unsafeProjectFile";
  }
};

const normalizeSavedAt = (value: unknown) => {
  if (typeof value !== "string") return new Date().toISOString();
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
};

const normalizeDraftIndex = (value: unknown, phraseCount: number, fallback: number) => {
  if (typeof value !== "number" || !Number.isInteger(value) || phraseCount <= 0) return fallback;
  return Math.min(Math.max(value, 0), phraseCount - 1);
};

const normalizeAutoSaveDraft = (value: unknown): AutoSaveDraft | null => {
  if (!isRecord(value) || value.schema !== AUTOSAVE_SCHEMA) return null;
  const normalized = normalizeLyricTimingProjectInput(value.project);
  if (!normalized.ok) return null;

  const phraseCount = normalized.project.phrases.length;
  const sourceText = typeof value.sourceText === "string"
    ? value.sourceText
    : normalized.project.lines.map((line) => line.rawText).join("\n");
  if (utf8ByteLength(sourceText) > MAX_LYRIC_TEXT_BYTES) return null;

  const selectedPhraseIndexes = Array.isArray(value.selectedPhraseIndexes)
    ? [...new Set(value.selectedPhraseIndexes.filter((index): index is number => (
        typeof index === "number" && Number.isInteger(index) && index >= 0 && index < phraseCount
      )))]
    : [];
  const selectionAnchorIndex = normalizeDraftIndex(value.selectionAnchorIndex, phraseCount, -1);

  return {
    id: AUTOSAVE_RECORD_ID,
    schema: AUTOSAVE_SCHEMA,
    savedAt: normalizeSavedAt(value.savedAt),
    sourceText,
    project: normalized.project,
    selectedPhraseIndex: normalizeDraftIndex(value.selectedPhraseIndex, phraseCount, 0),
    focusMode: value.focusMode === "manual" ? "manual" : "follow",
    selectedPhraseIndexes,
    selectionAnchorIndex: selectionAnchorIndex >= 0 ? selectionAnchorIndex : null
  };
};

const cloneProject = (value: LyricTimingProject): LyricTimingProject => structuredClone(value);

const snapshot = (): Snapshot => ({
  project: cloneProject(project),
  selectedPhraseIndex,
  focusMode,
  selectedPhraseIndexes: [...selectedPhraseIndexes],
  selectionAnchorIndex
});

const formatLocalDateTime = (iso: string | null) => {
  if (!iso) return "--";
  return new Date(iso).toLocaleString(language === "ja" ? "ja-JP" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const makeAutoSaveDraft = (): AutoSaveDraft => ({
  ...snapshot(),
  id: AUTOSAVE_RECORD_ID,
  schema: AUTOSAVE_SCHEMA,
  savedAt: new Date().toISOString(),
  sourceText: elements.lyricsText.value
});

const autoSaveKey = (draft: AutoSaveDraft) => JSON.stringify({
  project: draft.project,
  sourceText: draft.sourceText,
  selectedPhraseIndex: draft.selectedPhraseIndex,
  focusMode: draft.focusMode,
  selectedPhraseIndexes: draft.selectedPhraseIndexes,
  selectionAnchorIndex: draft.selectionAnchorIndex
});

const hasDraftContent = (draft: AutoSaveDraft | null) => Boolean(draft && (
  draft.sourceText.trim() ||
  draft.project.phrases.length ||
  draft.project.title.trim() ||
  draft.project.artist.trim() ||
  draft.project.audioRef
));

const openAutoSaveDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!("indexedDB" in window)) {
    reject(new Error("IndexedDB is unavailable"));
    return;
  }
  const request = indexedDB.open(AUTOSAVE_DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(AUTOSAVE_STORE_NAME)) {
      db.createObjectStore(AUTOSAVE_STORE_NAME, { keyPath: "id" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
});

const readAutoSaveDraft = async () => {
  const db = await openAutoSaveDatabase();
  return new Promise<AutoSaveDraft | null>((resolve, reject) => {
    const transaction = db.transaction(AUTOSAVE_STORE_NAME, "readonly");
    const request = transaction.objectStore(AUTOSAVE_STORE_NAME).get(AUTOSAVE_RECORD_ID);
    request.onsuccess = () => {
      resolve(normalizeAutoSaveDraft(request.result));
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB read aborted"));
    };
  });
};

const writeAutoSaveDraft = async (draft: AutoSaveDraft) => {
  const db = await openAutoSaveDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(AUTOSAVE_STORE_NAME, "readwrite");
    transaction.objectStore(AUTOSAVE_STORE_NAME).put(draft);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB write failed"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB write aborted"));
    };
  });
};

const deleteAutoSaveDraft = async () => {
  const db = await openAutoSaveDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(AUTOSAVE_STORE_NAME, "readwrite");
    transaction.objectStore(AUTOSAVE_STORE_NAME).delete(AUTOSAVE_RECORD_ID);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB delete failed"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB delete aborted"));
    };
  });
};

const pushUndo = () => {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
};

const restoreSnapshot = (next: Snapshot) => {
  project = cloneProject(next.project);
  selectedPhraseIndex = next.selectedPhraseIndex;
  focusMode = next.focusMode;
  selectedPhraseIndexes = new Set(next.selectedPhraseIndexes.filter((index) => index >= 0 && index < project.phrases.length));
  selectionAnchorIndex = next.selectionAnchorIndex;
  elements.lyricsText.value = project.lines.map((line) => line.rawText).join("\n");
};

const parseDurationInput = () => {
  if (!elements.duration.value.trim()) return null;
  const value = Number(elements.duration.value);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
};

const currentMetadata = () => ({
  slug: elements.slug.value,
  title: elements.title.value,
  artist: elements.artist.value,
  durationMs: parseDurationInput(),
  songUrl: elements.songUrl.value,
  songleUrl: elements.songleUrl.value,
  textAliveUrl: elements.textAliveUrl.value,
  notes: elements.notes.value,
  audioRef: project.audioRef
});

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

const transferReparsedPhraseTiming = (
  previousProject: LyricTimingProject,
  nextProject: LyricTimingProject
) => {
  let kept = 0;

  if (previousProject.phrases.length === nextProject.phrases.length) {
    return {
      project: {
        ...nextProject,
        phrases: nextProject.phrases.map((phrase, index) => {
          const previous = previousProject.phrases[index];
          if (phraseHasTiming(previous)) kept += 1;
          return copyPhraseTiming(phrase, previous);
        })
      },
      kept
    };
  }

  let previousCursor = 0;
  const phrases = nextProject.phrases.map((phrase) => {
    const signature = phraseTimingSignature(phrase);
    let matchedIndex = -1;
    for (let cursor = previousCursor; cursor < previousProject.phrases.length; cursor += 1) {
      if (phraseTimingSignature(previousProject.phrases[cursor]) !== signature) continue;
      matchedIndex = cursor;
      previousCursor = cursor + 1;
      break;
    }
    if (matchedIndex < 0) return phrase;
    const previous = previousProject.phrases[matchedIndex];
    if (phraseHasTiming(previous)) kept += 1;
    return copyPhraseTiming(phrase, previous);
  });

  return {
    project: {
      ...nextProject,
      phrases
    },
    kept
  };
};

const projectHasAnyTiming = () => project.phrases.some(phraseHasTiming);

const restoreLyricsTextScroll = (scrollTop: number, scrollLeft: number) => {
  elements.lyricsText.scrollTop = scrollTop;
  elements.lyricsText.scrollLeft = scrollLeft;
  window.requestAnimationFrame(() => {
    elements.lyricsText.scrollTop = scrollTop;
    elements.lyricsText.scrollLeft = scrollLeft;
  });
};

const focusSourceInsertion = (lineIndex: number, scrollTop: number, scrollLeft: number) => {
  const linesBefore = elements.lyricsText.value.split("\n").slice(0, lineIndex);
  const start = linesBefore.join("\n").length + (lineIndex > 0 ? 1 : 0);
  const end = start + BLANK_SOURCE_MARKER.length;
  elements.lyricsText.focus();
  elements.lyricsText.setSelectionRange(start, end);
  restoreLyricsTextScroll(scrollTop, scrollLeft);
};

const insertSourceLine = (lineText: string, lineIndex: number) => {
  const scrollTop = elements.lyricsText.scrollTop;
  const scrollLeft = elements.lyricsText.scrollLeft;
  const normalized = elements.lyricsText.value.replace(/\r\n?/g, "\n");
  const lines = normalized.length ? normalized.split("\n") : [];
  const insertAt = Math.max(0, Math.min(lineIndex, lines.length));
  lines.splice(insertAt, 0, lineText);
  elements.lyricsText.value = lines.join("\n");
  focusSourceInsertion(insertAt, scrollTop, scrollLeft);
  queueAutoSave();
  return insertAt;
};

const cursorLineIndex = () => {
  const cursor = elements.lyricsText.selectionEnd ?? elements.lyricsText.value.length;
  return elements.lyricsText.value.slice(0, cursor).split("\n").length - 1;
};

const setSourceSearchStatus = (key: string, values?: Record<string, string | number>) => {
  elements.sourceSearchStatus.textContent = text(key, values);
};

const sourceSearchMatches = (query: string) => {
  if (!query) return [];
  const matches: number[] = [];
  const sourceText = elements.lyricsText.value;
  let cursor = sourceText.indexOf(query);
  while (cursor >= 0) {
    matches.push(cursor);
    cursor = sourceText.indexOf(query, cursor + Math.max(1, query.length));
  }
  return matches;
};

const selectSourceMatch = (start: number, query: string, matches: number[]) => {
  elements.lyricsText.focus();
  elements.lyricsText.setSelectionRange(start, start + query.length);
  const matchIndex = matches.indexOf(start);
  setSourceSearchStatus("sourceSearchMatch", {
    current: matchIndex >= 0 ? matchIndex + 1 : 1,
    total: matches.length,
    query
  });
};

const findSourceMatch = (direction: 1 | -1) => {
  const query = elements.sourceSearchInput.value;
  if (!query) {
    setSourceSearchStatus("sourceSearchEmpty");
    elements.sourceSearchInput.focus();
    return null;
  }

  const matches = sourceSearchMatches(query);
  if (!matches.length) {
    setSourceSearchStatus("sourceSearchNoMatch");
    return null;
  }

  const cursor = direction > 0 ? elements.lyricsText.selectionEnd : elements.lyricsText.selectionStart;
  const match = direction > 0
    ? matches.find((start) => start >= cursor) ?? matches[0]
    : [...matches].reverse().find((start) => start < cursor) ?? matches.at(-1);

  if (match === undefined) return null;
  selectSourceMatch(match, query, matches);
  return { start: match, query, matches };
};

const currentSourceMatch = () => {
  const query = elements.sourceSearchInput.value;
  if (!query) return null;
  const start = elements.lyricsText.selectionStart;
  const end = elements.lyricsText.selectionEnd;
  if (end - start !== query.length) return null;
  if (elements.lyricsText.value.slice(start, end) !== query) return null;
  const matches = sourceSearchMatches(query);
  return matches.includes(start) ? { start, query, matches } : null;
};

const replaceSourceRange = (start: number, query: string, replacement: string) => {
  const sourceText = elements.lyricsText.value;
  const nextSourceText = `${sourceText.slice(0, start)}${replacement}${sourceText.slice(start + query.length)}`;
  if (utf8ByteLength(nextSourceText) > MAX_LYRIC_TEXT_BYTES) {
    setSourceSearchStatus("sourceReplaceTooLarge", { limit: formatBytes(MAX_LYRIC_TEXT_BYTES) });
    return false;
  }
  elements.lyricsText.value = nextSourceText;
  elements.lyricsText.focus();
  elements.lyricsText.setSelectionRange(start, start + replacement.length);
  queueAutoSave();
  return true;
};

const replaceSourceMatch = () => {
  const currentMatch = currentSourceMatch() ?? findSourceMatch(1);
  if (!currentMatch) return;
  if (!replaceSourceRange(currentMatch.start, currentMatch.query, elements.sourceReplaceInput.value)) return;
  setSourceSearchStatus("sourceReplaceDone");
};

const replaceAllSourceMatches = () => {
  const query = elements.sourceSearchInput.value;
  if (!query) {
    setSourceSearchStatus("sourceSearchEmpty");
    elements.sourceSearchInput.focus();
    return;
  }

  const matches = sourceSearchMatches(query);
  if (!matches.length) {
    setSourceSearchStatus("sourceSearchNoMatch");
    return;
  }

  const replacement = elements.sourceReplaceInput.value;
  const sourceText = elements.lyricsText.value;
  let cursor = 0;
  const parts: string[] = [];
  matches.forEach((start) => {
    parts.push(sourceText.slice(cursor, start), replacement);
    cursor = start + query.length;
  });
  parts.push(sourceText.slice(cursor));
  const nextSourceText = parts.join("");
  if (utf8ByteLength(nextSourceText) > MAX_LYRIC_TEXT_BYTES) {
    setSourceSearchStatus("sourceReplaceTooLarge", { limit: formatBytes(MAX_LYRIC_TEXT_BYTES) });
    return;
  }

  elements.lyricsText.value = nextSourceText;
  elements.lyricsText.focus();
  elements.lyricsText.setSelectionRange(matches[0], matches[0] + replacement.length);
  queueAutoSave();
  setSourceSearchStatus("sourceReplaceAllDone", { count: matches.length });
};

const setInputValueUnlessFocused = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  if (document.activeElement !== input) input.value = value;
};

const syncFieldsFromProject = () => {
  setInputValueUnlessFocused(elements.slug, project.slug ?? "");
  setInputValueUnlessFocused(elements.title, project.title);
  setInputValueUnlessFocused(elements.artist, project.artist);
  setInputValueUnlessFocused(elements.duration, project.durationMs === null ? "" : String(project.durationMs));
  setInputValueUnlessFocused(elements.songUrl, project.songUrl ?? "");
  setInputValueUnlessFocused(elements.songleUrl, project.songleUrl ?? "");
  setInputValueUnlessFocused(elements.textAliveUrl, project.textAliveUrl ?? "");
  setInputValueUnlessFocused(elements.notes, project.notes ?? "");
  elements.parseMode.value = project.parseMode;
};

const applyMetadata = () => {
  project = updateLyricTimingProjectMetadata(project, currentMetadata());
};

const renderAutoSaveStatus = () => {
  elements.autoSaveStatus.dataset.state = autoSaveStatus;
  elements.autoSaveStatus.title = "";
  if (autoSaveStatus === "saved" && autoSaveSavedAt) {
    elements.autoSaveStatus.textContent = text("autosaveSaved", { time: formatLocalDateTime(autoSaveSavedAt) });
    return;
  }
  if (autoSaveStatus === "error" && autoSaveError) {
    elements.autoSaveStatus.textContent = text("autosaveError");
    elements.autoSaveStatus.title = autoSaveError;
    return;
  }
  elements.autoSaveStatus.textContent = text({
    idle: "autosaveIdle",
    pending: "autosavePending",
    saving: "autosaveSaving",
    saved: "autosaveIdle",
    error: "autosaveError",
    unavailable: "autosaveUnavailable"
  }[autoSaveStatus]);
};

const renderDraftBanner = () => {
  elements.draftBanner.hidden = !availableDraft;
  if (!availableDraft) return;
  elements.draftBannerText.textContent = text("draftAvailableBody", {
    time: formatLocalDateTime(availableDraft.savedAt)
  });
};

const flushAutoSaveDraft = async () => {
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  const draft = pendingDraft;
  if (!draft) return;

  autoSaveStatus = "saving";
  autoSaveError = null;
  renderAutoSaveStatus();

  try {
    if (hasDraftContent(draft)) {
      await writeAutoSaveDraft(draft);
      lastAutoSaveKey = autoSaveKey(draft);
      autoSaveSavedAt = draft.savedAt;
      autoSaveStatus = "saved";
    } else {
      await deleteAutoSaveDraft();
      lastAutoSaveKey = "";
      autoSaveSavedAt = null;
      autoSaveStatus = "idle";
    }
    pendingDraft = null;
  } catch {
    autoSaveError = text("autosaveErrorDetail");
    autoSaveStatus = "error";
    setStatus("draftSaveFailed");
  }
  renderAutoSaveStatus();
};

const queueAutoSave = () => {
  if (!("indexedDB" in window)) {
    autoSaveStatus = "unavailable";
    renderAutoSaveStatus();
    return;
  }

  if (utf8ByteLength(elements.lyricsText.value) > MAX_LYRIC_TEXT_BYTES) {
    pendingDraft = null;
    autoSaveStatus = "error";
    autoSaveError = text("autosaveSkippedLargeDraft");
    renderAutoSaveStatus();
    return;
  }

  applyMetadata();
  const draft = makeAutoSaveDraft();
  const key = autoSaveKey(draft);
  if (key === lastAutoSaveKey) return;

  availableDraft = null;
  pendingDraft = draft;
  autoSaveStatus = "pending";
  autoSaveError = null;
  renderDraftBanner();
  renderAutoSaveStatus();

  if (autoSaveTimer !== null) window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    void flushAutoSaveDraft();
  }, AUTOSAVE_DELAY_MS);
};

const restoreAutoSaveDraft = () => {
  if (!availableDraft) return;
  const draft = availableDraft;
  project = cloneProject(draft.project);
  selectedPhraseIndex = clampPhraseIndex(draft.selectedPhraseIndex);
  focusMode = draft.focusMode;
  selectedPhraseIndexes = new Set(draft.selectedPhraseIndexes.filter(isValidPhraseIndex));
  selectionAnchorIndex = draft.selectionAnchorIndex;
  elements.lyricsText.value = draft.sourceText || project.lines.map((line) => line.rawText).join("\n");
  lyricsTextSaveFileHandle = null;
  projectSaveFileHandle = null;
  previewTimeMs = 0;
  undoStack.length = 0;
  redoStack.length = 0;
  availableDraft = null;
  pendingDraft = null;
  lastAutoSaveKey = autoSaveKey(draft);
  autoSaveSavedAt = draft.savedAt;
  autoSaveStatus = "saved";
  setStatus("draftRestored");
};

const discardAutoSaveDraft = async (statusKey = "draftDiscarded") => {
  try {
    if (autoSaveTimer !== null) {
      window.clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    await deleteAutoSaveDraft();
    availableDraft = null;
    pendingDraft = null;
    lastAutoSaveKey = "";
    autoSaveSavedAt = null;
    autoSaveStatus = "idle";
    setStatus(statusKey);
  } catch {
    autoSaveError = text("autosaveErrorDetail");
    autoSaveStatus = "error";
    setStatus("draftSaveFailed");
  }
};

const downloadAutoSaveDraft = () => {
  if (!availableDraft) return;
  if (hasDraftContent(availableDraft) && !window.confirm(text("rightsConfirm"))) return;
  downloadJson("lyric-timing-editor.autosave.work-project.json", availableDraft.project);
  setStatus("draftDownloaded");
};

const initializeAutoSave = async () => {
  if (!("indexedDB" in window)) {
    autoSaveStatus = "unavailable";
    renderAutoSaveStatus();
    return;
  }
  try {
    const draft = await readAutoSaveDraft();
    if (hasDraftContent(draft)) {
      availableDraft = draft;
      autoSaveSavedAt = draft?.savedAt ?? null;
      autoSaveStatus = "saved";
      lastAutoSaveKey = draft ? autoSaveKey(draft) : "";
    } else {
      autoSaveStatus = "idle";
    }
  } catch {
    autoSaveError = text("autosaveErrorDetail");
    autoSaveStatus = "error";
  }
  render();
};

const formatClock = (valueMs: number | null | undefined) => {
  if (valueMs === null || valueMs === undefined || !Number.isFinite(valueMs)) return "--:--.---";
  const ms = Math.max(0, Math.round(valueMs));
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
};

const formatTimeCell = (valueMs: number | null | undefined) => (
  valueMs === null || valueMs === undefined ? text("unmarked") : formatClock(valueMs)
);

const phraseEditorLabel = (phrase: LyricTimingPhrase) => (
  phrase.displayMode === "blank" ? text("blankPhraseLabel") : phrase.text
);

const formatDuration = (valueMs: number | null | undefined) => (
  valueMs === null || valueMs === undefined ? text("durationUnknown") : `${formatClock(valueMs)} / ${valueMs} ms`
);

const getKnownDurationMs = () => {
  if (project.durationMs !== null) return project.durationMs;
  if (project.audioRef?.durationMs !== null && project.audioRef?.durationMs !== undefined) return project.audioRef.durationMs;
  const audioDurationMs = elements.audioPlayer.duration * 1000;
  return Number.isFinite(audioDurationMs) && audioDurationMs > 0 ? Math.round(audioDurationMs) : null;
};

const getTimelineDurationMs = () => {
  const lastTimedPhraseMs = project.phrases.reduce((max, phrase) => (
    phrase.startTimeMs === null ? max : Math.max(max, phrase.startTimeMs)
  ), 0);
  return Math.max(getKnownDurationMs() ?? 0, lastTimedPhraseMs + 3500, previewTimeMs + 1000, 60000);
};

const getPlaybackMs = () => {
  const audioCurrentMs = elements.audioPlayer.currentTime * 1000;
  if (elements.audioPlayer.src && Number.isFinite(audioCurrentMs)) return Math.round(audioCurrentMs);
  return previewTimeMs;
};

const clampPhraseIndex = (index: number) => {
  if (!project.phrases.length) return -1;
  return Math.min(Math.max(index, 0), project.phrases.length - 1);
};

const getFollowPhraseIndex = () => {
  if (!project.phrases.length) return -1;
  const playbackMs = getPlaybackMs();
  const timedBeforeOrAt = project.phrases
    .filter((phrase) => phrase.startTimeMs !== null && phrase.startTimeMs <= playbackMs)
    .at(-1);
  if (timedBeforeOrAt) return timedBeforeOrAt.index;
  return clampPhraseIndex(selectedPhraseIndex);
};

const getCurrentPhraseIndex = () => (
  focusMode === "manual" ? clampPhraseIndex(selectedPhraseIndex) : getFollowPhraseIndex()
);

const getNextPhraseIndex = () => {
  const currentIndex = getCurrentPhraseIndex();
  return currentIndex >= 0 ? clampPhraseIndex(currentIndex + 1) : -1;
};

const getEffectiveEndTimeMs = (phrase: LyricTimingPhrase) => {
  if (phrase.startTimeMs === null) return null;
  const nextPhrase = project.phrases[phrase.index + 1];
  if (nextPhrase?.startTimeMs !== null && nextPhrase?.startTimeMs !== undefined) return nextPhrase.startTimeMs;
  const durationMs = getKnownDurationMs();
  if (durationMs !== null && durationMs > phrase.startTimeMs) return durationMs;
  return phrase.endTimeMs;
};

const isValidPhraseIndex = (index: number) => index >= 0 && index < project.phrases.length;

const sortedSelectedIndexes = () => [...selectedPhraseIndexes]
  .filter(isValidPhraseIndex)
  .sort((a, b) => a - b);

const selectedStats = () => {
  const indexes = sortedSelectedIndexes();
  const timed = indexes.filter((index) => project.phrases[index]?.startTimeMs !== null).length;
  return {
    count: indexes.length,
    timed,
    untimed: indexes.length - timed
  };
};

const countUntimedPhrases = () => project.phrases
  .filter((phrase) => phrase.startTimeMs === null)
  .length;

const rangeIndexes = (fromIndex: number, toIndex: number) => {
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset)
    .filter(isValidPhraseIndex);
};

const setCurrentPhrase = (index: number, mode: FocusMode = "manual") => {
  const nextIndex = clampPhraseIndex(index);
  if (nextIndex < 0) return false;
  selectedPhraseIndex = nextIndex;
  focusMode = mode;
  return true;
};

const setSelection = (indexes: Iterable<number>, anchorIndex: number | null = null) => {
  selectedPhraseIndexes = new Set([...indexes].filter(isValidPhraseIndex));
  selectionAnchorIndex = anchorIndex !== null && isValidPhraseIndex(anchorIndex)
    ? anchorIndex
    : (sortedSelectedIndexes()[0] ?? null);
};

const clearSelection = () => {
  setSelection([]);
};

const selectAllPhrases = () => {
  setSelection(project.phrases.map((phrase) => phrase.index), 0);
  setStatus("selectedAll");
};

const showAudioRequiredMessage = () => {
  audioGuidanceAlert = true;
  elements.audioGuidance.hidden = false;
  elements.audioGuidance.classList.remove("is-alert");
  void elements.audioGuidance.offsetWidth;
  elements.audioGuidance.classList.add("is-alert");
  setStatus("loadAudioFirst");
};

const applyListSelection = (index: number, event: MouseEvent) => {
  if (!setCurrentPhrase(index, "manual")) return;
  const anchor = selectionAnchorIndex ?? index;
  const isAdditive = event.ctrlKey || event.metaKey;
  const nextSelection = new Set(selectedPhraseIndexes);

  if (event.shiftKey && isAdditive) {
    rangeIndexes(anchor, index).forEach((rangeIndex) => nextSelection.delete(rangeIndex));
    setSelection(nextSelection, anchor);
  } else if (event.shiftKey) {
    rangeIndexes(anchor, index).forEach((rangeIndex) => nextSelection.add(rangeIndex));
    setSelection(nextSelection, anchor);
  } else if (isAdditive) {
    if (nextSelection.has(index)) {
      nextSelection.delete(index);
    } else {
      nextSelection.add(index);
    }
    setSelection(nextSelection, index);
  } else {
    setSelection([index], index);
  }

  const stats = selectedStats();
  setStatus("selectedPhrases", { count: stats.count });
};

const getSelectedTimedIndexes = () => sortedSelectedIndexes()
  .filter((index) => project.phrases[index]?.startTimeMs !== null);

const findPreviousTimedIndex = (index: number, ignoredIndexes = new Set<number>()) => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!ignoredIndexes.has(cursor) && project.phrases[cursor]?.startTimeMs !== null) return cursor;
  }
  return -1;
};

const findNextTimedIndex = (index: number, ignoredIndexes = new Set<number>()) => {
  for (let cursor = index + 1; cursor < project.phrases.length; cursor += 1) {
    if (!ignoredIndexes.has(cursor) && project.phrases[cursor]?.startTimeMs !== null) return cursor;
  }
  return -1;
};

const getLastKnownStartTimeMs = () => project.phrases.reduce<number | null>((lastKnown, phrase) => (
  phrase.startTimeMs === null ? lastKnown : Math.max(lastKnown ?? 0, phrase.startTimeMs)
), null);

const getMoveBounds = (targetIndexes: Set<number>) => {
  const timedIndexes = [...targetIndexes]
    .filter((index) => project.phrases[index]?.startTimeMs !== null)
    .sort((a, b) => a - b);

  if (!timedIndexes.length) return null;

  let minOffsetMs = -Infinity;
  let maxOffsetMs = Infinity;
  const durationMs = getKnownDurationMs();

  timedIndexes.forEach((index) => {
    const phrase = project.phrases[index];
    const startTimeMs = phrase.startTimeMs;
    if (startTimeMs === null) return;

    const previousIndex = findPreviousTimedIndex(index, targetIndexes);
    const previousTimeMs = previousIndex >= 0 ? project.phrases[previousIndex].startTimeMs : null;
    const minTimeMs = previousTimeMs === null ? 0 : previousTimeMs + MIN_TIMING_GAP_MS;
    minOffsetMs = Math.max(minOffsetMs, minTimeMs - startTimeMs);

    const nextIndex = findNextTimedIndex(index, targetIndexes);
    const nextTimeMs = nextIndex >= 0 ? project.phrases[nextIndex].startTimeMs : null;
    const maxTimeMs = nextTimeMs === null ? durationMs : nextTimeMs - MIN_TIMING_GAP_MS;
    if (maxTimeMs !== null && maxTimeMs !== undefined) {
      maxOffsetMs = Math.min(maxOffsetMs, maxTimeMs - startTimeMs);
    }
  });

  return { minOffsetMs, maxOffsetMs };
};

const clampStartTimeForIndexes = (targetIndexes: Set<number>, phraseIndex: number, timeMs: number) => {
  const phrase = project.phrases[phraseIndex];
  if (!phrase) return null;
  const previousIndex = findPreviousTimedIndex(phraseIndex, targetIndexes);
  const nextIndex = findNextTimedIndex(phraseIndex, targetIndexes);
  const previousTimeMs = previousIndex >= 0 ? project.phrases[previousIndex].startTimeMs : null;
  const nextTimeMs = nextIndex >= 0 ? project.phrases[nextIndex].startTimeMs : null;
  const minTimeMs = previousTimeMs === null ? 0 : previousTimeMs + MIN_TIMING_GAP_MS;
  const maxTimeMs = nextTimeMs === null ? getKnownDurationMs() : nextTimeMs - MIN_TIMING_GAP_MS;
  if (maxTimeMs !== null && maxTimeMs < minTimeMs) return null;
  return Math.max(minTimeMs, Math.min(maxTimeMs ?? Number.POSITIVE_INFINITY, Math.round(timeMs)));
};

const shiftOptionalMs = (value: number | null, offsetMs: number) => (
  value === null ? null : Math.max(0, Math.round(value + offsetMs))
);

const shiftPhraseTiming = (phrase: LyricTimingPhrase, offsetMs: number): LyricTimingPhrase => ({
  ...phrase,
  startTimeMs: shiftOptionalMs(phrase.startTimeMs, offsetMs),
  endTimeMs: shiftOptionalMs(phrase.endTimeMs, offsetMs),
  words: phrase.words?.map((word) => ({
    ...word,
    startTimeMs: shiftOptionalMs(word.startTimeMs, offsetMs),
    endTimeMs: shiftOptionalMs(word.endTimeMs, offsetMs)
  }))
});

const movePhraseStart = (phrase: LyricTimingPhrase, nextStartTimeMs: number): LyricTimingPhrase => {
  const roundedStartTimeMs = Math.max(0, Math.round(nextStartTimeMs));
  if (phrase.startTimeMs === null) {
    return { ...phrase, startTimeMs: roundedStartTimeMs, endTimeMs: null };
  }
  return shiftPhraseTiming(phrase, roundedStartTimeMs - phrase.startTimeMs);
};

const snapOffset = (offsetMs: number, snapMs: number) => Math.round(offsetMs / snapMs) * snapMs;

const clientXToTimeMs = (clientX: number, track: TrackGeometry) => {
  const durationMs = getTimelineDurationMs();
  const ratio = track.width <= 0 ? 0 : (clientX - track.left) / track.width;
  return Math.min(durationMs, Math.max(0, ratio * durationMs));
};

const setPlaybackPositionMs = (timeMs: number) => {
  const durationMs = getTimelineDurationMs();
  const nextTimeMs = Math.min(durationMs, Math.max(0, Math.round(timeMs)));
  previewTimeMs = nextTimeMs;
  if (elements.audioPlayer.src && Number.isFinite(elements.audioPlayer.duration)) {
    const audioDurationMs = Math.max(0, Math.round(elements.audioPlayer.duration * 1000));
    elements.audioPlayer.currentTime = Math.min(nextTimeMs, audioDurationMs) / 1000;
  }
  render();
};

const shiftPlaybackPositionMs = (offsetMs: number) => {
  setPlaybackPositionMs(getPlaybackMs() + offsetMs);
};

const seekStepFromEvent = (event: Pick<KeyboardEvent | WheelEvent, "shiftKey">) => (
  event.shiftKey ? SEEK_FINE_STEP_MS : SEEK_STEP_MS
);

const getTrackGeometry = (): TrackGeometry => {
  const track = elements.sequenceBar.querySelector<HTMLElement>(".sequence-track");
  const rect = (track ?? elements.sequenceBar).getBoundingClientRect();
  return { left: rect.left, width: rect.width };
};

const sanitizeProjectTimingOrder = (value: LyricTimingProject) => {
  let previousValidTimeMs: number | null = null;
  const violationIndexes = new Set<number>();
  const phrases = value.phrases.map((phrase) => {
    if (phrase.startTimeMs === null) return phrase;
    if (previousValidTimeMs !== null && phrase.startTimeMs < previousValidTimeMs + MIN_TIMING_GAP_MS) {
      violationIndexes.add(phrase.index);
      return {
        ...phrase,
        startTimeMs: null,
        endTimeMs: null,
        words: phrase.words?.map((word) => ({ ...word, startTimeMs: null, endTimeMs: null }))
      };
    }
    previousValidTimeMs = phrase.startTimeMs;
    return phrase;
  });

  return {
    project: violationIndexes.size ? { ...value, phrases } : value,
    violationCount: violationIndexes.size
  };
};

const hasTimingOrderViolation = (nextTimes = new Map<number, number | null>()) => {
  let previousValidTimeMs: number | null = null;
  return project.phrases.some((phrase) => {
    const startTimeMs = nextTimes.has(phrase.index) ? nextTimes.get(phrase.index) ?? null : phrase.startTimeMs;
    if (startTimeMs === null) return false;
    if (previousValidTimeMs !== null && startTimeMs < previousValidTimeMs + MIN_TIMING_GAP_MS) return true;
    previousValidTimeMs = startTimeMs;
    return false;
  });
};

const applyTranslations = () => {
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = text(key);
  });
  elements.lyricsText.placeholder = text("lyricsPlaceholder");
  elements.languageToggle.textContent = language === "ja" ? "EN" : "日本語";
  elements.undoAction.title = language === "ja" ? "元に戻す" : "Undo";
  elements.redoAction.title = language === "ja" ? "やり直す" : "Redo";
  elements.undoAction.setAttribute("aria-label", elements.undoAction.title);
  elements.redoAction.setAttribute("aria-label", elements.redoAction.title);
};

const renderSongRibbon = () => {
  const durationMs = getKnownDurationMs();
  const timedCount = project.phrases.filter((phrase) => phrase.startTimeMs !== null).length;
  elements.songTitle.textContent = project.title || text("untitled");
  elements.songArtist.textContent = project.artist || text("unknownArtist");
  elements.audioFileName.textContent = project.audioRef?.fileName ?? text("audioNotSelected");
  elements.audioDuration.textContent = formatDuration(durationMs);
  elements.summary.textContent = text("summary", { timed: timedCount, total: project.phrases.length });
  elements.phraseTableNote.textContent = text("tableNote", { timed: timedCount, total: project.phrases.length });
};

const renderPhraseStage = () => {
  const currentIndex = getCurrentPhraseIndex();
  const nextIndex = getNextPhraseIndex();
  const currentPhrase = currentIndex >= 0 ? project.phrases[currentIndex] : undefined;
  const nextPhrase = nextIndex >= 0 && nextIndex !== currentIndex ? project.phrases[nextIndex] : undefined;
  const isFollowMode = focusMode === "follow";

  elements.currentPhraseCard.dataset.focusMode = focusMode;
  elements.followPlayback.hidden = isFollowMode;
  elements.followPlayback.setAttribute("aria-pressed", isFollowMode ? "true" : "false");
  elements.followPlayback.title = text("followPlaybackTitle");
  elements.followPlayback.textContent = text("returnToFollowPlayback");
  elements.sequenceModeLabel.textContent = text(isFollowMode ? "followModeActive" : "manualModeActive");
  elements.sequenceModeLabel.dataset.focusMode = focusMode;
  elements.sequenceModeHint.textContent = text(isFollowMode ? "followModeHint" : "manualModeHint");
  elements.currentPhraseText.textContent = currentPhrase?.text ?? text("noPhraseLoaded");
  elements.currentPhraseText.classList.toggle("is-blank-display", currentPhrase?.displayMode === "blank");
  elements.currentPhraseText.setAttribute("aria-label", currentPhrase?.displayMode === "blank" ? text("blankPhraseLabel") : "");
  elements.currentPhraseId.textContent = currentPhrase ? `${text("phrase")} ${currentPhrase.index + 1}` : `${text("phrase")} --`;
  elements.currentPhraseTime.textContent = currentPhrase ? formatTimeCell(currentPhrase.startTimeMs) : "--:--.---";
  elements.currentPhraseLine.textContent = currentPhrase ? `${text("line")} ${currentPhrase.sourceLine}` : `${text("line")} --`;
  elements.nextPhraseText.textContent = nextPhrase?.text ?? text("noNextPhrase");
  elements.nextPhraseText.classList.toggle("is-blank-display", nextPhrase?.displayMode === "blank");
  elements.nextPhraseText.setAttribute("aria-label", nextPhrase?.displayMode === "blank" ? text("blankPhraseLabel") : "");
  elements.nextPhraseId.textContent = nextPhrase ? `${text("phrase")} ${nextPhrase.index + 1}` : `${text("phrase")} --`;
  elements.nextPhraseTime.textContent = nextPhrase ? formatTimeCell(nextPhrase.startTimeMs) : "--:--.---";
};

const renderTransport = () => {
  const playbackMs = getPlaybackMs();
  const durationMs = getTimelineDurationMs();
  const displayDuration = getKnownDurationMs();
  const hasAudioSource = Boolean(elements.audioPlayer.src);
  elements.playbackTime.textContent = formatClock(playbackMs);
  elements.playbackDuration.textContent = formatClock(displayDuration ?? durationMs);
  elements.seekBar.max = String(durationMs);
  elements.seekBar.value = String(Math.min(playbackMs, durationMs));
  elements.seekBar.disabled = project.phrases.length === 0 && !hasAudioSource;
  elements.seekBar.setAttribute("aria-label", text("playbackPosition"));
  const playLabel = elements.playToggle.querySelector<HTMLSpanElement>("[data-i18n]");
  const playIcon = elements.playToggle.querySelector<HTMLSpanElement>(".play-icon");
  if (playLabel) playLabel.textContent = text(elements.audioPlayer.paused ? "play" : "pause");
  if (playIcon) playIcon.dataset.state = elements.audioPlayer.paused ? "play" : "pause";
  applyAudioVolume(audioVolumePercent);
  elements.playToggle.classList.toggle("needs-audio", !hasAudioSource);
  elements.playToggle.title = hasAudioSource ? text(elements.audioPlayer.paused ? "play" : "pause") : text("loadAudioFirst");
  elements.audioGuidance.hidden = hasAudioSource;
  elements.audioGuidance.classList.toggle("is-alert", !hasAudioSource && audioGuidanceAlert);
  if (hasAudioSource) audioGuidanceAlert = false;
  elements.undoAction.disabled = undoStack.length === 0;
  elements.redoAction.disabled = redoStack.length === 0;
};

const renderSelectionEditBar = () => {
  const stats = selectedStats();
  const hasSelection = stats.count > 0;
  elements.selectionEditBar.hidden = !hasSelection;
  if (!hasSelection) return;

  elements.selectionSummary.textContent = text("selectionSummary", stats);
  elements.selectionShiftEarlier.disabled = stats.timed === 0;
  elements.selectionShiftLater.disabled = stats.timed === 0;
  elements.selectionEven.disabled = stats.count <= 1;
  elements.selectionEven.textContent = text(stats.untimed > 0 ? "evenSpacingWithUntimed" : "evenSpacing");
  elements.selectionClearTiming.disabled = stats.timed === 0;
  elements.sequenceDragHint.hidden = sequenceDragState?.type !== "move";
};

const makeCell = (textContent: string, className?: string) => {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = textContent;
  return cell;
};

const keepElementVisibleInside = (container: HTMLElement, target: HTMLElement) => {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetRect.top < containerRect.top) {
    container.scrollTop -= containerRect.top - targetRect.top;
  } else if (targetRect.bottom > containerRect.bottom) {
    container.scrollTop += targetRect.bottom - containerRect.bottom;
  }
};

const renderPhraseTable = () => {
  if (!project.phrases.length) {
    const empty = document.createElement("div");
    empty.className = "empty-table";
    empty.textContent = text("noPhraseLoaded");
    elements.phraseTable.replaceChildren(empty);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [text("tableNumber"), text("tablePhrase"), text("tableStart"), text("tableEnd"), text("tableLine")].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  });
  thead.append(headerRow);

  const currentIndex = getCurrentPhraseIndex();
  const nextIndex = getNextPhraseIndex();
  const tbody = document.createElement("tbody");
  project.phrases.forEach((phrase) => {
    const row = document.createElement("tr");
    row.dataset.phraseIndex = String(phrase.index);
    row.classList.toggle("is-current", phrase.index === currentIndex);
    row.classList.toggle("is-next", phrase.index === nextIndex && phrase.index !== currentIndex);
    row.classList.toggle("is-untimed", phrase.startTimeMs === null);
    row.classList.toggle("is-selected", selectedPhraseIndexes.has(phrase.index));
    row.setAttribute("aria-selected", selectedPhraseIndexes.has(phrase.index) ? "true" : "false");

    const numberCell = makeCell(String(phrase.index + 1), "number-cell");
    const phraseCell = document.createElement("td");
    const phraseButton = document.createElement("button");
    phraseButton.type = "button";
    phraseButton.className = "phrase-select";
    phraseButton.classList.toggle("is-blank-display", phrase.displayMode === "blank");
    phraseButton.textContent = phraseEditorLabel(phrase);
    phraseButton.dataset.phraseIndex = String(phrase.index);
    phraseCell.append(phraseButton);

    const endMs = getEffectiveEndTimeMs(phrase);
    row.append(
      numberCell,
      phraseCell,
      makeCell(formatTimeCell(phrase.startTimeMs), "time-cell"),
      makeCell(formatTimeCell(endMs), "time-cell muted-cell"),
      makeCell(String(phrase.sourceLine), "line-cell")
    );
    tbody.append(row);
  });
  table.append(thead, tbody);
  elements.phraseTable.replaceChildren(table);

  const activeRow = elements.phraseTable.querySelector<HTMLElement>(`[data-phrase-index="${currentIndex}"]`);
  if (activeRow && focusMode === "follow") {
    keepElementVisibleInside(elements.phraseTable, activeRow);
  }
};

const renderSequenceBar = () => {
  const durationMs = getTimelineDurationMs();
  const playbackMs = getPlaybackMs();
  const currentIndex = getCurrentPhraseIndex();
  const nextIndex = getNextPhraseIndex();
  const track = document.createElement("div");
  track.className = "sequence-track";

  const playhead = document.createElement("div");
  playhead.className = "sequence-playhead";
  playhead.style.left = `${Math.min(100, Math.max(0, (playbackMs / durationMs) * 100))}%`;
  track.append(playhead);

  elements.sequenceBar.setAttribute("aria-label", text("playbackPosition"));
  elements.sequenceBar.setAttribute("aria-valuemin", "0");
  elements.sequenceBar.setAttribute("aria-valuemax", String(durationMs));
  elements.sequenceBar.setAttribute("aria-valuenow", String(Math.min(playbackMs, durationMs)));
  elements.sequenceBar.setAttribute("aria-valuetext", formatClock(playbackMs));
  elements.sequenceBar.dataset.focusMode = focusMode;
  elements.sequenceBar.title = `${text("sequenceSeekHint")} ${text(focusMode === "follow" ? "followModeHint" : "manualModeHint")}`;

  if (sequenceDragState?.type === "range") {
    const startPercent = Math.min(
      100,
      Math.max(0, ((sequenceDragState.startClientX - sequenceDragState.track.left) / sequenceDragState.track.width) * 100)
    );
    const currentPercent = Math.min(
      100,
      Math.max(0, ((sequenceDragState.currentClientX - sequenceDragState.track.left) / sequenceDragState.track.width) * 100)
    );
    const rangePreview = document.createElement("div");
    rangePreview.className = "sequence-range-preview";
    rangePreview.style.left = `${Math.min(startPercent, currentPercent)}%`;
    rangePreview.style.width = `${Math.abs(currentPercent - startPercent)}%`;
    track.append(rangePreview);
  }

  project.phrases.forEach((phrase) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "sequence-marker";
    marker.classList.toggle("is-current", phrase.index === currentIndex);
    marker.classList.toggle("is-next", phrase.index === nextIndex && phrase.index !== currentIndex);
    marker.classList.toggle("is-untimed", phrase.startTimeMs === null);
    marker.classList.toggle("is-selected", selectedPhraseIndexes.has(phrase.index));
    marker.dataset.phraseIndex = String(phrase.index);
    marker.setAttribute("aria-label", `${text("phrase")} ${phrase.index + 1}: ${phrase.text}`);
    const previewStartTimeMs = sequenceDragState?.type === "move" &&
      selectedPhraseIndexes.has(phrase.index) &&
      phrase.startTimeMs !== null
        ? phrase.startTimeMs + sequenceDragState.previewOffsetMs
        : phrase.startTimeMs;
    const position = previewStartTimeMs === null
      ? (phrase.index / Math.max(1, project.phrases.length - 1)) * 100
      : (previewStartTimeMs / durationMs) * 100;
    marker.style.left = `${Math.min(100, Math.max(0, position))}%`;
    track.append(marker);
  });

  elements.sequenceBar.replaceChildren(track);
};

const setValidationDisplay = (
  state: ValidationUiState,
  validationMessage: string,
  exportReadinessMessage = validationMessage
) => {
  elements.validationSection.dataset.state = state;
  elements.validation.textContent = validationMessage;
  elements.exportMenu.dataset.state = state;
  elements.exportReadiness.dataset.state = state;
  elements.exportReadiness.hidden = state === "ok";
  elements.exportReadiness.textContent = state === "ok" ? "" : exportReadinessMessage;
};

const renderValidation = () => {
  const issues = validateLyricTimingProject(project);
  if (issues.length) {
    const state: ValidationUiState = issues.some((issue) => issue.level === "error") ? "error" : "warning";
    setValidationDisplay(state, renderIssues(issues), text("exportReadinessValidationIssue"));
    return;
  }

  const untimedCount = countUntimedPhrases();
  if (untimedCount > 0) {
    setValidationDisplay(
      "warning",
      text("validationExportMissingTiming", { count: untimedCount }),
      text("exportReadinessMissingTiming", { count: untimedCount })
    );
    return;
  }

  setValidationDisplay("ok", text("noValidationIssues"), "");
};

const renderExportMenu = () => {
  const hasLyrics = project.phrases.some((phrase) => phrase.text.trim());
  for (const button of [elements.exportWithLyrics, elements.exportWebVtt, elements.exportLrc]) {
    button.hidden = !hasLyrics;
    if (button.nextElementSibling instanceof HTMLElement) button.nextElementSibling.hidden = !hasLyrics;
  }
};

function render() {
  applyTranslations();
  syncFieldsFromProject();
  renderDraftBanner();
  renderSongRibbon();
  renderPhraseStage();
  renderTransport();
  renderSelectionEditBar();
  renderPhraseTable();
  renderSequenceBar();
  renderValidation();
  renderExportMenu();
  renderAutoSaveStatus();
  elements.status.textContent = text(statusMessage.key, statusMessage.values);
}

const downloadJson = (fileName: string, value: unknown) => {
  downloadText(fileName, `${JSON.stringify(value, null, 2)}\n`, "application/json;charset=utf-8");
};

const canSaveToPickedFile = () => (
  window.isSecureContext && typeof window.showSaveFilePicker === "function"
);

const projectJsonText = () => `${JSON.stringify(project, null, 2)}\n`;

const lyricsTextFileText = () => {
  const normalized = elements.lyricsText.value.replace(/\r\n?/g, "\n");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
};

const pickProjectSaveFile = (fileName: string) => window.showSaveFilePicker?.({
  suggestedName: fileName,
  types: [
    {
      description: "Lyric Timing Editor Work Project JSON",
      accept: {
        "application/json": [".json"]
      }
    }
  ]
});

const pickLyricsTextSaveFile = (fileName: string) => window.showSaveFilePicker?.({
  suggestedName: fileName,
  types: [
    {
      description: "UTF-8 Lyric Text",
      accept: {
        "text/plain": [".txt"]
      }
    }
  ]
});

const writePickedTextFile = async (handle: FileSystemFileHandleLike, value: string, type: string) => {
  const writable = await handle.createWritable();
  try {
    await writable.write(new Blob([value], { type }));
  } finally {
    await writable.close();
  }
};

const downloadText = (fileName: string, value: string, type: string) => {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
};

const fileBaseName = () => (
  project.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug) ? project.slug : "lyric-timing-editor"
);

const requireLyricsRightsConfirmation = () => {
  if (!project.phrases.length && !elements.lyricsText.value.trim()) return true;
  return window.confirm(text("rightsConfirm"));
};

const showExportIssues = (issues: LyricTimingIssue[]) => {
  const missingTimingCount = issues.filter((issue) => issue.code === "missing-start").length;
  const otherIssues = issues.filter((issue) => issue.code !== "missing-start");
  if (missingTimingCount > 0) {
    const message = [
      text("exportBlockedMissingTiming", { count: missingTimingCount }),
      otherIssues.length ? renderIssues(otherIssues) : ""
    ].filter(Boolean).join(" / ");
    elements.status.textContent = message;
    setValidationDisplay("error", message, text("exportReadinessMissingTiming", { count: missingTimingCount }));
    return;
  }
  const message = renderIssues(issues);
  elements.status.textContent = message;
  setValidationDisplay("error", message, text("exportReadinessValidationIssue"));
};

const parseLyrics = (options: ParseLyricsOptions = {}) => {
  if (utf8ByteLength(elements.lyricsText.value) > MAX_LYRIC_TEXT_BYTES) {
    setStatus("sourceTextTooLarge", { limit: formatBytes(MAX_LYRIC_TEXT_BYTES) });
    return;
  }
  const previousProject = cloneProject(project);
  applyMetadata();
  const nextProject = createLyricTimingProject({
    ...currentMetadata(),
    parseMode: elements.parseMode.value as LyricTextParseMode,
    lyricText: elements.lyricsText.value,
    now: new Date()
  });
  if (nextProject.phrases.length > MAX_LYRIC_PHRASES) {
    setStatus("tooManyPhrases", { limit: MAX_LYRIC_PHRASES });
    return;
  }
  const transferred = transferReparsedPhraseTiming(previousProject, nextProject);
  if (previousProject.phrases.length || projectHasAnyTiming()) pushUndo();
  project = transferred.project;
  selectedPhraseIndex = Math.max(
    0,
    Math.min(options.selectPhraseIndex ?? selectedPhraseIndex, Math.max(0, project.phrases.length - 1))
  );
  focusMode = options.focusMode ?? "follow";
  clearSelection();
  const statusKey = options.statusKey ?? (previousProject.phrases.some(phraseHasTiming) ? "lyricsParsedWithTiming" : "lyricsParsed");
  setStatus(statusKey, {
    count: project.phrases.length,
    kept: transferred.kept
  });
  queueAutoSave();
};

const insertBlankLineAtCursor = () => {
  insertSourceLine(BLANK_SOURCE_MARKER, cursorLineIndex() + 1);
  setStatus("blankLineInserted");
};

const insertBlankPhraseNearCurrent = (placement: "before" | "after") => {
  const currentIndex = getCurrentPhraseIndex();
  const phrase = currentIndex >= 0 ? project.phrases[currentIndex] : undefined;
  if (!phrase) {
    setStatus("noCurrentPhrase");
    return;
  }
  const insertAt = placement === "before" ? phrase.sourceLine - 1 : phrase.sourceLine;
  insertSourceLine(BLANK_SOURCE_MARKER, insertAt);
  parseLyrics({
    selectPhraseIndex: placement === "before" ? currentIndex : currentIndex + 1,
    focusMode: "manual",
    statusKey: "blankPhraseInserted"
  });
};

const loadSafeDemoLyrics = () => {
  const hasCustomSource = elements.lyricsText.value.trim() && elements.lyricsText.value !== SAFE_DEMO_LYRIC_TEXT;
  if ((hasCustomSource || projectHasAnyTiming()) && !window.confirm(text("replaceSourceConfirm"))) return;
  elements.parseMode.value = "textalive";
  elements.lyricsText.value = SAFE_DEMO_LYRIC_TEXT;
  lyricsTextSaveFileHandle = null;
  parseLyrics();
  setStatus("safeDemoLoaded", { count: project.phrases.length });
};

const handleParseModeChange = () => {
  const previousMode = project.parseMode;
  if (elements.parseMode.value === previousMode) return;

  if (projectHasAnyTiming() && !window.confirm(text("reparseLosesTimingConfirm"))) {
    elements.parseMode.value = previousMode;
    setStatus("parseModeKept");
    return;
  }

  parseLyrics();
};

const selectPhrase = (index: number, mode: FocusMode = "manual") => {
  const nextIndex = clampPhraseIndex(index);
  if (nextIndex < 0) return;
  selectedPhraseIndex = nextIndex;
  focusMode = mode;
  render();
};

const returnToFollowMode = (statusKey: string | null = null) => {
  focusMode = "follow";
  if (statusKey) {
    setStatus(statusKey);
    return;
  }
  render();
};

const setPhraseStartTime = (phraseIndex: number, timeMs: number, statusKey: string) => {
  const nextIndex = clampPhraseIndex(phraseIndex);
  if (nextIndex < 0) return;
  const roundedMs = clampStartTimeForIndexes(new Set([nextIndex]), nextIndex, timeMs);
  if (roundedMs === null) {
    setStatus("orderLockNoSpace");
    return;
  }
  applyMetadata();
  pushUndo();
  project = {
    ...project,
    updatedAt: new Date().toISOString(),
    phrases: project.phrases.map((phrase, index) => (
      index === nextIndex ? { ...phrase, startTimeMs: roundedMs } : phrase
    ))
  };
  selectedPhraseIndex = nextIndex;
  setStatus(statusKey, { index: nextIndex + 1, time: formatClock(roundedMs) });
  queueAutoSave();
};

const applyOffsetToSelectedTiming = (requestedOffsetMs: number, statusKey = "selectionMoved") => {
  const timedIndexes = getSelectedTimedIndexes();
  if (!timedIndexes.length) {
    setStatus("selectionMoveEmpty");
    return 0;
  }

  const targetIndexes = new Set(timedIndexes);
  const bounds = getMoveBounds(targetIndexes);
  if (!bounds) {
    setStatus("selectionMoveEmpty");
    return 0;
  }

  const offsetMs = Math.max(bounds.minOffsetMs, Math.min(bounds.maxOffsetMs, requestedOffsetMs));
  if (offsetMs === 0) {
    setStatus("selectionMoveBlocked");
    return 0;
  }

  applyMetadata();
  pushUndo();
  project = {
    ...project,
    updatedAt: new Date().toISOString(),
    phrases: project.phrases.map((phrase) => (
      targetIndexes.has(phrase.index) ? shiftPhraseTiming(phrase, offsetMs) : phrase
    ))
  };
  setStatus(statusKey, {
    count: timedIndexes.length,
    offset: offsetMs > 0 ? `+${offsetMs}` : offsetMs
  });
  queueAutoSave();
  return offsetMs;
};

const clearSelectionTiming = () => {
  const timedIndexes = getSelectedTimedIndexes();
  if (!timedIndexes.length) {
    setStatus("selectionMoveEmpty");
    return;
  }

  const targetIndexes = new Set(timedIndexes);
  applyMetadata();
  pushUndo();
  project = {
    ...project,
    updatedAt: new Date().toISOString(),
    phrases: project.phrases.map((phrase) => (
      targetIndexes.has(phrase.index)
        ? {
            ...phrase,
            startTimeMs: null,
            endTimeMs: null,
            words: phrase.words?.map((word) => ({ ...word, startTimeMs: null, endTimeMs: null }))
          }
        : phrase
    ))
  };
  setStatus("selectionTimingCleared", { count: targetIndexes.size });
  queueAutoSave();
};

const placeSelectedEvenly = () => {
  const indexes = sortedSelectedIndexes();
  if (indexes.length <= 1) {
    setStatus("selectionEmpty");
    return;
  }

  const firstIndex = indexes[0];
  const lastIndex = indexes[indexes.length - 1];
  const firstPhrase = project.phrases[firstIndex];
  const lastPhrase = project.phrases[lastIndex];
  let anchorStartTimeMs: number;
  let anchorEndTimeMs: number;
  let movingIndexes = indexes;
  let denominator = indexes.length + 1;
  let stepStart = 1;

  if (firstPhrase.startTimeMs !== null && lastPhrase.startTimeMs !== null) {
    anchorStartTimeMs = firstPhrase.startTimeMs;
    anchorEndTimeMs = lastPhrase.startTimeMs;
    movingIndexes = indexes.slice(1, -1);
    denominator = indexes.length - 1;
    stepStart = 1;
  } else {
    const selectedSet = new Set(indexes);
    const previousAnchorIndex = findPreviousTimedIndex(firstIndex, selectedSet);
    const nextAnchorIndex = findNextTimedIndex(lastIndex, selectedSet);
    anchorStartTimeMs = previousAnchorIndex >= 0 ? project.phrases[previousAnchorIndex].startTimeMs ?? 0 : 0;
    const fallbackEndTimeMs = getKnownDurationMs() ?? getLastKnownStartTimeMs();
    anchorEndTimeMs = nextAnchorIndex >= 0
      ? project.phrases[nextAnchorIndex].startTimeMs ?? anchorStartTimeMs
      : fallbackEndTimeMs ?? anchorStartTimeMs;

    if (anchorEndTimeMs <= anchorStartTimeMs) {
      setStatus("evenSpacingNeedsDuration");
      return;
    }
  }

  if (!movingIndexes.length) {
    setStatus("selectionEvened", { count: 0 });
    return;
  }

  const requiredSpanMs = denominator * MIN_TIMING_GAP_MS;
  if (anchorEndTimeMs - anchorStartTimeMs < requiredSpanMs) {
    setStatus("spacingTooSmall");
    return;
  }

  const nextTimes = new Map<number, number>();
  let previousTimeMs = anchorStartTimeMs;
  movingIndexes.forEach((index, offset) => {
    const remaining = movingIndexes.length - offset - 1;
    const rawTimeMs = anchorStartTimeMs + ((anchorEndTimeMs - anchorStartTimeMs) * (offset + stepStart)) / denominator;
    const minTimeMs = previousTimeMs + MIN_TIMING_GAP_MS;
    const maxTimeMs = anchorEndTimeMs - (remaining + 1) * MIN_TIMING_GAP_MS;
    const nextTimeMs = Math.min(maxTimeMs, Math.max(minTimeMs, Math.round(rawTimeMs)));
    nextTimes.set(index, nextTimeMs);
    previousTimeMs = nextTimeMs;
  });

  if (hasTimingOrderViolation(nextTimes)) {
    setStatus("spacingTooSmall");
    return;
  }

  applyMetadata();
  pushUndo();
  project = {
    ...project,
    updatedAt: new Date().toISOString(),
    phrases: project.phrases.map((phrase) => (
      nextTimes.has(phrase.index) ? movePhraseStart(phrase, nextTimes.get(phrase.index) ?? 0) : phrase
    ))
  };
  setStatus("selectionEvened", { count: nextTimes.size });
  queueAutoSave();
};

const stampCurrentPhrase = () => {
  const currentIndex = getCurrentPhraseIndex();
  if (currentIndex < 0) {
    setStatus("noCurrentPhrase");
    return;
  }
  setPhraseStartTime(currentIndex, getPlaybackMs(), "stampedCurrent");
};

const stampNextPhrase = () => {
  const nextIndex = getNextPhraseIndex();
  if (nextIndex < 0 || nextIndex === getCurrentPhraseIndex()) {
    setStatus("noNextTarget");
    return;
  }
  setPhraseStartTime(nextIndex, getPlaybackMs(), "stampedNext");
};

const togglePlayback = async () => {
  if (!elements.audioPlayer.src) {
    showAudioRequiredMessage();
    return;
  }
  if (elements.audioPlayer.paused) {
    try {
      await elements.audioPlayer.play();
    } catch {
      setStatus("audioPlaybackFailed");
    }
  } else {
    elements.audioPlayer.pause();
  }
  render();
};

const undo = () => {
  const previous = undoStack.pop();
  if (!previous) {
    setStatus("undoEmpty");
    return;
  }
  redoStack.push(snapshot());
  restoreSnapshot(previous);
  setStatus("undoDone");
  queueAutoSave();
};

const redo = () => {
  const next = redoStack.pop();
  if (!next) {
    setStatus("redoEmpty");
    return;
  }
  undoStack.push(snapshot());
  restoreSnapshot(next);
  setStatus("redoDone");
  queueAutoSave();
};

const isTextEditingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "submit", "reset"].includes(target.type);
};

const getMarkerElementsFromPoint = (clientX: number, clientY: number) => {
  const seen = new Set<HTMLElement>();
  return document.elementsFromPoint(clientX, clientY).flatMap((element) => {
    const marker = element.closest<HTMLElement>(".sequence-marker");
    if (!marker || seen.has(marker)) return [];
    seen.add(marker);
    return [marker];
  });
};

const getMarkerPhraseIndex = (marker: HTMLElement | null) => {
  const index = Number(marker?.dataset.phraseIndex);
  return Number.isInteger(index) && isValidPhraseIndex(index) ? index : -1;
};

const pickMarkerFromPointer = (event: PointerEvent) => {
  const markers = getMarkerElementsFromPoint(event.clientX, event.clientY);
  return markers.find((marker) => selectedPhraseIndexes.has(getMarkerPhraseIndex(marker))) ?? markers[0] ?? null;
};

const getPhraseRowFromPoint = (clientX: number, clientY: number) => {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const row = element.closest<HTMLElement>("tr[data-phrase-index]");
    if (row && elements.phraseTable.contains(row)) return row;
  }
  return null;
};

const getPhraseRowFromEvent = (event: MouseEvent | PointerEvent) => {
  const targetRow = event.target instanceof Element
    ? event.target.closest<HTMLElement>("tr[data-phrase-index]")
    : null;
  if (targetRow && elements.phraseTable.contains(targetRow)) return targetRow;
  return getPhraseRowFromPoint(event.clientX, event.clientY);
};

const describeModifiers = (event: MouseEvent | PointerEvent) => {
  const active = [
    event.ctrlKey ? "Ctrl" : "",
    event.metaKey ? "Meta" : "",
    event.shiftKey ? "Shift" : "",
    event.altKey ? "Alt" : ""
  ].filter(Boolean);
  return active.length ? active.join("+") : "none";
};

const ensureHitDebugOverlay = () => {
  if (hitDebugOverlay) return hitDebugOverlay;
  hitDebugOverlay = document.createElement("div");
  hitDebugOverlay.className = "hit-debug-overlay";
  document.body.append(hitDebugOverlay);
  return hitDebugOverlay;
};

const setHitDebugEnabled = (enabled: boolean) => {
  hitDebugEnabled = enabled;
  document.body.classList.toggle("hit-debug-enabled", hitDebugEnabled);
  const overlay = ensureHitDebugOverlay();
  overlay.hidden = !hitDebugEnabled;
  if (!hitDebugEnabled && hitDebugHoverRow) {
    hitDebugHoverRow.classList.remove("hit-debug-hover");
    hitDebugHoverRow = null;
  }
};

const updateHitDebugPointer = (event: PointerEvent) => {
  if (!hitDebugEnabled) return;
  const row = getPhraseRowFromPoint(event.clientX, event.clientY);
  if (hitDebugHoverRow && hitDebugHoverRow !== row) hitDebugHoverRow.classList.remove("hit-debug-hover");
  hitDebugHoverRow = row;
  hitDebugHoverRow?.classList.add("hit-debug-hover");

  const overlay = ensureHitDebugOverlay();
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const marker = getMarkerElementsFromPoint(event.clientX, event.clientY)[0] ?? null;
  const phraseIndex = row ? Number(row.dataset.phraseIndex) : -1;
  const markerIndex = getMarkerPhraseIndex(marker);
  overlay.hidden = false;
  overlay.style.left = `${Math.max(8, Math.min(window.innerWidth - 260, event.clientX + 14))}px`;
  overlay.style.top = `${Math.max(8, Math.min(window.innerHeight - 96, event.clientY + 14))}px`;
  overlay.textContent = [
    row ? `row ${phraseIndex + 1}` : "row none",
    markerIndex >= 0 ? `stone ${markerIndex + 1}` : "stone none",
    `target ${element?.tagName.toLowerCase() ?? "none"}${element instanceof HTMLElement && element.className ? `.${String(element.className).replace(/\s+/g, ".")}` : ""}`
  ].join(" / ");
};

const recordHitDebugSelection = (event: MouseEvent | PointerEvent, row: HTMLElement, before: number[]) => {
  if (!hitDebugEnabled) return;
  const index = Number(row.dataset.phraseIndex);
  const overlay = ensureHitDebugOverlay();
  const after = sortedSelectedIndexes();
  row.classList.add("hit-debug-clicked");
  window.setTimeout(() => row.classList.remove("hit-debug-clicked"), 240);
  overlay.textContent = [
    `clicked row ${index + 1}`,
    `mods ${describeModifiers(event)}`,
    `before ${before.map((value) => value + 1).join(",") || "none"}`,
    `after ${after.map((value) => value + 1).join(",") || "none"}`
  ].join(" / ");
};

const clearCurrentTiming = () => {
  const currentIndex = getCurrentPhraseIndex();
  if (currentIndex < 0) return;
  setSelection([currentIndex], currentIndex);
  clearSelectionTiming();
};

const beginSequencePointer = (event: PointerEvent) => {
  if (event.button !== 0) return;
  const track = getTrackGeometry();
  const marker = pickMarkerFromPointer(event);

  if (marker) {
    const phraseIndex = getMarkerPhraseIndex(marker);
    if (phraseIndex < 0) return;

    setCurrentPhrase(phraseIndex, "manual");
    if (!selectedPhraseIndexes.has(phraseIndex)) setSelection([phraseIndex], phraseIndex);
    const timedIndexes = getSelectedTimedIndexes();
    const bounds = getMoveBounds(new Set(timedIndexes));

    if (bounds) {
      sequenceDragState = {
        type: "move",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        currentClientX: event.clientX,
        track,
        minOffsetMs: bounds.minOffsetMs,
        maxOffsetMs: bounds.maxOffsetMs,
        previewOffsetMs: 0,
        moved: false
      };
      elements.sequenceBar.setPointerCapture(event.pointerId);
    }
    render();
    event.preventDefault();
    return;
  }

  if (!event.ctrlKey && !event.metaKey) {
    sequenceDragState = {
      type: "seek",
      pointerId: event.pointerId,
      track
    };
    elements.sequenceBar.setPointerCapture(event.pointerId);
    setPlaybackPositionMs(clientXToTimeMs(event.clientX, track));
    elements.sequenceBar.focus();
    event.preventDefault();
    return;
  }

  sequenceDragState = {
    type: "range",
    pointerId: event.pointerId,
    startClientX: event.clientX,
    currentClientX: event.clientX,
    track,
    additive: event.ctrlKey || event.metaKey,
    subtractive: (event.ctrlKey || event.metaKey) && event.shiftKey
  };
  elements.sequenceBar.setPointerCapture(event.pointerId);
  renderSequenceBar();
  event.preventDefault();
};

const moveSequencePointer = (event: PointerEvent) => {
  if (!sequenceDragState || sequenceDragState.pointerId !== event.pointerId) return;

  if (sequenceDragState.type === "seek") {
    setPlaybackPositionMs(clientXToTimeMs(event.clientX, sequenceDragState.track));
    event.preventDefault();
    return;
  }

  if (sequenceDragState.type === "range") {
    sequenceDragState = { ...sequenceDragState, currentClientX: event.clientX };
    renderSequenceBar();
    event.preventDefault();
    return;
  }

  const pixelDelta = event.clientX - sequenceDragState.startClientX;
  const durationMs = getTimelineDurationMs();
  const dragScale = event.shiftKey ? FINE_DRAG_SCALE : 1;
  const rawOffsetMs = Math.abs(pixelDelta) < DRAG_START_THRESHOLD_PX
    ? 0
    : (pixelDelta / Math.max(1, sequenceDragState.track.width)) * durationMs * dragScale;
  const snapMs = event.shiftKey ? 1 : TIMING_NUDGE_MS;
  const nextOffsetMs = Math.max(
    sequenceDragState.minOffsetMs,
    Math.min(sequenceDragState.maxOffsetMs, snapOffset(rawOffsetMs, snapMs))
  );

  sequenceDragState = {
    ...sequenceDragState,
    currentClientX: event.clientX,
    previewOffsetMs: nextOffsetMs,
    moved: sequenceDragState.moved || Math.abs(pixelDelta) >= DRAG_START_THRESHOLD_PX
  };
  renderSelectionEditBar();
  renderSequenceBar();
  event.preventDefault();
};

const endSequencePointer = (event: PointerEvent) => {
  if (!sequenceDragState || sequenceDragState.pointerId !== event.pointerId) return;
  const endedState = sequenceDragState;
  sequenceDragState = null;
  if (elements.sequenceBar.hasPointerCapture(event.pointerId)) {
    elements.sequenceBar.releasePointerCapture(event.pointerId);
  }

  if (endedState.type === "seek") {
    event.preventDefault();
    return;
  }

  if (endedState.type === "range") {
    const dragged = Math.abs(endedState.currentClientX - endedState.startClientX) >= DRAG_START_THRESHOLD_PX;
    if (!dragged) {
      if (!endedState.additive && !endedState.subtractive) clearSelection();
      render();
      event.preventDefault();
      return;
    }

    const startTimeMs = clientXToTimeMs(endedState.startClientX, endedState.track);
    const endTimeMs = clientXToTimeMs(endedState.currentClientX, endedState.track);
    const minTimeMs = Math.min(startTimeMs, endTimeMs);
    const maxTimeMs = Math.max(startTimeMs, endTimeMs);
    const rangeSelectedIndexes = project.phrases
      .filter((phrase) => phrase.startTimeMs !== null && phrase.startTimeMs >= minTimeMs && phrase.startTimeMs <= maxTimeMs)
      .map((phrase) => phrase.index);
    const nextSelection = new Set(endedState.additive || endedState.subtractive ? selectedPhraseIndexes : []);
    if (endedState.subtractive) {
      rangeSelectedIndexes.forEach((index) => nextSelection.delete(index));
    } else {
      rangeSelectedIndexes.forEach((index) => nextSelection.add(index));
    }
    const nextIndexes = [...nextSelection].sort((a, b) => a - b);
    setSelection(nextIndexes, rangeSelectedIndexes[0] ?? nextIndexes[0] ?? null);
    setStatus("selectedPhrases", { count: nextIndexes.length });
    event.preventDefault();
    return;
  }

  if (endedState.moved && endedState.previewOffsetMs !== 0) {
    applyOffsetToSelectedTiming(endedState.previewOffsetMs);
  } else {
    render();
  }
  event.preventDefault();
};

elements.parseLyrics.addEventListener("click", () => parseLyrics());
elements.loadSafeDemo.addEventListener("click", loadSafeDemoLyrics);
elements.parseMode.addEventListener("change", handleParseModeChange);
elements.lyricsText.addEventListener("input", queueAutoSave);
elements.insertBlankLine.addEventListener("click", insertBlankLineAtCursor);
elements.insertBlankBeforeCurrent.addEventListener("click", () => insertBlankPhraseNearCurrent("before"));
elements.insertBlankAfterCurrent.addEventListener("click", () => insertBlankPhraseNearCurrent("after"));
elements.sourceFindPrev.addEventListener("click", () => findSourceMatch(-1));
elements.sourceFindNext.addEventListener("click", () => findSourceMatch(1));
elements.sourceReplaceOne.addEventListener("click", replaceSourceMatch);
elements.sourceReplaceAll.addEventListener("click", replaceAllSourceMatches);
elements.sourceSearchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  findSourceMatch(event.shiftKey ? -1 : 1);
});
elements.sourceSearchInput.addEventListener("input", () => {
  elements.sourceSearchStatus.textContent = "";
});

elements.lyricsInput.addEventListener("change", async () => {
  const file = elements.lyricsInput.files?.[0];
  if (!file) return;
  try {
    if (!validateSelectedFile(file, {
      maxBytes: MAX_LYRIC_TEXT_BYTES,
      extensions: LYRIC_FILE_EXTENSIONS,
      acceptsType: (type) => type.startsWith("text/") || type === "application/octet-stream",
      invalidStatus: "unsupportedLyricsFile"
    })) return;
    elements.lyricsText.value = await file.text();
    lyricsTextSaveFileHandle = null;
    parseLyrics();
  } catch {
    setStatus("fileReadFailed");
  } finally {
    elements.lyricsInput.value = "";
  }
});

elements.audioInput.addEventListener("change", async () => {
  const file = elements.audioInput.files?.[0];
  if (!file) return;
  if (!validateSelectedFile(file, {
    maxBytes: MAX_AUDIO_BYTES,
    extensions: AUDIO_FILE_EXTENSIONS,
    acceptsType: (type) => type.startsWith("audio/"),
    invalidStatus: "unsupportedAudioFile"
  })) {
    elements.audioInput.value = "";
    return;
  }
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = URL.createObjectURL(file);
  elements.audioPlayer.src = audioObjectUrl;
  elements.audioPlayer.load();
  audioGuidanceAlert = false;

  const audioRef = await readAudioMetadata(file);
  project = updateLyricTimingProjectMetadata(project, {
    ...currentMetadata(),
    audioRef,
    durationMs: project.durationMs ?? audioRef.durationMs ?? null
  });
  previewTimeMs = 0;
  setStatus("audioUpdated");
  queueAutoSave();
  elements.audioInput.value = "";
});

for (const input of [elements.title, elements.artist, elements.slug, elements.duration, elements.songUrl, elements.songleUrl, elements.textAliveUrl, elements.notes]) {
  input.addEventListener("input", queueAutoSave);
  input.addEventListener("change", () => {
    applyMetadata();
    setStatus("metadataUpdated");
    queueAutoSave();
  });
}

elements.saveProject.addEventListener("click", () => {
  void saveProject();
});

elements.saveLyricsText.addEventListener("click", () => {
  void saveLyricsText();
});

const saveProject = async () => {
  if (!requireLyricsRightsConfirmation()) return;
  applyMetadata();
  project = { ...project, updatedAt: new Date().toISOString() };
  const fileName = `${fileBaseName()}.lyric-timing-editor.work-project.json`;
  const jsonText = projectJsonText();

  if (!canSaveToPickedFile()) {
    downloadText(fileName, jsonText, "application/json;charset=utf-8");
    setStatus("projectDownloaded");
    return;
  }

  try {
    projectSaveFileHandle = projectSaveFileHandle ?? await pickProjectSaveFile(fileName) ?? null;
    if (!projectSaveFileHandle) {
      setStatus("projectSaveCanceled");
      return;
    }
    await writePickedTextFile(projectSaveFileHandle, jsonText, "application/json;charset=utf-8");
    setStatus("projectSaved");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      setStatus("projectSaveCanceled");
      return;
    }
    projectSaveFileHandle = null;
    setStatus("projectSaveFailed");
  }
};

const saveLyricsText = async () => {
  const fileText = lyricsTextFileText();
  if (!fileText.trim()) {
    setStatus("lyricsTextEmpty");
    return;
  }
  if (utf8ByteLength(fileText) > MAX_LYRIC_TEXT_BYTES) {
    setStatus("sourceTextTooLarge", { limit: formatBytes(MAX_LYRIC_TEXT_BYTES) });
    return;
  }
  if (!requireLyricsRightsConfirmation()) return;
  applyMetadata();
  const fileName = `${fileBaseName()}.lyrics.txt`;

  if (!canSaveToPickedFile()) {
    downloadText(fileName, fileText, "text/plain;charset=utf-8");
    setStatus("lyricsTextDownloaded");
    return;
  }

  try {
    lyricsTextSaveFileHandle = lyricsTextSaveFileHandle ?? await pickLyricsTextSaveFile(fileName) ?? null;
    if (!lyricsTextSaveFileHandle) {
      setStatus("lyricsTextSaveCanceled");
      return;
    }
    await writePickedTextFile(lyricsTextSaveFileHandle, fileText, "text/plain;charset=utf-8");
    setStatus("lyricsTextSaved");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      setStatus("lyricsTextSaveCanceled");
      return;
    }
    lyricsTextSaveFileHandle = null;
    setStatus("lyricsTextSaveFailed");
  }
};

elements.projectInput.addEventListener("change", async () => {
  const file = elements.projectInput.files?.[0];
  if (!file) return;
  let loaded: LyricTimingProject;
  try {
    if (!validateSelectedFile(file, {
      maxBytes: MAX_PROJECT_JSON_BYTES,
      extensions: PROJECT_FILE_EXTENSIONS,
      acceptsType: (type) => type === "application/json" || type === "application/octet-stream",
      invalidStatus: "invalidProjectFile"
    })) return;
    const normalized = normalizeLyricTimingProjectInput(JSON.parse(await file.text()));
    if (!normalized.ok) {
      const statusKey = projectImportStatusKey(normalized.reason);
      setStatus(statusKey, {
        limit: statusKey === "tooManyPhrases"
          ? MAX_LYRIC_PHRASES
          : formatBytes(statusKey === "sourceTextTooLarge" ? MAX_LYRIC_TEXT_BYTES : MAX_PROJECT_JSON_BYTES)
      });
      return;
    }
    loaded = normalized.project;
  } catch {
    setStatus("invalidProjectFile");
    return;
  } finally {
    elements.projectInput.value = "";
  }
  const sanitized = sanitizeProjectTimingOrder(loaded);
  if (sanitized.violationCount > 0) {
    if (!window.confirm(text("projectOrderViolationConfirm"))) {
      setStatus("projectLoadCanceled");
      return;
    }
    loaded = sanitized.project;
  }
  project = loaded;
  projectSaveFileHandle = null;
  lyricsTextSaveFileHandle = null;
  selectedPhraseIndex = 0;
  focusMode = "follow";
  clearSelection();
  undoStack.length = 0;
  redoStack.length = 0;
  elements.lyricsText.value = loaded.lines.map((line) => line.rawText).join("\n");
  setStatus(sanitized.violationCount > 0 ? "projectLoadedWithTimingFixes" : "projectLoaded", { count: sanitized.violationCount });
  queueAutoSave();
});

const exportProject = (includeLyrics: boolean) => {
  if (includeLyrics && !requireLyricsRightsConfirmation()) return;
  applyMetadata();
  const result = makeLyricTimingExport(project, { includeLyrics });
  if (!result.ok) {
    showExportIssues(result.issues);
    return;
  }
  downloadJson(`${fileBaseName()}.music-effect.lyrics-timing.v2.${includeLyrics ? "with-lyrics" : "timing-only"}.json`, result.exportData);
  elements.exportMenu.open = false;
  setStatus(includeLyrics ? "exportedWithLyrics" : "exportedTimingOnly");
};

const exportWebVtt = () => {
  if (!requireLyricsRightsConfirmation()) return;
  applyMetadata();
  const result = makeWebVttExport(project);
  if (!result.ok) {
    showExportIssues(result.issues);
    return;
  }
  downloadText(`${fileBaseName()}.lyrics.vtt`, result.fileText, "text/vtt;charset=utf-8");
  elements.exportMenu.open = false;
  setStatus("exportedWebVtt");
};

const exportLrc = () => {
  if (!requireLyricsRightsConfirmation()) return;
  applyMetadata();
  const result = makeLrcExport(project);
  if (!result.ok) {
    showExportIssues(result.issues);
    return;
  }
  downloadText(`${fileBaseName()}.lyrics.lrc`, result.fileText, "text/plain;charset=utf-8");
  elements.exportMenu.open = false;
  setStatus("exportedLrc");
};

elements.exportWithLyrics.addEventListener("click", () => exportProject(true));
elements.exportTimingOnly.addEventListener("click", () => exportProject(false));
elements.exportWebVtt.addEventListener("click", exportWebVtt);
elements.exportLrc.addEventListener("click", exportLrc);
elements.projectDetails.addEventListener("click", () => elements.projectDetailsDialog.showModal());
elements.helpOpen.addEventListener("click", () => elements.helpDialog.showModal());
elements.restoreDraft.addEventListener("click", restoreAutoSaveDraft);
elements.downloadDraft.addEventListener("click", downloadAutoSaveDraft);
elements.clearLocalData.addEventListener("click", () => {
  void discardAutoSaveDraft("localDraftCleared");
});
elements.discardDraft.addEventListener("click", () => {
  void discardAutoSaveDraft();
});
elements.languageToggle.addEventListener("click", () => {
  language = language === "ja" ? "en" : "ja";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  setStatus("languageChanged");
});
elements.followPlayback.addEventListener("click", () => {
  returnToFollowMode("followModeEnabled");
});
elements.followList.addEventListener("click", () => {
  returnToFollowMode("followModeEnabled");
});
elements.playToggle.addEventListener("click", () => {
  void togglePlayback();
});
elements.stampCurrent.addEventListener("click", stampCurrentPhrase);
elements.stampNext.addEventListener("click", stampNextPhrase);
elements.undoAction.addEventListener("click", undo);
elements.redoAction.addEventListener("click", redo);
elements.selectionShiftEarlier.addEventListener("click", () => {
  applyOffsetToSelectedTiming(-TIMING_NUDGE_MS);
});
elements.selectionShiftLater.addEventListener("click", () => {
  applyOffsetToSelectedTiming(TIMING_NUDGE_MS);
});
elements.selectionEven.addEventListener("click", placeSelectedEvenly);
elements.selectionClearTiming.addEventListener("click", clearSelectionTiming);
elements.selectionClear.addEventListener("click", () => {
  clearSelection();
  returnToFollowMode("followModeEnabled");
});

elements.seekBar.addEventListener("input", () => {
  const nextMs = Number(elements.seekBar.value);
  setPlaybackPositionMs(Number.isFinite(nextMs) ? nextMs : 0);
});

elements.volumeSlider.addEventListener("input", () => {
  applyAudioVolume(Number(elements.volumeSlider.value), true);
});

const handleSeekKeyboard = (event: KeyboardEvent) => {
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      shiftPlaybackPositionMs(-seekStepFromEvent(event));
      return true;
    case "ArrowRight":
      event.preventDefault();
      shiftPlaybackPositionMs(seekStepFromEvent(event));
      return true;
    case "PageDown":
      event.preventDefault();
      shiftPlaybackPositionMs(-SEEK_LARGE_STEP_MS);
      return true;
    case "PageUp":
      event.preventDefault();
      shiftPlaybackPositionMs(SEEK_LARGE_STEP_MS);
      return true;
    case "Home":
      event.preventDefault();
      setPlaybackPositionMs(0);
      return true;
    case "End":
      event.preventDefault();
      setPlaybackPositionMs(getTimelineDurationMs());
      return true;
    default:
      return false;
  }
};

const handleSeekWheel = (event: WheelEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (delta === 0) return;
  event.preventDefault();
  shiftPlaybackPositionMs((delta > 0 ? 1 : -1) * seekStepFromEvent(event));
};

elements.seekBar.addEventListener("keydown", (event) => {
  if (handleSeekKeyboard(event)) event.stopPropagation();
});
elements.sequenceBar.addEventListener("keydown", (event) => {
  if (handleSeekKeyboard(event)) event.stopPropagation();
});
elements.seekBar.addEventListener("wheel", handleSeekWheel, { passive: false });
elements.sequenceBar.addEventListener("wheel", handleSeekWheel, { passive: false });

elements.audioPlayer.addEventListener("timeupdate", () => {
  previewTimeMs = getPlaybackMs();
  render();
});
elements.audioPlayer.addEventListener("loadedmetadata", () => render());
elements.audioPlayer.addEventListener("error", () => {
  setStatus("audioPlaybackFailed");
});
elements.audioPlayer.addEventListener("play", () => render());
elements.audioPlayer.addEventListener("pause", () => render());

elements.phraseTable.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const target = getPhraseRowFromEvent(event);
  if (!target) return;
  event.preventDefault();
  const before = sortedSelectedIndexes();
  applyListSelection(Number(target.dataset.phraseIndex), event as MouseEvent);
  recordHitDebugSelection(event, target, before);
});

elements.phraseTable.addEventListener("click", (event) => {
  if (event.detail !== 0) return;
  const target = getPhraseRowFromEvent(event);
  if (!target) return;
  event.preventDefault();
  const before = sortedSelectedIndexes();
  applyListSelection(Number(target.dataset.phraseIndex), event as MouseEvent);
  recordHitDebugSelection(event, target, before);
});

elements.sequenceBar.addEventListener("pointerdown", beginSequencePointer);
elements.sequenceBar.addEventListener("pointermove", moveSequencePointer);
elements.sequenceBar.addEventListener("pointerup", endSequencePointer);
elements.sequenceBar.addEventListener("pointercancel", endSequencePointer);

window.addEventListener("pointermove", updateHitDebugPointer);
window.addEventListener("pointerleave", () => {
  if (hitDebugHoverRow) hitDebugHoverRow.classList.remove("hit-debug-hover");
  hitDebugHoverRow = null;
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "h") {
    event.preventDefault();
    setHitDebugEnabled(!hitDebugEnabled);
    return;
  }
  if (isTextEditingTarget(event.target)) return;
  if (event.target === elements.volumeSlider) return;
  if (event.target === elements.seekBar || event.target === elements.sequenceBar) {
    if (handleSeekKeyboard(event)) return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllPhrases();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }

  switch (event.key) {
    case " ":
      event.preventDefault();
      void togglePlayback();
      break;
    case "a":
    case "A":
      event.preventDefault();
      stampCurrentPhrase();
      break;
    case "d":
    case "D":
      event.preventDefault();
      stampNextPhrase();
      break;
    case "ArrowLeft":
      event.preventDefault();
      selectPhrase(getCurrentPhraseIndex() - 1);
      break;
    case "ArrowRight":
      event.preventDefault();
      selectPhrase(getCurrentPhraseIndex() + 1);
      break;
    case "Backspace":
      event.preventDefault();
      if (selectedPhraseIndexes.size) {
        clearSelectionTiming();
      } else {
        clearCurrentTiming();
      }
      break;
    default:
      break;
  }
});

window.addEventListener("beforeunload", (event) => {
  if (autoSaveStatus !== "pending" && autoSaveStatus !== "saving") return;
  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("pagehide", () => {
  if (autoSaveStatus === "pending") void flushAutoSaveDraft();
});

setHitDebugEnabled(hitDebugEnabled);
applyAudioVolume(readStoredVolumePercent());
render();
void initializeAutoSave();
