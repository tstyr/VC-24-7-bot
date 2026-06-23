# YouTube ダウンロード修正ガイド

## 実装済みの対策

### 1. マルチクライアント戦略
```bash
--extractor-args youtube:player_client=android,ios,web
```
- Android、iOS、Webクライアントを順番に試行
- Bot検出を回避

### 2. Cookieベース認証
```bash
--cookies-from-browser chrome
```
- Chromeブラウザから自動的にCookieを取得
- ログイン済みの場合はそのセッションを使用
- Cookie取得失敗時は自動的にCookieなしで再試行

### 3. User-Agent偽装
```bash
--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
```
- 最新のChromeブラウザとして認識

### 4. IPv4強制
```bash
--force-ipv4
```
- IPv6での接続問題を回避

### 5. 自動フォールバック
- Cookie認証失敗時、自動的にCookieなしで再試行
- 複数の方法を試すため成功率が向上

## トラブルシューティング

### エラー: "Sign in to confirm you're not a bot"

**原因:**
- YouTubeが高度なBot検出を実施
- IPアドレスが制限されている可能性

**解決策:**

#### 方法1: ブラウザでYouTubeにログイン（推奨）
1. Chromeブラウザを開く
2. YouTube.comにアクセス
3. Googleアカウントでログイン
4. Botを再起動
5. `/video-download` コマンドを実行

yt-dlpが自動的にChromeのCookieを読み取り、ログイン済みセッションを使用します。

#### 方法2: 手動でCookieをエクスポート
1. Chromeに [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) 拡張機能をインストール
2. YouTube.comでCookieをエクスポート → `cookies.txt` として保存
3. Dockerコンテナ内に配置: `/app/cookies.txt`
4. `.env` に追加:
   ```
   YOUTUBE_COOKIES_PATH=/app/cookies.txt
   ```
5. `youtubeDownloader.js` を修正:
   ```javascript
   '--cookies', process.env.YOUTUBE_COOKIES_PATH
   ```

#### 方法3: VPNまたはプロキシ使用
```bash
--proxy http://proxy-server:port
```

#### 方法4: yt-dlpを最新版に更新
```bash
# Dockerコンテナ内で実行
pip install --upgrade yt-dlp
```

### エラー: "No title found in player responses"

**対策済み:**
現在の実装では警告として表示されますが、タイトルは初期データから取得されるため機能します。

### 動画が非常に遅い

**原因:**
- YouTube側のレート制限
- ネットワーク速度

**解決策:**
```bash
--concurrent-fragments 5  # 並列ダウンロード
--limit-rate 5M           # 速度制限（サーバー負荷軽減）
```

## 現在の実装の流れ

```
┌─────────────────────────────────────┐
│ /video-download コマンド実行        │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ サイトタイプ判定 (YouTube?)         │
└───────────┬─────────────────────────┘
            │ YES
            ▼
┌─────────────────────────────────────┐
│ YouTube用オプション適用:            │
│ • player_client=android,ios,web     │
│ • Chromeから自動Cookie取得          │
│ • User-Agent偽装                    │
│ • IPv4強制                          │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ yt-dlp実行（情報取得）              │
└───────────┬─────────────────────────┘
            │
            ▼
    Cookie認証失敗?
            │
      YES   │   NO
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌───────┐      ┌────────┐
│再試行 │      │成功    │
│Cookie │      │        │
│なし   │      └────────┘
└───────┘
```

## 代替案: 他のサイトを使用

YouTubeがどうしても動作しない場合、以下のサイトは安定して動作します：

- **TikTok**: `https://vt.tiktok.com/...`
- **Twitter/X**: `https://twitter.com/...`
- **Instagram**: `https://www.instagram.com/...`
- **Twitch**: `https://www.twitch.tv/...`
- **Vimeo**: `https://vimeo.com/...`
- **Dailymotion**: `https://www.dailymotion.com/...`

これらのサイトはBot検出が緩いため、追加設定なしで動作します。

## さらなる改善

### OAuth認証実装（高度）
```javascript
// YouTube Data API v3を使用
// 認証トークンを取得して使用
```

### Seleniumを使用した完全ブラウザエミュレーション
- Headless Chromeで動画ページを開く
- 直接URLを抽出
- 最も確実だが遅い
