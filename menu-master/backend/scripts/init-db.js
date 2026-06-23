'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = path.join(__dirname, '../../database/init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'admin_platform',
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log('Database initialized successfully.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});
