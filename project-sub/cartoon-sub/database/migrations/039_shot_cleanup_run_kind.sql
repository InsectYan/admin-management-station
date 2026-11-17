DELETE FROM cartoon_prompt_traces AS trace
WHERE NOT EXISTS (
  SELECT 1 FROM cartoon_shots AS shot WHERE shot.id = trace.shot_id
);

ALTER TABLE cartoon_prompt_traces DROP CONSTRAINT IF EXISTS cartoon_prompt_traces_shot_id_fkey;
ALTER TABLE cartoon_prompt_traces
  ADD CONSTRAINT cartoon_prompt_traces_shot_id_fkey
  FOREIGN KEY (shot_id) REFERENCES cartoon_shots(id) ON DELETE CASCADE;

ALTER TABLE cartoon_full_runs ADD COLUMN IF NOT EXISTS run_kind VARCHAR(32) NOT NULL DEFAULT 'full';

UPDATE cartoon_full_runs
SET run_kind = 'assets'
WHERE scope IN ('assets', 'assets-reset') AND run_kind = 'full';

UPDATE cartoon_full_runs
SET run_kind = 'profiles'
WHERE scope = 'profiles' AND run_kind = 'full';
