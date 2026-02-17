# Study Record

学習記録JSONからGitHub Pages向け静的サイトを生成するリポジトリです。

## 開発コマンド
- `npm run validate`: `content/logs/*.json` を検証
- `npm run build`: `_site/` に静的サイト生成
- `npm run check`: 検証 + 生成

## JSON入力先
- `content/logs/YYYY-MM-DD.json`
- スキーマ: `schema/log.schema.json`
- VSCode補完: `.vscode/settings.json`

## 公開ページ
- `index.html` (Week)
- `month.html` (Month)
- `day/YYYY-MM-DD/` (Day)

## デプロイ
- `main` へ push すると `.github/workflows/deploy.yml` が実行され、GitHub Pagesへ反映されます。
