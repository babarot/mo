# `/~/` HOME 相対 URL スキーム 実装計画

## 目的

現在の `?file={sha8}` ID ベースのディープリンクを残したまま、人間可読な URL として `/~/<home-relative path>` を追加する。`$HOME` 配下の登録済みファイルにブラウザの URL バー・ブックマーク・チャット共有から到達できるようにする。

## 決定事項とスコープ

過去の対話で `/-/` (ルート絶対) と `/~/` (HOME 相対) の両方が検討されていたが、レビューの結果以下の範囲に縮小する。

### 採用

- `/~/<path>` のみ。`/~/src/foo.md` は `$HOME/src/foo.md` を指す。
- 予約プレフィックスは `/_/` (API) と `/~/` (HOME 相対) の 2 つに限定。

### 不採用・スコープ外

- `/-/` (ルート絶対) は入れない。`$HOME` 外のファイルはこれまで通り ID 経由のみ。
- `/~/` 経由での「未登録ファイルの自動オープン」は不可。URL で到達できるのは登録済みファイルのみ。
- uploaded / stdin ファイルは対象外 (ディスクパスがないため)。これらは従来どおり `?file={id}`。
- 送信側リンク (`buildFileUrl`) は当面変更しない。`/~/` は入口専用の URL 形式とし、解決後は ID ベースに `replaceState` する。将来的にユーザー設定でリンク形式を `/~/` に切替える拡張は別タスク。

## セキュリティ境界

1. リクエストされたパスは `$HOME` 配下で閉じていることを必須とする。`filepath.Rel(home, abs)` の結果が `..` から始まる場合は 404 を返す。
2. `--dangerously-allow-remote-access` が有効な場合、`/~/` による解決 API は 404 を返す。リモートから任意の HOME 配下ファイルを参照できてしまうのを防ぐため。
3. URL で指定されたパスをサーバー側で勝手に登録 (mutate) しない。既存 State の検索のみ。これにより現状のセキュリティモデル (「CLI で登録されたものだけ読める」) を保つ。
4. 展開は `~` プレフィックスのみ。`~user` 形式は扱わない。

### セキュリティ要件の実装経路 (伝搬方法)

現在 `dangerouslyAllowRemoteAccess` フラグは `cmd/root.go` のローカル変数で、`server.NewHandler(state)` には渡っていない。このままでは resolve API が remote access 有効時に無効化される経路がないため、以下の変更で伝搬する。

- `internal/server/server.go` に `HandlerConfig` (もしくは `ServerConfig`) 構造体を新設:
  ```go
  type HandlerConfig struct {
      AllowRemoteAccess bool
      HomeDir           string // os.UserHomeDir() を cmd 側で解決して渡す
  }
  ```
- `NewHandler` のシグネチャを `NewHandler(state *State, cfg HandlerConfig) http.Handler` に変更。
- `cmd/root.go:1361` の `server.NewHandler(state)` を `server.NewHandler(state, server.HandlerConfig{AllowRemoteAccess: dangerouslyAllowRemoteAccess, HomeDir: homeDir})` に書き換える。
- 既存の全テスト (`internal/server/server_test.go` の ~30 箇所の `NewHandler(s)` 呼び出し) は `NewHandler(s, HandlerConfig{})` にまとめて書き換える。ゼロ値 (`AllowRemoteAccess: false`, `HomeDir: ""`) が安全側になるよう、resolve ハンドラ側で `HomeDir == ""` のとき無効扱い (404) にする。
- resolve ハンドラはクロージャ内で `cfg` を参照する形で配線する (`handleResolveHomeFile(state, cfg)`)。

この変更は機械的な差し替えで、既存の動作には影響しない。セキュリティ要件の実装漏れをコンパイル時に検出可能にするのが狙い。

## グループ名の後方互換 (予約不要)

当初案ではグループ名の先頭 `~` を予約禁止にする方針だったが、以下の理由で不要と判断する。

- `/~/` (スラッシュ 2 つ挟む) と `/~foo` (スラッシュ 1 つ) は URL 上でも区別可能。
- フロントエンドの初期化で `parseHomePathFromPath` を `parseGroupFromPath` より先に評価するため、`/~/foo` がグループ名 `~/foo` と誤解釈されることはない。
- サーバー側のグループ名バリデーション (`validateGroupName`) は URL ルーティングと独立しており、`~foo` というグループ名を許容していても `/~/foo` 解決 API と衝突しない。
- 既存の backup/restore に `~` 先頭のグループが入っている可能性への配慮が不要になる (データ移行・警告ロジック不要)。

よって `validateGroupName` は変更しない。`~` 先頭を禁止する変更は加えない。

## 設計

### 新規 API エンドポイント

```
GET /_/api/files/resolve?path=<home-path>
```

レスポンス:

```json
{ "group": "design", "id": "a1b2c3d4" }
```

失敗時は `404 Not Found` + テキストエラー。

入力仕様:
- `path=~/src/foo.md` → `$HOME/src/foo.md` に展開。
- `path=%2F...` (絶対パス) は受け付けない。必ず `~/` 始まりかスラッシュなしの相対形式に限定 (曖昧さ回避のため)。
- クエリ文字列は URL エンコード済みとして扱い、`url.QueryUnescape` でデコード。

処理:
1. `~/` を `$HOME/` に置換 (シンプルな prefix 置換)。
2. `filepath.Clean` で正規化。
3. `filepath.Rel(home, cleaned)` で HOME 配下チェック。逸脱したら 404。
4. `dangerouslyAllowRemoteAccess == true` なら 404。
5. State 内を走査し、パス一致する登録済みエントリを探す (`Uploaded == false` のみ対象)。
6. 複数グループに同一パスがある場合は決定的に選ぶ。`State.groups` が `map[string]*Group` で iteration order が非決定的なため、そのまま「最初の一致」を返すと起動ごとに違うグループに解決されて共有 URL が不安定になる。以下の優先順位で固定する。
   1. `default` グループに登録されていればそれを返す。
   2. それ以外はグループ名のアルファベット昇順で最初に一致したものを返す。
   これをテストで明示的に固定する (Go の map 走査をソート済みキー配列経由に置き換え)。

