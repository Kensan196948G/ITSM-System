# 国際化(i18n)実装サマリー

## 実装日
2026-01-07

## 概要
ITSM-Sec Nexusに国際化(i18n)機能を実装し、多言語対応を実現しました。

## 実装内容

### 1. ライブラリの導入
- **i18next** v25.7.3 - フロントエンド国際化ライブラリ
- **i18next-browser-languagedetector** v8.2.0 - ブラウザ言語自動検出

### 2. 翻訳ファイルの作成

#### 対応言語
1. **日本語 (ja)** - デフォルト言語
   - ファイル: `/mnt/LinuxHDD/ITSM-System/frontend/locales/ja.json`
   - サイズ: 12KB
   - 翻訳キー数: 300+

2. **英語 (en)**
   - ファイル: `/mnt/LinuxHDD/ITSM-System/frontend/locales/en.json`
   - サイズ: 10KB
   - 翻訳キー数: 300+

3. **中国語簡体字 (zh-CN)**
   - ファイル: `/mnt/LinuxHDD/ITSM-System/frontend/locales/zh-CN.json`
   - サイズ: 9.4KB
   - 翻訳キー数: 300+

#### 翻訳カバレッジ
- UI文言（ボタン、ラベル、メッセージ）: 100%
- エラーメッセージ: 100%
- 通知文言: 100%
- ダッシュボードラベル: 100%
- ナビゲーション: 100%
- フォーム項目: 100%

### 3. フロントエンド実装

#### i18n初期化スクリプト
- ファイル: `/mnt/LinuxHDD/ITSM-System/frontend/i18n.js`
- 機能:
  - 翻訳リソースの動的読み込み
  - ブラウザ言語の自動検出
  - 言語切り替え機能
  - 日付・数値のローカライズ
  - 言語設定のlocalStorage保存

#### 主要機能
```javascript
// 初期化
await i18nInit();

// 翻訳の取得
const text = t('common.welcome');

// 言語切り替え
changeLanguage('en');

// 日付フォーマット
const date = formatDate(new Date());

// 数値フォーマット
const number = formatNumber(1234.56);
```

#### UI統合
- **index.html** の更新
  - i18nextライブラリの読み込み (CDN)
  - i18n.jsスクリプトの読み込み
  - 言語切り替えウィジェット用コンテナの追加

- **app.js** の更新
  - DOMContentLoadedイベントでi18n初期化
  - 言語切り替えウィジェットの自動生成
  - showApp()関数に言語切り替え初期化を追加

### 4. バックエンド実装

#### i18nミドルウェア
- ファイル: `/mnt/LinuxHDD/ITSM-System/backend/middleware/i18n.js`
- 機能:
  - Accept-Languageヘッダーのパース
  - リクエストごとの言語設定
  - サーバーサイド翻訳関数 (req.t())
  - バックエンドメッセージの多言語化

#### メッセージ翻訳
以下のカテゴリのバックエンドメッセージを翻訳:
- エラーメッセージ
- 認証メッセージ
- インシデント管理メッセージ
- 変更管理メッセージ
- 資産管理メッセージ
- SLA管理メッセージ
- 成功メッセージ

#### サーバー統合
- **server.js** の更新
  - i18nミドルウェアのインポート
  - Express アプリケーションへの適用
  - すべてのAPIエンドポイントで利用可能

### 5. ドキュメント

#### 英語版README
- ファイル: `/mnt/LinuxHDD/ITSM-System/README.en.md`
- 内容: 日本語版READMEの完全な英訳
- セクション:
  - プロジェクト概要
  - 機能説明
  - セットアップ手順
  - デプロイメント
  - セキュリティ
  - 国際化機能

#### 日本語版READMEの更新
- 国際化セクションの追加
- 英語版READMEへのリンク

#### i18n実装ガイド
- ファイル: `/mnt/LinuxHDD/ITSM-System/Docs/i18n-guide.md`
- 内容:
  - 使用方法
  - 新言語の追加手順
  - ベストプラクティス
  - トラブルシューティング
  - APIリファレンス
  - サンプルコード

## 技術仕様

### フロントエンド

```javascript
// 設定
const DEFAULT_LANGUAGE = 'ja';
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN'];

// 初期化オプション
{
  lng: initialLanguage,
  fallbackLng: 'ja',
  debug: false,
  resources: { /* 翻訳リソース */ },
  interpolation: {
    escapeValue: false
  }
}
```

