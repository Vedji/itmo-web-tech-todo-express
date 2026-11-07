import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const publicFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return isObject(value) && Object.keys(value).every(key => allowedKeys.includes(key));
}

function isValidTitle(title) {
  return typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 200;
}

function isValidRunId(runId) {
  return typeof runId === 'string' && RUN_ID_PATTERN.test(runId);
}

function isValidNewTask(body) {
  return hasOnlyKeys(body, ['title', 'runId']) &&
    Object.keys(body).length === 2 &&
    isValidTitle(body.title) &&
    isValidRunId(body.runId);
}

function isValidUpdate(body) {
  if (!hasOnlyKeys(body, ['title', 'done']) || Object.keys(body).length === 0) {
    return false;
  }
  if ('title' in body && !isValidTitle(body.title)) return false;
  if ('done' in body && typeof body.done !== 'boolean') return false;
  return true;
}

function publicTask(task) {
  return {
    id: task.id,
    ownerLogin: task.ownerLogin,
    title: task.title,
    done: task.done,
    runId: task.runId,
    createdAt: new Date(task.createdAt).toISOString()
  };
}


function tokensMatch(received, expected) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ express, bodyParser, tasksCollection, login, fullName, apiToken }) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS,DELETE',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, ngrok-skip-browser-warning',
      'Cache-Control': 'no-store'
    });

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });


  app.use((req, res, next) => {
    const needsSlash = req.path === '/login' || req.path.startsWith('/api/');
    if (!needsSlash || req.path.endsWith('/')) return next();

    return res.redirect(308, `${req.path}/${req.url.slice(req.path.length)}`);
  });

  app.get('/login/', (req, res) => res.type('text/plain').send(login));
  app.get('/', (req, res) => res.sendFile(path.join(publicFolder, 'index.html')));
  app.use('/assets/', express.static(publicFolder, { index: false, dotfiles: 'deny' }));

 
  app.use('/api/', (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    const token = /^Bearer (.+)$/.exec(authorization)?.[1];

    if (!token || !tokensMatch(token, apiToken)) {
      return sendError(res, 401, 'Unauthorized');
    }
    next();
  });

  app.use(bodyParser.json({ limit: '32kb' }));
  app.use(bodyParser.urlencoded({ extended: false, limit: '32kb' }));

 
  async function withCollection(res, operation) {
    try {
      const collection = await tasksCollection();
      return await operation(collection);
    } catch (err) {
      return sendError(res, 503, 'Database unavailable');
    }
  }

  function taskFilter(id) {
    return { id, ownerLogin: login };
  }

  app.get('/api/author/', (req, res) => {
    res.json({ login, fullName });
  });

  app.get('/api/tasks/', (req, res) => {
    const { runId } = req.query;
    if (!isValidRunId(runId) || Object.keys(req.query).some(key => key !== 'runId')) {
      return sendError(res, 400, 'Invalid runId');
    }

    return withCollection(res, async collection => {
      const tasks = await collection.find({ ownerLogin: login, runId }).toArray();
      return res.json(tasks.map(publicTask));
    });
  });

  app.post('/api/tasks/', (req, res) => {
    if (!isValidNewTask(req.body)) {
      return sendError(res, 400, 'Invalid task data');
    }

    const task = {
      id: randomUUID(),
      ownerLogin: login,
      title: req.body.title.trim(),
      done: false,
      runId: req.body.runId,
      createdAt: new Date().toISOString()
    };

    return withCollection(res, async collection => {
      await collection.insertOne(task);
      return res.status(201).json(publicTask(task));
    });
  });

  app.param('id', (req, res, next, id) => {
    if (!UUID_PATTERN.test(id)) return sendError(res, 400, 'Invalid UUID');
    next();
  });

  app.get('/api/tasks/:id/', (req, res) => {
    return withCollection(res, async collection => {
      const task = await collection.findOne(taskFilter(req.params.id));
      if (!task) return sendError(res, 404, 'Task not found');
      return res.json(publicTask(task));
    });
  });

  app.patch('/api/tasks/:id/', (req, res) => {
    if (!isValidUpdate(req.body)) {
      return sendError(res, 400, 'Invalid task update');
    }

    const changes = {};
    if ('title' in req.body) changes.title = req.body.title.trim();
    if ('done' in req.body) changes.done = req.body.done;

    return withCollection(res, async collection => {
      const filter = taskFilter(req.params.id);
      const result = await collection.updateOne(filter, { $set: changes });
      if (!result.matchedCount) return sendError(res, 404, 'Task not found');

      const task = await collection.findOne(filter);
      if (!task) return sendError(res, 404, 'Task not found');
      return res.json(publicTask(task));
    });
  });

  app.delete('/api/tasks/:id/', (req, res) => {
    return withCollection(res, async collection => {
      const result = await collection.deleteOne(taskFilter(req.params.id));
      if (!result.deletedCount) return sendError(res, 404, 'Task not found');
      return res.status(204).end();
    });
  });

  app.use('/api/', (req, res) => sendError(res, 404, 'Route not found'));
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
      return sendError(res, 400, 'Invalid JSON');
    }
    if (err.type === 'entity.too.large') return sendError(res, 400, 'Payload too large');
    if (req.path.startsWith('/api/')) return sendError(res, 400, 'Invalid request');
    return res.status(400).type('text/plain').send('Bad request');
  });

  return app;
}

export default createApp;
