-- 小说概要：全书故事长文真源（数百～数千字），与短简介 summary 区分
ALTER TABLE novels ADD COLUMN IF NOT EXISTS story_overview TEXT;
