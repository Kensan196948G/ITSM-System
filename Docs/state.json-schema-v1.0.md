# state.json 正式スキーマ定義（ClaudeCode＋GitHub Actions 自動修復ループ用）

本ドキュメントは、**ClaudeCode（Linuxネイティブ）＋ GitHub Actions** による
自動エラー修復ループ運用において使用する **state.json の正式仕様**を定義する。

本ファイルは、**Run と Run の間で状態を引き継ぐ唯一の情報源**であり、
GitHub Actions の判断ロジックは本ファイルのみを参照する。

---

## 1. 基本設計方針

* JSON は **人が読めること**を最優先とする
* GitHub Actions から `jq` 等で安全に参照できる構造とする
* ClaudeCode は **読み取り専用**（原則）
* 書き込み責任は GitHub Actions 側が持つ
* 拡張を前提とした設計とする

---

## 2. ファイル配置

```text
.github/auto-repair/state.json
```

---

## 3. スキーマ全体（最新版 v1.0）

```json
{
  "schema_version": "1.0",
  "retry": {
    "need_retry": true,
    "current_run": 2,
    "max_runs": 10,
    "last_run_result": "test_failed",
    "last_failure_type": "unit_test"
  },
  "loop": {
    "max_attempts_per_run": 15,
    "attempts_used": 15
  },
  "timestamps": {
    "first_failed_at": "2025-01-29T09:10:00Z",
    "last_failed_at": "2025-01-29T09:45:00Z",
    "last_success_at": null
  },
  "meta": {
    "workflow": "auto-repair",
    "branch": "main",
    "note": "Auto repair in progress"
  }
}
```

---

## 4. 各フィールド詳細

### 4.1 schema_version

| 項目 | 内容                    |
| -- | --------------------- |
| 型  | string                |
| 必須 | Yes                   |
| 説明 | state.json のスキーマバージョン |
| 例  | "1.0"                 |

---

### 4.2 retry オブジェクト（Run 制御）

#### retry.need_retry

| 項目 | 内容         |
| -- | ---------- |
| 型  | boolean    |
| 必須 | Yes        |
| 説明 | 再試行が必要かどうか |
| 値  | true / false |

**制御ロジック**:
- `true`: 次回のschedule実行時に修復ループを再実行
- `false`: 次回のschedule実行時は何もしない

---

#### retry.current_run

| 項目 | 内容                 |
| -- | ------------------ |
| 型  | number             |
| 必須 | Yes                |
| 説明 | これまでに実行された Run の回数 |
| 初期値 | 0                  |

**インクリメントタイミング**: 各Run開始時に+1

---

#### retry.max_runs

| 項目 | 内容             |
| -- | -------------- |
| 型  | number         |
| 必須 | Yes            |
| 説明 | 許容される最大 Run 回数 |
| 推奨値 | 10             |

**制御ロジック**:
- `current_run >= max_runs`の場合、自動実行を停止
- 手動実行（`force_run=true`）時は無視される

---

#### retry.last_run_result

| 項目 | 内容                                   |
| -- | ------------------------------------ |
| 型  | string                               |
| 必須 | Yes                                  |
| 値例 | success / test_failed / build_failed / none |
| 説明 | 最後のRun実行結果 |

**値の定義**:
- `success`: 修復成功、全テスト通過
- `test_failed`: テスト失敗
- `build_failed`: ビルド失敗
- `none`: 未実行

---

#### retry.last_failure_type

| 項目 | 内容           |
| -- | ------------ |
| 型  | string \| null       |
| 必須 | No           |
| 説明 | 最後に発生した失敗の分類 |
| 値例 | unit_test / integration_test / lint / format |

---

### 4.3 loop オブジェクト（1 Run 内ループ）

#### loop.max_attempts_per_run

| 項目 | 内容                 |
| -- | ------------------ |
| 型  | number             |
| 必須 | Yes                |
| 説明 | 1 Run あたりの最大修復試行回数 |
| 推奨値 | 15                 |

---

#### loop.attempts_used

| 項目 | 内容          |
| -- | ----------- |
| 型  | number      |
| 必須 | Yes         |
| 説明 | 実際に消費した試行回数 |
| 範囲 | 0 〜 max_attempts_per_run |

**更新タイミング**: 各Run終了時

---

### 4.4 timestamps オブジェクト（監査・運用）

| フィールド           | 型 | 説明                 |
| --------------- | -- | ------------------ |
| first_failed_at | string \| null | 初回失敗日時（ISO 8601 UTC） |
| last_failed_at  | string \| null | 直近失敗日時（ISO 8601 UTC） |
| last_success_at | string \| null | 最後に成功した日時（ISO 8601 UTC） |

**形式**: `2025-01-29T09:10:00Z`

**更新ルール**:
- `first_failed_at`: 初回失敗時のみ設定、以降変更しない
- `last_failed_at`: 失敗のたびに更新
- `last_success_at`: 成功時のみ更新

---

### 4.5 meta オブジェクト（補助情報）