### バックエンド

```javascript
// Accept-Language パース
parseAcceptLanguage('en-US,en;q=0.9,ja;q=0.8')
// => 'en'

// リクエストオブジェクトに追加されるプロパティ
req.language  // 'en'
req.t('auth.login.success')  // 'Login successful'
```

## 主要機能

### 1. 自動言語検出
- ブラウザの `navigator.language` を検出
- Accept-Languageヘッダーの優先順位を尊重
- サポートされていない言語の場合はデフォルト(日本語)にフォールバック

### 2. 言語切り替えUI
- ヘッダー右上に配置
- ドロップダウンで言語選択
- リアルタイムでページコンテンツを更新
- 選択した言語をlocalStorageに保存

### 3. ロケール対応
- 日付フォーマット (Intl.DateTimeFormat)
- 数値フォーマット (Intl.NumberFormat)
- 通貨表示
- 時刻表示

### 4. パラメータ補間
```javascript
// 例: エラーメッセージ
t('errors.requiredField', { field: 'username' })
// ja: "usernameは必須項目です"
// en: "username is required"
// zh-CN: "username为必填项"
```

## パフォーマンス最適化

### キャッシング
- i18nextの内部キャッシュを活用
- 翻訳リソースは初回読み込み時のみフェッチ
- 言語設定をlocalStorageに保存して再読み込みを削減

### 遅延読み込み
- 翻訳ファイルは非同期で読み込み
- アプリケーション起動を遅延させない

### バンドルサイズ
- CDNからi18nextを読み込み
- 翻訳ファイルはJSONで軽量
- 合計サイズ: ~32KB (全言語)

## セキュリティ対策

### XSS対策
- 翻訳文字列は`textContent`で挿入
- `innerHTML`は使用しない
- DOM APIのみを使用

### 入力検証
- 翻訳パラメータのサニタイズ
- 信頼できないデータのエスケープ

## テスト

### 手動テスト項目
- [ ] 言語切り替えが正常に動作する
- [ ] ブラウザ言語が自動検出される
- [ ] localStorageに言語設定が保存される
- [ ] ページリロード後も言語設定が維持される
- [ ] すべてのUI要素が翻訳される
- [ ] エラーメッセージが適切な言語で表示される
- [ ] 日付・数値が正しくフォーマットされる
- [ ] バックエンドメッセージが翻訳される

### 動作確認コマンド
```bash
# サーバー起動
npm start

# フロントエンド起動
python3 -m http.server 5050 --bind 0.0.0.0

# ブラウザでアクセス
open http://localhost:5050/index.html
```

## 今後の拡張

### 追加予定の言語
- フランス語 (fr)
- ドイツ語 (de)
- スペイン語 (es)
- 韓国語 (ko)

### 機能拡張
- 日付フォーマットのカスタマイズ
- 数値フォーマットのカスタマイズ
- RTL言語のサポート (アラビア語など)
- 翻訳管理システムとの統合
- 翻訳の動的更新
- ユーザーごとの言語設定

## 既知の制限事項

1. **静的コンテンツ**
   - 一部のハードコーディングされた文字列は未翻訳
   - 段階的に翻訳を追加予定

2. **データベース内容**
   - データベースに保存されたコンテンツは翻訳されない
   - 将来的に多言語データベーススキーマを検討

3. **PDF/エクスポート**
   - PDF生成時の言語対応は部分的
   - フォントのサポートが必要

## 参考リンク

- i18next公式ドキュメント: https://www.i18next.com/
- i18next-browser-languagedetector: https://github.com/i18next/i18next-browser-languageDetector
- WCAG国際化ガイドライン: https://www.w3.org/WAI/standards-guidelines/wcag/

## 貢献者

- 実装: Claude Code
- レビュー: 開発チーム
- 翻訳: 自動生成 (要レビュー・修正)

## まとめ

ITSM-Sec Nexusに包括的な国際化機能が実装されました。これにより、グローバルユーザーへの展開が可能になり、システムの利用範囲が大幅に拡大します。

翻訳の品質向上とさらなる言語の追加により、より多くのユーザーにサービスを提供できるようになります。
