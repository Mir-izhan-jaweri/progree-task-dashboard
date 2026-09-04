const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'dashboard.db'));

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed a few example rows only if table is empty, so the dashboard isn't blank on first run
const count = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
if (count === 0) {
  const seed = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, due_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  seed.run('Design database schema', 'Define tables and relationships for the dashboard', 'done', 'high', null);
  seed.run('Build REST API', 'Implement CRUD endpoints with Express', 'in_progress', 'high', null);
  seed.run('Connect frontend to API', 'Wire up fetch calls with async/await', 'todo', 'medium', null);
}

module.exports = db;
