# cc-proxy

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

Claude Code 用の軽量級 LLM プロキシサーバー - Anthropic API リクエストを任意の LLM プロバイダーにルーティングします。

## 機能

- **モデルルーティング**: Claude モデル（haiku、sonnet、opus）を任意のプロバイダーモデルにマッピング
- **マルチプロバイダー**: 複数の LLM プロバイダーを同時サポート
- **フォーマット変換**: Anthropic と OpenAI フォーマット間の自動変換
- **ホットリロード**: 設定変更を自動適用、再起動不要
- **パフォーマンス最適化**: 非同バッチログ記録でオーバーヘッド最小化
- **自動起動**: Shell 統み込み、バックグラウンドで静黙起動

## インストール

### オプション 1: Bun グローバルインストール（推奨）

```bash
# npm からインストール
bun install -g cc-proxy

# またはローカルソースから
cd cc-proxy
bun link
```

これにより `ccp` コマンドがグローバルにインストールされます：

```bash
ccp start    # プロキシサーバーを起動
ccp status   # ステータス確認
ccp logs     # ログ表示
ccp help     # すべてのコマンドを表示
```

Shell 起動時に自動起動するため、`~/.zshrc` または `~/.bashrc` に追加：

```bash
eval "$(ccp activate)"
```

### オプション 2: 手動セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/your-username/cc-proxy.git
cd cc-proxy

# 依存関係をインストール
bun install

# 設定を初期化
bun run init
```

## クイックスタート

### 1. 設定の初期化

```bash
bun run init
```

これにより作成されます：
- `~/.claude-code-proxy/` ディレクトリ構造
- デフォルトの設定ファイル
- ログディレクトリ

### 2. プロバイダーの設定

設定ファイルを編集：

```bash
~/.claude-code-proxy/config.json
```

### 3. サーバーの起動

```bash
# ccp コマンド使用（グローバルインストール場合）
ccp start

# または bun 使用
bun start
```


## 構成リファレンス

### 完全な構造

```json
{
  "server": {
    "port": 3457,
    "host": "127.0.0.1"
  },
  "logging": {
    "enabled": true,
    "level": "verbose",
    "dir": "~/.claude-code-proxy/logs"
  },
  "providers": [
    {
      "name": "zp",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-api-key",
      "format": "anthropic"
    }
  ],
  "router": {
    "haiku": "zp,glm-4.7",
    "sonnet": "zp,glm-4.7",
    "opus": "zp,glm-4.7",
    "image": "zp,glm-4.7"
  }
}
```

### パラメータ

#### `server`

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|------------|------|
| `port` | number | `3457` | プロキシサーバーのポート番号 |
| `host` | string | `"127.0.0.1"` | バインドするホストアドレス |

#### `logging`

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|------------|------|
| `enabled` | boolean | `true` | ログの有効/無効 |
| `level` | string | `"verbose"` | ログレベル：`"basic"`、`"standard"`、`"verbose"` |
| `dir` | string | `"~/.claude-code-proxy/logs"` | ログファイル保存先 |

#### `providers`

プロバイダー設定配列。各プロバイダーオブジェクト：

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|--------|------|
| `name` | string | ✅ はい | プロバイダーの一意識別子（ルーティングで使用） |
| `baseUrl` | string | ✅ はい | API エンドポイント URL |
| `apiKey` | string | ✅ はい | API 認証キー |
| `format` | string | いいえ | API フォーマット：`"anthropic"`、`"openai"`、または省略（pass-through） |

**フォーマット種類：**
- `"anthropic"`：Anthropic 互換ヘッダーを使用（x-api-key, anthropic-version）
- `"openai"`：OpenAI フォーマットに変換（Authorization: Bearer）
- 省略：Pass-through モード（元のヘッダーを転送、API キーのみ置換）

#### `router`

Claude モデル名をプロバイダーエンドポイントにマッピング。

形式：`"<claude-model>": "<provider-name>,<actual-model-name>"`

| パラメータ | 説明 | 例 |
|-----------|------|------|
| `haiku` | 高速/低コストモデルルーティング | `"zp,glm-4.7"` |
| `sonnet` | バランス性能モデルルーティング | `"zp,glm-4.7"` |
| `opus` | 高性能モデルルーティング | `"openrouter,anthropic/claude-opus-4.5"` |
| `image` | 画像生成モデルルーティング | `"zp,glm-4.7"` |

### ルーティング構文

```json
"router": {
  "haiku": "provider-name,model-name"
}
```

**構成要素：**
- **プロバイダー名**：プロバイダーの `name` フィールドに一致する必要
- **モデル名**：プロバイダーにリクエストする実際のモデル

**例：**
- `"zp,glm-4.7"`：`zp` プロバイダー使用、`glm-4.7` モデルリクエスト
- `"openrouter,anthropic/claude-opus-4.5"`：OpenRouter 使用、Claude Opus 4.5 リクエスト

### 環境変数による上書き

`ANTHROPIC_BASE_URL` からポートを検出可能：

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
```

