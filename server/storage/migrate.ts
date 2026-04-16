import Database from 'better-sqlite3';
import path from 'path';
import { initialMigration } from './migrations/001_initial';

const dbPath = path.resolve(__dirname, '../../data/arch_trainer.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(initialMigration);

console.log('Migration complete.');
