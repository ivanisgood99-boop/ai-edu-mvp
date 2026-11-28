ALTER TABLE private.learning_level_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.learning_level_requirements FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE private.learning_level_requirements IS 'Server-only allowlist of curriculum question IDs used by SECURITY DEFINER learning progress RPCs.';