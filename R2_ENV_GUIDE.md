# Cloudflare R2 環境変数の取得方法

このガイドでは、R2に必要な5つの環境変数を取得する方法をスクリーンショット付きで説明します。

## 必要な環境変数

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your_access_key_id>
R2_SECRET_ACCESS_KEY=<your_secret_access_key>
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

---

## ステップ1: Cloudflareアカウントにログイン

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にアクセス
2. アカウントにログイン
3. ログイン後、ダッシュボードが表示されます

---

## ステップ2: R2を有効化

### 初めてR2を使う場合

1. 左サイドバーから **「R2」** を選択
2. 「R2を有効にする」ボタンをクリック
3. 支払い方法を追加（無料枠があるので実際の請求は発生しません）
4. 利用規約に同意して有効化

### すでにR2が有効な場合

1. 左サイドバーから **「R2」** を選択
2. R2のダッシュボードが表示されます

---

## ステップ3: アカウントIDを取得（R2_ENDPOINT用）

### 📍 場所: R2ダッシュボード右側

1. R2のダッシュボードを開く
2. 右側のパネルに **「アカウント ID」** が表示されています
3. **コピー**ボタンをクリックしてコピー

**例:** `abc123def456ghi789jkl012`

### ✅ 環境変数に設定

```env
# <account-id>の部分をコピーしたアカウントIDに置き換える
R2_ENDPOINT=https://abc123def456ghi789jkl012.r2.cloudflarestorage.com
```

---

## ステップ4: バケットを作成（R2_BUCKET_NAME用）

### 📍 場所: R2ダッシュボード

1. R2のダッシュボードで **「バケットを作成」** をクリック
2. バケット名を入力: `youtube-downloads`（推奨）
3. ロケーション: **「自動」** を選択（または最寄りのリージョン）
4. **「作成」** ボタンをクリック

### ✅ 環境変数に設定

```env
R2_BUCKET_NAME=youtube-downloads
```

---

## ステップ5: 公開URLを取得（R2_PUBLIC_URL用）

バケットを作成したら、公開アクセスを設定します。

### オプションA: R2.dev ドメイン（簡単・推奨初心者向け）

1. 作成したバケット（`youtube-downloads`）をクリック
2. **「設定」** タブを開く
3. **「公開アクセス」** セクションを見つける
4. **「R2.devサブドメインを許可」** のトグルを **ON** にする
5. 表示されるURLをコピー

**表示例:**
```
https://pub-0a1b2c3d4e5f6g7h8i9j0k1l.r2.dev
```

### ✅ 環境変数に設定

```env
R2_PUBLIC_URL=https://pub-0a1b2c3d4e5f6g7h8i9j0k1l.r2.dev
```

---

### オプションB: カスタムドメイン（上級者向け）

自分のドメインを使いたい場合：

1. バケットの **「設定」** タブを開く
2. **「カスタムドメイン」** セクションで **「ドメインを追加」** をクリック
3. 所有しているドメインを入力（例: `cdn.yourdomain.com`）
4. 表示される手順に従ってDNSレコードを設定
   - Cloudflare DNSを使っている場合は自動的に設定されます
   - 外部DNSの場合は手動でCNAMEレコードを追加
5. 検証が完了したら、このドメインを使用

### ✅ 環境変数に設定

```env
R2_PUBLIC_URL=https://cdn.yourdomain.com
```

---

## ステップ6: APIトークンを作成（R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY用）

### 📍 場所: Cloudflare Dashboard → R2 → APIトークン管理

#### 方法1: R2ダッシュボードから作成

1. R2のダッシュボードに戻る
2. 右側のパネルで **「R2 APIトークンを管理」** をクリック
3. **「APIトークンを作成」** ボタンをクリック

#### 方法2: ダッシュボードから直接アクセス

1. Cloudflare Dashboardのトップページで右上のプロフィールアイコンをクリック
2. **「マイプロファイル」** を選択
3. 左メニューから **「APIトークン」** を選択
4. **「R2トークン」** タブをクリック
5. **「APIトークンを作成」** をクリック

---

### APIトークンの設定

1. **トークン名**: `youtube-bot-token`（任意の名前）

2. **権限**（Permissions）:
   - **オブジェクトの読み取りと書き込み**（Object Read & Write）を選択

3. **バケット**（Bucket）:
   - **特定のバケット** を選択
   - バケット名: `youtube-downloads` を選択

4. **TTL**（有効期限）:
   - **無期限**（Forever）を推奨
   - または必要に応じて期限を設定

