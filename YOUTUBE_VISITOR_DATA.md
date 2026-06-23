# YouTube Visitor Data 取得ガイド（Cookieなし認証）

Cookieの代わりにVisitor Dataを使用してYouTubeにアクセスする方法です。

## Visitor Dataとは？

- YouTubeがユーザーを識別するための一時的なID
- Cookieより軽量で設定が簡単
- 有効期限が短い（数時間〜数日）
- 不安定だが、簡易的な用途には十分

## 方法1: ブラウザから手動取得（推奨）

### ステップ1: YouTube.comを開く
1. Chrome/Edge/Firefoxで https://www.youtube.com を開く
2. 動画を1つ再生（任意の動画）

### ステップ2: 開発者ツールでVisitor Dataを取得
1. `F12` キーを押して開発者ツールを開く
2. 「Network」タブに移動
3. ページをリロード（`Ctrl+R` / `Cmd+R`）
4. フィルターに `player` と入力
5. `player` リクエストをクリック
6. 「Payload」または「Request」タブを開く
7. `context` → `client` → `visitorData` を探す

例:
```json
{
  "context": {
    "client": {
      "visitorData": "CgtsZW1pYnZPc3RHOCiRq..."  ← これをコピー
    }
  }
}
```

### ステップ3: 環境変数に設定

#### Koyebの場合:
環境変数に追加:
```
YOUTUBE_VISITOR_DATA=CgtsZW1pYnZPc3RHOCiRq...
```

#### Dockerの場合:
`.env` ファイルに追加:
```
YOUTUBE_VISITOR_DATA=CgtsZW1pYnZPc3RHOCiRq...
```

### ステップ4: Botを再起動
Koyeb/Dockerを再起動して環境変数を反映

## 方法2: yt-dlpコマンドで自動取得

```bash
# Visitor Dataを取得
yt-dlp --dump-json "https://www.youtube.com/watch?v=dQw4w9WgXcQ" | grep -o '"visitorData":"[^"]*"'

# または
yt-dlp --print "%(visitor_data)s" "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

出力例:
```
"visitorData":"CgtsZW1pYnZPc3RHOCiRq..."
```

コピーして環境変数に設定

## 方法3: curlで取得（上級）

```bash
curl -s 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  | grep -o 'visitorData":"[^"]*' | cut -d'"' -f3
```

## Visitor Data vs Cookies

| 項目 | Visitor Data | Cookies |
|------|-------------|---------|
| 安定性 | ⚠️ 不安定 | ✅ 安定 |
| 有効期限 | 数時間〜数日 | 1〜6ヶ月 |
| 設定の簡単さ | ✅ 簡単 | ⚠️ やや複雑 |
| メンテナンス | 定期更新必要 | ほぼ不要 |
| おすすめ度 | テスト用 | 本番用 |

## 認証方法の優先順位

Botは以下の順番で認証方法を試します:

1. **Cookie認証** (最優先)
   ```
   YOUTUBE_COOKIES_PATH=/app/cookies.txt
   ```
   ✅ 最も安定
   
2. **Visitor Data認証** (次点)
   ```
   YOUTUBE_VISITOR_DATA=CgtsZW1pYnZPc3RHOCiRq...
   ```
   ⚠️ 不安定だが簡単

3. **認証なし** (フォールバック)
   デフォルトのplayer_skipのみ
   ❌ ほぼ失敗する

## トラブルシューティング

### エラー: "Sign in to confirm you're not a bot"
**原因:**
- Visitor Dataが古い・無効
- YouTubeがIPアドレスをブロック

**解決策:**
1. 新しいVisitor Dataを取得
2. しばらく待ってから再試行
3. Cookie認証に切り替え（推奨）

### Visitor Dataの有効期限
- 通常: **数時間〜24時間**
- 頻繁に更新が必要
- 毎日自動更新するスクリプトの作成を推奨

### 自動更新スクリプト（Node.js）

```javascript
// update-visitor-data.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function updateVisitorData() {
  try {
    const { stdout } = await execPromise(
      'yt-dlp --dump-json "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
    );
    
    const data = JSON.parse(stdout);
    const visitorData = data.context?.client?.visitorData;
    
    if (visitorData) {
      console.log('New Visitor Data:', visitorData);
      // 環境変数を更新（Koyeb APIを使用等）
    }
  } catch (error) {
    console.error('Failed to update visitor data:', error);
  }
}

// 12時間ごとに更新
setInterval(updateVisitorData, 12 * 60 * 60 * 1000);
updateVisitorData(); // 初回実行
```

## 環境変数の確認

現在の認証方法を確認:

```javascript
// src/services/youtubeDownloader.js に追加
console.log('YouTube Auth Method:', 
  process.env.YOUTUBE_COOKIES_PATH ? 'Cookies' :
  process.env.YOUTUBE_VISITOR_DATA ? 'Visitor Data' :
  'None (Default)'
);
```

## おすすめの使い方

### 個人利用（低頻度）
→ **Visitor Data** で十分

### Bot運用（高頻度）
→ **Cookie認証** を推奨

### テスト環境
→ **Visitor Data** で素早くテスト

### 本番環境
→ **Cookie認証** で安定運用

## まとめ

**簡単にテストしたい場合:**
1. YouTube.comで開発者ツールを開く（F12）
2. NetworkタブでVisitor Dataを探す
3. 環境変数 `YOUTUBE_VISITOR_DATA` に設定
4. Botを再起動

**安定して運用したい場合:**
Cookie認証の方が確実です → `YOUTUBE_COOKIES_SETUP.md` を参照

両方設定した場合、Cookieが優先されます。
