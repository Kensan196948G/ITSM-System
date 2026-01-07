# 国際化(i18n)実装ガイド

## 概要

ITSM-Sec Nexusは、i18next を使用した多言語対応機能を実装しています。このガイドでは、i18n機能の使用方法と拡張方法について説明します。

## サポート言語

現在、以下の言語をサポートしています：

- **日本語 (ja)** - デフォルト言語
- **英語 (en)** - English
- **中国語簡体字 (zh-CN)** - 简体中文

## アーキテクチャ

### フロントエンド

```
frontend/
├── locales/           # 翻訳ファイル
│   ├── ja.json       # 日本語翻訳
│   ├── en.json       # 英語翻訳
│   └── zh-CN.json    # 中国語翻訳
├── i18n.js           # i18n初期化スクリプト
├── app.js            # メインアプリケーション
└── index.html        # HTMLテンプレート
```

### バックエンド

```
backend/
└── middleware/
    └── i18n.js       # Accept-Language対応ミドルウェア
```

## 使用方法

### フロントエンド

#### 1. 初期化

`index.html`にi18nextとi18n.jsを読み込みます：

```html
<!-- i18next CDN -->
<script src="https://cdn.jsdelivr.net/npm/i18next@23.7.6/i18next.min.js"></script>

<!-- i18n初期化スクリプト -->
<script src="./frontend/i18n.js"></script>
```

アプリケーション起動時に初期化：

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  await window.i18nInit();
  // その他の初期化処理...
});
```

#### 2. 翻訳の使用

JavaScriptコードで翻訳を使用：

```javascript
// 基本的な使用
const welcomeMsg = t('common.welcome');

// パラメータ付き翻訳
const errorMsg = t('errors.requiredField', { field: 'ユーザー名' });

// ネストされたキー
const dashboardTitle = t('dashboard.title');
```

#### 3. 言語切り替え

プログラム的に言語を変更：

```javascript
changeLanguage('en');  // 英語に切り替え
changeLanguage('ja');  // 日本語に切り替え
changeLanguage('zh-CN');  // 中国語に切り替え
```

UI上で言語切り替えウィジェットを表示：

```javascript
const switcher = createLanguageSwitcher();
container.appendChild(switcher);
```

#### 4. 日付・数値のフォーマット

ロケールに応じた日付・数値のフォーマット：

```javascript
// 日付フォーマット
const formattedDate = formatDate(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

// 数値フォーマット
const formattedNumber = formatNumber(1234.56, {
  style: 'currency',
  currency: 'JPY'
});
```

### バックエンド

#### 1. ミドルウェアの使用

`server.js`でi18nミドルウェアを有効化：

```javascript
const { i18nMiddleware } = require('./middleware/i18n');

app.use(i18nMiddleware);
```

#### 2. リクエストで翻訳を使用

各リクエストハンドラで`req.t()`を使用：

```javascript
app.post('/api/v1/incidents', async (req, res) => {
  try {
    // インシデント作成処理...
    res.json({
      success: true,
      message: req.t('incident.created')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: req.t('error.serverError')
    });
  }
});
```

#### 3. Accept-Languageヘッダー

クライアントから`Accept-Language`ヘッダーを送信：

```javascript
fetch('/api/v1/incidents', {
  headers: {
    'Accept-Language': 'en',
    'Authorization': `Bearer ${token}`
  }
});
```

## 翻訳ファイル構造

### 標準構造

翻訳ファイルは以下のセクションに分類されています：

```json
{
  "common": {
    "appName": "...",
    "welcome": "...",
    "logout": "..."
  },
  "auth": {
    "username": "...",
    "password": "...",
    "loginSuccess": "..."
  },
  "navigation": {
    "dashboard": "...",
    "incidents": "..."
  },
  "dashboard": { ... },
  "incidents": { ... },
  "changes": { ... },
  "assets": { ... },
  "security": { ... },
  "compliance": { ... },
  "sla": { ... },
  "notifications": { ... },
  "reports": { ... },
  "settings": { ... },
  "users": { ... },
  "errors": { ... },
  "messages": { ... },
  "dateTime": { ... }
}
```

### パラメータ補間

翻訳文字列にパラメータを埋め込む：

```json
{
  "errors": {
    "requiredField": "{{field}}は必須項目です",
    "minLength": "{{field}}は{{min}}文字以上で入力してください"
  }
}
```

使用例：

```javascript
t('errors.requiredField', { field: 'ユーザー名' });
// => "ユーザー名は必須項目です"

t('errors.minLength', { field: 'パスワード', min: 8 });
// => "パスワードは8文字以上で入力してください"
```

## 新しい言語の追加

### 1. 翻訳ファイルの作成

`frontend/locales/` に新しい言語ファイルを作成：

```bash
cp frontend/locales/en.json frontend/locales/fr.json
# fr.jsonを編集してフランス語翻訳を追加
```

### 2. サポート言語リストの更新

`frontend/i18n.js` を編集：

```javascript
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'fr'];

const LANGUAGE_NAMES = {
  ja: '日本語',
  en: 'English',
  'zh-CN': '简体中文',
  fr: 'Français'
};
```

### 3. バックエンドの更新

`backend/middleware/i18n.js` を編集：

```javascript
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'fr'];

