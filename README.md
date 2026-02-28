# Discord 音楽＆通話記録Bot + Webダッシュボード

Discord.js v14とLavalinkを使用した音楽再生Bot、およびNext.jsで構築された通話記録ダッシュボードのシステムです。

## 📋 機能

### Discord Bot
- 🎵 24時間VC滞在機能
- 🎶 Lavalink経由の音楽再生
- 🔍 `/play`コマンドで検索・選曲（Select Menu）
- 🎛️ Embed操作パネル（スキップ、一時停止、リピート）
- 📊 通話記録の自動保存

### Webダッシュボード
- 📈 通話記録の表示（テーブル形式）
- 🔄 リアルタイム更新
- 🎨 レスポンシブデザイン（Tailwind CSS）
- 🌙 ダークモード対応

## 🏗️ システム構成

```
Discord Bot (Koyeb) ←→ MongoDB Atlas ←→ Dashboard (Vercel)
         ↓
    Lavalink (公開ノード)
```

## 📦 必要な環境

### Bot
- Node.js 20以上
- MongoDB Atlas（無料プラン可）
- Discord Bot Token
- 公開Lavalinkノード

### Dashboard
- Node.js 20以上
- Vercel アカウント（無料プラン可）

## 🚀 セットアップ

### 1. MongoDB Atlasの準備

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)でアカウント作成
2. 無料クラスターを作成
3. Database Access でユーザーを作成
4. Network Access で `0.0.0.0/0` を許可
5. 接続文字列をコピー

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

# 公開Lavalinkノードの例
LAVALINK_HOST=lavalink.example.com
LAVALINK_PORT=443
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=true

# Koyebデプロイ時の設定（自動停止防止）
KOYEB_PUBLIC_DOMAIN=your-app.koyeb.app
PORT=8000
```

#### 公開Lavalinkノードの例

- `lavalink.devamop.in:443` (パスワード: `DevamOP`)
- `lavalink.oops.wtf:443` (パスワード: `www.freelavalink.ga`)
- `lava.link:80` (パスワード: `anything`)

※公開ノードは不安定な場合があります。本番環境では自前のLavalinkサーバーを推奨します。

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
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/discord-bot
NEXT_PUBLIC_APP_NAME=Discord Bot Dashboard
```

### 5. Dashboardの起動（ローカル）

```bash
cd dashboard
npm run dev
```

http://localhost:3000 でアクセス可能

## 🌐 デプロイ

### Botのデプロイ（Koyeb）

1. [Koyeb](https://www.koyeb.com/)でアカウント作成
2. GitHubリポジトリを接続
3. 以下の設定でデプロイ：
   - Build command: `cd bot && npm install`
   - Run command: `cd bot && npm start`
   - Port: `8000`（ヘルスチェック用）
4. 環境変数を設定（.envの内容）
   - 特に `KOYEB_PUBLIC_DOMAIN` を設定（例: `your-app.koyeb.app`）
5. Health Check設定:
   - Path: `/health`
   - Port: `8000`

注意: `KOYEB_PUBLIC_DOMAIN`を設定すると、5分ごとに自己pingして自動停止を防ぎます。

### Dashboardのデプロイ（Vercel）

1. [Vercel](https://vercel.com/)でアカウント作成
2. GitHubリポジトリを接続
3. 以下の設定でデプロイ：
   - Framework Preset: Next.js
   - Root Directory: `dashboard`
4. 環境変数を設定（.envの内容）

## 📝 使い方

1. Discordサーバーでボイスチャンネルに参加
2. `/play 曲名` で音楽を検索
3. Select Menuから曲を選択
4. 操作パネルのボタンで再生をコントロール
5. 通話記録は自動的にダッシュボードに保存されます

## 🔧 トラブルシューティング

### Lavalinkに接続できない

- 公開ノードのステータスを確認
- ホスト名、ポート、パスワードが正しいか確認
- 別の公開ノードを試す

### MongoDBに接続できない

- 接続文字列が正しいか確認
- Network Accessで `0.0.0.0/0` が許可されているか確認
- ユーザー名とパスワードが正しいか確認

### Botが起動しない

- Node.jsのバージョンを確認（20以上）
- `npm install` を再実行
- ログを確認してエラーメッセージを確認

## 📄 ライセンス

MIT License

## 🤝 貢献

プルリクエストを歓迎します！
