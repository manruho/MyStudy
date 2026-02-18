# Study Record

学習記録JSONからGitHub Pages向け静的サイトを生成するリポジトリです。

## 開発コマンド
- `npm run validate`: `content/logs/YYYYMM/*.json` を検証
- `npm run build`: `_site/` に静的サイト生成
- `npm run check`: 検証 + 生成

## JSON入力先
- `content/logs/YYYYMM/YYYY-MM-DD.json`（例: `content/logs/202601/2026-01-15.json`）
- スキーマ: `schema/log.schema.json`
- VSCode補完: `.vscode/settings.json`
- 推奨最小項目: `date`, `toshinKoma`
- 任意項目: `plan`, `notes`
- 互換項目: 旧 `study[]`, `toshin[]` も読み取り可能

## 公開ページ
- `index.html` (Week)
- `day/YYYY-MM-DD/` (Day)

## デプロイ
- `main` へ push すると `.github/workflows/deploy.yml` が実行され、GitHub Pagesへ反映されます。
