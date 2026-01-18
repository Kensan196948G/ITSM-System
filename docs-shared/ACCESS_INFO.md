# ITSM-Sec Nexus - アクセス情報

## 🌐 現在のアクセスURL

### **プライマリIPアドレス**: `192.168.0.187`

以下のURLでITSM-Sec Nexusにアクセスできます：

---

### 🔓 HTTP接続（推奨：開発環境）

```
http://192.168.0.187:6000
```

### 🔒 HTTPS接続（推奨：本番環境）

```
https://192.168.0.187:6443
```

---

## 📱 ローカルアクセス（同一マシン）

同じマシンからアクセスする場合：

- **HTTP**: `http://localhost:6000`
- **HTTPS**: `https://localhost:6443`

---

## 🌍 ネットワークアクセス（他のデバイス）

同じネットワーク上の他のデバイス（スマートフォン、タブレット、別のPC）からアクセスする場合：

- **HTTP**: `http://192.168.0.187:6000`
- **HTTPS**: `https://192.168.0.187:6443`

---

## ⚙️ 自動IPアドレス検出

ITSM-Sec Nexusは**自動的にホスト名を検出**する設計になっています。

### どのように動作するか

フロントエンドのJavaScriptコード：
```javascript
const API_BASE =
  window.location.protocol === 'https:'
    ? `https://${window.location.hostname}:6443/api/v1`
    : `http://${window.location.hostname}:6000/api/v1`;
```

**つまり**：
- `http://192.168.0.187:6000` でアクセス → API: `http://192.168.0.187:6000/api/v1`
- `http://localhost:6000` でアクセス → API: `http://localhost:6000/api/v1`
- `http://example.com:6000` でアクセス → API: `http://example.com:6000/api/v1`

**どのIPアドレスやホスト名でアクセスしても、自動的に正しいAPIエンドポイントに接続されます！**

---

## 🔍 現在のIPアドレスを確認

システムのIPアドレスが変更された場合、以下のコマンドで確認できます：

```bash
# プライマリIPアドレスを表示
hostname -I | awk '{print $1}'

# すべてのネットワークインターフェースのIPアドレスを表示
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

---

## 🛡️ ファイアウォール設定

他のデバイスからアクセスできない場合、ファイアウォールでポートを開放する必要があります：

### UFWの場合

```bash
sudo ufw allow 6000/tcp
sudo ufw allow 6443/tcp
sudo ufw reload
```

### firewalldの場合

```bash
sudo firewall-cmd --permanent --add-port=6000/tcp
sudo firewall-cmd --permanent --add-port=6443/tcp
sudo firewall-cmd --reload
```

---

## 🔐 HTTPS証明書について

HTTPS接続時にブラウザで「安全でない接続」の警告が表示される場合：

**原因**: 自己署名証明書を使用しているため

**対処法**:
1. 警告を無視して「詳細設定」→「このサイトに進む」をクリック
2. または、正式なSSL証明書（Let's Encryptなど）を設定

---

## 📊 サーバーリスニング状態の確認

サーバーが正しくポートでリスニングしているか確認：

```bash
# ポート6000と6443のリスニング状態を確認
ss -tlnp | grep -E ":(6000|6443)"
```

期待される出力：
```
LISTEN 0      511          0.0.0.0:6000       0.0.0.0:*
LISTEN 0      511          0.0.0.0:6443       0.0.0.0:*
```

`0.0.0.0` = すべてのネットワークインターフェースでリクエストを受付

---

## 🎯 アクセステスト

### コマンドラインでテスト

```bash
# HTTPアクセステスト
curl -I http://192.168.0.187:6000

# HTTPSアクセステスト（証明書検証なし）
curl -Ik https://192.168.0.187:6443
```

成功すると、以下のようなレスポンスが返ります：
```
HTTP/1.1 200 OK
または
HTTP/1.1 302 Found
```

---

## 📝 デフォルトログイン情報

初回アクセス時のログイン情報：

- **ユーザー名**: `admin`
- **パスワード**: `admin123`

**⚠️ セキュリティ警告**: 初回ログイン後、必ずパスワードを変更してください！

---

## 🔄 IPアドレスが変更された場合

DHCPでIPアドレスが自動割り当てされている場合、再起動後にIPアドレスが変わる可能性があります。

### 静的IPアドレスの設定（推奨）

本番環境では、静的IPアドレスを設定することをお勧めします。

**Ubuntu/Debianの場合** (`/etc/netplan/`):
```yaml
network:
  version: 2
  ethernets:
    eth0:  # ネットワークインターフェース名
      addresses:
        - 192.168.0.187/24
      gateway4: 192.168.0.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

設定後：
```bash
sudo netplan apply
```

---

## 📚 関連ドキュメント

- **Systemdサービス管理**: `SYSTEMD_SERVICE.md`
- **クイックスタート**: `QUICKSTART_SYSTEMD.md`
- **APIドキュメント**: `http://192.168.0.187:6000/api-docs`

---

**最終更新**: 2026-01-16
**現在のIPアドレス**: 192.168.0.187
