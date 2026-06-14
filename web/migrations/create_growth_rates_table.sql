-- 増加率を保存するテーブル (Supabase用)
CREATE TABLE IF NOT EXISTS osu_growth_rates (
  id BIGSERIAL PRIMARY KEY,
  osu_user_id INTEGER NOT NULL,
  mode VARCHAR(10) NOT NULL,
  pp_per_hour NUMERIC(10, 4) DEFAULT 0,
  rank_change_per_hour NUMERIC(10, 4) DEFAULT 0,
  score_per_hour BIGINT DEFAULT 0,
  plays_per_hour NUMERIC(10, 4) DEFAULT 0,
  confidence NUMERIC(3, 2) DEFAULT 0,
  data_points INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(osu_user_id, mode)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_growth_rates_user_mode ON osu_growth_rates(osu_user_id, mode);
CREATE INDEX IF NOT EXISTS idx_growth_rates_updated ON osu_growth_rates(updated_at DESC);

-- 自動更新用のトリガー (Supabase Postgres互換)
CREATE OR REPLACE FUNCTION update_growth_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_growth_rates_updated_at ON osu_growth_rates;
CREATE TRIGGER trigger_update_growth_rates_updated_at
  BEFORE UPDATE ON osu_growth_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_growth_rates_updated_at();
