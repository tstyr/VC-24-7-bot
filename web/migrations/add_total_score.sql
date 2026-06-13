-- osu_user_snapshotsテーブルにtotal_scoreカラムを追加
ALTER TABLE osu_user_snapshots 
ADD COLUMN IF NOT EXISTS total_score BIGINT DEFAULT 0;

-- 既存データを更新（テスト用のダミーデータ）
UPDATE osu_user_snapshots 
SET total_score = CAST(pp * 100000 AS BIGINT)
WHERE total_score = 0 OR total_score IS NULL;

-- データを確認
SELECT osu_username, mode, pp, global_rank, play_count, total_score 
FROM osu_user_snapshots 
ORDER BY captured_at DESC 
LIMIT 10;