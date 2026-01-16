# ITSM-Sec Nexus - Systemdサービス クイックスタート

## 🚀 5分でセットアップ

### 1️⃣ インストール

```bash
cd /mnt/LinuxHDD/ITSM-System
sudo ./install-service.sh
```

### 2️⃣ 起動

```bash
sudo ./service-manager.sh start
```

### 3️⃣ 確認

```bash
./service-manager.sh status
```

### 4️⃣ 自動起動を有効化（オプション）

```bash
sudo ./service-manager.sh enable
```

---

## 📝 よく使うコマンド

| 操作 | コマンド |
|------|---------|
| 🚀 起動 | `sudo ./service-manager.sh start` |
| 🛑 停止 | `sudo ./service-manager.sh stop` |
| 🔄 再起動 | `sudo ./service-manager.sh restart` |
| 📊 状態確認 | `./service-manager.sh status` |
| 📋 ログ表示 | `./service-manager.sh logs` |
| ⚙️ 自動起動ON | `sudo ./service-manager.sh enable` |
| 🔓 自動起動OFF | `sudo ./service-manager.sh disable` |

---

## 🌐 アクセス

サービス起動後、以下のURLでアクセス可能：

- **HTTP**: `http://localhost:6000`
- **HTTPS**: `https://localhost:6443`

---

## 🔧 トラブルシューティング

### サービスが起動しない場合

```bash
# ログを確認
./service-manager.sh logs

# 詳細なエラーログを表示
sudo journalctl -u itsm-sec-nexus -p err -n 50
```

### ポートが使用中の場合

```bash
# ポート使用状況を確認
sudo netstat -tlnp | grep -E ":(6000|6443)"

# 既存プロセスを停止
pkill -f "node.*server.js"
```

---

## 📚 詳細ドキュメント

詳しい情報は [SYSTEMD_SERVICE.md](./SYSTEMD_SERVICE.md) を参照してください。

---

## ✅ 動作確認チェックリスト

- [ ] `sudo ./install-service.sh` でインストール完了
- [ ] `sudo ./service-manager.sh start` でサービス起動
- [ ] `./service-manager.sh status` で `active (running)` を確認
- [ ] ブラウザで `http://localhost:6000` にアクセス可能
- [ ] ログインページが表示される
- [ ] `sudo ./service-manager.sh enable` で自動起動を設定

---

**すべて完了したら、システムを再起動してサービスが自動起動することを確認してください！**
