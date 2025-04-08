-- Drop and recreate reports table to match the schema
DROP TABLE IF EXISTS reports CASCADE;

-- Recreate reports table with correct schema
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  overall_score DOUBLE PRECISION,
  top_likes TEXT,
  top_hates TEXT,
  benchmark_rank INTEGER,
  benchmark_comparison TEXT,
  top_issues JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  last_modified_by INTEGER REFERENCES users(id)
);