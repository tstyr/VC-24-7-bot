# Cloudflare R2 セットアップガイド

このガイドでは、YouTube動画ダウンロード機能で使用するCloudflare R2の設定方法を説明します。

## なぜR2を使うのか？

- **無制限のファイルサイズ**: Discordの25MB制限を回避
- **高速配信**: Cloudflareの高速CDN
- **低コスト**: egress（送信）料金が無料
- **自動削除**: ライフサイクルルールで3日後に自動削除

## セットアップ手順

### 1. Cloudflare R2を有効化

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にログイン
2. 左メニューから「R2」を選択
3. 「R2を有効にする」をクリック
4. クレジットカード情報を登録（無料枠あり）

### 2. バケットを作成

1. 「バケットを作成」をクリック
2. バケット名: `youtube-downloads`（任意）
3. ロケーション: 自動（または最も近い地域）
4. 「作成」をクリック

### 3. ライフサイクルルールを設定（自動削除）

1. 作成したバケットをクリック
2. 「設定」タブを開く
3. 「ライフサイクルルール」セクションで「ルールを追加」
4. 以下の設定：
   - **ルール名**: `delete-after-3-days`
   - **アクション**: オブジェクトを削除
   - **プレフィックス**: （空白）
   - **日数**: `3`
5. 「保存」をクリック

### 4. 公開アクセスを有効化

#### オプション1: R2.dev ドメイン（簡単）

1. バケットの「設定」タブを開く
2. 「公開アクセス」セクションで「R2.devサブドメインを許可」を有効化
3. 表示されたURLをコピー（例: `https://pub-xxxxx.r2.dev`）

#### オプション2: カスタムドメイン（推奨）

1. バケットの「設定」タブを開く
2. 「カスタムドメイン」で「ドメインを追加」
3. 所有しているドメインを入力（例: `cdn.yourdomain.com`）
4. DNSレコードを設定してドメインを検証
5. 設定完了後、このドメインを使用

### 5. API トークンを作成

1. Cloudflare Dashboardのホームに戻る
2. 右上のプロフィール → 「API トークン」
3. 「R2 APIトークン」タブを選択
4. 「APIトークンを作成」をクリック
5. 以下の権限を設定：
   - **権限**: オブジェクトの読み取り/書き込み
   - **バケット**: `youtube-downloads`を選択
6. 「トークンを作成」をクリック
7. 表示された以下の情報をコピー：
   - **Access Key ID**: `R2_ACCESS_KEY_ID`
   - **Secret Access Key**: `R2_SECRET_ACCESS_KEY`

### 6. アカウントIDを取得

1. R2のダッシュボードに戻る
2. 右側に表示されている「アカウントID」をコピー

### 7. 環境変数を設定

`.env`ファイルに以下を追加：

```env
# Cloudflare R2設定
R2_ENDPOINT=https://<アカウントID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=<公開URL>
```

**例（R2.devドメインの場合）:**
```env
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=1a2b3c4d5e6f7g8h9i0j
R2_SECRET_ACCESS_KEY=k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

**例（カスタムドメインの場合）:**
```env
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=1a2b3c4d5e6f7g8h9i0j
R2_SECRET_ACCESS_KEY=k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
R2_BUCKET_NAME=youtube-downloads
R2_PUBLIC_URL=https://cdn.yourdomain.com
```

## 確認

Botを起動すると、R2設定が自動的に検証されます：

```
[INFO] R2 configuration verified
```

このメッセージが表示されれば設定完了です！

## 料金について

Cloudflare R2は以下の無料枠があります：

- **ストレージ**: 10 GB/月
- **Class A操作** (書き込み): 100万リクエスト/月
- **Class B操作** (読み込み): 1000万リクエスト/月
- **Egress** (送信): 無料（無制限）

通常の使用では無料枠内で十分です。

## トラブルシューティング

### エラー: "Missing R2 configuration"

環境変数が正しく設定されているか確認してください：
```bash
echo $R2_ENDPOINT
echo $R2_ACCESS_KEY_ID
```

### エラー: "Access Denied"

- APIトークンの権限を確認
- バケット名が正しいか確認
- アカウントIDがEndpointに含まれているか確認

### エラー: "Network timeout"

- エンドポイントURLが正しいか確認
- ファイアウォールでCloudflare R2へのアクセスがブロックされていないか確認

### ファイルが3日後に削除されない

- ライフサイクルルールが正しく設定されているか確認
- ルールの適用には最大24時間かかる場合があります

## 参考リンク

- [Cloudflare R2 公式ドキュメント](https://developers.cloudflare.com/r2/)
- [R2 料金](https://www.cloudflare.com/products/r2/)
- [R2 API リファレンス](https://developers.cloudflare.com/r2/api/s3/)
