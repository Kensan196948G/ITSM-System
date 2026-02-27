# ITSM-Sec Nexus 運用デモ
ISO 20000 (ITSM) と NIST CSF 2.0 (Security) を統合した次世代運用ダッシュボードのサンプルです。

## 準拠の考え方

### 1. ISO 20000-1:2018 (ITサービスマネジメント)
本デモでは、以下のプロセスを視覚化しています：
- **サービスレベル管理 (SLA)**: ダッシュボード上部でSLA遵守率をリアルタイムに表示。
- **インシデント管理 (Cl. 8.6.1)**: インシデントの優先度、ステータス、経過時間を管理。
- **構成管理 (Cl. 8.2.6)**: メニューに「構成管理 (CMDB)」を配置し、資産識別を可能に。
- **変更管理 (Cl. 8.5.1)**: 変更要求のステータス管理セクションを構成。

### 2. NIST Cybersecurity Framework (CSF) 2.0
2024年にリリースされた最新の2.0版に基づき、以下の6つのコア機能（Function）を統合しています：
- **GOVERN (統治)**: 組織のサイバーセキュリティ戦略とポリシー。
- **IDENTIFY (識別)**: 資産、脆弱性の把握。
- **PROTECT (保護)**: アクセス制御、データ保護。
- **DETECT (検知)**: 異常なアクティビティの早期発見。
- **RESPOND (対応)**: 検知されたインシデントへの対処。
- **RECOVER (復旧)**: サービス復旧とレジリエンス。

## 使い方
### 推奨（WebUI + APIサーバー）
1. `webui-sample` ディレクトリで `python3 api_server.py` を実行します。
2. 起動ログに表示された自動割り当てIP（例: `http://192.168.0.185:8765`）をブラウザで開きます。
3. ログイン（デモ）後、`システム設定` -> `ユーザー設定` でユーザーCRUD・ロール権限編集を確認します。

### フロントのみ（API未接続）
1. `index.html` をブラウザで開きます。
2. UIは動作しますが、ユーザー設定の永続化は行われません（ローカル表示のみ）。

## 技術スタック
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend (sample)**: Python 3 標準ライブラリ HTTP Server (`api_server.py`)
- **Icons**: Font Awesome 6
- **Design**: Modern Dark Mode with Glassmorphism

## 追加されたユーザー設定機能（サンプル）
- ユーザー設定: 検索、ロール/状態/部署フィルタ
- ユーザーCRUD: 新規作成・編集・削除
- ロール権限マトリクス: チェックボックス編集 + 保存
- バリデーション: 必須、文字数、メール形式、ユーザーID形式
- 監査ログ連携: ユーザー操作とロール権限更新を監査ログに記録

## UI表記ルール（Label Style）
- 原則: `日本語（英語）`
- 対象: サイドバーのカテゴリ名、主要画面名、監査画面の主要項目名
- 例:
  - `セキュリティ（Security）`
  - `監査ログ一覧（Audit Log List）`
  - `時刻（Time）`
- 詳細ガイド: `webui-sample/UI_LABEL_STYLE_GUIDE.md`

## テスト支援（開発用）
- テストデータ初期化API: `POST /api/test/reset`
- Playwright雛形: `playwright.config.js`, `tests/user-settings.spec.js`
- 実行例:
  - `npm install`
  - `npx playwright install`
  - `PLAYWRIGHT_BASE_URL=http://<自動割り当てIP>:8765 npm run test:e2e`
