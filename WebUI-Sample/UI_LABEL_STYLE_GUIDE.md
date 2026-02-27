# UI表記ルールガイド（UI Label Style Guide）

## 目的
- WebUI内のラベル表記を統一し、利用者の理解しやすさと監査・設計ドキュメントとの対応を取りやすくする。

## 基本ルール
- 標準表記は `日本語（英語）`
- 日本語を先に表示し、括弧内に英語を併記する
- 英語のみが一般的な固有名詞は必要に応じて日本語説明を先頭に置く
  - 例: `監査（Audit）`
  - 例: `NIST CSF 2.0（Cybersecurity Framework）`

## 適用対象
- 左サイドバーのカテゴリ名
- 左サイドバーの各画面タイトル（主要メニュー）
- 監査画面など、業務/監査で参照頻度が高い項目名

## 適用例
- `概要（Overview）`
- `運用（Operations）`
- `品質（Quality）`
- `セキュリティ（Security）`
- `管理（Admin）`
- `インシデント管理（Incident Management）`
- `サービス要求管理（Service Request Management）`
- `監査ログ一覧（Audit Log List）`
- `実行者（Actor）`
- `差分（Diff）`

## 非適用（例外）
- 実データ値そのもの（ユーザー名、チケットID、外部製品名）
- コード/プロトコル略語で意味が明確なもの（例: `CMDB`, `SLA`, `RFC`）
  - ただし見出しでは補足を推奨（例: `構成管理（Configuration Management / CMDB）`）

## 実装メモ
- 新規メニュー追加時は、`webui-sample/app.js` の `navSections` 定義で表記ルールに従う
- 主要画面のテーブル列名/見出し追加時も、業務用語は `日本語（英語）` を優先する
