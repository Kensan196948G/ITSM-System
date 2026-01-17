# ITSM-Sec Nexus API Documentation

このディレクトリには、ITSM-Sec Nexus APIの静的ドキュメントが含まれています。

## ファイル一覧

- `index.html` - ランディングページ
- `swagger.html` - Swagger UI（インタラクティブドキュメント）
- `redoc.html` - ReDoc（読みやすいドキュメント）
- `openapi.json` - OpenAPI 3.0.3 仕様書
- `postman-collection.json` - Postman Collection v2.1

## GitHub Pagesでの公開

1. このディレクトリをGitHubリポジトリにプッシュ
2. リポジトリ設定 → Pages → Source で `docs/static` を選択
3. 公開URLにアクセス

## ローカルでの確認

```bash
# 簡易HTTPサーバーで確認
cd docs/static
python3 -m http.server 8000

# ブラウザでアクセス
open http://localhost:8000
```

## 更新方法

```bash
# スクリプトを実行して最新のドキュメントを生成
./scripts/generate-static-docs.sh
```
