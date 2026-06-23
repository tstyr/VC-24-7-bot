# 🚀 R2設定 - 今すぐセットアップ

すべての情報が揃いました！以下の手順で設定を完了してください。

---

## ステップ1: .envファイルを作成

プロジェクトのルートディレクトリ（このファイルと同じ場所）に `.env` ファイルを作成してください。

### Windowsの場合

コマンドプロンプトまたはPowerShellで：

```bash
# プロジェクトディレクトリに移動
cd "c:\Users\haka\Desktop\ショートカット\app\24.7 VC connect bot"

# .envファイルを作成（既存の設定をコピー）
copy .env.example .env
```

### または手動で作成

1. プロジェクトフォルダを開く
2. 右クリック → 新規作成 → テキストドキュメント
3. ファイル名を `.env` に変更（拡張子なし）

---

## ステップ2: R2設定を追加

`.env` ファイルを開いて、以下の内容を**追加**してください：

```env
# Cloudflare R2設定
R2_ENDPOINT=https://ee3052802d9f583ae4332492cedbc291.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=17a279483004588181884440b92dbb8f
R2_SECRET_ACCESS_KEY=6e3d9a4144dbf467ec589efbc74f6f2789a44f501999a8b76eef187535c11693
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev
```

### 💡 簡単な方法

`.env.r2.ready` ファイルの内容をコピーして、`.env` ファイルの最後に貼り付けるだけ！

---

## ステップ3: Botを再起動

```bash
npm start
```

---

## ステップ4: 成功メッセージを確認

Botが起動したら、以下のメッセージが表示されるはずです：

```
[SUCCESS] R2 configuration verified
```

このメッセージが表示されれば設定完了です！🎉

---

## ステップ5: テスト

Discordで以下のコマンドを実行してテストしてください：

### 1. 設定コマンド

```
/youtube-config format:mp4 quality:720p
```

成功すると：
```
✅ 設定が保存されました
ダウンロード形式: MP4 (動画)
動画品質: 720p
```

### 2. ダウンロードコマンド

```
/youtube-download url:https://youtube.com/watch?v=dQw4w9WgXcQ
```

成功すると：
```
🎬 ダウンロード完了！

https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev/video_1234567890.mp4

*このリンクは3日間有効です*
```

---

## 📊 設定内容の説明

| 環境変数 | 値 | 説明 |
|---------|-----|------|
| `R2_ENDPOINT` | `https://ee3052802d9f583ae4332492cedbc291.r2.cloudflarestorage.com` | R2 APIエンドポイント |
| `R2_ACCESS_KEY_ID` | `17a279483004588181884440b92dbb8f` | アクセスキーID |
| `R2_SECRET_ACCESS_KEY` | `6e3d9a4144dbf467ec589efbc74f6f2789a44f501999a8b76eef187535c11693` | シークレットアクセスキー |
| `R2_BUCKET_NAME` | `youtube-downloads` | バケット名 |
| `R2_PUBLIC_URL` | `https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev` | 公開URL |

---

## ✅ 完成した.envファイルの例

```env
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_bot_client_id
GUILD_ID=your_guild_id

# ... その他の既存設定 ...

# Cloudflare R2設定
R2_ENDPOINT=https://ee3052802d9f583ae4332492cedbc291.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=17a279483004588181884440b92dbb8f
R2_SECRET_ACCESS_KEY=6e3d9a4144dbf467ec589efbc74f6f2789a44f501999a8b76eef187535c11693
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev
```

---

## 🔒 セキュリティ注意事項

### ⚠️ 重要

- `.env` ファイルは **絶対に** Gitにコミットしないでください
- APIキーは **他人と共有しない**
- このファイル（SETUP_R2_NOW.md）も機密情報を含むため、公開しないでください

### ✅ 確認事項

`.gitignore` に以下が含まれているか確認：

```
.env
.env.local
*.env
```

---

## ❓ トラブルシューティング

### エラー: "Missing R2 configuration"

**原因**: 環境変数が読み込まれていない

**解決方法**:
1. `.env` ファイルがプロジェクトルートにあるか確認
2. ファイル名が正確に `.env` か確認（`.env.txt` などになっていないか）
3. 環境変数に余分なスペースがないか確認
4. Botを完全に再起動

---

### エラー: "Access Denied"

**原因**: APIキーが間違っている、または権限不足

**解決方法**:
1. コピー時に余分な文字が入っていないか確認
2. Access Key ID と Secret Access Key を確認
3. Cloudflare R2ダッシュボードでトークンの権限を確認

---

### エラー: "Bucket not found"

**原因**: バケット名が間違っている

**解決方法**:
1. `R2_BUCKET_NAME=youtube-downloads` が正しく設定されているか確認
2. Cloudflare R2ダッシュボードでバケット名を確認

---

### ダウンロードは成功するが、リンクが開けない

**原因**: 公開アクセスが有効になっていない

**解決方法**:
1. Cloudflare R2ダッシュボードを開く
2. `youtube-downloads` バケットを選択
3. 「設定」タブ
4. 「公開アクセス」→「R2.devサブドメインを許可」が **ON** になっているか確認

---

## 🎉 完了！

すべての設定が完了したら、大容量の動画もダウンロードできるようになります！

### 使用例

1. **短い動画**（テスト用）
   ```
   /youtube-download url:https://youtube.com/watch?v=dQw4w9WgXcQ
   ```

2. **長い動画**（数GB以上でもOK）
   ```
   /youtube-download url:https://youtube.com/watch?v=...
   ```

3. **音声のみ**
   ```
   /youtube-config format:m4a
   /youtube-download url:https://youtube.com/watch?v=...
   ```

---

何か問題があれば、以下のガイドを参照してください：

- `R2_QUICKSTART.md` - クイックガイド
- `R2_ENV_GUIDE.md` - 詳細ガイド
- `YOUR_R2_CONFIG.md` - あなた専用ガイド
