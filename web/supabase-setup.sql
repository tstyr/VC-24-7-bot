-- osu! 追跡ユーザーテーブル
CREATE TABLE IF NOT EXISTS osu_tracked_users (
    discord_id VARCHAR(255) PRIMARY KEY,
    osu_user_id BIGINT,
    osu_username VARCHAR(255) NOT NULL,
    first_linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- osu! ユーザー統計スナップショット
CREATE TABLE IF NOT EXISTS osu_user_snapshots (
    id BIGSERIAL PRIMARY KEY,
    discord_id VARCHAR(255),
    osu_user_id BIGINT NOT NULL,
    osu_username VARCHAR(255),
    mode VARCHAR(16) NOT NULL,
    pp DOUBLE PRECISION,
    global_rank INTEGER,
    country_rank INTEGER,
    play_time_seconds INTEGER,
    play_count INTEGER,
    total_score BIGINT, -- 追加
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 既存テーブルにカラムを追加（すでにテーブルが存在する場合）
ALTER TABLE osu_user_snapshots ADD COLUMN IF NOT EXISTS total_score BIGINT;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_osu_user_snapshots_lookup
ON osu_user_snapshots (osu_user_id, mode, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_osu_user_snapshots_discord_lookup
ON osu_user_snapshots (discord_id, mode, captured_at DESC);

-- サンプルデータの挿入（テスト用）
-- 注意: 実際のDiscord IDとosu! User IDに置き換えてください
INSERT INTO osu_tracked_users (discord_id, osu_user_id, osu_username) 
VALUES ('123456789', 7562902, 'Vaxei') 
ON CONFLICT (discord_id) DO NOTHING;

INSERT INTO osu_user_snapshots (discord_id, osu_user_id, osu_username, mode, pp, global_rank, play_count)
VALUES ('123456789', 7562902, 'Vaxei', 'osu', 15000.0, 1, 50000)
ON CONFLICT DO NOTHING;