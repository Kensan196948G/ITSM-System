# 自律CI修復エージェント

## 概要

このディレクトリには、ITSM-Systemの自律CI修復エージェント設定が含まれています。

## ファイル構成

- `hooks.json` - Hook設定ファイル（無限ループ防止機能付き）
- `auto-ci-repair-agent.sh` - 自律CI修復エージェントスクリプト
- `README.md` - このファイル

## 自律CI修復エージェントの仕様

### 目的

- `pnpm test:ci`を自動実行
- エラーを自動検知
- 原因を解析
- コードを安全に修正
- 最大15回まで自動修復を試行

### 実行フロー

```
1. pnpm test:ci 実行
2. エラー検知
3. 原因解析
4. 安全な修正適用
5. 再テスト実行
6. 成功判定 or 次の試行
```

### 制約

- ✅ CI/テスト/ソースコード修正に限定
- ❌ 本番環境・本番データの変更禁止
- ❌ 削除系コマンド禁止
- ⚠️ 設計変更が必要な場合は「人間判断」として整理

### 終了条件

エージェントは以下の条件で自動終了します：

1. **正常終了**: エラーが検知されず、全テストが成功
2. **最大試行到達**: 15回の試行を完了
3. **人間判断必要**: 設計変更が必要な問題を検出

### 出力形式

各試行の開始時：
```
Attempt X/15
```

成功時の出力：
```
✅ すべてのテストが安定して成功しました

💡 スラッシュコマンド実行案:
  - /commit "修正内容"
  - /push

🚀 次の開発ステップ:
  - セキュリティダッシュボード実装
  - レポート機能完成
  - アーキテクチャ改善

📋 要約レポート:
  実施内容: Attempt X で全テスト成功
  残課題: なし
```

### 15回失敗後の動作

15回の試行で修復できなかった場合：

1. 原因を分類して整理
2. 「人間判断が必要な残課題」としてリスト化
3. 30分後に自動再試行（別プロセス）
4. 30分間隔で継続実行

### 使用方法

#### 手動実行

```bash
./.claude/auto-ci-repair-agent.sh
```

#### Hook経由での実行

Hook設定（`hooks.json`）で`enabled: true`に設定すると、Stop hook経由で自動実行されます。

**注意**: 無限ループを防ぐため、デフォルトでは`enabled: false`に設定されています。

### ⚠️ 無限ループ防止の重要性

#### Stop Hookの潜在的リスク

Stop Hookはセッション終了時に実行されるため、以下のような無限ループが発生する可能性があります：

```
1. セッション終了
2. Stop Hook が auto-ci-repair-agent.sh を実行
3. テスト失敗を検出し、コードを修正
4. Git commit & push を実行
5. CI/CDパイプラインが新しいセッションをトリガー
6. 新しいセッションが終了 → 1に戻る (無限ループ)
```

#### 安全な使用方法

**推奨される実行方法**（優先順）:

1. **手動実行**（最も安全）:
   ```bash
   ./.claude/auto-ci-repair-agent.sh
   ```

2. **CI/CDパイプライン統合**:
   - GitHub Actions の workflow_dispatch で手動トリガー
   - 定期実行（scheduled job）として設定

3. **Cron ジョブ**:
   ```bash
   # 毎日深夜2時に実行
   0 2 * * * cd /path/to/ITSM-System && ./.claude/auto-ci-repair-agent.sh
   ```

4. **Hook経由での実行**（非推奨）:
   - `enabled: true` に設定する前に、必ず無限ループ対策を確認
   - テスト環境でのみ使用
   - 本番環境では**絶対に有効化しない**

### トラブルシューティング

#### Stop hookが無限ループする場合

1. **即座に停止**:
   ```bash
   # hooks.jsonのenabledをfalseに設定
   sed -i 's/"enabled": true/"enabled": false/' .claude/hooks.json
   ```

2. セッションを再起動

3. 無限ループの原因を調査:
   - Git コミット履歴を確認
   - CI/CDパイプラインのログを確認
   - auto-ci-repair-agent.sh の実行ログを確認

4. 必要に応じて手動でスクリプトを実行

#### エージェントが終了しない場合

- Ctrl+C で強制終了
- Hook設定の`terminationConditions`を確認
- `ps aux | grep auto-ci-repair` でプロセスを確認し、必要に応じて kill

#### 無限ループからの復旧手順

1. **緊急停止**:
   ```bash
   # すべての実行中のスクリプトを停止
   pkill -f auto-ci-repair-agent.sh
   ```

2. **Hook無効化**:
   ```bash
   # hooks.jsonを編集
   echo '{"hooks":{"Stop":{"enabled":false}},"agents":{...}}' > .claude/hooks.json
   ```

3. **Git履歴の確認**:
   ```bash
   # 最近の自動コミットを確認
   git log --oneline --grep="auto-ci-repair" -20
   ```

4. **必要に応じてロールバック**:
   ```bash
   # 不要なコミットを取り消す
   git reset --hard <commit-hash>
   ```

## 技術スタック

- **パッケージマネージャー**: pnpm（npm経由）
- **テストフレームワーク**: Jest
- **リント**: ESLint + Prettier
- **CI/CD**: GitHub Actions + Auto Healing CI Loop

## 更新履歴

- 2025-12-29: 初版作成（無限ループ防止機能追加）
