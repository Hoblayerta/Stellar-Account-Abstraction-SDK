import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/recovery.db';

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
export function initializeDatabase() {
  console.log('🔧 Initializing database...');

  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  db.exec(schema);

  console.log('✅ Database initialized');
}

// Cleanup old verification codes
export function cleanupExpiredCodes() {
  const stmt = db.prepare(`
    DELETE FROM verification_codes
    WHERE expires_at < datetime('now') OR used = 1
  `);

  const result = stmt.run();
  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} expired verification codes`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredCodes, 60 * 60 * 1000);
