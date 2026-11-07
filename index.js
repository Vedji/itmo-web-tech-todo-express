import express from 'express';
import bodyParser from 'body-parser';
import mongodb from 'mongodb';

const { MongoClient } = mongodb;
import { createApp } from './app.js';

const required = [
  'MONGODB_URI',
  'MONGODB_DB',
  'API_TOKEN',
  'MOODLE_LOGIN',
  'MOODLE_FULL_NAME'
];

for (const name of required) {
  const value = process.env[name];
  if (!value || (name === 'MOODLE_FULL_NAME' && value === 'REPLACE_WITH_FULL_NAME')) {
    console.error(`Missing required configuration: ${name}`);
    process.exit(1);
  }
}

const { MONGODB_URI, MONGODB_DB, API_TOKEN, MOODLE_LOGIN, MOODLE_FULL_NAME } = process.env;

if (Buffer.byteLength(API_TOKEN) < 16) {
  console.error('API_TOKEN must have at least 16 bytes');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
});

let connection;
let indexesReady = false;

async function tasksCollection() {
  if (!connection) {
    connection = client.connect().catch(error => {
      connection = null;
      throw error;
    });
  }

  await connection;
  const collection = client.db(MONGODB_DB).collection('tasks');

  if (!indexesReady) {
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ ownerLogin: 1, runId: 1 });
    indexesReady = true;
  }

  return collection;
}

const app = createApp({
  express,
  bodyParser,
  tasksCollection,
  login: MOODLE_LOGIN,
  fullName: MOODLE_FULL_NAME,
  apiToken: API_TOKEN
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on ${port}`);
});

async function shutdown() {
  server.close(async () => {
    try {
      await client.close();
      process.exit(0);
    } catch (error) {
      console.error('Failed to close MongoDB connection:', error);
      process.exit(1);
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
