# Vim Editor を通常エディタに差し替える 実装計画

## 目的

現状 `VimEditor.tsx` (CodeMirror 6 + `@vimee/plugin-codemirror`) で実装している Vim モードを廃止し、CodeMirror 6 の素のエディタに置き換える。常用に耐える普通のテキスト編集体験を提供する。

## 残すもの / 捨てるもの

### 残す

- CodeMirror 6 (`@codemirror/*`, `codemirror`)
- markdown 言語拡張 + シンタックスハイライト
- テーマ (`lib/editorThemes.ts`) と light/dark 同期 (MutationObserver)
- 行折り返しトグル
- 保存 API (`saveFileContent` → `PUT /_/api/groups/{group}/files/{id}/content`)
- autoSave (1 秒デバウンス) — 設定として継続
- ビュー ↔ 編集間のカーソル行同期 (`VimEditorHandle.getCursorLine`)
- `onQuit(cursorLine)` のコールバックシグネチャ (`MarkdownViewer.tsx:990` 周辺の呼び出し側を無改修にするため)
- EditToggle ボタン (アイコンと位置は据え置き、tooltip 文言だけ変更)
- フルスクリーン編集レイアウト

### 捨てる

- `@vimee/core`, `@vimee/plugin-codemirror` 依存
- `patches/@vimee__plugin-codemirror.patch`
- Vim モード state (`mode`, `commandLine`, `statusMessage`, `statusError`)
- ブロックカーソル拡張 (`blockCursorStyle`, `blockCursorWidthPlugin`, `blockCursorExtensions`)
- ステータスバー (モード表示 / コマンドライン / カーソル位置 / Top/Bot/% 表示)
- `vim.attach(...)` まわりのフック (`onSave`, `onChange`, `onModeChange`, `onAction`)
- `:w` / `:q` 由来の特別処理
- `vim-visual` クラス切替と関連 CSS
- 設定 `editorBlockCursor`

### 互換のため温存

- `settings.editorBlockCursor` のキー自体は読み書きしないが、localStorage に残っても無害なので migration 不要
- `VimEditorHandle` 型名は `EditorHandle` にリネーム (export 名変更で型エラーは即座に検出できる)

## キーバインド設計

CodeMirror 6 の標準キーマップ (`basicSetup` に含まれる `defaultKeymap` / `historyKeymap` / `searchKeymap` 等) をそのまま使い、追加で以下を `Prec.high` で上書き:

| キー | 動作 |
|---|---|
| `Mod-s` (Cmd/Ctrl+S) | 即座に保存 |

`Escape` を quit に割り当てない。Vim の `:q` と違って `Escape` は普通のテキスト編集中にも頻繁に押されるキーで、誤爆して未保存編集を捨てる事故が起きる。離脱は EditToggle ボタンに集約する。検索パネル等のデフォルト `Escape` 動作も温存できる。

## 未保存編集の保護

すべての離脱経路で「flushSave → 退出」をワンセットにする。失敗しても退出は続行 (UX を止めない)。

離脱経路は 2 通りある:

- (a) ユーザーが EditToggle を押下 — 同じファイルのまま edit → view へ
- (b) サイドバー等で別ファイルへ遷移 — `fileId` prop が変わって編集中の状態が捨てられる (`MarkdownViewer.tsx:699` 周辺の render-phase コード)

両方を塞ぐ:

- `EditorHandle` に以下を追加:
  - `flushSave(): Promise<void>` — 現在の `activeGroup` / `fileId` props に対して即時保存。autoSave のタイマーがあればキャンセル。
  - `flushSaveTo(group: string, id: string): Promise<void>` — 任意の宛先に保存。エディタの内容を同期的にスナップショットしてから fetch を発行するので、呼び出し直後にコンポーネントが unmount されても安全。
