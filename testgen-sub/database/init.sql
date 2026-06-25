-- testgen_db 初始化（app_key=testgen · AI智能测试平台）

CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  doc_type      VARCHAR(32) NOT NULL DEFAULT 'markdown',
  content       TEXT,
  file_path     VARCHAR(512),
  file_size     INT,
  source        VARCHAR(64) DEFAULT 'upload',
  parse_status  VARCHAR(32) DEFAULT 'pending',
  parse_error   TEXT,
  parsed_meta   JSONB DEFAULT '{}',
  tags          JSONB DEFAULT '[]',
  metadata      JSONB DEFAULT '{}',
  upload_user   VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_documents_parse_status ON documents (parse_status);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents (doc_type);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id          SERIAL PRIMARY KEY,
  module      VARCHAR(64) NOT NULL,
  tag         VARCHAR(64),
  title       VARCHAR(255),
  content     TEXT NOT NULL,
  entity_refs JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_module_tag ON knowledge_entries (module, tag);

CREATE TABLE IF NOT EXISTS modules (
  id    SERIAL PRIMARY KEY,
  code  VARCHAR(64) UNIQUE NOT NULL,
  name  VARCHAR(100) NOT NULL,
  sort  INT DEFAULT 0
);

INSERT INTO modules (code, name, sort) VALUES
  ('course_booking', '课程预约', 1),
  ('equipment_loan', '设备借用', 2),
  ('membership', '会员管理', 3)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS generation_jobs (
  id              SERIAL PRIMARY KEY,
  document_id     INT REFERENCES documents(id) ON DELETE SET NULL,
  module          VARCHAR(64) NOT NULL,
  test_types      JSONB NOT NULL DEFAULT '[]',
  options         JSONB DEFAULT '{}',
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  current_phase   VARCHAR(32) DEFAULT 'analyze',
  progress        JSONB DEFAULT '{"analyze":0,"functional":0,"edge":0,"review":0}',
  steps_log       JSONB DEFAULT '[]',
  agent_run_id    INT,
  error_message   TEXT,
  created_by      VARCHAR(100),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs (status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_document ON generation_jobs (document_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON generation_jobs (created_at DESC);

CREATE TABLE IF NOT EXISTS test_cases (
  id              SERIAL PRIMARY KEY,
  job_id          INT REFERENCES generation_jobs(id) ON DELETE CASCADE,
  case_id         VARCHAR(64) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  module          VARCHAR(64),
  type            VARCHAR(32),
  priority        VARCHAR(16) DEFAULT 'medium',
  status          VARCHAR(20) DEFAULT 'pending',
  confidence      REAL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  compliance      VARCHAR(32) DEFAULT 'unverified',
  preconditions   TEXT,
  steps           JSONB NOT NULL DEFAULT '[]',
  expected        TEXT,
  tags            JSONB DEFAULT '[]',
  document_id     INT REFERENCES documents(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_test_cases_job ON test_cases (job_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_module_type ON test_cases (module, type);
