# YouTube Cookie設定ガイド（簡単版）

YouTubeのBot検出を回避するために、ブラウザのCookieをBotに設定します。

## 方法1: Chrome拡張機能を使う（最も簡単）

### ステップ1: 拡張機能をインストール
1. Chromeブラウザで以下のリンクを開く:
   https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc

2. 「Chromeに追加」をクリック

### ステップ2: YouTubeにログイン
1. YouTube.com を開く
2. Googleアカウントでログイン

### ステップ3: Cookieをエクスポート
1. YouTube.comのページで拡張機能アイコンをクリック
2. 「Export」をクリック
3. `youtube.com_cookies.txt` というファイルがダウンロードされる

### ステップ4: Botに設定

#### Koyebの場合:
1. Koyebダッシュボードで「Files」セクションに移動
2. `/app/cookies.txt` にファイルをアップロード
3. 環境変数に追加:
   ```
   YOUTUBE_COOKIES_PATH=/app/cookies.txt
   ```
4. Botを再デプロイ

#### Dockerの場合:
1. プロジェクトルートに `cookies.txt` を配置
2. `Dockerfile` に以下を追加:
   ```dockerfile
   COPY cookies.txt /app/cookies.txt
   ```
3. `.env` に追加:
   ```
   YOUTUBE_COOKIES_PATH=/app/cookies.txt
   ```
4. 再ビルド:
   ```bash
   docker build -t your-bot .
   docker run --env-file .env your-bot
   ```

## 方法2: ブラウザの開発者ツール（中級）

### Chrome/Edge
1. YouTube.comを開く
2. `F12` を押して開発者ツールを開く
3. 「Application」タブ → 「Cookies」 → 「https://www.youtube.com」
4. すべてのCookieをコピー
5. Netscapeフォーマットに変換（オンラインツール使用）
6. `cookies.txt` として保存

### Firefox
1. YouTube.comを開く
2. `F12` → 「Storage」タブ
3. 同様の手順

## 方法3: Python スクリプト（上級）

```python
# extract_cookies.py
import browser_cookie3

# Chromeから自動取得
cookies = browser_cookie3.chrome(domain_name='youtube.com')

with open('cookies.txt', 'w') as f:
    f.write('# Netscape HTTP Cookie File\n')
    for cookie in cookies:
        f.write(f'{cookie.domain}\tTRUE\t{cookie.path}\t'
                f'{"TRUE" if cookie.secure else "FALSE"}\t{cookie.expires}\t'
                f'{cookie.name}\t{cookie.value}\n')
```

実行:
```bash
pip install browser-cookie3
python extract_cookies.py
```

## Cookieの有効期限

- Cookieは通常1〜6ヶ月有効
- 期限切れの場合は再取得が必要
- エラーが出たら再エクスポート

## トラブルシューティング

### エラー: "HTTP Error 403: Forbidden"
- Cookieが古い → 再エクスポート
- ファイルパスが間違っている → 環境変数を確認

### エラー: "Sign in to confirm you're not a bot"
- Cookieが設定されていない
- `YOUTUBE_COOKIES_PATH` 環境変数を確認
- ファイルが正しい場所にあるか確認

### Cookieファイルの形式

正しい形式（Netscape HTTP Cookie File）:
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1234567890	CONSENT	YES+
.youtube.com	TRUE	/	FALSE	1234567890	VISITOR_INFO1_LIVE	abc123
```

## 環境変数の確認

Koyebで確認:
```bash
# ログに出力
console.log('YOUTUBE_COOKIES_PATH:', process.env.YOUTUBE_COOKIES_PATH);
```

正しく設定されていれば:
```
YOUTUBE_COOKIES_PATH: /app/cookies.txt
```

## セキュリティ注意事項

⚠️ **重要:**
- Cookieファイルは機密情報です
- GitHubにコミットしないでください（`.gitignore`に追加）
- 他人と共有しないでください
- 定期的に更新してください

## `.gitignore` に追加

```
# YouTube Cookies
cookies.txt
youtube.com_cookies.txt
*.cookies.txt
```

## まとめ

1. Chrome拡張機能で `youtube.com_cookies.txt` をエクスポート
2. Koyeb/Dockerに `cookies.txt` としてアップロード
3. 環境変数 `YOUTUBE_COOKIES_PATH=/app/cookies.txt` を設定
4. Botを再起動
5. `/video-download` でYouTube URLを試す

これでYouTubeのダウンロードが可能になります！
