# cc-proxy

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

Claude Code 用の軽量級 LLM プロキシサーバー - Anthropic API リクエストを任意の LLM プロバイダーにルーティングします。

## 機能

- **モデルルーティング**: Claude モデル（haiku、sonnet、opus）を任意のプロバイダーモデルにマッピング
- **負荷分散**: 加重ラウンドロビンで複数プロバイダー間でリクエストを分散
- **マルチプロバイダー**: 複数の LLM プロバイダーを同時サポート
- **フォーマット変換**: Anthropic と OpenAI フォーマット間の自動変換
- **ホットリロード**: 設定変更を自動適用、再起動不要
- **パフォーマンス最適化**: 非同バッチログ記録でオーバーヘッド最小化
- **自動起動**: Shell 統み込み、バックグラウンドで静黙起動
- **並行性安全**: 高並行シナリオ向けスレッドセーフ設計

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
ccp config   # エディターで設定ファイルを開く
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

Claude モデル名をプロバイダーエンドポイントにマッピング。3つの設定フォーマットをサポート：

| パラメータ | 説明 | 例 |
|-----------|------|------|
| `haiku` | 高速/低コストモデルルーティング | `"zp,glm-4.7"` |
| `sonnet` | バランス性能モデルルーティング | `"zp,glm-4.7"` |
| `opus` | 高性能モデルルーティング | `"openrouter,anthropic/claude-opus-4.5"` |
| `image` | 画像生成モデルルーティング | `"zp,glm-4.7"` |

### ルーター設定フォーマット

#### フォーマット 1: 単一プロバイダー（シンプル）

```json
"router": {
  "sonnet": "provider-name,model-name"
}
```

すべてのリクエストが単一のプロバイダーに送信されます。

**構成要素：**
- **プロバイダー名**：プロバイダーの `name` フィールドに一致する必要
- **モデル名**：プロバイダーにリクエストする実際のモデル

**例：**
- `"zp,glm-4.7"`：`zp` プロバイダー使用、`glm-4.7` モデルリクエスト
- `"openrouter,anthropic/claude-opus-4.5"`：OpenRouter 使用、Claude Opus 4.5 リクエスト

#### フォーマット 2: 複数プロバイダー（ラウンドロビン）

```json
"router": {
  "sonnet": [
    "provider-a,model-a",
    "provider-b,model-b"
  ]
}
```

リクエストはローテーションでプロバイダー間に均等分散されます。以下に最適：
- 負荷分散
- コスト最適化
- フェイルオーバーシナリオ

#### フォーマット 3: 加重分散（高度）

```json
"router": {
  "opus": {
    "targets": [
      { "provider": "provider-a", "model": "model-a", "weight": 70 },
      { "provider": "provider-b", "model": "model-b", "weight": 30 }
    ],
    "strategy": "weighted-round-robin"
  }
}
```

重みに基づいてリクエストを分散（70% を provider-a、30% を provider-b へ）。

### 負荷分散戦略

| 戦略 | 説明 | ユースケース |
|------|------|--------------|
| `round-robin` | ターゲットを順番にローテーション | 均等分散、プロバイダーが同様の性能 |
| `weighted-round-robin` | 重みに基づいて分散 | 不均等分散、プロバイダーが異なる容量 |
| `random` | ランダム選択 | 状態追跡なしのシンプルな分散 |

**デフォルト：** 指定がない場合、`round-robin` が使用されます。

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

### 負荷分散設定例

#### シナリオ 1: コスト最適化

大部分のリクエストに安価なプロバイダーを、複雑なタスクにプレミアムプロバイダーを使用：

```json
{
  "providers": [
    {
      "name": "budget",
      "baseUrl": "https://api.budget-llm.com/v1/messages",
      "apiKey": "key1",
      "format": "anthropic"
    },
    {
      "name": "premium",
      "baseUrl": "https://api.anthropic.com/v1/messages",
      "apiKey": "key2",
      "format": "anthropic"
    }
  ],
  "router": {
    "haiku": "budget,model-haiku",
    "sonnet": [
      "budget,model-sonnet",
      "premium,claude-sonnet-4"
    ],
    "opus": {
      "targets": [
        { "provider": "budget", "model": "model-opus", "weight": 80 },
        { "provider": "premium", "model": "claude-opus-4-5-20251101", "weight": 20 }
      ],
      "strategy": "weighted-round-robin"
    }
  }
}
```

#### シナリオ 2: フェイルオーバー設定

プライマリプロバイダーとバックアップ：

```json
{
  "router": {
    "sonnet": [
      "primary,claude-sonnet-4",
      "backup,claude-sonnet-4"
    ]
  }
}
```

リクエストはプライマリとバックアッププロバイダー間で交互に送信されます。

#### シナリオ 3: マルチクラウド分散

複数のクラウドプロバイダー間で分散：

