# 対応サイト一覧

`/video-download`コマンドは、yt-dlpを使用して**1000以上のサイト**から動画・音声をダウンロードできます。

## 🎬 主要な対応サイト

### 動画共有サイト

#### YouTube系
- ✅ **YouTube** - youtube.com, youtu.be
- ✅ **YouTube Music** - music.youtube.com
- ✅ **YouTube Shorts** - youtube.com/shorts

#### SNS系
- ✅ **Twitter (X)** - twitter.com, x.com
- ✅ **Instagram** - instagram.com (投稿、リール、ストーリー)
- ✅ **TikTok** - tiktok.com
- ✅ **Facebook** - facebook.com (動画投稿)
- ✅ **Reddit** - reddit.com (動画投稿)

#### 動画プラットフォーム
- ✅ **Vimeo** - vimeo.com
- ✅ **Dailymotion** - dailymotion.com
- ✅ **Twitch** - twitch.tv (VOD、クリップ)
- ✅ **Bilibili** - bilibili.com
- ✅ **ニコニコ動画** - nicovideo.jp

#### ライブ配信
- ✅ **Twitch** - ライブ配信のVOD
- ✅ **YouTube Live** - アーカイブ
- ✅ **ツイキャス** - twitcasting.tv

---

## 🌏 地域特化サイト

### 日本
- ✅ **ニコニコ動画** - nicovideo.jp
- ✅ **ツイキャス** - twitcasting.tv
- ✅ **FC2動画** - video.fc2.com
- ✅ **GYAO!** - gyao.yahoo.co.jp
- ✅ **AbemaTV** - abema.tv

### 韓国
- ✅ **Naver TV** - tv.naver.com
- ✅ **Afreeca TV** - afreecatv.com

### 中国
- ✅ **Bilibili** - bilibili.com
- ✅ **Youku** - youku.com
- ✅ **iQIYI** - iqiyi.com

---

## 🎵 音楽サイト

- ✅ **SoundCloud** - soundcloud.com
- ✅ **Bandcamp** - bandcamp.com
- ✅ **Mixcloud** - mixcloud.com
- ✅ **Audiomack** - audiomack.com

---

## 📺 ニュース・メディア

- ✅ **CNN** - cnn.com
- ✅ **BBC** - bbc.co.uk
- ✅ **NHK** - nhk.or.jp
- ✅ **TED** - ted.com

---

## 🎓 教育サイト

- ✅ **Coursera** - coursera.org
- ✅ **Udemy** - udemy.com
- ✅ **Khan Academy** - khanacademy.org

---

## 💻 技術系

- ✅ **GitHub** - github.com (リリース動画)
- ✅ **GitLab** - gitlab.com

---

## 📝 使用方法

### 基本的な使い方

```
/video-download url:https://twitter.com/user/status/123456789
/video-download url:https://www.tiktok.com/@user/video/123456789
/video-download url:https://www.instagram.com/p/ABC123/
/video-download url:https://www.twitch.tv/videos/123456789
```

### 設定の変更

```
# 動画形式を選択
/youtube-config format:mp4 quality:720p

# 音声のみ
/youtube-config format:m4a
```

---

## ⚠️ 注意事項

### 成功率について

| サイト | 成功率 | 備考 |
|--------|--------|------|
| Twitter (X) | ⭐⭐⭐⭐⭐ | 非常に高い |
| TikTok | ⭐⭐⭐⭐⭐ | 非常に高い |
| Instagram | ⭐⭐⭐⭐ | 高い（一部制限あり） |
| Twitch | ⭐⭐⭐⭐ | VODは高い |
| Vimeo | ⭐⭐⭐⭐⭐ | 非常に高い |
| YouTube | ⭐⭐⭐ | Bot検出により変動 |
| ニコニコ動画 | ⭐⭐⭐⭐ | 高い |

### 制限事項

#### ダウンロードできない動画
- ❌ DRM保護コンテンツ
- ❌ 有料会員限定コンテンツ
- ❌ 地域制限のある動画（一部）
- ❌ 年齢制限のある動画（一部）
- ❌ ライブ配信中の動画

#### サイズ制限
- Cloudflare R2にアップロードするため、実質的な制限はありません
- ただし、ダウンロード時間が長い動画は注意

---

## 🎯 推奨サイト

YouTubeのBot検出が厳しいため、以下のサイトが特に推奨されます：

### 1. **Twitter (X)** ⭐⭐⭐⭐⭐
```
/video-download url:https://twitter.com/user/status/123456789
```
- 制限が少ない
- ダウンロード速度が速い
- ほぼ確実に成功

### 2. **TikTok** ⭐⭐⭐⭐⭐
```
/video-download url:https://www.tiktok.com/@user/video/123456789
```
- ウォーターマークなしでダウンロード可能
- 高画質

### 3. **Instagram** ⭐⭐⭐⭐
```
/video-download url:https://www.instagram.com/p/ABC123/
/video-download url:https://www.instagram.com/reel/ABC123/
```
- リール、投稿、ストーリーに対応
- 比較的成功率が高い

### 4. **Twitch** ⭐⭐⭐⭐
```
/video-download url:https://www.twitch.tv/videos/123456789
```
- VOD（過去配信）のダウンロードが可能
- クリップにも対応

### 5. **Vimeo** ⭐⭐⭐⭐⭐
```
/video-download url:https://vimeo.com/123456789
```
- 高画質でダウンロード可能
- 制限が少ない

---

## 🔗 完全なサイト一覧

yt-dlpは1000以上のサイトに対応しています。完全なリストは以下で確認できます：

[yt-dlp 対応サイト一覧](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

---

## 💡 Tips

### 1. YouTubeで失敗したら他のサイトを試す

```
# YouTubeで失敗
/video-download url:https://youtube.com/watch?v=ABC123
❌ エラー

# 別のサイトで試す
/video-download url:https://twitter.com/user/status/123
✅ 成功！
```

### 2. 音声のみでダウンロード

```
/youtube-config format:m4a
/video-download url:https://soundcloud.com/user/track
```

### 3. 低画質で成功率UP

```
/youtube-config format:mp4 quality:480p
```

---

## 📞 サポート

問題が発生した場合：

1. 別のサイト（Twitter, TikTok等）で試す
2. 数分待って再試行
3. 設定を変更（画質を下げる、音声のみにする）

それでも解決しない場合は管理者に連絡してください。
