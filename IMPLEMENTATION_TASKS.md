# NextTake MVP 実装タスク

`/Users/shu/Developer/NextTake/TECH_SPEC.md` を元に、MVPを実装可能なタスクへ分解。

## 0. 前提と未確定事項

- `TECH_SPEC.md` が途中で終了しているため、以下はMVP成立に必要な最小前提で策定。
- 未確定事項:
  - 利用モデル（OpenAI APIのどのモデルを使うか）
  - ログイン要否（MVPでは不要前提）
  - 永続化要否（MVPでは履歴保存なし前提）
  - 多言語対応（MVPでは日本語出力優先）
- 出力JSONは下記を契約仕様（APIレスポンス）として固定:
  - `key_points: string[]`
  - `so_what: string`
  - `next_actions: { text: string; eta_min: number }[]`
  - `open_questions: string[]`

## 1. システム構成タスク

1. プロジェクト初期化
- Nuxt 3 + TypeScript で新規作成
- Lint/Format（ESLint + Prettier）設定
- `.env.example` に `OPENAI_API_KEY` 追加

2. ディレクトリ設計
- `pages/` 画面
- `server/api/` APIルート
- `lib/` ドメインロジック
- `lib/parsers/` URL種別判定・抽出ロジック
- `lib/ai/` プロンプト構築・モデル呼び出し
- `lib/schema/` Zodスキーマ

3. 依存導入
- `zod`（入出力バリデーション）
- `openai`（APIクライアント）
- 必要に応じて `youtube-transcript` 系パッケージ（失敗時フォールバック前提）

## 2. 機能実装タスク（Backend）

1. 入力バリデーション
- APIエンドポイント: `POST /api/summarize`
- リクエスト:
  - `url?: string`
  - `pasted_text?: string`
- ルール:
  - `url` または `pasted_text` のどちらか必須
  - `pasted_text` は最大 12,000 文字に切り詰め（先頭優先）
  - URL形式チェック（http/https）

2. URL判定とコンテンツ抽出
- YouTube URL判定（`youtu.be`, `youtube.com/watch`, `youtube.com/shorts`）
- 記事URL判定（YouTube以外のhttp/https）
- 抽出方針:
  - `pasted_text` がある場合は最優先で使用
  - YouTube: 字幕取得を試行（失敗時はエラー理由を返す）
  - 記事: 本文抽出（最小実装はURLメタ + ユーザー貼り付けテキスト優先）

3. AI要約パイプライン
- システムプロンプト作成:
  - JSON以外を出力しない
  - `next_actions` は着手しやすい順
  - `eta_min` は整数（5, 15, 30目安）
- モデル呼び出し
- JSONパース + Zod検証
- 検証失敗時のリトライ（1回）

4. APIレスポンス設計
- 成功: 200 + 仕様JSON
- 入力エラー: 400
- 抽出不可/生成失敗: 422 or 500
- エラー形式を統一:
  - `{ "error": { "code": "...", "message": "..." } }`

## 3. 機能実装タスク（Frontend）

1. 入力フォーム
- URL入力欄
- 任意テキスト入力欄（文字数カウンタ付き）
- 送信ボタン + ローディング表示

2. 出力表示
- JSONビュー（整形表示 + コピーボタン）
- セクション表示:
  - 重要な要点
  - So what
  - Next Actions（ETA付き）
  - Open Questions

3. エラーUI
- バリデーションエラー表示
- API失敗時の再試行導線

## 4. 品質タスク（最低限）

1. 単体テスト
- 入力バリデーション
- 12,000文字トリム
- JSONスキーマ検証

2. 結合テスト
- `POST /api/summarize` 正常系
- 異常系（URL不正、入力なし、AI応答不正）

3. 手動確認シナリオ
- 記事URL + テキストなし
- YouTube URL + テキストなし
- テキストのみ
- URL + テキスト併用

## 5. 開発順序（推奨）

1. API契約（Zod）を先に固定
2. `POST /api/summarize` のモック実装（固定JSON返却）
3. フロント接続（送信→表示）
4. AI呼び出し実装
5. URL抽出（YouTube/記事）実装
6. テスト追加
7. README整備

## 6. 受け入れ条件（MVP）

- ユーザーは URL またはテキストを入力して送信できる
- 返却は常に仕様のJSON形を満たす
- `next_actions` が ETA付きで最低3件出る
- エラー時に原因がUI上で分かる
- ローカルで再現可能な手順が `README.md` にある

## 7. 直近の着手チケット（この順で実装）

1. `chore/init-nuxt`  
Nuxt 3 + TypeScript 初期化、Lint、環境変数テンプレ作成

2. `feat/api-contract`  
Zodスキーマと `POST /api/summarize` のモックレスポンス実装

3. `feat/input-ui`  
URL/テキスト入力フォーム、文字数カウンタ、ローディング実装

4. `feat/result-ui`  
JSON整形表示、セクション表示、エラーハンドリング実装

5. `feat/openai-pipeline`  
OpenAI呼び出し、JSON強制、パース/検証/リトライ実装

6. `feat/source-extraction`  
YouTube判定・字幕取得、記事URL判定と本文取得フォールバック実装

7. `test/mvp-core`  
バリデーション・API正常/異常系テスト追加