```json
{
  "router": {
    "sonnet": {
      "targets": [
        { "provider": "aws", "model": "claude-sonnet-4", "weight": 40 },
        { "provider": "gcp", "model": "claude-sonnet-4", "weight": 35 },
        { "provider": "azure", "model": "claude-sonnet-4", "weight": 25 }
      ],
      "strategy": "weighted-round-robin"
    }
  }
}
```

40% を AWS、35% を GCP、25% を Azure に分散。

## CLI コマンド

```bash
ccp activate    # 静黙自動起動（Shell 設定用）
ccp start       # 強制再起動して起動
ccp stop        # プロキシサーバーを停止
ccp restart     # プロキシサーバーを再起動
ccp status      # 実行中ステータスを表示
ccp config      # エディターで設定ファイルを開く（zed > vscode > vi）
ccp logs        # サーバーログをリアルタイム表示
ccp help        # ヘルプを表示
```

## Statusline

Claude Code のステータスバーでリアルタイムのトークン追跡とコンテキストウィンドウ監視。

### 出力例

```
[claude-sonnet-4-5] | 18% (実際 29%) | 37k tokens | main ✓ | ⚠️ 85% 週制限
```

### 機能

- **モデル名**: 現在の Claude モデル
- **コンテキスト使用率**: Claude の % + 実際のプロバイダーの %（異なる場合）
- **トークン数**: セッショントークン消費量
- **Git ステータス**: ブランチ名とクリーン/ダーティインジケーター
- **週制限警告**: プロバイダー制限に近づくと表示（≥70%）

### 設定

#### 1. プロバイダーにモデル情報を追加

`~/.claude-code-proxy/config.json` を編集：

```json
{
  "providers": [
    {
      "name": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
      "apiKey": "your-key",
      "format": "openai",
      "info": {
        "anthropic/claude-sonnet-4": {
          "contextRange": "200K",
          "weeklyLimit": {
            "maxInputTokens": 500000,
            "maxOutputTokens": 200000,
            "enabled": true
          }
        }
      }
    }
  ]
}
```

**Info フィールド：**
- `contextRange`: モデルのコンテキストウィンドウサイズ（例：`"200K"`、`"128K"`、`"1M"`）
- `weeklyLimit`: オプションの週次トークン制限
  - `maxTotalTokens`: 総トークン制限
  - `maxInputTokens`: 入力トークン制限
  - `maxOutputTokens`: 出力トークン制限
  - `enabled`: 追跡の有効/無効（デフォルト：true）

#### 2. config.json で Statusline を有効化

```json
{
  "statusline": {
    "enabled": true,
    "sessionRetentionHours": 24
  }
}
```

#### 3. Claude Code を設定

`~/.claude/settings.json` に追加：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash -c '~/.bun/bin/bun /path/to/cc-proxy/src/statusline/index.ts'"
  }
}
```

**正しいパスを取得：**
```bash
echo "bash -c '\"$(which bun)\" \"$(pwd)/src/statusline/index.ts\"'"
```

#### 4. プロキシを再起動

```bash
ccp restart
```

### CLI コマンド

```bash
# 現在のステータスを表示
ccp statusline

# 出力をテスト
echo '{"model":{"display_name":"test"},"context_window":{"used_percentage":50}}' | ccp statusline

# 詳細統計を表示
curl http://127.0.0.1:3457/statusline

# セッショントークンをリセット
curl -X POST http://127.0.0.1:3457/session/reset
```

### 一般的なモデルのコンテキストウィンドウ設定

```json
{
  "anthropic/claude-opus-4-5-20251101": { "contextRange": "200K" },
  "anthropic/claude-sonnet-4-5-20250929": { "contextRange": "200K" },
  "anthropic/claude-haiku-4-5-20251001": { "contextRange": "200K" },
  "gpt-4o": { "contextRange": "128K" },
  "gpt-4-turbo": { "contextRange": "128K" },
  "glm-4": { "contextRange": "128K" },
  "glm-5": { "contextRange": "200K" },
  "deepseek-chat": { "contextRange": "64K" }
}
```

### データ保存

- **データベース**: `~/.claude-code-proxy/data/statusline.db` (SQLite)
- **セッションデータ**: 24 時間後に自動クリーンアップ
- **週次統計**: ISO 週境界で自動リセット

詳細なドキュメントは [STATUSLINE.md](STATUSLINE.md) を参照してください。

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
- **並行性安全**: スレッドセーフな負荷分散と分離されたリクエストコンテキスト

agent-swarm シナリオで 100+ 並発リクエストを処理可能。

### 並行性安全性

負荷分散は高並行ユースケースで安全です：

- ✅ **複数ターミナル**: 並行ターミナルセッション間での干渉なし
- ✅ **複数タブセッション**: クロスセッション汚染なし
- ✅ **複数サブエージェント**: 変更はリクエストごとに分離
- ✅ **スレッドセーフカウンター**: 負荷分散器が正確な分散を維持

各リクエストは分離されたコンテキストオブジェクトを受け取り、プロバイダー設定は不変のままです。

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
