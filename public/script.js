const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-input');
const taskList = document.querySelector('#task-list');
const formMessage = document.querySelector('#form-message');
const filterButtons = document.querySelectorAll('.filter-button');

let tasks = [];
let activeFilter = 'all';

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || 'The request could not be completed.');
  }

  return response.status === 204 ? null : response.json();
}

function renderTasks() {
  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;
  const highPriorityCount = tasks.filter((task) => task.priority === 'High').length;
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#completed-count').textContent = completedCount;
  document.querySelector('#pending-count').textContent = pendingCount;
  document.querySelector('#high-count').textContent = highPriorityCount;

  const visibleTasks = tasks.filter((task) => {
    if (activeFilter === 'pending') return !task.completed;
    if (activeFilter === 'completed') return task.completed;
    return true;
  });
  document.querySelector('#visible-count').textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'}`;
  taskList.replaceChildren();

  if (visibleTasks.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    const mark = document.createElement('span');
    mark.className = 'empty-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = activeFilter === 'completed' ? '\u2713' : '+';
    const heading = document.createElement('strong');
    heading.textContent = activeFilter === 'completed' ? 'No completed tasks yet' : activeFilter === 'pending' ? 'All caught up' : 'A fresh page';
    const message = document.createElement('p');
    message.textContent = activeFilter === 'completed' ? 'Finish a task and it will show up here.' : activeFilter === 'pending' ? 'Every task on your list is complete.' : 'Add a study task above to get your sprint started.';
    emptyState.append(mark, heading, message);
    taskList.append(emptyState);
    return;
  }

  for (const task of visibleTasks) {
    const row = document.createElement('article');
    row.className = `task-row${task.completed ? ' is-completed' : ''}`;

    const completeButton = document.createElement('button');
    completeButton.className = 'complete-button';
    completeButton.type = 'button';
    completeButton.disabled = task.completed;
    completeButton.setAttribute('aria-label', task.completed ? `Completed: ${task.title}` : `Mark ${task.title} as complete`);
    completeButton.textContent = task.completed ? 'Completed' : 'Complete';
    if (!task.completed) completeButton.addEventListener('click', () => completeTask(task.id));

    const content = document.createElement('div');
    content.className = 'task-content';
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const taskMeta = document.createElement('div');
    taskMeta.className = 'task-meta';
    const category = document.createElement('span');
    category.className = 'task-tag';
    category.textContent = task.category;
    const priority = document.createElement('span');
    priority.className = `task-tag priority-${task.priority.toLowerCase()}`;
    priority.textContent = `${task.priority} priority`;
    const status = document.createElement('span');
    status.className = `task-tag status-${task.completed ? 'completed' : 'pending'}`;
    status.textContent = task.completed ? 'Completed' : 'Pending';
    taskMeta.append(category, priority, status);
    content.append(title, taskMeta);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', `Delete ${task.title}`);
    deleteButton.title = 'Delete task';
    deleteButton.textContent = '\u00d7';
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    row.append(completeButton, content, deleteButton);
    taskList.append(row);
  }
}

async function loadTasks() {
  taskList.setAttribute('aria-busy', 'true');
  try {
    tasks = await request('/api/tasks');
    renderTasks();
  } catch (error) {
    taskList.replaceChildren();
    const errorMessage = document.createElement('p');
    errorMessage.className = 'empty-state';
    errorMessage.textContent = `${error.message} Check that the StudySprint server is running.`;
    taskList.append(errorMessage);
  } finally {
    taskList.setAttribute('aria-busy', 'false');
  }
}

async function completeTask(id) {
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PUT' });
    await loadTasks();
  } catch (error) {
    formMessage.textContent = error.message;
  }
}

async function deleteTask(id) {
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadTasks();
  } catch (error) {
    formMessage.textContent = error.message;
  }
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  const category = document.querySelector('#task-category').value;
  const priority = document.querySelector('#task-priority').value;
  if (!title) {
    formMessage.textContent = 'Please enter a study task.';
    taskInput.focus();
    return;
  }

  formMessage.textContent = '';
  const submitButton = taskForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, category, priority }),
    });
    taskInput.value = '';
    await loadTasks();
    taskInput.focus();
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    for (const filterButton of filterButtons) {
      const isActive = filterButton === button;
      filterButton.classList.toggle('is-active', isActive);
      filterButton.setAttribute('aria-pressed', String(isActive));
    }
    renderTasks();
  });
}

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric',
}).format(new Date());

loadTasks();