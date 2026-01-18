# CLAUDE.md - ITSM-Sec Nexus 開発ルール

## プロジェクト概要

ITSM-Sec Nexus は、ITサービス管理（ITSM）とセキュリティ管理を統合したWebアプリケーションです。
NIST Cybersecurity Framework (CSF) 2.0 に準拠した設計を採用しています。

## 技術スタック

- **Backend**: Node.js + Express.js
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla JavaScript (SPA)
- **認証**: JWT + Refresh Token
- **API**: RESTful API (v1)

## ディレクトリ構成

```
ITSM-System/
├── backend/           # バックエンドソースコード
│   ├── routes/        # APIルート
│   ├── services/      # ビジネスロジック
│   ├── middleware/    # ミドルウェア
│   ├── migrations/    # DBマイグレーション
│   └── __tests__/     # テストコード
├── frontend/          # フロントエンドソースコード
├── Docs/              # ドキュメント
└── .github/           # GitHub Actions設定
```

## 開発ルール

### コーディング規約

1. **ESLint/Prettier**: コードは必ずフォーマットを適用
2. **命名規則**: camelCase（変数・関数）、PascalCase（クラス）
3. **コメント**: 複雑なロジックには日本語コメントを付与
4. **エラーハンドリング**: try-catchで適切にエラーを捕捉

### API設計

- **バージョニング**: `/api/v1/` プレフィックス必須
- **認証**: JWTトークンをAuthorizationヘッダーで送信
- **レスポンス形式**: JSON
- **エラーレスポンス**: `{ error: string, message: string }`

### セキュリティ

- **入力検証**: すべてのユーザー入力をバリデーション
- **SQLインジェクション防止**: プリペアドステートメント使用
- **XSS防止**: 出力のエスケープ処理
- **CSRF防止**: トークン検証

### テスト

- **ユニットテスト**: `backend/__tests__/unit/`
- **統合テスト**: `backend/__tests__/integration/`
- **E2Eテスト**: `backend/__tests__/e2e/`
- **カバレッジ目標**: 70%以上

## 禁止事項

1. **本番環境への直接デプロイ禁止**
2. **シークレット情報のハードコード禁止**
3. **未テストのコードのマージ禁止**
4. **README.mdの仕様に反する実装禁止**

## 自動修復ルール

自動修復プロセスでは以下を遵守：

1. **仕様変更禁止**: README.mdに記載された仕様を変更しない
2. **最小限の修正**: テスト失敗に直接関係する箇所のみ修正
3. **新機能追加禁止**: バグ修正のみ許可
4. **依存関係追加禁止**: 新しいnpmパッケージを追加しない

## 環境設定

- **開発環境**: ポート5443 (HTTPS)
- **本番環境**: ポート6443 (HTTPS)
- **テスト環境**: NODE_ENV=test

## 連絡先

問題が発生した場合は、GitHubのIssueを作成してください。
