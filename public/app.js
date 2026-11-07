const elements = {
  loginScreen: document.getElementById('authPanel'),
  loginForm: document.getElementById('authForm'),
  tokenInput: document.getElementById('token'),
  tasksScreen: document.getElementById('workspace'),
  logoutButton: document.getElementById('logout'),
  taskForm: document.getElementById('taskForm'),
  titleInput: document.getElementById('title'),
  taskList: document.getElementById('tasks'),
  emptyMessage: document.getElementById('empty'),
  runIdInput: document.getElementById('runId'),
  loadButton: document.getElementById('load'),
  message: document.getElementById('message'),
  author: document.getElementById('author'),
};

let apiToken = '';
let currentRunId = 'manual';
let tasks = [];
let busy = false;

function showError(message = '') {
  elements.message.textContent = message;
}

function getRunId() {
  const runId = elements.runIdInput.value.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(runId)) {
    throw new Error('Набор: 1–64 символа (латиница, цифры, _ или -).');
  }
  return runId;
}

async function request(url, method = 'GET', data) {
  const headers = { Authorization: `Bearer ${apiToken}` };
  const options = { method, headers };

  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  if (response.status === 204) return null;

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Ошибка сервера (${response.status}).`);
  }
  return result;
}

async function loadTasks(runId = currentRunId) {
  const loadedTasks = await request(`/api/tasks/?runId=${encodeURIComponent(runId)}`);
  currentRunId = runId;
  tasks = loadedTasks;
  renderTasks();
}

async function createTask(title) {
  await request('/api/tasks/', 'POST', { title, runId: currentRunId });
  await loadTasks();
}

async function updateTask(id, changes) {
  await request(`/api/tasks/${id}/`, 'PATCH', changes);
  await loadTasks();
}

async function deleteTask(id) {
  await request(`/api/tasks/${id}/`, 'DELETE');
  await loadTasks();
}


async function perform(action) {
  if (busy) return;
  busy = true;
  showError();

  try {
    await action();
  } catch (error) {
    showError(error.message || 'Не удалось выполнить действие.');
    if (apiToken && !elements.tasksScreen.hidden) {
      await loadTasks().catch(() => {});
    }
  } finally {
    busy = false;
  }
}

function makeButton(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function editTask(task, row) {
  const form = document.createElement('form');
  form.className = 'task-edit';

  const input = document.createElement('input');
  input.value = task.title;
  input.maxLength = 200;
  input.required = true;
  input.setAttribute('aria-label', 'Изменить задачу');

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.textContent = 'Сохранить';

  const cancelButton = makeButton('Отмена', renderTasks);
  form.append(input, saveButton, cancelButton);
  row.replaceChildren(form);
  input.focus();
  input.select();

  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    perform(() => updateTask(task.id, { title }));
  });
}

function makeTaskRow(task) {
  const row = document.createElement('li');
  row.className = `task-row${task.done ? ' done' : ''}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', `Выполнено: ${task.title}`);
  checkbox.addEventListener('change', () => {
    perform(() => updateTask(task.id, { done: checkbox.checked }));
  });

  const title = document.createElement('span');
  title.className = 'task-text';
  title.textContent = task.title;

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const editButton = makeButton('Изменить', () => editTask(task, row));
  const deleteButton = makeButton('Удалить', () => {
    if (window.confirm('Удалить задачу?')) {
      perform(() => deleteTask(task.id));
    }
  });

  actions.append(editButton, deleteButton);
  row.append(checkbox, title, actions);
  return row;
}

function renderTasks() {
  elements.taskList.replaceChildren(...tasks.map(makeTaskRow));
  elements.emptyMessage.hidden = tasks.length > 0;
}

function showTasksScreen() {
  elements.loginScreen.hidden = true;
  elements.tasksScreen.hidden = false;
  elements.tokenInput.value = '';
  elements.titleInput.focus();
}

function showLoginScreen() {
  apiToken = '';
  elements.author.textContent = '';
  tasks = [];

  elements.tasksScreen.hidden = true;
  elements.loginScreen.hidden = false;
  elements.taskList.replaceChildren();

  showError();
  elements.tokenInput.focus();
}


elements.loginForm.addEventListener('submit', event => {
  event.preventDefault();

  perform(async () => {
    apiToken = elements.tokenInput.value.trim();

    const author = await request('/api/author/');
    elements.author.textContent = `${author.fullName} (${author.login})`;

    await loadTasks(getRunId());
    showTasksScreen();
  });
});

elements.logoutButton.addEventListener('click', showLoginScreen);

elements.taskForm.addEventListener('submit', event => {
  event.preventDefault();
  const title = elements.titleInput.value.trim();
  if (!title) return;

  perform(async () => {
    await createTask(title);
    elements.titleInput.value = '';
    elements.titleInput.focus();
  });
});

elements.loadButton.addEventListener('click', () => {
  perform(() => loadTasks(getRunId()));
});
