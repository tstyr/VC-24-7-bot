# VC 24/7 Bot + Dashboard

Discord.js v14のボットとNext.jsのダッシュボードをまとめた構成です。音楽再生、VC滞在、osu!関連機能、通話ログ表示を扱います。

## 機能

### Discord Bot
- 24時間VC滞在
- Lavalink経由の音楽再生
- `/play`で検索・選曲（Select Menu）
- Embed操作パネル（スキップ、一時停止、リピート）
- 通話ログの保存
- osu!連携と各種コマンド（成長、プロフィール、ランキングなど）
- リアルタイムスコア通知
- 日次プレイ履歴（DM/チャンネル送信）
- 週次レポート、成長アラート
- **YouTube動画/音声ダウンロード機能**
  - yt-dlpを使用してYouTube動画をダウンロード
  - ユーザーごとにmp4/m4a形式を設定可能
  - 動画品質の選択（720p、1080p等）

### Webダッシュボード
- 通話ログの一覧表示
- フィルタとページング
- Next.js + Tailwind CSS

## 構成

```
Discord Bot (Koyeb) ←→ PostgreSQL (Supabase/Neonなど) ←→ Dashboard (Vercel)
         ↓
    Lavalink
```

## 必要な環境

### Bot
- Node.js 20以上
- PostgreSQL
- Discord Bot Token
- Lavalinkノード
- osu! APIのClient ID / Client Secret
- Supabaseプロジェクト（osu!連携を使う場合）

### Dashboard
- Node.js 20以上
- PostgreSQL

## セットアップ

### 1. PostgreSQLの準備

Botは起動時に必要なテーブルを自動作成します。Dashboard側の通話ログ用テーブルは手動で作成してください。

```sql
CREATE TABLE IF NOT EXISTS voice_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  guild_id VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  action VARCHAR(16) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_logs_timestamp
  ON voice_logs (timestamp DESC);
```

### 2. Discord Botの設定

```bash
cd bot
npm install
cp .env.example .env
```

`.env`を編集：

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_bot_client_id
GUILD_ID=your_guild_id
VC_CHANNEL_ID=your_voice_channel_id_for_24_7
DATABASE_URL=postgresql://user:password@host:5432/database

OSU_CLIENT_ID=your_osu_client_id
OSU_CLIENT_SECRET=your_osu_client_secret
OSU_API_MAX_CONCURRENCY=2
OSU_API_TIMEOUT_MS=8000
DB_POOL_MAX=5

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

LAVALINK_HOST=lavalink.example.com
LAVALINK_PORT=443
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=true

KOYEB_PUBLIC_DOMAIN=your-app.koyeb.app
PORT=8000

# Cloudflare R2設定（YouTube動画ダウンロード用）
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://your-custom-domain.com
```

### 3. Botの起動（ローカル）

```bash
cd bot
npm start
```

### 4. Dashboardの設定

```bash
cd dashboard
npm install
cp .env.example .env
```

`.env`を編集：

```env
DATABASE_URL=postgresql://user:password@host:5432/database
NEXT_PUBLIC_APP_NAME=VC 24/7 Dashboard
```

### 5. Dashboardの起動（ローカル）

```bash
cd dashboard
npm run dev
```

http://localhost:3000 でアクセスできます。

## デプロイ

### Botのデプロイ（Koyeb）

1. [Koyeb](https://www.koyeb.com/)でアカウント作成
2. GitHubリポジトリを接続
3. 以下の設定でデプロイ
   - Build command: `cd bot && npm install`
   - Run command: `cd bot && npm start`
   - Port: `8000`
4. 環境変数を設定（.envの内容）
   - 特に `KOYEB_PUBLIC_DOMAIN` を設定
5. Health Check設定
   - Path: `/health`
   - Port: `8000`

### Dashboardのデプロイ（Vercel）

1. [Vercel](https://vercel.com/)でアカウント作成
2. GitHubリポジトリを接続
3. 以下の設定でデプロイ
   - Framework Preset: Next.js
   - Root Directory: `dashboard`
4. 環境変数を設定（.envの内容）

## 使い方

1. Discordサーバーでボイスチャンネルに参加
2. `/connect`でボットをVCに参加させる（24時間VC運用時は不要）
3. `/play`で音楽を再生
4. `/osu link` でosu!アカウントを連携
5. `/osu profile`、`/osu recent`、`/osu growth` などを実行
6. Select Menuと操作パネルから音楽再生をコントロール
7. 通話ログは自動的にダッシュボードへ保存されます

全コマンドは [COMMANDS.md](COMMANDS.md) を参照してください。移行期間に旧 `/osu-*`
コマンドも残す場合だけ、`ENABLE_LEGACY_OSU_COMMANDS=true` を設定します。

## 応答速度とヘルスチェック

- 定期収集・リアルタイム監視のosu! API処理は低優先度で実行され、Discordからのコマンドが先に処理されます。
- 同じユーザーへの同時API要求と、言語・連携・ギルド設定の短時間の重複取得はプロセス内でまとめられます。
- `/health` はDiscord接続状態、稼働時間、osu! API待ち行列数をJSONで返します。
- 通常は `.env.example` の値で運用し、API制限が発生する場合は `OSU_API_MAX_CONCURRENCY` を `1` に下げてください。

## トラブルシューティング

### Lavalinkに接続できない

- ノードの稼働状況を確認
- ホスト名、ポート、パスワードを確認

### PostgreSQLに接続できない

- `DATABASE_URL`を確認
- SSL設定が必要な環境では`ssl`が有効か確認

### Botが起動しない

- Node.jsのバージョンを確認（20以上）
- `npm install` を再実行
- ログを確認

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。
