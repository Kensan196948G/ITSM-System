# 🚀 本番環境ドキュメント (Production Documentation)

本番環境のデプロイメント、運用、監視、セキュリティに関するドキュメント集です。

## 📂 ファイル一覧

### セットアップ・デプロイ
| ファイル | 説明 |
|---------|------|
| [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) | 環境別セットアップガイド |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | 本番デプロイ前チェックリスト |
| [DATA_MIGRATION_PLAN.md](DATA_MIGRATION_PLAN.md) | 本番データ移行計画 |

### HTTPS/TLS設定
| ファイル | 説明 |
|---------|------|
| [HTTPS_QUICKSTART.md](HTTPS_QUICKSTART.md) | 5分HTTPSセットアップ |
| [HTTPS_SETUP.md](HTTPS_SETUP.md) | HTTPS設定完全ガイド |
| [HTTPS_DESIGN.md](HTTPS_DESIGN.md) | HTTPS設計書 |
| [HTTPS_IMPLEMENTATION_SUMMARY.md](HTTPS_IMPLEMENTATION_SUMMARY.md) | HTTPS実装サマリー |

### Systemdサービス
| ファイル | 説明 |
|---------|------|
| [QUICKSTART_SYSTEMD.md](QUICKSTART_SYSTEMD.md) | Systemd 5分セットアップ |
| [SYSTEMD_SERVICE.md](SYSTEMD_SERVICE.md) | Systemdサービス管理 |
| [SYSTEMD_SERVICE_SETUP.md](SYSTEMD_SERVICE_SETUP.md) | Systemd設定手順 |

### 運用・監視
| ファイル | 説明 |
|---------|------|
| [OPERATIONS.md](OPERATIONS.md) | 本番運用マニュアル |
| [EMAIL_NOTIFICATION_SETUP.md](EMAIL_NOTIFICATION_SETUP.md) | メール通知設定 |

### セキュリティ
| ファイル | 説明 |
|---------|------|
| [security-audit-report.md](security-audit-report.md) | セキュリティ監査レポート |
| [SECURITY_API_KEY_ROTATION_REQUIRED.md](SECURITY_API_KEY_ROTATION_REQUIRED.md) | APIキーローテーション警告 |

## 🔐 本番環境アクセス

```bash
# 本番環境起動（HTTPS）
npm run start:prod

# ヘルスチェック
curl https://localhost:6443/api/v1/health
```

## 🔗 関連ドキュメント

- [開発環境ドキュメント](../docs-dev/README.md)
- [共通ドキュメント](../docs-shared/README.md)

---
**最終更新**: 2026-01-17
