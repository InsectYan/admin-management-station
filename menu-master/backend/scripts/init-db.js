'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSqlFiles(client, files) {
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
    console.log(`Applied: ${path.basename(file)}`);
  }
}

async function main() {
  const dbDir = path.join(__dirname, '../../database');
  const initSql = path.join(dbDir, 'init.sql');
  const migrationsDir = path.join(dbDir, 'migrations');

  const client = new Client({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5300),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'admin_platform',
  });

  await client.connect();
  try {
    await runSqlFiles(client, [initSql]);

    if (fs.existsSync(migrationsDir)) {
      const migrations = fs.readdirSync(migrationsDir)
        .filter(name => name.endsWith('.sql'))
        .sort()
        .map(name => path.join(migrationsDir, name));
      if (migrations.length > 0) {
        await runSqlFiles(client, migrations);
      }
    }

    console.log('Database initialized successfully.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});
