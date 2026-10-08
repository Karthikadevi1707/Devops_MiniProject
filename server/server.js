const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const tasksFile = path.join(__dirname, 'tasks.json');
const categories = ['Assignment', 'Lab Work', 'Project', 'Exam Preparation', 'Seminar', 'Placement', 'Internship', 'Other'];
const priorities = ['High', 'Medium', 'Low'];

function createSampleTasks() {
  const createdAt = new Date().toISOString();
  return [
    ['Complete Data Structures Assignment', 'Assignment', 'High'],
    ['Prepare C++ Lab Exam', 'Exam Preparation', 'High'],
    ['Submit Machine Learning Record', 'Lab Work', 'Medium'],
    ['Complete Web Development Project', 'Project', 'High'],
    ['Prepare Seminar Presentation', 'Seminar', 'Medium'],
    ['Practice Placement Aptitude', 'Placement', 'Low'],
  ].map(([title, category, priority]) => ({
    id: randomUUID(), title, category, priority, completed: false, createdAt,
  }));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

async function readTasks() {
  try {
    const contents = await fs.readFile(tasksFile, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const tasks = createSampleTasks();
      await writeTasks(tasks);
      return tasks;
    }
    throw error;
  }
}

async function writeTasks(tasks) {
  await fs.writeFile(tasksFile, `${JSON.stringify(tasks, null, 2)}\n`);
}

app.get('/api/tasks', async (req, res, next) => {
  try {
    res.json(await readTasks());
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const { category, priority } = req.body;
    if (!title || title.length > 160) {
      return res.status(400).json({ message: 'Enter a task name up to 160 characters.' });
    }
    if (!categories.includes(category)) {
      return res.status(400).json({ message: 'Choose a valid task category.' });
    }
    if (!priorities.includes(priority)) {
      return res.status(400).json({ message: 'Choose a valid task priority.' });
    }

    const tasks = await readTasks();
    const task = {
      id: randomUUID(),
      title,
      category,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task);
    await writeTasks(tasks);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    task.completed = true;
    await writeTasks(tasks);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks();
    const remainingTasks = tasks.filter((item) => item.id !== req.params.id);
    if (remainingTasks.length === tasks.length) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    await writeTasks(remainingTasks);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`StudySprint is running at http://localhost:${PORT}`);
});