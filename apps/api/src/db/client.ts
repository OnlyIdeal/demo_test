import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

function migrateUsersForSystemAdmin(sqlite: Database.Database) {
  const table = sqlite.prepare('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?').get('table', 'users') as { sql: string };
  if (!table) return;
  if (table.sql.includes('system_admin')) return;
  sqlite.pragma('foreign_keys = OFF');
  sqlite.pragma('legacy_alter_table = ON');
  sqlite.exec('BEGIN; ALTER TABLE users RENAME TO users_legacy;');
  const userColumns = [
    'id TEXT PRIMARY KEY', 'username TEXT NOT NULL UNIQUE', 'password_hash TEXT NOT NULL',
    'name TEXT NOT NULL', 'email TEXT NOT NULL UNIQUE',
    'role TEXT NOT NULL CHECK (role IN (\'employee\', \'manager\', \'budget_admin\', \'system_admin\'))',
    'department_id TEXT NOT NULL',
    'status TEXT NOT NULL DEFAULT \'active\' CHECK (status IN (\'active\', \'inactive\'))',
    'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP', 'updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT',
  ];
  sqlite.exec(`CREATE TABLE users (${userColumns.join(', ')})`);
  sqlite.exec('INSERT INTO users SELECT * FROM users_legacy; DROP TABLE users_legacy; COMMIT;');
  sqlite.pragma('legacy_alter_table = OFF');
  sqlite.pragma('foreign_keys = ON');
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const databasePath = resolve(rootDir, process.env.DATABASE_PATH ?? 'apps/api/data/ai-ems.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('foreign_keys = ON');
const schemaSqlPath = resolve(rootDir, 'database.sql');
if (process.env.INIT_DATABASE !== 'false') {
  migrateUsersForSystemAdmin(sqlite);
  sqlite.exec(readFileSync(schemaSqlPath, 'utf8'));
  const applicationColumns = sqlite.prepare("PRAGMA table_info(applications)").all() as Array<{ name: string }>;
  if (!applicationColumns.some((column) => column.name === 'approval_stage')) {
    sqlite.exec("ALTER TABLE applications ADD COLUMN approval_stage TEXT NOT NULL DEFAULT 'manager' CHECK (approval_stage IN ('manager', 'budget_admin', 'completed'))");
  }
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
