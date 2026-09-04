const API_BASE = 'http://localhost:4000/api';

const state = {
  tasks: [],
  priorityFilter: '',
  searchQuery: '',
};

// ---------- DOM refs ----------
const els = {
  form: document.getElementById('taskForm'),
  titleInput: document.getElementById('titleInput'),
  descInput: document.getElementById('descInput'),
  priorityInput: document.getElementById('priorityInput'),
  dueInput: document.getElementById('dueInput'),
  submitBtn: document.getElementById('submitBtn'),
  searchInput: document.getElementById('searchInput'),
  priorityFilters: document.getElementById('priorityFilters'),
  requestStatus: document.getElementById('requestStatus'),
  connDot: document.getElementById('connDot'),
  toast: document.getElementById('toast'),
  lists: {
    todo: document.getElementById('list-todo'),
    in_progress: document.getElementById('list-in_progress'),
    done: document.getElementById('list-done'),
  },
  counts: {
    todo: document.getElementById('countTodo'),
    in_progress: document.getElementById('countProgress'),
    done: document.getElementById('countDone'),
  },
  stats: {
    total: document.getElementById('statTotal'),
    todo: document.getElementById('statTodo'),
    progress: document.getElementById('statProgress'),
    done: document.getElementById('statDone'),
  },
  modalBackdrop: document.getElementById('modalBackdrop'),
  editForm: document.getElementById('editForm'),
  editId: document.getElementById('editId'),
  editTitle: document.getElementById('editTitle'),
  editDesc: document.getElementById('editDesc'),
  editStatus: document.getElementById('editStatus'),
  editPriority: document.getElementById('editPriority'),
  editDue: document.getElementById('editDue'),
  cancelEdit: document.getElementById('cancelEdit'),
  deleteTaskBtn: document.getElementById('deleteTaskBtn'),
};

// ---------- Helpers ----------
function showToast(message, type = '') {
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.className = 'toast';
  }, 2600);
}

function setBusy(isBusy, label = '') {
  els.requestStatus.textContent = isBusy ? label : '';
  els.submitBtn.disabled = isBusy;
}

function formatDue(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = d < today;
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, overdue };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- API layer (async/await fetch) ----------
async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch (_) { /* no body */ }
    const message = body.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function fetchTasks() {
  const params = new URLSearchParams();
  if (state.priorityFilter) params.set('priority', state.priorityFilter);
  if (state.searchQuery) params.set('q', state.searchQuery);
  const qs = params.toString();
  return apiRequest(`/tasks${qs ? `?${qs}` : ''}`);
}

async function createTask(payload) {
  return apiRequest('/tasks', { method: 'POST', body: JSON.stringify(payload) });
}

