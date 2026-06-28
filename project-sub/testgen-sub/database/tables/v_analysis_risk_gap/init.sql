-- 风险覆盖缺口
CREATE OR REPLACE VIEW v_analysis_risk_gap AS
SELECT * FROM v_metric_risk_guard_coverage WHERE coverage_status IN ('GAP', 'PARTIAL');;
