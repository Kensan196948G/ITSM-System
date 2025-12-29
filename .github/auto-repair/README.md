# 自動修復状態管理

このディレクトリは GitHub Actions の自動修復ループの状態を管理します。

## ファイル構成

### state.json

ワークフロー間で状態を保持するためのファイルです。

```json
{
  "retry_needed": false,        // 再試行が必要かどうか
  "total_runs": 0,              // 累計実行回数
  "last_error": null,           // 最後のエラーメッセージ
  "last_success": null,         // 最後の成功日時
  "consecutive_failures": 0     // 連続失敗回数
}
```

## 状態遷移

### 初期状態
- `retry_needed`: false
- すべてのカウンターがゼロ

### 修復失敗時（15回試行後）
- `retry_needed`: true
- `last_error`: エラーメッセージを記録
- `consecutive_failures`: +1

### 修復成功時
- `retry_needed`: false
- `last_success`: 現在時刻を記録
- `consecutive_failures`: 0にリセット

### 再実行時（30分後）
- `state.json`を読み取り
- `retry_needed === true` なら修復ループを再開
- `retry_needed === false` なら何もせず終了

## 注意事項

- このファイルは Git で管理されます
- ワークフローが自動的に更新します
- 手動編集は推奨されません
