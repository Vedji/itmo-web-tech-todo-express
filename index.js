import express from 'express';
import bodyParser from 'body-parser';
import { createReadStream } from 'node:fs';
import mongodb from 'mongodb';
const { MongoClient } = mongodb;
import crypto from 'node:crypto';
import http from 'node:http';
import appSrc from './app.js';

const app = appSrc(
  express,
  bodyParser,
  createReadStream,
  crypto,
  http,
  MongoClient
);

app.listen(process.env.PORT);