const messages = {
  ja: { ... },
  en: { ... },
  'zh-CN': { ... },
  fr: {
    'error.generic': 'Une erreur s\'est produite',
    // ...他の翻訳を追加
  }
};
```

## ベストプラクティス

### 1. キーの命名規則

- ドット記法を使用：`section.subsection.key`
- 説明的なキー名を使用
- 一貫性のあるネーミング

良い例：
```javascript
t('incidents.createIncident')
t('errors.validationError')
t('messages.confirmDelete')
```

悪い例：
```javascript
t('inc1')
t('err')
t('msg')
```

### 2. 翻訳キーの再利用

共通の翻訳は `common` セクションに配置：

```json
{
  "common": {
    "save": "保存",
    "cancel": "キャンセル",
    "delete": "削除"
  }
}
```

### 3. コンテキストの提供

翻訳キーには十分なコンテキストを含める：

```json
{
  "incidents": {
    "statusNew": "新規",
    "statusInProgress": "対応中",
    "statusResolved": "解決済"
  }
}
```

### 4. 複数形の処理

必要に応じて複数形を別のキーとして定義：

```json
{
  "messages": {
    "itemCount": "{{count}}件のアイテム",
    "itemCountSingular": "1件のアイテム",
    "itemCountPlural": "{{count}}件のアイテム"
  }
}
```

## トラブルシューティング

### 翻訳が表示されない

1. ブラウザコンソールでエラーを確認
2. 翻訳ファイルのパスが正しいか確認
3. JSONファイルの構文が正しいか確認
4. キー名が正確か確認

### 言語が切り替わらない

1. `changeLanguage()` が正しく呼び出されているか確認
2. ページのリロードが必要な場合がある
3. `updatePageContent()` が呼び出されているか確認

### バックエンドで翻訳が動作しない

1. i18nミドルウェアが有効化されているか確認
2. Accept-Languageヘッダーが送信されているか確認
3. `req.t()` が正しく使用されているか確認

## パフォーマンス考慮事項

### 翻訳ファイルのサイズ

- 翻訳ファイルは必要に応じて分割可能
- 大規模アプリケーションでは遅延読み込みを検討

### キャッシュ

- i18nextは内部的に翻訳をキャッシュ
- ブラウザの言語設定はlocalStorageに保存

### CDN使用

- i18nextはCDNから読み込み（本番環境推奨）
- ローカルバンドルも可能

## セキュリティ

### XSS対策

- 翻訳文字列はDOM APIを使用して安全に挿入
- `innerHTML`は使用しない
- ユーザー入力を翻訳パラメータとして使用する場合は適切にエスケープ

### 入力検証

- 翻訳パラメータは常に検証
- 信頼できないソースからの入力は適切にサニタイズ

## リファレンス

### i18n.js API

#### 関数

- `i18nInit()` - i18nextを初期化
- `changeLanguage(lang)` - 言語を変更
- `getCurrentLanguage()` - 現在の言語を取得
- `t(key, params)` - 翻訳を取得
- `updatePageContent()` - ページコンテンツを更新
- `createLanguageSwitcher()` - 言語切り替えUIを作成
- `formatDate(date, options)` - 日付をフォーマット
- `formatNumber(number, options)` - 数値をフォーマット

#### 定数

- `SUPPORTED_LANGUAGES` - サポートされている言語のリスト
- `LANGUAGE_NAMES` - 言語名のマッピング

### バックエンドi18n API

#### ミドルウェア

- `i18nMiddleware` - Express ミドルウェア

#### 関数

- `translate(language, key, params)` - 特定言語の翻訳を取得
- `parseAcceptLanguage(header)` - Accept-Languageヘッダーをパース

#### リクエストオブジェクトプロパティ

- `req.language` - リクエストの言語
- `req.t(key, params)` - 翻訳関数

## サンプルコード

### コンポーネントでの使用例

```javascript
function createIncidentForm() {
  const form = createEl('form');

  // ラベル
  const titleLabel = createEl('label', {
    textContent: t('incidents.subject')
  });

  // ボタン
  const saveBtn = createEl('button', {
    className: 'btn-primary',
    textContent: t('common.save')
  });

  // エラーメッセージ
  if (error) {
    Toast.error(t('errors.validationError'));
  }

  // 成功メッセージ
  if (success) {
    Toast.success(t('incidents.incidentCreated'));
  }

  return form;
}
```

### API呼び出しでの使用例

```javascript
async function createIncident(data) {
  try {
    const response = await fetch('/api/v1/incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept-Language': getCurrentLanguage()
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    Toast.success(result.message);
  } catch (error) {
    Toast.error(t('errors.networkError'));
  }
}
```

## まとめ

ITSM-Sec Nexusのi18n実装により、グローバルユーザーへの対応が可能になりました。このガイドに従って、新しい言語の追加や翻訳の管理を行ってください。

---

**関連ドキュメント:**
- [開発者ガイド](開発者ガイド.md)
- [フロントエンド開発](フロントエンド開発.md)
- [API仕様書](http://localhost:5000/api-docs)