5. **「トークンを作成」** ボタンをクリック

---

### トークン情報のコピー

トークンが作成されると、以下の情報が表示されます：

```
✅ APIトークンが正常に作成されました

Access Key ID
━━━━━━━━━━━━━━━━━━━━━━━━━━
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5

Secret Access Key
━━━━━━━━━━━━━━━━━━━━━━━━━━
p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6
```

⚠️ **重要**: この画面は一度しか表示されません！必ず両方をコピーして保存してください。

### ✅ 環境変数に設定

```env
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
R2_SECRET_ACCESS_KEY=p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6
```

---

## ステップ7: ライフサイクルルールの設定（3日後に自動削除）

### 📍 場所: バケット設定

1. バケット（`youtube-downloads`）を開く
2. **「設定」** タブをクリック
3. **「オブジェクトライフサイクルルール」** セクションまでスクロール
4. **「ルールを追加」** をクリック

### ルールの設定

- **ルール名**: `delete-after-3-days`
- **アクション**: **オブジェクトを削除**（Delete objects）
- **スコープ**: 
  - **すべてのオブジェクト**（All objects）を選択
  - または **プレフィックスでフィルタ**: 空白のまま
- **条件**:
  - **経過日数**（Days after creation）: `3`

5. **「ルールを作成」** をクリック

✅ これで、アップロードされたファイルは3日後に自動的に削除されます。

---

## 完成した環境変数の例

すべての情報を取得したら、`.env`ファイルに以下のように設定します：

```env
# Cloudflare R2設定
R2_ENDPOINT=https://abc123def456ghi789jkl012.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
R2_SECRET_ACCESS_KEY=p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-0a1b2c3d4e5f6g7h8i9j0k1l.r2.dev
```

---

## 動作確認

### Botを再起動

```bash
npm start
```

### ログを確認

起動時に以下のメッセージが表示されればOK：

```
[SUCCESS] R2 configuration verified
```

### テストコマンドを実行

Discordで以下のコマンドを実行してテスト：

```
/youtube-config format:mp4 quality:720p
/youtube-download url:https://youtube.com/watch?v=dQw4w9WgXcQ
```

成功すれば、ダイレクトリンクが表示されます！

---

## トラブルシューティング

### エラー: "Missing R2 configuration"

**原因**: 環境変数が正しく設定されていない

**解決方法**:
1. `.env`ファイルが正しい場所にあるか確認
2. 環境変数名のスペルミスを確認
3. 値が正しくコピーされているか確認（前後のスペースに注意）
4. Botを再起動

---

### エラー: "Access Denied"

**原因**: APIトークンの権限が不足している

**解決方法**:
1. R2ダッシュボードでAPIトークンを確認
2. 権限が **「オブジェクトの読み取りと書き込み」** になっているか確認
3. 対象バケットが正しく選択されているか確認
4. 必要に応じてトークンを再作成

---

### エラー: "Bucket not found"

**原因**: バケット名が間違っている

**解決方法**:
1. R2ダッシュボードでバケット名を確認
2. `R2_BUCKET_NAME`の値と一致しているか確認
3. 大文字・小文字を正確に入力

---

### ファイルが公開URLでアクセスできない

**原因**: 公開アクセスが有効になっていない

**解決方法**:
1. バケットの「設定」→「公開アクセス」を確認
2. 「R2.devサブドメインを許可」がONになっているか確認
3. カスタムドメインを使用している場合、DNS設定を確認

---

## セキュリティのベストプラクティス

### ✅ 推奨

- APIトークンは環境変数で管理（`.env`ファイル）
- `.env`ファイルは`.gitignore`に追加（Gitにコミットしない）
- トークンには必要最小限の権限のみ付与
- 定期的にトークンをローテーション

### ❌ 避けるべき

- コードに直接APIトークンを記述
- 公開リポジトリに`.env`をコミット
- 過度な権限を持つトークンの使用
- トークンを他の人と共有

---

## 参考リンク

- [Cloudflare R2 公式ドキュメント](https://developers.cloudflare.com/r2/)
- [R2 APIトークンの管理](https://developers.cloudflare.com/r2/api/s3/tokens/)
- [R2 ライフサイクルルール](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [R2 公開バケット](https://developers.cloudflare.com/r2/buckets/public-buckets/)

---

## サポート

問題が解決しない場合：

1. [Cloudflare Community](https://community.cloudflare.com/)で質問
2. [Cloudflare Discord](https://discord.gg/cloudflaredev)でサポートを求める
3. このREADMEの「トラブルシューティング」セクションを再確認