- (a) `MarkdownViewer.handleToggleEdit` で edit → view 遷移時に `await editorRef.current?.flushSave()` してから `setIsEditView(false)`。
- (b) `MarkdownViewer` に 2 つの useEffect を宣言順で並べる。React は同一 commit 内で useEffect を宣言順に発火させる ので、ref を読む側 → 更新する側 の順にすれば「新値で潰される前に旧値を読める」。
  - `editTargetRef = useRef<{ group: string; fileId: string } | null>(null)` を用意。
  - 1 つ目の useEffect (deps `[fileId]`): `editTargetRef.current` を読む。`target && target.fileId !== fileId` なら `editorRef.current?.flushSaveTo(target.group, target.fileId)` を呼んで `setIsEditView(false)` する。
  - 2 つ目の useEffect (deps `[isEditView, activeGroup, fileId]`): `editTargetRef.current = isEditView ? { group: activeGroup, fileId } : null` で ref を更新する。
  - 1 つ目が先に走るので新 fileId でも ref はまだ旧値を保持しており、判定材料が消えない。2 つ目はその直後に新値へ更新する。`useLayoutEffect` は使わない (順序の根拠は宣言順なので useEffect 同士で揃える)。
  - 既存の render-phase `if (fileId !== prevFetchKey.fileId)` ブロックからは `setIsEditView(false)` を撤去し、`setPrevFetchKey` と `setLoading(true)` だけを残す (render-phase setState は React の許容パターン、副作用は不可)。
  - `flushSaveTo` を render-phase で呼ばないことで、StrictMode による render 二重実行や aborted render での誤発火を回避する。
  - useEffect 内で `editorRef.current` 経由で同期的にエディタ内容をスナップショットしてから fetch を投げるため、その後の `setIsEditView(false)` で editor が unmount しても保存は完走する。
- 保存失敗時は `console.warn` 程度に留め、UI には出さない (現行 autoSave 失敗時と同じ静音動作と揃える。要望が出たらトースト追加は別タスク)。
- `onQuit(cursorLine)` 経路は今のところ Vim の `:q` 専用だったが Vim を捨てるので呼ばれない。シグネチャは将来エディタ内ショートカットを追加した時のために残す。新たに `onQuit` を発火する箇所が増える際は同様に flushSave を先行する責務を呼び出し側に持たせる。

## 状態管理

`VimEditor.tsx` を `Editor.tsx` にリネーム (or 同名のまま中身を全置換) し、Vim 関連 state を全て削除。残るのは:

- `viewRef: EditorView | null`
- `saving: boolean` (保存中インジケータ用、UI からは現状参照箇所なし → 削除可、autoSave のレート制御だけ `savingRef` で残す)
- `themeRef`, `wrapRef` (Compartment 経由の動的切替用)

ステータスバーは消すが、完全に何も出さないと寂しいので 行:列 だけ表示する超薄いフッターを残す案も検討。当初は無しで進め、欲しくなったら別タスク。

## ファイル別の変更

### `internal/frontend/src/components/VimEditor.tsx` → `Editor.tsx`

- ファイル名変更
- export 名 `VimEditor` → `Editor`、`VimEditorHandle` → `EditorHandle`
- 上記「捨てる」の削除と「キーバインド設計」の実装
- 大幅縮小 (328 行 → 150 行前後を目標)

### `internal/frontend/src/components/MarkdownViewer.tsx`

- import を `Editor` / `EditorHandle` に変更
- `vimEditorRef` → `editorRef`
- `MarkdownViewerProps` から `editorBlockCursor` を削除
- `editTargetRef = useRef<{ group: string; fileId: string } | null>(null)` を追加
- 1 つ目の `useEffect(() => { /* ref を読んで flushSaveTo + setIsEditView(false) */ }, [fileId])` を追加
- 2 つ目の `useEffect(() => { editTargetRef.current = isEditView ? { group: activeGroup, fileId } : null; }, [isEditView, activeGroup, fileId])` を追加。これらは宣言順で並べる
- 既存 render-phase 分岐 `if (fileId !== prevFetchKey.fileId)` から `if (isEditView) setIsEditView(false)` 行を撤去 (上記 useEffect で扱う)
- `handleToggleEdit` で edit → view 遷移時に `await editorRef.current?.flushSave()` を先行
- EditToggle の tooltip `"Edit with Vim"` → `"Edit"` (EditToggle.tsx 側の文言)
- ステータスバーが消えることに伴うレイアウト微調整は不要 (フッターは Editor 内に閉じている)

