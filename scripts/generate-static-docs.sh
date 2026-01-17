#!/bin/bash
#
# 静的APIドキュメント生成スクリプト（GitHub Pages用）
#
# 使用方法:
#   ./scripts/generate-static-docs.sh
#
# 出力:
#   docs/static/ ディレクトリに静的HTMLファイルを生成
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/docs"
STATIC_DIR="$DOCS_DIR/static"

echo "========================================="
echo "Static API Documentation Generator"
echo "========================================="

# 出力ディレクトリを作成
mkdir -p "$STATIC_DIR"

# OpenAPI YAML から JSON を生成
echo "Generating OpenAPI JSON..."
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const spec = yaml.load(fs.readFileSync('$DOCS_DIR/openapi.yaml', 'utf8'));
fs.writeFileSync('$STATIC_DIR/openapi.json', JSON.stringify(spec, null, 2));
console.log('✓ OpenAPI JSON generated');
"

# Postman Collection を生成
echo "Generating Postman Collection..."
if [ -f "$SCRIPT_DIR/generate-postman-collection.js" ]; then
    node "$SCRIPT_DIR/generate-postman-collection.js"
    cp "$DOCS_DIR/postman-collection.json" "$STATIC_DIR/" 2>/dev/null || true
    echo "✓ Postman Collection generated"
fi

# ReDoc 静的HTMLを生成
echo "Generating ReDoc HTML..."
cat > "$STATIC_DIR/redoc.html" << 'EOF'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ITSM-Sec Nexus API - ReDoc</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <redoc spec-url="./openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
EOF
echo "✓ ReDoc HTML generated"

# Swagger UI 静的HTMLを生成
echo "Generating Swagger UI HTML..."
cat > "$STATIC_DIR/swagger.html" << 'EOF'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ITSM-Sec Nexus API - Swagger UI</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "./openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        syntaxHighlight: {
          activate: true,
          theme: "monokai"
        }
      });
    };
  </script>
</body>
</html>
EOF
echo "✓ Swagger UI HTML generated"

# index.html (ランディングページ) を生成
echo "Generating index.html..."
cat > "$STATIC_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ITSM-Sec Nexus API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .header {
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      color: white;
      padding: 40px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .content { padding: 40px; }
    .section { margin-bottom: 30px; }
    .section h2 {
      font-size: 1.8em;
      margin-bottom: 20px;
      color: #2c3e50;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .card {
      border: 2px solid #e1e8ed;
      border-radius: 8px;
      padding: 25px;
      transition: all 0.3s;
    }
    .card:hover {
      border-color: #667eea;
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
      transform: translateY(-5px);
    }
    .card h3 { font-size: 1.4em; margin-bottom: 15px; color: #2c3e50; }
    .card p { margin-bottom: 15px; color: #666; }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      transition: all 0.3s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      border-radius: 0 0 10px 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ITSM-Sec Nexus API</h1>
      <p>ITIL準拠の統合ITサービスマネジメントAPI - 完全なドキュメント</p>
    </div>

    <div class="content">
      <div class="section">
        <h2>APIドキュメント</h2>
        <div class="cards">
          <div class="card">
            <h3>Swagger UI</h3>
            <p>インタラクティブなAPIドキュメント</p>
            <a href="./swagger.html" class="btn">Swagger UIを開く</a>
          </div>
          <div class="card">
            <h3>ReDoc</h3>
            <p>美しく読みやすいドキュメント</p>
            <a href="./redoc.html" class="btn">ReDocを開く</a>
          </div>
          <div class="card">
            <h3>OpenAPI仕様</h3>
            <p>JSON形式の仕様書</p>
            <a href="./openapi.json" class="btn" download>JSONをダウンロード</a>
          </div>
          <div class="card">
            <h3>Postman Collection</h3>
            <p>すべてのエンドポイント</p>
            <a href="./postman-collection.json" class="btn" download>Collectionをダウンロード</a>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>&copy; 2025 ITSM-Sec Nexus | Version 1.0.0 | MIT License</p>
    </div>
  </div>
</body>
</html>
EOF
echo "✓ index.html generated"

# README.md を生成
cat > "$STATIC_DIR/README.md" << 'EOF'
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
EOF
echo "✓ README.md generated"

echo ""
echo "========================================="
echo "Generation Complete!"
echo "========================================="
echo "Output directory: $STATIC_DIR"
echo ""
echo "Generated files:"
ls -lh "$STATIC_DIR"
echo ""
echo "To preview locally:"
echo "  cd $STATIC_DIR && python3 -m http.server 8000"
echo ""
echo "To deploy to GitHub Pages:"
echo "  1. Push this repository to GitHub"
echo "  2. Go to Settings → Pages"
echo "  3. Set source to 'docs/static' directory"
echo "  4. Save and wait for deployment"
