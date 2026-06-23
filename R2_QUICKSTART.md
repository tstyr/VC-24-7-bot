# Cloudflare R2 クイックスタート（5分で完了）

## 🚀 最速セットアップ

### 1️⃣ Cloudflare R2を開く

[https://dash.cloudflare.com/](https://dash.cloudflare.com/) → 左メニュー「R2」

---

### 2️⃣ アカウントIDをコピー

画面右側に表示される **「アカウント ID」** をコピー

```env
R2_ENDPOINT=https://【ここにアカウントID】.r2.cloudflarestorage.com
```

**例:**
```env
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
```

---

### 3️⃣ バケットを作成

1. 「バケットを作成」をクリック
2. バケット名: `youtube-downloads`
3. ロケーション: 自動
4. 「作成」ボタンをクリック

```env
R2_BUCKET_NAME=youtube-downloads
```

---

### 4️⃣ 公開URLを取得

1. 作成したバケットをクリック
2. 「設定」タブ
3. 「公開アクセス」→「R2.devサブドメインを許可」を **ON**
4. 表示されるURLをコピー

```env
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

---

### 5️⃣ ライフサイクルルールを設定（3日後削除）

1. バケットの「設定」タブ
2. 「オブジェクトライフサイクルルール」→「ルールを追加」
3. 設定:
   - ルール名: `delete-after-3-days`
   - アクション: オブジェクトを削除
   - 経過日数: `3`
4. 「ルールを作成」

---

### 6️⃣ APIトークンを作成

#### 方法A: R2ダッシュボードから

右側パネル → 「R2 APIトークンを管理」→「APIトークンを作成」

#### 方法B: プロフィールから

右上プロフィール → マイプロファイル → APIトークン → R2トークンタブ → APIトークンを作成

#### トークン設定:

- トークン名: `youtube-bot`（任意）
- 権限: **オブジェクトの読み取りと書き込み**
- バケット: **youtube-downloads**
- TTL: **無期限**

「トークンを作成」をクリック

---

### 7️⃣ トークン情報をコピー

⚠️ **一度しか表示されないので必ずコピー！**

表示される2つの値をコピー:

```
Access Key ID: a1b2c3d4e5f6g7h8...
Secret Access Key: p6q7r8s9t0u1v2w3...
```

```env
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8...
R2_SECRET_ACCESS_KEY=p6q7r8s9t0u1v2w3...
```

---

## ✅ 完成した`.env`ファイル

プロジェクトの`.env`ファイルに以下を追加:

```env
# Cloudflare R2設定
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
R2_SECRET_ACCESS_KEY=p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-0a1b2c3d4e5f6g7h8i9j0k1l.r2.dev
```

---

## 🎯 動作確認

### Botを起動

```bash
npm start
```

### 成功メッセージを確認

```
[SUCCESS] R2 configuration verified
```

### Discordでテスト

```
/youtube-download url:https://youtube.com/watch?v=dQw4w9WgXcQ
```

成功すると、ダイレクトリンクが表示されます！

```
🎬 ダウンロード完了！

https://pub-xxxxx.r2.dev/video_1234567890.mp4

*このリンクは3日間有効です*
```

---

## 📊 各値の説明

| 環境変数 | 取得場所 | 例 |
|---------|---------|-----|
| `R2_ENDPOINT` | R2ダッシュボード右側「アカウントID」 | `https://abc123.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | APIトークン作成時に表示 | `a1b2c3d4e5f6g7h8...` |
| `R2_SECRET_ACCESS_KEY` | APIトークン作成時に表示（一度のみ） | `p6q7r8s9t0u1v2w3...` |
| `R2_BUCKET_NAME` | 自分で作成したバケット名 | `youtube-downloads` |
| `R2_PUBLIC_URL` | バケット設定→公開アクセス | `https://pub-xxxxx.r2.dev` |

---

## ❓ よくある質問

### Q: R2は無料で使えますか？

A: はい！月10GBのストレージと送信無制限が無料です。

### Q: R2.devドメインとカスタムドメインの違いは？

A: 
- **R2.dev**: Cloudflareが提供する無料ドメイン（簡単）
- **カスタムドメイン**: 自分のドメインを使う（上級者向け）

初心者はR2.devドメインがおすすめです。

### Q: APIトークンを紛失しました

A: 新しいトークンを作成して、環境変数を更新してください。古いトークンは削除できます。

### Q: ファイルが3日後に削除されるか確認したい

A: ライフサイクルルールが正しく設定されていれば、3日後に自動的に削除されます。R2ダッシュボードでバケット内のオブジェクト一覧を確認できます。

---

## 🔗 詳細ガイド

より詳しい説明が必要な場合は `R2_ENV_GUIDE.md` を参照してください。

---

## 💡 Tips

- **テスト用**: 短い動画（数秒）でテストすることをおすすめ
- **トークン管理**: 定期的にトークンをローテーションして セキュリティを強化
- **コスト監視**: Cloudflare Dashboardで使用量を確認できます

---

設定完了です！🎉 大容量の動画もダウンロードできるようになりました！