これにより `server.port` 設定を上書きし、ポート `3456` を使用します。

サバーは：
- `~/.claude-code-proxy/` から設定を読み込み
- `~/.claude-code-proxy/logs/` にログを保存
- 設定ファイルの変更を監視し、ホットリロード

## 設定例

### Zhipu AI（Anthropic フォーマット）

```json
{
  "name": "zp",
  "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
  "apiKey": "your-key",
  "format": "anthropic"
}
```

### OpenRouter（OpenAI フォーマット）

```json
{
  "name": "openrouter",
  "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
  "apiKey": "sk-or-...",
  "format": "openai"
}
```

### 複数プロバイダー設定

```json
{
  "providers": [
    {
      "name": "zp",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-zpai-key"
    },
    {
      "name": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
      "apiKey": "sk-or-..."
    }
  ],
  "router": {
    "haiku": "zp,glm-4.7",
    "sonnet": "zp,glm-4.7",
    "opus": "openrouter,anthropic/claude-opus-4.5"
  }
}
```

## CLI コマンド

```bash
ccp activate    # 静黙自動起動（Shell 設定用）
ccp start       # 強制再起動して起動
ccp stop        # プロキシサーバーを停止
ccp restart     # プロキシサーバーを再起動
ccp status      # 実行中ステータスを表示
ccp logs        # サーバーログをリアルタイム表示
ccp help        # ヘルプを表示
```

## Claude Code 連携

Claude Code で cc-proxy を使用するため、環境変数を設定：

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="routing-key"
```

Shell 起動時に自動起動する場合、`~/.zshrc` に追加：

```bash
eval "$(ccp activate)"
```

## ログ管理

### 最新ログの表示

```bash
# サーバーログ
ccp logs

# リクエストログ（JSONL フォーマット）
tail -f ~/.claude-code-proxy/logs/requests.jsonl | jq '.'
```

### ログのフィルタリング

```bash
# プロバイダーでフィルタ
cat ~/.claude-code-proxy/logs/requests.jsonl | jq 'select(.provider == "zp")'

# タイプでフィルタ
cat ~/.claude-code-proxy/logs/requests.jsonl | jq 'select(.type == "forward")'
cat ~/.claude-code-proxy/logs/requests.jsonl | jq 'select(.type == "response")'
```

## パフォーマンス

高並発シナリオ向けに最適化されています：

- **非同期バッチログ**: 100ms フラッシュ間隔で I/O ブロッキング最小化
- **チャンクごとのログなし**: ストリームングレスホンスでチャンク単位のオーバーヘッドを回避
- **効率的メモリ使用**: 約 100KB バッファ制限
- **グレースフルシャットダウン**: 終了前にログフラッシュ

agent-swarm シナリオで 100+ 並発リクエストを処理可能。

## トラブルシューティング

### サーバーが起動しない

```bash
# 既に実行中か確認
ccp status

# ログを確認
ccp logs

# 強制再起動を試みる
ccp restart
```

### 設定が読み込まれない

```bash
# 設定ファイルの存在を確認
cat ~/.claude-code-proxy/config.json

# 再度初期化
bun run init
```

## ライセンス

MIT
