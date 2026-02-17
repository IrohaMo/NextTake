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
- 使用モデル: `gemini-2.5-flash`（`/Users/shu/Developer/NextTake/nuxt.config.ts` の `runtimeConfig.geminiModel` に固定）
- 出力: 固定JSONスキーマ（`key_points`, `so_what`, `next_actions`, `open_questions`）

