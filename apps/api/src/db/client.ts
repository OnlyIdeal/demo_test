import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const databasePath = resolve(rootDir, process.env.DATABASE_PATH ?? 'apps/api/data/ai-ems.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('foreign_keys = ON');
const schemaSqlPath = resolve(rootDir, 'database.sql');
if (process.env.INIT_DATABASE !== 'false') {
  sqlite.exec(readFileSync(schemaSqlPath, 'utf8'));
  const applicationColumns = sqlite.prepare("PRAGMA table_info(applications)").all() as Array<{ name: string }>;
  if (!applicationColumns.some((column) => column.name === 'approval_stage')) {
    sqlite.exec("ALTER TABLE applications ADD COLUMN approval_stage TEXT NOT NULL DEFAULT 'manager' CHECK (approval_stage IN ('manager', 'budget_admin', 'completed'))");
  }
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
