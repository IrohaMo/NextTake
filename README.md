# NextTake

URLまたはテキスト入力から、要点・So what・次アクションをJSONで返すMVP（Nuxt 3想定）。

## 仕様ドキュメント

- `NextTake/TECH_SPEC.md`
- `NextTake/IMPLEMENTATION_TASKS.md`

## 実装方針

- フレームワーク: Nuxt 3 + TypeScript
- API: `POST /api/summarize`
- 出力: 固定JSONスキーマ（`key_points`, `so_what`, `next_actions`, `open_questions`）

## 実装Log

### 2026-02-16

- `TECH_SPEC.md` にMVP要件を記載。
- 実装可能な粒度にタスク分解し、`IMPLEMENTATION_TASKS.md` を作成。
