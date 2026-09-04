const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const VALID_STATUS = ['todo', 'in_progress', 'done'];
const VALID_PRIORITY = ['low', 'medium', 'high'];

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

function validateTaskInput(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('title is required and must be a non-empty string');
    } else {
      data.title = body.title.trim();
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description must be a string');
    } else {
      data.description = body.description;
    }
  } else if (!partial) {
    data.description = '';
  }

  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status)) {
      errors.push(`status must be one of: ${VALID_STATUS.join(', ')}`);
    } else {
      data.status = body.status;
    }
  } else if (!partial) {
    data.status = 'todo';
  }

  if (body.priority !== undefined) {
    if (!VALID_PRIORITY.includes(body.priority)) {
      errors.push(`priority must be one of: ${VALID_PRIORITY.join(', ')}`);
    } else {
      data.priority = body.priority;
    }
  } else if (!partial) {
    data.priority = 'medium';
  }

  if (body.due_date !== undefined) {
    data.due_date = body.due_date === '' ? null : body.due_date;
  } else if (!partial) {
    data.due_date = null;
  }

  return { errors, data };
}

// GET /api/tasks - list all (supports ?status= & ?priority= & ?q= filters)
app.get('/api/tasks', (req, res) => {
  const { status, priority, q } = req.query;
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (status) {
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: `invalid status filter: ${status}` });
    }
    query += ' AND status = ?';
    params.push(status);
  }
  if (priority) {
    if (!VALID_PRIORITY.includes(priority)) {
      return res.status(400).json({ error: `invalid priority filter: ${priority}` });
    }
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (q) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch tasks', details: err.message });
  }
});

// GET /api/tasks/:id - get single task
app.get('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(task);
});

// POST /api/tasks - create
app.post('/api/tasks', (req, res) => {
  const { errors, data } = validateTaskInput(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'validation failed', details: errors });

  try {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(data.title, data.description, data.status, data.priority, data.due_date);
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: 'failed to create task', details: err.message });
  }
});

// PUT /api/tasks/:id - full update
app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'task not found' });

  const { errors, data } = validateTaskInput(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'validation failed', details: errors });

  try {
    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?,
          priority = ?, due_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(data.title, data.description, data.status, data.priority, data.due_date, id);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'failed to update task', details: err.message });
  }
});

// PATCH /api/tasks/:id - partial update (e.g. drag-and-drop status change)
app.patch('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'task not found' });

  const { errors, data } = validateTaskInput(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'validation failed', details: errors });
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'no valid fields to update' });

  const merged = { ...existing, ...data, id };

  try {
    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?,
          priority = ?, due_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(merged.title, merged.description, merged.status, merged.priority, merged.due_date, merged.id);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'failed to update task', details: err.message });
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'task not found' });

  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'failed to delete task', details: err.message });
  }
});

// GET /api/stats - small aggregate used by the dashboard header
app.get('/api/stats', (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all();
  const stats = { todo: 0, in_progress: 0, done: 0, total: 0 };
  rows.forEach(r => { stats[r.status] = r.count; stats.total += r.count; });
  res.json(stats);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Task Dashboard API running on http://localhost:${PORT}`);
});
