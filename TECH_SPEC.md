# NextTake / CatchUp AI — 仕様書

## 📌 1. プロジェクト概要

### プロダクト名
NextTake（仮称）

### 目的
忙しいユーザーが **URLを入力するだけで**  
Web記事やYouTube動画から  
- 重要な要点  
- なぜ重要か（So what）  
- 次に取るべき具体的ToDo（着手しやすさ順）

まで一気通貫で得られるWebアプリを作る。  
仕様はAIにコーディングさせるためにMarkdown化。  [oai_citation:0‡The GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-using-markdown-as-a-programming-language-when-building-with-ai/?utm_source=chatgpt.com)

---

## 📌 2. 用語

| 用語 | 意味 |
|------|------|
| URL | 記事 or YouTube video link |
| ToDo | 次に取るべき具体的行動 |
| So what | 重要性の理由 |
| JSON | 機械可読フォーマット |

---

## 📌 3. MVP要件

### 3.1 入力
- URL（記事 or YouTube）  
- 任意でテキスト貼り付け（字幕 or 本文）  
- 最大テキスト入力長: **12,000文字前後**（長い場合は先頭を優先）  [oai_citation:1‡株式会社Enlyt(エンライト) - ポジティブ・デベロップメント・スタジオ](https://enlyt.co.jp/blog/markdown/?utm_source=chatgpt.com)

---

## 📌 3.2 出力
出力は必ず **JSON形式固定**:

```jsonc
{
  "key_points": ["..."],
  "so_what": "...",
  "next_actions": [
    { "text": "...", "eta_min": 5 },
    { "text": "...", "eta_min": 15 },
    { "text": "...", "eta_min": 30 }
  ],
  "open_questions": ["..."]
}
