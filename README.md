# 二等無人航空機操縦者 確認テスト

二等無人航空機操縦者の学科試験対策として、教則の章単位で受講者の習熟度を確認するためのクイズ Web アプリです。Netlify に静的ホスティング + Netlify Forms + Netlify Functions の構成でデプロイできます。

第1弾として、**第2章「無人航空機操縦者の心得」** の50問（4択）を収録しています。

---

## ディレクトリ構成

```
drone-quiz/
├── index.html                 受講者名入力・章選択のトップ画面
├── quiz.html                  50問の4択受験画面 + 結果画面
├── dashboard.html             講師用の集計ダッシュボード
├── netlify.toml               Netlify ビルド/関数設定
├── assets/
│   ├── css/styles.css         共通スタイル
│   └── js/
│       ├── common.js          共通ユーティリティ（Netlify Forms送信等）
│       ├── quiz.js            受験ロジック
│       └── dashboard.js       集計・可視化ロジック
├── data/
│   └── chapter2.json          第2章の問題データ（50問）
└── netlify/
    └── functions/
        └── get-submissions.js Netlify Forms の送信結果取得API
```

### 問題データフォルダ

問題データは **`/data/<chapterId>.json`** に置く設計です。
章を追加する場合は `chapter3.json` などを追加し、`index.html` の `<select id="chapter">` に選択肢を追加するだけで拡張できます。

```json
{
  "chapter": "2",
  "title": "無人航空機操縦者の心得",
  "sections": { "2.1": "操縦者の役割と責任", "2.2": "...", "2.3": "..." },
  "questions": [
    {
      "id": "Q01",
      "section": "2.1",
      "subsection": "操縦者としての自覚",
      "question": "問題文",
      "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "answer": 1,
      "explanation": "解説"
    }
  ]
}
```

---

## 受講者・講師の機能

### 受講者
1. トップで名前（必須）と受講者ID（任意）を入力
2. 分野を選び「テストを開始」
3. 50問の4択に回答（前後移動可／未回答スキップ可）
4. 結果画面で、総得点・正答率・分野別正答率・問題ごとの正誤と解説を確認
5. 結果は **Netlify Forms に送信** + 端末の `localStorage` にも自動保存

### 講師（ダッシュボード `/dashboard.html`）
- **受講者別 点数一覧**：最新得点・平均・受験回数をランキング
- **分野別正答率**：2.1 / 2.2 / 2.3 ごとのバーグラフ
- **間違いランキング**：正答率の低い問題 TOP20
- **個人履歴**：受験回ごとの点数推移（折れ線）と明細

---

## Netlify へのデプロイ手順

1. このディレクトリ全体を GitHub などの Git リポジトリに push
2. Netlify の「Add new site → Import from Git」で接続（Build command は不要、Publish directory は `/`）
3. デプロイ完了後、サイトURLでアクセスし、テストを1回受験して **Netlify Forms に `quiz-results` フォームが登録される** ことを確認
4. ダッシュボードで全受験者分を閲覧したい場合は、以下の環境変数を設定（Site settings → Build & deploy → Environment）：

| Key | 値 |
| --- | --- |
| `NETLIFY_API_TOKEN` | Netlify → User settings → Applications → Personal access tokens で発行 |
| `NETLIFY_SITE_ID`   | Netlify → Site settings → General → Site information の API ID |

設定後に再デプロイすると、`/.netlify/functions/get-submissions` が有効になりダッシュボードに全受講者の結果が反映されます。

> 環境変数未設定の場合も**デプロイ自体は可能**で、各受講者の端末ローカル（`localStorage`）に保存された履歴のみがダッシュボードに表示されます。

---

## ローカルでの動作確認

静的ファイルなので、任意のローカルサーバで開くだけで動作します（`fetch` のため `file://` では動きません）。

```bash
# 例
cd drone-quiz
python3 -m http.server 8000
# → http://localhost:8000/
```

Netlify Forms / Functions の検証は `netlify dev` が便利です。

```bash
npm i -g netlify-cli
netlify dev
```

---

## 章の追加手順

1. `data/chapterN.json` を作成
2. `index.html` の章セレクトに `<option value="chapterN">…</option>` を追加
3. `dashboard.html` の章フィルタにも同じ値の選択肢を追加
4. 既存 UI・送信ロジックは共通のため、そのまま動作します

---

## 出題範囲（第2章）

| 節 | 名称 | 収録問数 |
| --- | --- | --- |
| 2.1 | 操縦者の役割と責任 | 13問 |
| 2.2 | 安全な飛行の確保 | 25問 |
| 2.3 | 事故が起きた時の対応 | 12問 |
| **合計** | **無人航空機操縦者の心得** | **50問** |
