# 学習記録サイト 仕様書 v0.2

## 1. 目的
- 学習内容を毎日Gitにpushして蓄積し、GitHub Pagesの静的サイトとして公開する。
- 先生が今週の学習内容と東進コマ数をすぐ把握できるようにする。
- 学習時間・問数・ページ数などは入力必須にしない（`detail`自由記述）。

## 2. 全体構成
- 入力: `content/logs/YYYYMM/YYYY-MM-DD.json` をVSCodeで作成/編集。
- 検証: CIでJSON形式・必須項目・日付整合性をチェック。
- 出力: 静的サイトを `_site/` に生成し、GitHub Pagesへ自動デプロイ。

## 3. 日付と時刻基準
- 週フォーカスの「今週」は **JST（Asia/Tokyo）** 基準、月曜開始。
- `Today`リンクも **JSTの日付** で判定。

## 4. データ仕様

### 4.1 ファイル単位
- 1日1ファイル: `content/logs/YYYYMM/YYYY-MM-DD.json`
- 例: `content/logs/202602/2026-02-17.json`

### 4.2 ルート項目
- `date` 必須: `YYYY-MM-DD`。ファイル名と一致必須。
- `toshinKoma` 推奨: その日に進めた東進コマ数（整数 `>= 0`）。
- `plan` 任意: その日の予定。
- `notes` 任意: その日の自由メモ。
- `study` 任意: 自学配列（旧運用互換）。
- `toshin` 任意: 東進配列（旧運用互換）。

### 4.3 `study[]`
- `subject` 必須: 科目。
- `focus` 必須: 強化テーマ。
- `detail` 必須: 自由記述（量や取り組み内容を記述）。
- `tags` 任意: 補助タグ文字列配列。

### 4.4 `toshin[]`
- `subject` 必須: 科目。
- `course` 必須: 講座名・授業内容。
- `koma` 必須: 整数かつ `>= 1`。
- `memo` 任意: 補助メモ。

### 4.5 学習日判定
- 記録あり: `study.length > 0 || toshin.length > 0`
- 自学あり: `study.length > 0`
- 東進あり: `toshin.length > 0`

## 5. 表示仕様

### 5.1 Week（トップ）
- デフォルト表示: 今週（JST・月曜開始）の7日。
- 各日カード: 日付・進めたコマ数・予定のみを表示。
- 週サマリー:
  - 今週合計コマ数
  - 記録日数 / 7

### 5.2 Month
- 月選択してカレンダー表示（`month.html?m=YYYY-MM`）。
- 記録あり日は●、東進あり日は赤●を追加。
- 日付クリックで日別詳細へ遷移。

### 5.3 Day
- URL形式: `day/YYYY-MM-DD/`
- 表示順: 進めたコマ数 → 予定 → メモ
- URL直接共有可能。

## 6. 自由記述の表示ルール
- `detail` / `memo` / `notes` はHTMLエスケープして表示（XSS防止）。
- 改行は `<br>` に変換して保持。
- 長文はWeekでは折りたたみ（notes）し、Dayで全文確認。

## 7. 集計ルール
- 日次コマ数は `toshinKoma` を優先。
- `toshinKoma` がない場合は `toshin[].koma` 合計を使用（互換）。

## 8. ナビゲーション
- `Week`（`index.html`）
- `Month`（`month.html`）
- `Today`（当日の詳細がある場合のみリンク）

## 9. 運用ルール
- 空の日は原則ファイルを作らない。
- 表記揺れ防止のため `subject` は固定語彙を推奨。
- `focus` は自由だが頻出語は統一推奨。

## 10. CI/CD
- Workflow: `.github/workflows/deploy.yml`
- `main`へのpushで実行:
  1. `npm ci`
  2. `npm run validate`
  3. `npm run build`
  4. `_site` を Pages にデプロイ

### 10.1 ビルド失敗条件
- JSON構文エラー
- 必須キー不足（`date`）
- 余計なキー混入
- `date`書式不正
- `date`とファイル名不一致
- `toshinKoma` が整数 `>=0` でない
- `toshin[].koma` が整数 `>=1` でない（互換項目使用時）
- 同一`date`の重複

## 11. 受け入れ条件
- `git push`だけでサイトが更新される。
- トップで今週一覧が見られる。
- 月カレンダーで記録日が分かる。
- 東進は色分けされ、科目別コマ数が週サマリーで分かる。
- 定量入力（問数/ページ数/時間）は必須でない。
