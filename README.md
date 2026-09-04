# Task Dashboard — Interactive Dynamic Task Dashboard Platform

A full-stack CRUD app: a Vanilla JS frontend talking to a Node.js/Express API backed by a local SQLite database.

- **Backend:** Node.js + Express + SQLite (Node's built-in `node:sqlite` module — no extra database package to install, no native compilation needed) — REST API with full Create, Read, Update, Delete
- **Frontend:** Vanilla JS (no framework, no build step) using `async/await fetch()` — dark "control panel" themed Kanban board
- **Database:** SQLite file, created automatically on first run (`backend/dashboard.db`)

> Requires **Node.js 22.5 or newer** (SQLite support was added to Node in that version). Check your version with `node --version`.

## 1. Install & run the backend

```bash
cd backend
npm install
npm start
```

This starts the API at **http://localhost:4000**. On first run it creates `dashboard.db` and seeds 3 example tasks.

Health check: open http://localhost:4000/api/health — should return `{"ok":true}`.

## 2. Run the frontend

The frontend is plain HTML/CSS/JS, so you just need to serve the folder (opening `index.html` directly with `file://` also works since CORS is enabled on the backend, but a local server avoids browser quirks).

**Option A — Python (already on most machines):**
```bash
cd frontend
python3 -m http.server 5500
```
Then open **http://localhost:5500**

**Option B — VS Code "Live Server" extension:** right-click `frontend/index.html` → "Open with Live Server".

> Keep the backend (`npm start` in `backend/`) running in a separate terminal while you use the dashboard.

## 3. What you can do

- **Create** — type a title (required), optional description, priority, and due date in the top bar, then "Add task"
- **Read** — tasks load automatically into three columns: To do / In progress / Done. Search box and priority chips filter the list live.
- **Update** — click any card to open the edit modal (change title, description, status, priority, due date), or drag a card into a different column to change its status instantly
- **Delete** — open a card's edit modal and click "Delete"

## API reference

| Method | Route              | Description                          |
|--------|---------------------|---------------------------------------|
| GET    | `/api/tasks`         | List tasks (`?status=`, `?priority=`, `?q=` filters) |
| GET    | `/api/tasks/:id`      | Get one task |
| POST   | `/api/tasks`          | Create a task |
| PUT    | `/api/tasks/:id`      | Full update |
| PATCH  | `/api/tasks/:id`      | Partial update (e.g. just status) |
| DELETE | `/api/tasks/:id`      | Delete a task |
| GET    | `/api/stats`          | Counts by status |

Task shape:
```json
{
  "id": 1,
  "title": "string, required",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority": "low | medium | high",
  "due_date": "YYYY-MM-DD or null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## Project structure

```
task-dashboard/
├── backend/
│   ├── server.js       # Express app + all CRUD routes + validation
│   ├── db.js            # SQLite connection, schema, seed data
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js            # all fetch()/async-await calls to the API
└── README.md
```

## Notes for presenting/submitting this

- The backend validates every input server-side (missing title, bad status/priority values, unknown ids) and returns proper HTTP status codes (400/404/500), so it's not just a happy-path demo.
- If the connection dot in the top-left turns red, the frontend can't reach the backend — check that `npm start` is running on port 4000.
- To change the API port, set `PORT=xxxx npm start` in `backend/` and update `API_BASE` at the top of `frontend/app.js` to match.