### ルーティング

`cmd` 側・サーバー側のパスマッチャには触らない。`/~/` は SPA フォールバックに落ち、フロントエンドで解釈する。サーバーが介在するのは `/_/api/files/resolve` のみ。

理由: `net/http` の `ServeMux` で `/~/` を別ハンドラにしてもレスポンスとして `index.html` を返すことになり差分がない。SPA ルーティングと同一ルートを通すのが最も単純。

### フロントエンドの変更

#### `internal/frontend/src/utils/groups.ts`

```ts
export function parseHomePathFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/~/")) return null;
  const rest = pathname.slice(3);
  if (rest === "") return null;
  return rest;
}
```

`parseGroupFromPath` は変更しない (引き続き先頭スラッシュを剥いでグループ名扱い)。`/~/foo` を `parseGroupFromPath` に渡すと `~/foo` というグループ名に化けるため、`App.tsx` で `parseHomePathFromPath` を先に判定する。

#### `internal/frontend/src/hooks/useApi.ts`

```ts
export async function resolveHomeFile(
  relPath: string,
): Promise<{ group: string; id: string } | null>;
```

`404` は `null` 正常系として扱う (ユーザー通知はフロントで制御)。

#### `internal/frontend/src/App.tsx`

`useState` 初期化と初回 `useEffect` に以下を追加する。

1. 初回マウント時、`parseHomePathFromPath(window.location.pathname)` をチェック。
2. パスが取れた場合、`resolveHomeFile` を呼び出し `{group, id}` を取得。
3. 成功したら `setActiveGroup(group)` / `setInitialFileId(id)` して、`history.replaceState(null, "", \`${groupToPath(group)}?file=${id}\`)` で URL を ID ベースに正規化。
4. 失敗したらトースト or シンプルなエラーバナーで「見つからなかった」旨を出し、`replaceState(null, "", "/")` で default に戻す。
5. 既存の「URL の `?file=` を読み取って `initialFileId` にセット」ロジックとの優先順位: `/~/` が先、解決できなければ `?file=` ロジックへ。両方を持つ URL (`/~/foo?file=xxx`) は想定しない (`/~/` があれば `?file=` は無視)。

`parseGroupFromPath` の既存テストは影響を受けない (`/~/foo` を渡すテストケースは追加しない方針)。

### 既存エラーバナー / トースト機構の確認

`App.tsx` 周辺には既にトースト的な UI があるか確認する必要がある。ない場合は軽量な `Toast` コンポーネントを新設せず、`console.warn` + タイトル表記 (例: `"Not found: <path> | mo"`) で済ます。UI 追加は別タスク。

## テスト計画

### Go

- `internal/server/server_test.go` に `TestHandleResolveHomePath` を追加:
  - 通常ケース: 登録済み `$HOME/foo.md` → 200 & `{group,id}`。
  - 未登録: 404。
  - `..` traversal: `~/../../etc/passwd` のような入力 → 404。
  - HOME 外の絶対パス指定 → 400 / 404 (仕様次第)。
  - `--dangerously-allow-remote-access` 相当の State → 404。
  - uploaded ファイルに一致する場合 → 404 (skip)。
- `internal/server/group_test.go` に `~` 先頭のグループ名を invalid ケースとして追加。

### フロント

- `internal/frontend/src/utils/groups.test.ts` に `parseHomePathFromPath` のテスト (`/`, `/~/`, `/~/foo`, `/~/a/b`, `/group` の各ケース)。
- `App.tsx` のテストは既存が薄い場合省略。手動確認で代替。

### 手動確認

- `make dev ARGS="testdata/basic.md"` で `/~/src/github.com/babarot/mo/testdata/basic.md` にアクセス → 開く。
- 存在しない `/~/nothing.md` → エラー表示 & default に戻る。
- `/~/../../../etc/passwd` → 404。
- `--dangerously-allow-remote-access` 付きで同じ URL → 404。

## 実装順序

1. Go: `HandlerConfig` 構造体新設 + `NewHandler` シグネチャ変更 + 全テストの `NewHandler(s)` を `NewHandler(s, HandlerConfig{})` に一括置換。機能変更なし、コンパイル通過を確認。
2. Go: `cmd/root.go` で `dangerouslyAllowRemoteAccess` と `os.UserHomeDir()` を `HandlerConfig` 経由で渡す。
3. Go: `GET /_/api/files/resolve` ハンドラ実装 + テスト (決定性順序 / HOME 境界 / remote access disable / uploaded skip を網羅)。
4. フロント: `parseHomePathFromPath` util + テスト。
5. フロント: `useApi.resolveHomeFile` 追加。
6. フロント: `App.tsx` 初期化ロジックに組み込み。
7. 手動動作確認。

## リスクと未決事項

- 将来 `/~/` を canonical URL にする拡張 (`buildFileUrl` を `/~/<path>` 形式に切替) を入れる場合、`App.tsx` の URL 同期ロジックと `useScrollRestoration` の `ctx.url` 比較を更新する必要がある。v1 では ID ベース URL を canonical のまま据え置く。
- `$HOME` の取得は `os.UserHomeDir()` に統一。環境変数 `HOME` の変更は起動中に反映しない (プロセス寿命内は固定)。シンボリックリンクで `$HOME` 自体が多重化しているケースは考慮しない (`filepath.Rel` の字句比較)。