async function updateTask(id, payload) {
  return apiRequest(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

async function patchTask(id, payload) {
  return apiRequest(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

async function deleteTask(id) {
  return apiRequest(`/tasks/${id}`, { method: 'DELETE' });
}

async function fetchStats() {
  return apiRequest('/stats');
}

// ---------- Rendering ----------
function render() {
  const grouped = { todo: [], in_progress: [], done: [] };
  state.tasks.forEach(t => grouped[t.status]?.push(t));

  Object.entries(grouped).forEach(([status, tasks]) => {
    const list = els.lists[status];
    list.innerHTML = '';
    if (tasks.length === 0) {
      list.innerHTML = `<div class="empty-state">No tasks here</div>`;
    } else {
      tasks.forEach(task => list.appendChild(buildCard(task)));
    }
    els.counts[status].textContent = tasks.length;
  });
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = task.id;

  const due = formatDue(task.due_date);

  card.innerHTML = `
    <div class="card__top">
      <div class="card__title">${escapeHtml(task.title)}</div>
      <span class="pill pill--${task.priority}">${task.priority}</span>
    </div>
    ${task.description ? `<div class="card__desc">${escapeHtml(task.description)}</div>` : ''}
    <div class="card__meta">
      <span class="card__id">#${task.id}</span>
      ${due ? `<span class="card__due ${due.overdue && task.status !== 'done' ? 'overdue' : ''}">due ${due.label}</span>` : '<span></span>'}
    </div>
  `;

  card.addEventListener('click', () => openEditModal(task));

  card.addEventListener('dragstart', () => {
    card.classList.add('dragging');
    dragState.taskId = task.id;
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragState.taskId = null;
  });

  return card;
}

async function renderStats() {
  try {
    const stats = await fetchStats();
    els.stats.total.textContent = stats.total;
    els.stats.todo.textContent = stats.todo;
    els.stats.progress.textContent = stats.in_progress;
    els.stats.done.textContent = stats.done;
  } catch (_) { /* silent — stats are non-critical */ }
}

// ---------- Load ----------
async function loadTasks() {
  setBusy(true, 'loading...');
  try {
    state.tasks = await fetchTasks();
    render();
    setConnectionState(true);
  } catch (err) {
    setConnectionState(false);
    showToast(`Couldn't load tasks: ${err.message}`, 'error');
  } finally {
    setBusy(false);
  }
  renderStats();
}

function setConnectionState(online) {
  els.connDot.classList.toggle('online', online);
  els.connDot.classList.toggle('offline', !online);
  els.connDot.title = online ? 'API connected' : 'API unreachable — is the backend running on :4000?';
}

// ---------- Create ----------
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.titleInput.value.trim();
  if (!title) return;

  const payload = {
    title,
    description: els.descInput.value.trim(),
    priority: els.priorityInput.value,
    due_date: els.dueInput.value || null,
  };

  setBusy(true, 'adding...');
  try {
    await createTask(payload);
    els.form.reset();
    els.priorityInput.value = 'medium';
    showToast('Task added', 'success');
    await loadTasks();
  } catch (err) {
    showToast(`Couldn't add task: ${err.message}`, 'error');
  } finally {
    setBusy(false);
  }
});

// ---------- Search / filter ----------
let searchDebounce;
els.searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchQuery = els.searchInput.value.trim();
    loadTasks();
  }, 300);
});

els.priorityFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  [...els.priorityFilters.children].forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  state.priorityFilter = btn.dataset.priority;
  loadTasks();
});

// ---------- Edit modal ----------
let editingTask = null;

function openEditModal(task) {
  editingTask = task;
  els.editId.value = task.id;
  els.editTitle.value = task.title;
  els.editDesc.value = task.description || '';
  els.editStatus.value = task.status;
  els.editPriority.value = task.priority;
  els.editDue.value = task.due_date || '';
  els.modalBackdrop.classList.add('show');
}

function closeEditModal() {
  els.modalBackdrop.classList.remove('show');
  editingTask = null;
}

els.cancelEdit.addEventListener('click', closeEditModal);
els.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === els.modalBackdrop) closeEditModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && els.modalBackdrop.classList.contains('show')) closeEditModal();
});

els.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = els.editId.value;
  const payload = {
    title: els.editTitle.value.trim(),
    description: els.editDesc.value.trim(),
    status: els.editStatus.value,
    priority: els.editPriority.value,
    due_date: els.editDue.value || null,
  };

  try {
    await updateTask(id, payload);
    showToast('Task updated', 'success');
    closeEditModal();
    await loadTasks();
  } catch (err) {
    showToast(`Couldn't update task: ${err.message}`, 'error');
  }
});

els.deleteTaskBtn.addEventListener('click', async () => {
  if (!editingTask) return;
  if (!confirm(`Delete "${editingTask.title}"? This can't be undone.`)) return;

  try {
    await deleteTask(editingTask.id);
    showToast('Task deleted', 'success');
    closeEditModal();
    await loadTasks();
  } catch (err) {
    showToast(`Couldn't delete task: ${err.message}`, 'error');
  }
});

// ---------- Drag and drop between columns ----------
const dragState = { taskId: null };

Object.entries(els.lists).forEach(([status, listEl]) => {
  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    listEl.classList.add('dragover');
  });
  listEl.addEventListener('dragleave', () => listEl.classList.remove('dragover'));
  listEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    listEl.classList.remove('dragover');
    if (!dragState.taskId) return;

    const task = state.tasks.find(t => t.id === dragState.taskId);
    if (!task || task.status === status) return;

    try {
      await patchTask(dragState.taskId, { status });
      showToast(`Moved to ${status.replace('_', ' ')}`, 'success');
      await loadTasks();
    } catch (err) {
      showToast(`Couldn't move task: ${err.message}`, 'error');
    }
  });
});

// ---------- Init ----------
loadTasks();
setInterval(renderStats, 15000);
