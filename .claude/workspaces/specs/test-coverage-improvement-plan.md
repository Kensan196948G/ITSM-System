# テストカバレッジ向上計画

## 📊 現状分析

### 現在のカバレッジ
- **総合カバレッジ**: 47.08%
- **目標カバレッジ**: 70%
- **必要な向上**: +22.92%

### 現在のテスト数
- Unit Tests: 約14ファイル
- Integration Tests: 18ファイル
- E2E Tests: 6ファイル
- **合計**: 45テストファイル / 279テストケース

### テスト対象ファイル数
| カテゴリ | ファイル数 | 推定カバレッジ |
|---------|----------|---------------|
| Services | 13 | 40% |
| Middleware | 12 | 55% |
| Routes | 21 | 45% |

---

## 🎯 優先度別テスト追加計画

### Phase 1: 高優先度（即時対応）

#### 1.1 Services テスト追加（目標: +8%カバレッジ）

| ファイル | 現状 | 追加テスト |
|---------|------|-----------|
| `threatDetectionService.js` | 未テスト | 脅威検知ロジック、アラート生成 |
| `pdfReportService.js` | 未テスト | PDF生成、テンプレート処理 |
| `notificationService.js` | 部分テスト | 全通知タイプ、エラーハンドリング |
| `schedulerService.js` | 未テスト | ジョブスケジューリング、実行確認 |

**推定作業量**: 20テストケース追加

#### 1.2 Middleware テスト追加（目標: +5%カバレッジ）

| ファイル | 現状 | 追加テスト |
|---------|------|-----------|
| `metrics.js` | 未テスト | Prometheusメトリクス記録 |
| `i18n.js` | 未テスト | 言語切替、翻訳取得 |
| `userActivity.js` | 未テスト | アクティビティ記録、追跡 |
| `errorHandler.js` | 部分テスト | 全エラータイプのハンドリング |

**推定作業量**: 15テストケース追加

### Phase 2: 中優先度（1週間以内）

#### 2.1 Routes テスト追加（目標: +7%カバレッジ）

| ファイル | 現状 | 追加テスト |
|---------|------|-----------|
| `webhooks.js` | 未テスト | Webhook送受信、署名検証 |
| `m365.js` | 未テスト | M365連携、認証フロー |
| `integrations.js` | 部分テスト | 外部連携、エラーハンドリング |
| `reports.js` | 部分テスト | レポート生成、フィルタリング |

**推定作業量**: 25テストケース追加

#### 2.2 E2E テスト追加（目標: +3%カバレッジ）

| シナリオ | 追加テスト |
|---------|-----------|
| セキュリティダッシュボード | 全ウィジェット表示、データ更新 |
| SLAモニタリング | アラート生成、通知フロー |
| 監査ログ | ログ記録、エクスポート |

**推定作業量**: 10テストケース追加

### Phase 3: 低優先度（2週間以内）

#### 3.1 エッジケーステスト追加

- 境界値テスト
- 異常系テスト
- 同時実行テスト
- パフォーマンステスト

**推定作業量**: 15テストケース追加

---

## 📋 実装計画

### Week 1: Phase 1 実施
```
Day 1-2: threatDetectionService テスト
Day 3-4: pdfReportService テスト
Day 5: notificationService テスト追加
```

### Week 2: Phase 2 実施
```
Day 1-2: Middleware テスト追加
Day 3-4: Routes テスト追加
Day 5: E2E テスト追加
```

### Week 3: Phase 3 実施
```
Day 1-3: エッジケーステスト
Day 4-5: カバレッジレポート確認、調整
```

---

## 🧪 テスト作成ガイドライン

### 必須テストパターン

1. **正常系テスト**
   - 期待される入力での動作確認
   - 戻り値の検証

2. **異常系テスト**
   - 不正入力でのエラーハンドリング
   - 例外のスロー確認

3. **境界値テスト**
   - 最小値/最大値での動作
   - 空値/null値での動作

4. **権限テスト**
   - 認証なしアクセス拒否
   - 権限不足でのアクセス拒否

### テストファイル命名規則
```
backend/__tests__/unit/<category>/<filename>.test.js
backend/__tests__/integration/<feature>.test.js
backend/__tests__/e2e/<scenario>.e2e.test.js
```

### テストケース命名規則
```javascript
describe('機能名', () => {
  describe('メソッド名', () => {
    it('should 期待される動作 when 条件', async () => {
      // テスト実装
    });
  });
});
```

---

## 📈 期待される成果

### カバレッジ目標達成
| フェーズ | 追加テスト数 | カバレッジ向上 | 累計カバレッジ |
|---------|-------------|---------------|---------------|
| 開始時 | 0 | 0% | 47% |
| Phase 1 | 35 | +13% | 60% |
| Phase 2 | 35 | +8% | 68% |
| Phase 3 | 15 | +4% | **72%** |

### 品質向上効果
- バグ検出率向上
- リグレッション防止
- コードリファクタリング安全性向上
- CI/CD信頼性向上

---

## ✅ チェックリスト

### Phase 1
- [ ] threatDetectionService.test.js 作成
- [ ] pdfReportService.test.js 作成
- [ ] notificationService.test.js 追加
- [ ] schedulerService.test.js 作成
- [ ] metrics.test.js 作成
- [ ] i18n.test.js 作成
- [ ] userActivity.test.js 作成
- [ ] errorHandler.test.js 追加

### Phase 2
- [ ] webhooks.test.js 作成
- [ ] m365.test.js 作成
- [ ] integrations.test.js 追加
- [ ] reports.test.js 追加
- [ ] security-dashboard.e2e.test.js 追加
- [ ] sla-monitoring.e2e.test.js 作成
- [ ] audit-log.e2e.test.js 作成

### Phase 3
- [ ] 境界値テスト追加
- [ ] 異常系テスト追加
- [ ] 同時実行テスト追加
- [ ] カバレッジレポート確認
- [ ] 70%カバレッジ達成確認

---

## 🔧 テスト実行コマンド

```bash
# 全テスト実行
npm test

# カバレッジ付きテスト実行
npm run test:coverage

# 特定のテストファイル実行
npm test -- backend/__tests__/unit/services/threatDetectionService.test.js

# カバレッジレポート確認
open coverage/lcov-report/index.html
```

---

*作成日: 2026-01-25*
*担当SubAgent: test-designer*
*レビュー: code-reviewer*
