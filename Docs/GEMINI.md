# GEMINI.md

## プロジェクト概要
**ITSM-Sec Nexus**
ISO 20000 (ITSM) と NIST CSF 2.0 (Security) を統合した次世代運用管理システム。
Node.js (Express) + SQLite (Knex) + Vanilla JS で構成され、現在 **Phase B（本番移行準備）完了済み**、**Phase C（機能拡張）** および **品質向上（テストカバレッジ、ドキュメント）** フェーズにある。

## 役割
1.  **技術調査 & 実装支援**
    - Node.js/Express バックエンドの改修・拡張
    - フロントエンド (Vanilla JS) のUI改善
    - セキュリティ機能 (2FA, RBAC) の検証
2.  **品質保証 (QA)**
    - テストカバレッジ向上 (現在の約24%から目標30%へ)
    - エラー原因の一次切り分け (ログ分析、DB整合性チェック)
    - Lint/Format エラーの修正 (`npm run lint`, `npm run format:check`)
3.  **ドキュメント整備**
    - `Docs/` 以下のドキュメントと実装の整合性チェック
    - API仕様 (Swagger/JSDoc) の要約・更新

## 出力ルール
- **箇条書き** で簡潔に記述する。
- **事実と推測を分離** する（「ログに〜のエラーがあるため（事実）、〜が原因の可能性がある（推測）」）。
- **公式情報・プロジェクト内ルールを優先** する (`README.md`, `CLAUDE.md` 準拠)。
- **コマンド** はプロジェクトのスクリプト (`package.json`) を優先して提示する。
    - テスト: `npm test` / `npm run test:coverage`
    - Lint: `npm run lint`
    - 起動: `npm start` / `python3 -m http.server 5050`
- **ファイルパス** はルート (`./`) からの相対パスで記述する。

## 禁止事項
- **大量のコード生成** (既存コードのスタイルを維持し、最小限の修正にとどめる)。
- **`README.md` の勝手な変更** (仕様の正本であるため)。
- **テストを無視した修正** (修正後は必ずテストを通すこと)。
- **未確認のライブラリ追加** (原則として `package.json` にあるものを使用)。

## 重要コンテキスト
- **主要ドキュメント**:
    - `README.md`: プロジェクト仕様の正本。
    - `Docs/IMPLEMENTATION_SUMMARY.md`: 実装詳細。
    - `Docs/Phase-B完了レポート.md`: 直近のマイルストーン達成状況。
- **データベース**: SQLite (`./backend/data/itsm.db` 想定), Knex.js によるマイグレーション管理。
- **認証**: JWT + RBAC (admin, manager, analyst, viewer)。
- **開発状況**:
    - CI/CDパイプライン (`.github/workflows`) 整備済み。
    - 自動修復エージェント (`CLAUDE.md` 参照) の概念あり。

## 直近のタスク (Priority)
1.  テストカバレッジ 30% 達成。
2.  ドキュメント (`Docs/`) の最新化。
3.  次期フェーズ (Phase C) の機能設計支援。