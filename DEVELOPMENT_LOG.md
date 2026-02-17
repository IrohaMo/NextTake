###使用したAI Tool
ChatGPT: 要件定義や使用技術選択の際に壁打ち相手として使用。
codex: ChatGPTに書かせたMVP要件をもとに実装を指示。

###工夫した点・悩んだ点
gemini APIに投げるプロンプトによっては、”記事の方法で〜をやってみる”みたいなToDoが出力されたので、具体的な指示を出すようプロンプトを調整。
geminiの無料枠がかなり少ない（20requests / day）のでモデルを切り替えながらテストした。

###何を作ったか
記事の要約などはすでにサービスが存在するが、具体的なToDoを出力することで行動に繋げられるようなアプリ。
ChromeやSafariの拡張機能として、リンクの共有欄に出てくるようにすると使いやすいかも？

###開発Log
### 2026-02-16

- `TECH_SPEC.md` にMVP要件を記載。
- 実装可能な粒度にタスク分解し、`IMPLEMENTATION_TASKS.md` を作成。
- AI基盤を Gemini 前提へ変更（キー名・タスク名・依存表記を更新）。
- `chore/init-nuxt` を実施し、Nuxt 3 の初期ファイル群を作成。
- `POST /api/summarize` を実装（入力検証、Gemini呼び出し、JSONスキーマ検証、429/500エラーハンドリング）。
- 最小UIを実装（URL入力、`/api/summarize` 呼び出し、要約結果とRaw JSON表示）。
- API/フロントにログを追加し、待機中UIが確実に表示されるようフォーム送信処理を修正。
- 使用モデルを `gemini-2.5-flash` に変更。
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
- 画面全体のUIを再調整し、セクションを整理した読みやすいレイアウトへ更新。
