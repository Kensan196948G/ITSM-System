# 📊 Claude Code Statusline 設定ガイド

このプロジェクトでは、[ccstatusline](https://github.com/sirmalloc/ccstatusline) を使用してClaude Codeのステータスラインをカスタマイズしています。

## 🎨 現在の表示内容

Statuslineは **3行** で構成されています：

### 📍 1行目: 基本情報
- **🤖 モデル名** (cyan) - 現在使用中のClaudeモデル
- **📁 カレントディレクトリ** (yellow) - 作業中のディレクトリ名
- **🌿 Gitブランチ** (green) - 現在のブランチ名

### 📊 2行目: リソース情報
- **📈 コンテキスト使用率** (magenta) - コンテキストウィンドウの使用割合
- **🔢 総トークン数** (blue) - 現在のセッションで使用したトークン数
- **💰 セッションコスト** (yellow) - APIコストの累計（USD）

### ⏱️ 3行目: アクティビティ情報
- **⏰ セッション時間** (cyan) - セッション開始からの経過時間
- **🔄 Git変更** (red) - 未コミットの変更ファイル数

---

## ⚙️ 設定ファイルの場所

### グローバル設定
```
~/.config/ccstatusline/settings.json
```
このファイルで表示するウィジェットとレイアウトを設定します。

### Claude Code設定
```
.claude/settings.local.json
```
プロジェクト固有のstatusline設定が含まれています。

---

## 🎯 カスタマイズ方法

### 対話型設定ツールの使用

ターミナルで以下のコマンドを実行すると、対話型UIが起動します：

```bash
npx ccstatusline@latest --configure
```

または、設定ファイルを直接編集することもできます。

### 利用可能なウィジェット一覧

| ウィジェット名 | 説明 | 例 |
|---|---|---|
| **ModelName** | 使用中のモデル名 | "Sonnet 4.5" |
| **GitBranch** | 現在のGitブランチ | "main" |
| **GitChanges** | 未コミットの変更数 | "M: 5, A: 2" |
| **CurrentWorkingDirectory** | カレントディレクトリ | "ITSM-System" |
| **SessionClock** | セッション経過時間 | "15:32" |
| **SessionCost** | APIコスト | "$0.123" |
| **ContextPercentage** | コンテキスト使用率 | "45%" |
| **TokensInput** | 入力トークン数 | "8500" |
| **TokensOutput** | 出力トークン数 | "1200" |
| **TokensTotal** | 総トークン数 | "9700" |
| **BlockTimer** | 最後のブロックからの経過時間 | "2m 30s" |
| **Version** | Claude Codeのバージョン | "v1.2.3" |
| **CustomText** | カスタムテキスト | 任意のテキスト |
| **CustomCommand** | コマンド実行結果 | `git status` の出力など |

### 色のカスタマイズ

各ウィジェットで使用できる色：

- `black`, `red`, `green`, `yellow`
- `blue`, `magenta`, `cyan`, `white`
- `gray`, `brightRed`, `brightGreen`, `brightYellow`
- `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite`

---

## 🔧 トラブルシューティング

### Statuslineが表示されない場合

1. **Node.jsがインストールされているか確認**
   ```bash
   node --version
   ```
   バージョン14.0.0以上が必要です。

2. **設定ファイルのJSON構文を確認**
   ```bash
   cat ~/.config/ccstatusline/settings.json | jq .
   ```

3. **npxが正しく動作するか確認**
   ```bash
   echo '{"model":{"id":"test"}}' | npx ccstatusline@latest
   ```

### 表示が崩れる場合

1. **ターミナルの幅を広げる**
   - `flexMode` 設定により、ターミナル幅に応じて自動調整されます

2. **colorLevel を調整**
   - `colorLevel: 0` - 色なし
   - `colorLevel: 1` - 基本色のみ
   - `colorLevel: 2` - フルカラー（デフォルト）

---

## 📝 設定例

### シンプルな1行表示

```json
{
  "version": 3,
  "lines": [
    [
      {"id": "model", "type": "ModelName", "fgColor": "cyan"},
      {"id": "sep", "type": "Separator", "text": " | "},
      {"id": "dir", "type": "CurrentWorkingDirectory", "fgColor": "yellow"}
    ]
  ],
  "colorLevel": 2
}
```

### Powerline風のスタイリッシュ表示

```json
{
  "version": 3,
  "lines": [
    [
      {"id": "model", "type": "ModelName", "fgColor": "cyan", "bold": true}
    ]
  ],
  "powerline": {
    "enabled": true,
    "leftCap": "",
    "rightCap": "",
    "separator": ""
  },
  "inheritSeparatorColors": true
}
```

---

## 🚀 さらに詳しく

公式ドキュメント: https://github.com/sirmalloc/ccstatusline

---

*このstatusline設定は、Claude Codeセッション中のメトリクスをリアルタイムで可視化し、効率的な開発をサポートします。*
