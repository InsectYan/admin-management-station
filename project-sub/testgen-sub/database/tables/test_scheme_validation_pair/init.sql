CREATE TABLE IF NOT EXISTS test_scheme_validation_pair (
  pair_id VARCHAR(64) PRIMARY KEY,
  scheme_id VARCHAR(64) REFERENCES test_scheme_enum(scheme_id),
  validation_id VARCHAR(64) REFERENCES test_validation_enum(validation_id),
  scheme_name TEXT,
  validation_name TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P01', 'TS-01-DET', 'VS-01-EXACT', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P02', 'TS-01-DET', 'VS-02-CONTRACT', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P03', 'TS-02-BND', 'VS-01-EXACT', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P04', 'TS-02-BND', 'VS-02-CONTRACT', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P05', 'TS-03-REP', 'VS-08-PASSK', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P06', 'TS-03-REP', 'VS-07-RATE-M', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P07', 'TS-04-SET', 'VS-07-RATE-M', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P08', 'TS-04-SET', 'VS-07-RATE-H', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P09', 'TS-05-CHAIN', 'VS-04-CHAIN-OK', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P10', 'TS-06-PAIR', 'VS-03-ZERO', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P11', 'TS-06-PAIR', 'VS-01-EXACT', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P12', 'TS-07-NEG', 'VS-09-BLOCK-H', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P13', 'TS-07-NEG', 'VS-03-ZERO', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P14', 'TS-08-OBS', 'VS-05-PRESENCE', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P15', 'TS-08-OBS', 'VS-06-COMPLETE', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P16', 'TS-09-LOAD', 'VS-10-SLO-M', TRUE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P17', 'TS-09-LOAD', 'VS-01-EXACT', FALSE) ON CONFLICT (pair_id) DO NOTHING;
INSERT INTO test_scheme_validation_pair (pair_id, scheme_id, validation_id, is_primary) VALUES ('P18', 'TS-10-MAN', 'VS-11-MAJORITY', TRUE) ON CONFLICT (pair_id) DO NOTHING;