### `internal/frontend/src/App.tsx`

- `MarkdownViewer` に渡している `editorBlockCursor={settings.editorBlockCursor}` を削除 (このまま残すと TypeScript エラー)。

### `internal/frontend/src/components/EditToggle.tsx`

- `title` の `"Edit with Vim"` → `"Edit"`
- アイコンは据え置き

### `internal/frontend/src/components/SettingsDialog.tsx`

- `editorBlockCursor` トグル UI を削除
- セクション見出しが `Vim` 寄りなら `Editor` に変更

### `internal/frontend/src/lib/settings.ts`

- 型と defaults から `editorBlockCursor` 削除
- 既存 localStorage の余分なキーは `loadSettings` の余剰プロパティとして無視されるため移行コード不要 (要確認 — `loadSettings` の実装を見て安全か検証する。spread 系で全部読む実装なら値だけ放置される)

### `internal/frontend/package.json`

- 依存削除: `@vimee/core`, `@vimee/plugin-codemirror`
- `pnpm.patchedDependencies` から `@vimee/plugin-codemirror` 行削除
- `patches/@vimee__plugin-codemirror.patch` ファイル削除
- `pnpm-lock.yaml` 再生成 (`pnpm install`)

### テスト

- `VimEditor.tsx` のカバレッジは 2.63% でほぼテストなし。差し替え後、薄い動作確認テストを追加:
  - `Mod-s` を押すと `saveFileContent` が呼ばれる
  - autoSave 設定 ON 時、変更後 1 秒で `saveFileContent` が呼ばれる
  - `flushSaveTo(group, id)` が指定された宛先に保存する
- vitest で `EditorView` を実 DOM にマウントすると重いので、`saveFileContent` のモックと keydown 発火だけで担保する形にする

## 動作確認 (手動)

1. ファイルを開いて編集ボタン押下 → Editor がフルスクリーンで開く
2. 文字入力 → 普通に編集できる (`Escape` を押してもビューには戻らない)
3. Cmd+S → 保存される (network タブで確認)
4. EditToggle 押下 → flushSave 後にビューに戻り、カーソル行が反映されたスクロール位置に着地
5. autoSave 設定を ON → 文字入力 1 秒後に保存
6. ライト/ダーク切替 → エディタテーマも追従
7. 折り返しトグル → エディタの折り返し挙動が変わる
8. 編集中にサイドバーで別ファイルへ切替 → 旧ファイル宛に save が飛んでから新ファイルが開く (network タブで PUT が旧 fileId に出ていることを確認)
9. autoSave OFF + Cmd+S 未押下で EditToggle を押下 → flushSave が走り、変更が消えない

## 実装順序

1. `Editor.tsx` 新規作成 (or `VimEditor.tsx` リネーム後、中身全置換)
2. `MarkdownViewer.tsx` を新 import に切替、`vimEditorRef` をリネーム
3. `EditToggle.tsx`, `SettingsDialog.tsx` の文言とトグル整理
4. `settings.ts` の型と defaults 更新
5. `package.json` から vimee 削除、`patches/` のパッチ削除、`pnpm install` で lockfile 更新
6. 旧 fix が不要になったか re-check (`cd2b792` IME composition、`bf65a08` visual モード CSS) → 不要なら CSS / コードを掃除
7. lint / fmt / test
8. 手動確認 → コミット

## リスク / 未決事項

- `loadSettings` が未知キーをどう扱うか確認必須。spread だと残るが、明示プロパティ列挙だと無視される。前者ならノーアクション、後者なら 1 度だけ古いキーを削除するクリーンアップを `loadSettings` に入れる。
- `mo-vim-editor` のクラス名と関連 CSS (`vim-visual` セレクタ等) が `app.css` にあれば削除する。
- vimee の patch を消す前に、patch 内容を最後に確認して、こちらが必要としていた挙動 (例: `getCommandLine` 公開) が消えても問題ないことを念押しする。
- `flushSave` 中にユーザーが連打して別ファイルを開く等した場合のレース。現状 autoSave も同様の弱点があるので深追いしない。`saving` フラグで二重起動を防ぐ程度で OK。
