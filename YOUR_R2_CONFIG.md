# あなたのR2設定情報

## ✅ 確認済みの情報

以下の情報は既に取得できています：

```env
# エンドポイント（アカウントID付き）
R2_ENDPOINT=https://ee3052802d9f583ae4332492cedbc291.r2.cloudflarestorage.com

# バケット名
R2_BUCKET_NAME=youtube-downloads

# 公開URL
R2_PUBLIC_URL=https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev
```

---

## ⚠️ 残りの作業: APIトークンの作成

まだ取得していない項目：
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

---

## 📋 APIトークンの取得手順

### ステップ1: R2ダッシュボードを開く

[https://dash.cloudflare.com/](https://dash.cloudflare.com/) にアクセス

→ 左メニューから **「R2」** を選択

---

### ステップ2: APIトークン管理を開く

#### 方法A: 簡単な方法
右側パネルの **「R2 APIトークンを管理」** をクリック

#### 方法B: プロフィールから
1. 右上のプロフィールアイコンをクリック
2. 「マイプロファイル」を選択
3. 左メニュー「APIトークン」
4. 「R2トークン」タブをクリック

---

### ステップ3: 新しいAPIトークンを作成

「APIトークンを作成」ボタンをクリック

---

### ステップ4: トークンの設定

以下のように設定してください：

#### 📝 トークン名
```
youtube-bot-token
```
（任意の名前でOK）

#### 🔑 権限（Permissions）
```
オブジェクトの読み取りと書き込み
(Object Read & Write)
```

#### 🪣 バケット（Bucket）
```
特定のバケット: youtube-downloads
```

#### ⏰ TTL（有効期限）
```
無期限 (Forever)
```
推奨: セキュリティ上、定期的にローテーションする場合は期限を設定

#### 作成ボタンをクリック
**「トークンを作成」** ボタンをクリック

---

### ステップ5: トークン情報をコピー

⚠️ **超重要**: 次の画面は一度しか表示されません！

表示される画面：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ APIトークンが正常に作成されました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Access Key ID
━━━━━━━━━━━━━━━━━━━━━━
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
[コピー]

Secret Access Key  
━━━━━━━━━━━━━━━━━━━━━━
p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6
[コピー]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### やること：
1. **Access Key ID** の右にある「コピー」ボタンをクリック
2. どこかに保存（メモ帳など）
3. **Secret Access Key** の右にある「コピー」ボタンをクリック
4. どこかに保存（メモ帳など）

---

## ✅ 完成した環境変数

取得した2つの値を使って、`.env`ファイルに以下を追加：

```env
# Cloudflare R2設定
R2_ENDPOINT=https://ee3052802d9f583ae4332492cedbc291.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=【ここにコピーしたAccess Key IDを貼り付け】
R2_SECRET_ACCESS_KEY=【ここにコピーしたSecret Access Keyを貼り付け】
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev
```

---

## 📝 設定例

```env
# 例（実際の値に置き換えてください）
R2_ENDPOINT=https://ee3052802d9f583ae4332492cedbc291.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
R2_SECRET_ACCESS_KEY=p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev
```

---

## 🚀 Botを起動

すべての環境変数を設定したら：

```bash
npm start
```

成功すると以下のメッセージが表示されます：

```
[SUCCESS] R2 configuration verified
```

---

## 🎯 テスト

Discordでコマンドを実行してテスト：

```
/youtube-download url:https://youtube.com/watch?v=dQw4w9WgXcQ
```

成功すると、以下のようなメッセージが返ってきます：

```
🎬 ダウンロード完了！

https://pub-a814136a101142d19e7519d3c6694cc1.r2.dev/video_1234567890.mp4

*このリンクは3日間有効です*
```

---

## ❓ トラブルシューティング

### エラー: "Missing R2 configuration"

**原因**: 環境変数が設定されていない

**解決方法**:
1. `.env`ファイルが正しい場所にあるか確認
2. すべての環境変数（5つ）が設定されているか確認
3. Botを再起動

---

### エラー: "Access Denied"

**原因**: APIトークンの権限が不足

**解決方法**:
1. トークンの権限が「オブジェクトの読み取りと書き込み」になっているか確認
2. 対象バケットが「youtube-downloads」になっているか確認
3. 必要に応じてトークンを再作成

---

### APIトークンを紛失した場合

**Secret Access Key** は一度しか表示されないため、紛失した場合は：

1. R2ダッシュボードのAPIトークン管理を開く
2. 古いトークンを削除
3. 新しいトークンを作成
4. `.env`ファイルを更新
5. Botを再起動

---

## 🔒 セキュリティ

- `.env`ファイルは絶対にGitにコミットしない
- APIトークンは他人と共有しない
- 定期的にトークンをローテーション
- 不要になったトークンは削除

---

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

- `R2_QUICKSTART.md` - 簡易ガイド
- `R2_ENV_GUIDE.md` - 詳細ガイド
- `R2_SETUP.md` - セットアップガイド

---

設定完了すれば、大容量の動画もダウンロードできます！🎉
