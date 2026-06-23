-- YouTube ダウンロード設定テーブル
CREATE TABLE IF NOT EXISTS youtube_download_settings (
  user_id TEXT PRIMARY KEY,
  format VARCHAR(10) NOT NULL DEFAULT 'mp4', -- 'mp4' or 'm4a'
  quality VARCHAR(20) DEFAULT 'best', -- 'best', 'worst', '720p', '1080p', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_youtube_download_settings_user_id ON youtube_download_settings(user_id);

-- 更新トリガー
CREATE OR REPLACE FUNCTION update_youtube_download_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_youtube_download_settings_updated_at
BEFORE UPDATE ON youtube_download_settings
FOR EACH ROW
EXECUTE FUNCTION update_youtube_download_settings_updated_at();
