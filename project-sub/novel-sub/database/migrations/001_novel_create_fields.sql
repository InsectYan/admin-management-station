-- novels 表扩展：创作向导基础字段 + setting_json

ALTER TABLE novels ADD COLUMN IF NOT EXISTS creative_intent TEXT;
ALTER TABLE novels ADD COLUMN IF NOT EXISTS target_audience VARCHAR(200);
ALTER TABLE novels ADD COLUMN IF NOT EXISTS update_cadence VARCHAR(50);
ALTER TABLE novels ADD COLUMN IF NOT EXISTS setting_json JSONB DEFAULT '{}';
