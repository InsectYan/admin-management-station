'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const adminClient = new Client({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: 'postgres',
  });

  const dbName = process.env.POSTGRES_DB || process.env.NOVEL_POSTGRES_DB || 'novel_db';

  await adminClient.connect();
  const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database ${dbName}`);
  }
  await adminClient.end();

  const client = new Client({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: dbName,
  });

  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '../../database/init.sql'), 'utf8');
  await client.query(sql);
  console.log('novel_db schema initialized');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
