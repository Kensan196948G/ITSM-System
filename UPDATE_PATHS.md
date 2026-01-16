# ファイル整理後のパス更新ガイド

## ⚠️ 重要

`organize-root.sh`を実行した後、以下のファイルのパスを更新する必要があります。

---

## 📝 更新が必要なファイル

### 1. Systemdサービスファイル

#### **services/itsm-sec-nexus-dev.service**

```ini
# 変更前
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env.development

# 変更後
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/config/env/.env.development
```

```ini
# 変更前
StandardOutput=append:/mnt/LinuxHDD/ITSM-System/backend-dev.log
StandardError=append:/mnt/LinuxHDD/ITSM-System/backend-dev.log

# 変更後
StandardOutput=append:/mnt/LinuxHDD/ITSM-System/logs/backend-dev.log
StandardError=append:/mnt/LinuxHDD/ITSM-System/logs/backend-dev.log
```

#### **services/itsm-sec-nexus-prod.service**

同様の変更を適用

---

### 2. スクリプトファイル

#### **scripts/deploy-services.sh**

```bash
# 変更前
cp "${SCRIPT_DIR}/${DEV_SERVICE}" "${SYSTEMD_DIR}/${DEV_SERVICE}"

# 変更後
cp "${SCRIPT_DIR}/../services/${DEV_SERVICE}" "${SYSTEMD_DIR}/${DEV_SERVICE}"
```

---

### 3. ドキュメント内のパス参照

多くのドキュメントで以下のパスを更新：

```bash
# 変更前
./manage-env.sh
./deploy-services.sh

# 変更後
./scripts/manage-env.sh
./scripts/deploy-services.sh
```

---

## 🔄 自動更新スクリプト

```bash
#!/bin/bash
# update-paths.sh

# Systemdサービスファイルを更新
sed -i 's|EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env.development|EnvironmentFile=/mnt/LinuxHDD/ITSM-System/config/env/.env.development|g' services/itsm-sec-nexus-dev.service

sed -i 's|EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env.production|EnvironmentFile=/mnt/LinuxHDD/ITSM-System/config/env/.env.production|g' services/itsm-sec-nexus-prod.service

# ログパスを更新
sed -i 's|backend-dev.log|logs/backend-dev.log|g' services/itsm-sec-nexus-dev.service
sed -i 's|backend-prod.log|logs/backend-prod.log|g' services/itsm-sec-nexus-prod.service

echo "✅ パス更新完了"
```

---

## ✅ シンボリックリンクの作成（後方互換性）

古いパスでも動作するように、シンボリックリンクを作成：

```bash
# ルートからスクリプトへのショートカット
ln -s scripts/manage-env.sh manage-env.sh
ln -s scripts/switch-env.sh switch-env.sh
ln -s scripts/deploy-services.sh deploy-services.sh

# 環境変数ファイル（.envは現在使用中なのでそのまま）
# 移行期間中は両方に配置
```

---

## 📋 整理後の確認事項

- [ ] Systemdサービスが起動する
- [ ] スクリプトが正常に動作する
- [ ] 環境変数が正しく読み込まれる
- [ ] ログが正しい場所に出力される

---

**次のステップ**: まず`organize-root.sh`を実行して整理し、その後このガイドに従ってパスを更新してください。
