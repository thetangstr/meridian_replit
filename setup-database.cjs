// Setup database tables for PostgreSQL
const { db } = require('./shared/db');
const { sql } = require('drizzle-orm');

async function main() {
  console.log('Setting up database tables...');
  
  try {
    // Drop all tables first for a clean slate
    console.log('Dropping all existing tables...');
    await db.execute(sql`
      DROP TABLE IF EXISTS reviewer_assignments CASCADE;
      DROP TABLE IF EXISTS category_evaluations CASCADE;
      DROP TABLE IF EXISTS task_evaluations CASCADE;
      DROP TABLE IF EXISTS reports CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS cujs CASCADE;
      DROP TABLE IF EXISTS cuj_categories CASCADE;
      DROP TABLE IF EXISTS cars CASCADE;
      DROP TABLE IF EXISTS cuj_database_versions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS scoring_configs CASCADE;
      DROP TABLE IF EXISTS media_items CASCADE;
    `);
    
    // Create tables in the correct order
    console.log('Creating users table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reviewer'
      );
    `);
    
    console.log('Creating cuj_database_versions table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cuj_database_versions (
        id SERIAL PRIMARY KEY,
        version_number TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        source_file_name TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);
    
    console.log('Creating cuj_categories table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cuj_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'category'
      );
    `);
    
    console.log('Creating cujs table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cujs (
        id SERIAL PRIMARY KEY, 
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER NOT NULL REFERENCES cuj_categories(id)
      );
    `);
    
    console.log('Creating tasks table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        cuj_id INTEGER NOT NULL REFERENCES cujs(id),
        prerequisites TEXT,
        expected_outcome TEXT NOT NULL
      );
    `);
    
    console.log('Creating cars table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        android_version TEXT NOT NULL,
        build_fingerprint TEXT NOT NULL,
        location TEXT NOT NULL,
        image_url TEXT
      );
    `);
    
    console.log('Creating reviews table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        car_id INTEGER NOT NULL REFERENCES cars(id),
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'not_started',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        cuj_database_version_id INTEGER REFERENCES cuj_database_versions(id),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_modified_by INTEGER REFERENCES users(id),
        last_modified_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Creating task_evaluations table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_evaluations (
        review_id INTEGER NOT NULL REFERENCES reviews(id),
        task_id INTEGER NOT NULL REFERENCES tasks(id),
        doable_score INTEGER,
        usability_score INTEGER,
        visuals_score INTEGER,
        feedback TEXT,
        issues TEXT,
        media_ids TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (review_id, task_id)
      );
    `);
    
    console.log('Creating category_evaluations table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS category_evaluations (
        review_id INTEGER NOT NULL REFERENCES reviews(id),
        category_id INTEGER NOT NULL REFERENCES cuj_categories(id),
        responsiveness_score INTEGER,
        writing_score INTEGER,
        emotional_score INTEGER,
        feedback TEXT,
        issues TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (review_id, category_id)
      );
    `);
    
    console.log('Creating reports table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        review_id INTEGER NOT NULL UNIQUE REFERENCES reviews(id),
        overall_score DOUBLE PRECISION,
        category_scores JSONB,
        task_scores JSONB,
        summary TEXT,
        top_issues JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        last_modified_by INTEGER REFERENCES users(id)
      );
    `);
    
    console.log('Creating scoring_configs table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scoring_configs (
        id SERIAL PRIMARY KEY,
        task_doable_weight DOUBLE PRECISION NOT NULL DEFAULT 0.4375,
        task_usability_weight DOUBLE PRECISION NOT NULL DEFAULT 0.375,
        task_visuals_weight DOUBLE PRECISION NOT NULL DEFAULT 0.1875,
        category_tasks_weight DOUBLE PRECISION NOT NULL DEFAULT 0.6,
        category_responsiveness_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15,
        category_writing_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15,
        category_emotional_weight DOUBLE PRECISION NOT NULL DEFAULT 0.1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER REFERENCES users(id)
      );
    `);
    
    console.log('Creating media_items table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        url TEXT NOT NULL,
        type TEXT NOT NULL,
        thumbnail_url TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Creating reviewer_assignments table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviewer_assignments (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES cuj_categories(id),
        car_id INTEGER NOT NULL REFERENCES cars(id),
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(category_id, car_id)
      );
    `);
    
    console.log('Database setup complete!');
    
    // Insert default values including a scoring configuration
    console.log('Inserting default scoring configuration...');
    await db.execute(sql`
      INSERT INTO scoring_configs (
        task_doable_weight, 
        task_usability_weight, 
        task_visuals_weight, 
        category_tasks_weight, 
        category_responsiveness_weight, 
        category_writing_weight, 
        category_emotional_weight
      ) VALUES (
        0.4375, 0.375, 0.1875, 0.6, 0.15, 0.15, 0.1
      )
    `);
    
    console.log('All done!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();