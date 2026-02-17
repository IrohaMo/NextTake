# NextTake

URLまたはテキスト入力から、要点・So what・次アクションをJSONで返すMVP（Nuxt 3想定）。

## アプリ概要

NextTake は、記事URLまたはYouTube URLを入力すると内容を要約し、以下を日本語で返すWebアプリです。

- `key_points`（要点）
- `so_what`（なぜ重要か）
- `next_actions`（次に取る行動）
- `open_questions`（未解決の論点）

## 使い方

1. アプリを起動する
2. URL入力欄に記事またはYouTubeのURLを入力する
3. 「要約する」を押す
4. 結果（Summary / So what / Next Take / Open Questions）を確認する

## 使用技術

- Nuxt 3
- TypeScript
- Gemini API（`@google/genai`）
- Nitro Server API（`POST /api/summarize`）

## 公開URL

https://next-take.vercel.app

## 仕様ドキュメント

- `/Users/shu/Developer/NextTake/TECH_SPEC.md`
- `/Users/shu/Developer/NextTake/IMPLEMENTATION_TASKS.md`

## 実装方針

- フレームワーク: Nuxt 3 + TypeScript
- API: `POST /api/summarize`
- モデル基盤: Gemini API（`GEMINI_API_KEY`）
- 使用モデル: `gemini-2.5-flash-lite`（`/Users/shu/Developer/NextTake/nuxt.config.ts` の `runtimeConfig.geminiModel` に固定）
- 出力: 固定JSONスキーマ（`key_points`, `so_what`, `next_actions`, `open_questions`）

## 実装Log

### 2026-02-16

- `TECH_SPEC.md` にMVP要件を記載。
- 実装可能な粒度にタスク分解し、`IMPLEMENTATION_TASKS.md` を作成。
- AI基盤を Gemini 前提へ変更（キー名・タスク名・依存表記を更新）。
- `chore/init-nuxt` を実施し、Nuxt 3 の初期ファイル群を作成。
- `POST /api/summarize` を実装（入力検証、Gemini呼び出し、JSONスキーマ検証、429/500エラーハンドリング）。
- `.env.example` を使わない運用に合わせ、モデル定義を `nuxt.config.ts` に固定。
- 最小UIを実装（URL入力、`/api/summarize` 呼び出し、要約結果とRaw JSON表示）。
- API/フロントにログを追加し、待機中UIが確実に表示されるようフォーム送信処理を修正。
- 使用モデルを `gemini-2.5-flash-lite` に戻した。
- 要約精度改善として、URL先のHTML本文抽出を追加（本文手動入力UIは廃止）。
- YouTube URLの場合は字幕取得を試行し、取得した字幕テキストを要約入力に使用するように拡張。
- YouTube字幕を取得できない場合はフォールバックせず、明示エラー（422）を返す挙動に変更。
- APIレスポンスに `source_info` を追加し、YouTubeでは `transcript_type`（`auto`/`manual`/`none`）を明示。
- （後で廃止）字幕取得単体の検証用に `GET /api/youtube-transcript?url=...` を追加。
- YouTube字幕取得を自前パースから `youtube-transcript-api` 利用へ切り替え（共通ユーティリティ化）。
- （後で廃止）UIに「字幕取得テスト」ボタンを追加し、字幕取得結果プレビューを表示可能にした。
- UI/APIの処理ステップごとに逐次 `console` ログを出力するよう強化。
- `youtube-transcript-api` 呼び出しの候補メソッド別に詳細ログ（失敗理由含む）を追加。
- `youtube-transcript-api` の実装仕様に合わせ、`TranscriptClient` + `client.getTranscript(videoId)` 呼び出しへ修正。
- `client not fully initialized!` 対策として、初期化待機の吸収と `getTranscript` リトライを追加。
- `youtube-transcript-api` が失敗した場合に watchページ解析へ自動フォールバックする処理を追加。
- watchページフォールバック時に複数トラック・複数字幕フォーマットを順次試すよう強化。
- 字幕URLが相対パスの場合に `https://www.youtube.com` へ正規化して取得するよう修正。
- フォールバック取得で `CONSENT` Cookie と追加ヘッダを付与し、同意ページ返却の回避を試行。
- `api/timedtext` の署名/IP系パラメータを除去したクリーンURLでも再試行するよう改善。
- Python連携は廃止し、Node-only（watchページ経由）で字幕取得する構成に戻した。
- `POST /api/summarize` は YouTube URL時に Gemini Video Understanding（`fileData.fileUri`）を使う方式へ切り替え。
- 不要になった字幕テストUIと `GET /api/youtube-transcript` エンドポイントを削除。
- 要約プロンプトを強化版へ更新し、`next_actions` から所要時間（`eta_min`）を削除して `string[]` 化。
- ログを本番向けに整理し、`info/warn` は開発時のみ、`error` は本番でも残す運用へ変更。
- 入力UXを強化し、URL妥当性メッセージ・YouTube/記事判定表示・再試行ボタンを追加。
- UIを分割し、`app.vue` から入力パネル/結果パネルを `components/` へ分離。
- UIのエラー文言を `error.code` ベースで統一表示するように変更。
- Geminiモックモードを無効化し、`/api/summarize` は実際のGemini API呼び出しに戻した。
