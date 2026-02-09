# フロントエンドモジュール化 POC

このディレクトリには、フロントエンドモジュール化の概念実証（POC）実装が含まれています。

## POC の内容

### 作成されたモジュール

```
frontend/
├── config/
│   └── constants.js         ✅ 定数定義（API_BASE, トークンキー等）
├── core/
│   └── api-client.js        ✅ API通信クライアント
├── shared/
│   ├── ui/
│   │   ├── toast.js         ✅ Toast通知システム
│   │   └── dom-utils.js     ✅ DOM操作ユーティリティ
└── features/
    └── dashboard/
        └── kpi-cards.js     ✅ KPIカード表示モジュール
```

### モジュールの説明

#### 1. config/constants.js
- **責務**: アプリケーション全体で使用する定数を定義
- **内容**: API_BASE, トークンキー, Chart色定義, NIST CSF設定等
- **元の位置**: app.js の 9-25行 + 各所に散在していた定数

#### 2. core/api-client.js
- **責務**: 認証付きAPIクライアント（fetch wrapper）
- **内容**: GET/POST/PUT/DELETE メソッド、JWT自動付加、401エラーハンドリング
- **元の位置**: app.js の 928-999行
- **特徴**:
  - クラスベース設計
  - シングルトンパターン
  - エラーハンドリング統一

#### 3. shared/ui/toast.js
- **責務**: Toastify.js のラッパー
- **内容**: success, error, warning, info メソッド
- **元の位置**: app.js の 85-155行
- **特徴**:
  - 静的メソッドで使いやすく
  - Toastify未ロード時のフォールバック

#### 4. shared/ui/dom-utils.js
- **責務**: XSS対策済みのDOM操作関数
- **内容**: createEl, setText, createBadge, createLoadingSpinner等
- **元の位置**: app.js の 159-230行
- **特徴**:
  - innerHTML を使わない（XSS対策）
  - textContent で安全にテキスト設定

#### 5. features/dashboard/kpi-cards.js
- **責務**: ダッシュボードのKPIカード表示
- **内容**: renderKpiCards 関数、createKpiCard 関数
- **元の位置**: app.js の 1558-1737行
- **特徴**:
  - 6つのKPIカード（インシデント、変更、脆弱性、SLA、ナレッジ、資産）
  - ホバーアニメーション付き

## 使用方法

### 1. 従来の使い方（グローバル変数）

```javascript
// app.js（既存コード）
Toast.success('保存しました');
const card = createEl('div', { textContent: 'Hello' });
```

→ **互換性維持のため、グローバル変数としても公開されています**

### 2. 推奨される使い方（ES Modules）

```javascript
// 新規コード（推奨）
import { Toast } from './shared/ui/toast.js';
import { createEl } from './shared/ui/dom-utils.js';

Toast.success('保存しました');
const card = createEl('div', { textContent: 'Hello' });
```

## 次のステップ

### Phase 1: 基盤整備（残タスク）

- [ ] core/auth.js 実装（ログイン、2FA、トークン更新）
- [ ] core/router.js 実装（ビュー切り替え）
- [ ] core/state.js 実装（グローバル状態管理）
- [ ] shared/ui/modal.js 実装（モーダル基本機能）
- [ ] shared/utils/date-utils.js 実装（日付フォーマット）
- [ ] Vite導入（vite.config.js作成）
- [ ] Vitest導入（ユニットテスト環境構築）

### Phase 2: パイロット移行

- [ ] features/dashboard/index.js 実装（メイン）
- [ ] features/dashboard/charts.js 実装（Chart.js動的インポート）
- [ ] features/dashboard/sla-widget.js 実装（SLAウィジェット）
- [ ] app.js からダッシュボード機能を削除
- [ ] E2Eテストで動作確認

### Phase 3: 本格展開

詳細は `/mnt/LinuxHDD/ITSM-System/Docs/frontend-modularization-design.md` を参照

## テスト

POCモジュールのユニットテスト例:

```javascript
// __tests__/shared/ui/toast.test.js
import { Toast } from '../../../shared/ui/toast.js';

describe('Toast', () => {
  test('should call Toastify.showToast', () => {
    const mockToastify = jest.fn(() => ({ showToast: jest.fn() }));
    global.Toastify = mockToastify;

    Toast.success('Test message');

    expect(mockToastify).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Test message',
        duration: 3000
      })
    );
  });
});
```

## 互換性

### 後方互換性の維持

全てのモジュールは、既存コード（app.js）との互換性を保つため、以下の対策を実施:

1. **グローバル変数として公開**
   ```javascript
   // 各モジュールの末尾
   if (typeof window !== 'undefined') {
     window.Toast = Toast;
     console.warn('Toast: グローバル変数は非推奨です。import を使用してください');
   }
   ```

2. **動的インポートによる遅延ロード**
   ```javascript
   // 循環依存回避のため、必要時に動的インポート
   const { handleUnauthorized } = await import('./auth.js');
   ```

3. **段階的移行**
   - 既存の app.js はそのまま残す
   - 新規機能からモジュール版を使用
   - 移行完了後に app.js から該当部分を削除

## パフォーマンス改善

### 期待される効果

| 指標 | 現在 | POC完了後 | Phase 4完了後 |
|------|------|----------|-------------|
| app.js サイズ | 633.5KB | 600KB | 200KB |
| 初期ロード時間 | 5.0秒 | 4.5秒 | 2.0秒 |
| 初期JSダウンロード | 633.5KB | 500KB | 150KB |

### Code Splitting の例

```javascript
// Dynamic Import でChart.jsを遅延ロード
const renderCharts = async () => {
  const Chart = await import('chart.js/auto').then(m => m.default);
  // Chart.js を使った処理
};
```

## トラブルシューティング

### Q1. モジュールをインポートするとエラーが出る

```
Uncaught SyntaxError: Cannot use import statement outside a module
```

**解決策**: HTMLで `<script type="module">` を使用

```html
<script type="module" src="app.js"></script>
```

### Q2. Viteなしで動作確認したい

**解決策**: ローカルサーバーで実行（file:// プロトコルは不可）

```bash
# Python 3
python3 -m http.server 8000

# Node.js (http-server)
npx http-server -p 8000
```

### Q3. 既存のapp.jsとの統合方法は?

**解決策**: app.js の先頭でモジュールをインポート

```javascript
// app.js（移行期間中）
import { Toast } from './shared/ui/toast.js';
import { apiClient } from './core/api-client.js';

// グローバル変数として公開（既存コードとの互換性）
window.Toast = Toast;
window.apiClient = apiClient;

// 以降、既存のコード...
```

## 参考資料

- [設計書](../Docs/frontend-modularization-design.md)
- [Vite公式ドキュメント](https://vitejs.dev/)
- [ES Modules 入門](https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Modules)

## フィードバック

POCに関する質問・提案は GitHub Issues へ
