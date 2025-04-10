import { db } from './shared/db.js';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Setting up local database...');
  
  try {
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, password, name, role)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run('admin', hashedPassword, 'Admin User', 'admin');

    console.log('Local database setup complete!');
    console.log('You can now login with:');
    console.log('Username: admin');
    console.log('Password: password123');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

main(); 