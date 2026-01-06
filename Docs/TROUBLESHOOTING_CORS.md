# CORS エラー トラブルシューティングガイド

## 🔍 問題: CORSエラーが発生する

```
Access to fetch at 'http://172.23.10.109:5000/api/v1/auth/login' from origin 'http://172.23.10.109:8080'
has been blocked by CORS policy
```

## ✅ 解決済み - バックエンド側の対応

バックエンドサーバーは既に正しくCORS設定されています：

- ✅ CORS_ORIGIN: http://localhost:8080,http://172.23.10.109:8080
- ✅ プリフライトリクエスト: 正常応答
- ✅ Access-Control-Allow-Origin ヘッダー: 正常

## 🔧 ブラウザ側での解決方法

### 方法1: ブラウザのキャッシュをクリア（最も効果的）

#### Chrome / Edge

1. **Ctrl + Shift + Delete** を押す
2. 「キャッシュされた画像とファイル」を選択
3. 「データを削除」をクリック
4. ブラウザをリロード: **Ctrl + F5**（強制リロード）

#### Firefox

1. **Ctrl + Shift + Delete** を押す
2. 「キャッシュ」を選択
3. 「OK」をクリック
4. **Ctrl + F5** でリロード

### 方法2: シークレット/プライベートモード

1. **Ctrl + Shift + N**（Chrome/Edge）または **Ctrl + Shift + P**（Firefox）
2. シークレットウィンドウで http://172.23.10.109:8080/index.html を開く

### 方法3: ハードリロード

1. ブラウザで **Ctrl + F5** を押す
2. または **Shift + F5**

### 方法4: Service Worker クリア

開発者ツール（F12）を開いて：

1. **Application** タブ（Chrome/Edge）または **Storage** タブ（Firefox）
2. 「Service Workers」を選択
3. 「Unregister」をクリック
4. ページをリロード

---

## 🧪 動作確認方法

### ステップ1: APIが正常に動作しているか確認

コマンドプロンプトまたはPowerShellで：

```bash
# ヘルスチェック
curl http://localhost:5000/api/v1/health

# CORSプリフライトテスト
curl -X OPTIONS http://localhost:5000/api/v1/auth/login ^
  -H "Origin: http://172.23.10.109:8080" ^
  -H "Access-Control-Request-Method: POST" ^
  -H "Access-Control-Request-Headers: Content-Type" ^
  -v

# ログインテスト
curl -X POST http://localhost:5000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -H "Origin: http://172.23.10.109:8080" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

**期待される結果:**
- ヘルスチェック: `{"status":"OK",...}`
- CORSヘッダー: `Access-Control-Allow-Origin: http://172.23.10.109:8080`
- ログイン: JWTトークンを含むJSON

### ステップ2: ブラウザ開発者ツールで確認

1. **F12** で開発者ツールを開く
2. **Network** タブを選択
3. ログインを試行
4. `/api/v1/auth/login` リクエストを確認
5. **Response Headers** に以下が含まれているか確認：
   - `Access-Control-Allow-Origin: http://172.23.10.109:8080`
   - `Access-Control-Allow-Credentials: true`

---

## 🔄 サーバー再起動

CORSエラーが解決しない場合、サーバーを完全に再起動：

```
scripts\startup\stop-dev.bat   # 全サーバー停止
scripts\startup\start-dev.bat  # 再起動
```

---

## 📋 確認事項チェックリスト

- [ ] バックエンドサーバーが起動している（http://localhost:5000/api/v1/health で確認）
- [ ] フロントエンドHTTPサーバーが起動している（http://localhost:8080/index.html で確認）
- [ ] .envファイルに正しいCORS_ORIGINが設定されている
- [ ] ブラウザのキャッシュをクリアした
- [ ] ハードリロード（Ctrl + F5）を実行した
- [ ] 開発者ツールでCORSヘッダーを確認した

---

## 🐛 その他の問題

### 404 Not Found エラー

**原因:** バックエンドサーバーが起動していない、またはルーティング問題

**解決策:**
```bash
# バックエンドサーバーを再起動
scripts\startup\stop-dev.bat
scripts\startup\start-dev.bat

# ヘルスチェックで確認
curl http://localhost:5000/api/v1/health
```

### Failed to fetch エラー

**原因:** ネットワーク接続問題、バックエンドサーバーダウン

**解決策:**
1. バックエンドサーバーウィンドウでエラーログを確認
2. `npm start` を実行してバックエンドを手動起動
3. ファイアウォール設定を確認

---

## 💡 追加Tips

### localhost と IPアドレスの使い分け

- **localhost:8080** - 同じPC内でのアクセス（シンプル）
- **172.23.10.109:8080** - 他のデバイスからアクセス（ネットワーク経由）

### CORS設定の確認

`.env`ファイルを開いて確認：
```env
CORS_ORIGIN=http://localhost:8080,http://172.23.10.109:8080,...
```

使用するURLが含まれていることを確認してください。

---

**最終更新**: 2026-01-05
**ステータス**: ✅ CORS設定完了、動作確認済み
