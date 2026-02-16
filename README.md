# NextTake

URLまたはテキスト入力から、要点・So what・次アクションをJSONで返すMVP（Nuxt 3想定）。

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
