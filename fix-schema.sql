-- Drop tables with mismatched schema
DROP TABLE IF EXISTS task_evaluations CASCADE;
DROP TABLE IF EXISTS category_evaluations CASCADE;

-- Recreate Task Evaluations table with correct schema
CREATE TABLE IF NOT EXISTS task_evaluations (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  doable BOOLEAN,
  undoable_reason TEXT,
  usability_score INTEGER,
  usability_feedback TEXT,
  visuals_score INTEGER,
  visuals_feedback TEXT,
  media JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recreate Category Evaluations table with correct schema
CREATE TABLE IF NOT EXISTS category_evaluations (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  category_id INTEGER NOT NULL REFERENCES cuj_categories(id),
  responsiveness_score INTEGER,
  responsiveness_feedback TEXT,
  writing_score INTEGER,
  writing_feedback TEXT,
  emotional_score INTEGER,
  emotional_feedback TEXT,
  media JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create a constraint to ensure only one reviewer assignment per car per category
ALTER TABLE reviewer_assignments ADD CONSTRAINT reviewer_assignments_unique_car_category UNIQUE(car_id, category_id);