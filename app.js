export default function appSrc(express, bodyParser, createReadStream, crypto, http, MongoClient) {
  const app = express();
  const login = 'ponkratov_na';

app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning'
  });

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

  app.use((req, res, next) => {
    if (req.path !== '/' && !req.path.endsWith('/')) {
      res.status(308);
      res.set('Location', `${req.path}/${req.url.slice(req.path.length)}`);
      return res.type('text/plain').send('Redirecting');
    }
    next();
  });

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.get('/login/', (req, res) => {
    res.type('text/plain').send(login);
  });

  app.get('/code/', (req, res) => {
    res.type('text/plain');
    createReadStream(import.meta.url.substring(7)).pipe(res);
  });

  app.get('/sha1/:input/', (req, res) => {
    res.type('text/plain').send(
      crypto.createHash('sha1').update(req.params.input).digest('hex')
    );
  });

  app.get('/req/', (req, res) => {
    const addr = req.query.addr;

    res.type('text/plain');

    if (!addr) {
      return res.status(400).send('addr is required');
    }

    http.get(addr, response => {
      response.pipe(res);
    }).on('error', () => {
      res.status(502).send('request failed');
    });
  });

  app.post('/req/', (req, res) => {
    const addr = req.body.addr;

    res.type('text/plain');

    if (!addr) {
      return res.status(400).send('addr is required');
    }

    http.get(addr, response => {
      response.pipe(res);
    }).on('error', () => {
      res.status(502).send('request failed');
    });
  });

app.post('/insert/', async (req, res) => {
  const { login: userLogin, password, URL } = req.body || {};

  if (
    typeof userLogin !== 'string' ||
    typeof password !== 'string' ||
    typeof URL !== 'string' ||
    !URL.trim()
  ) {
    return res.status(400).type('text/plain')
      .send('login, password and URL are required');
  }

  let client;

  try {
    client = new MongoClient(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000
  });

    await client.connect();

    await client.db().collection('users').insertOne({
      login: userLogin,
      password
    });

    res.status(200).type('text/plain').send('ok');

  } catch (err) {
    res.status(502).type('text/plain')
      .send('database request failed');

  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
});

  app.all('*', (req, res) => {
    res.type('text/plain').send(login);
  });

  app.use((err, req, res, next) => {
    res.status(500).type('text/plain').send('internal server error');
  });

  return app;
}