| フィールド    | 型 | 説明            |
| -------- | -- | ------------- |
| workflow | string | 対象 Workflow 名（"auto-repair"） |
| branch   | string | 実行対象ブランチ（"main"） |
| note     | string | 自由記述（運用メモ） |

---

## 5. 初期状態の例

```json
{
  "schema_version": "1.0",
  "retry": {
    "need_retry": false,
    "current_run": 0,
    "max_runs": 10,
    "last_run_result": "none",
    "last_failure_type": null
  },
  "loop": {
    "max_attempts_per_run": 15,
    "attempts_used": 0
  },
  "timestamps": {
    "first_failed_at": null,
    "last_failed_at": null,
    "last_success_at": null
  },
  "meta": {
    "workflow": "auto-repair",
    "branch": "main",
    "note": "initialized"
  }
}
```

---

## 6. 状態遷移図

```
[初期状態]
   need_retry: false
   current_run: 0
   ↓
[Run #1 開始]
   current_run: 1
   ↓
[テスト失敗]
   need_retry: true
   last_run_result: "test_failed"
   first_failed_at: 設定
   last_failed_at: 設定
   ↓
[30分待機]
   ↓
[Run #2 開始]（schedule実行、need_retry=trueのため）
   current_run: 2
   ↓
[テスト成功]
   need_retry: false
   last_run_result: "success"
   last_success_at: 設定
   ↓
[30分待機]
   ↓
[Run #3 スキップ]（schedule実行、need_retry=falseのため）
```

---

## 7. 運用ルール（重要）

### 7.1 更新責任

* GitHub Actions のみが state.json を更新する
* ClaudeCode は原則として参照のみ
* 手動編集は緊急時のみ

### 7.2 成功時のリセット

* 成功時は `need_retry=false` に必ず戻す
* `current_run`はリセットしない（累計記録として保持）

### 7.3 最大Run回数の制御

* `current_run >= max_runs` の場合は強制停止
* `force_run=true`時は`max_runs`チェックを無視

---

## 8. jq コマンド例

### 8.1 need_retryを読み取る

```bash
NEED_RETRY=$(jq -r '.retry.need_retry' .github/auto-repair/state.json)
```

### 8.2 成功時の状態更新

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
jq --arg now "$NOW" \
   '.retry.need_retry = false |
    .retry.last_run_result = "success" |
    .timestamps.last_success_at = $now' \
   state.json > state.json.tmp
mv state.json.tmp state.json
```

### 8.3 失敗時の状態更新

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
jq --arg now "$NOW" \
   '.retry.need_retry = true |
    .retry.last_run_result = "test_failed" |
    .retry.last_failure_type = "unit_test" |
    .timestamps.last_failed_at = $now' \
   state.json > state.json.tmp
mv state.json.tmp state.json
```

### 8.4 Run回数をインクリメント

```bash
jq '.retry.current_run += 1' state.json > state.json.tmp
mv state.json.tmp state.json
```

---

## 9. この設計の利点

| 利点 | 説明 |
|------|------|
| **無限ループ防止** | max_runsで上限を設定 |
| **状態の可視化** | JSONで人が読める形式 |
| **監査可能** | timestampsで履歴追跡 |
| **柔軟な制御** | need_retryで実行/スキップ判断 |
| **拡張性** | meta, loopオブジェクトで将来拡張可能 |

---

## 10. トラブルシューティング

### Q1. ループが止まらない

**確認**:
```bash
cat .github/auto-repair/state.json | jq .retry
```

**手動停止**:
```bash
jq '.retry.need_retry = false' state.json > state.json.tmp
mv state.json.tmp state.json
git add .github/auto-repair/state.json
git commit -m "chore: 手動でneed_retryをfalseに設定"
git push
```

### Q2. max_runsに到達した場合

**リセット方法**:
```bash
jq '.retry.current_run = 0' state.json > state.json.tmp
mv state.json.tmp state.json
```

### Q3. 状態を完全リセット

**初期状態に戻す**:
```bash
cat << 'EOF' > .github/auto-repair/state.json
{
  "schema_version": "1.0",
  "retry": {
    "need_retry": false,
    "current_run": 0,
    "max_runs": 10,
    "last_run_result": "none",
    "last_failure_type": null
  },
  "loop": {
    "max_attempts_per_run": 15,
    "attempts_used": 0
  },
  "timestamps": {
    "first_failed_at": null,
    "last_failed_at": null,
    "last_success_at": null
  },
  "meta": {
    "workflow": "auto-repair",
    "branch": "main",
    "note": "initialized"
  }
}
EOF
git add .github/auto-repair/state.json
git commit -m "chore: state.jsonを初期化"
git push
```

---

## 11. バージョン履歴

| バージョン | 日付 | 変更内容 |
|----------|------|---------|
| 1.0 | 2025-12-30 | 初版リリース - retry/loop/timestamps/meta構造 |

---

以上が、ClaudeCode＋GitHub Actions 自動修復ループにおける
**state.json の正式スキーマ定義（v1.0）**である。
