'use strict';

const path = require('path');
const { seedData } = require('./db-cli');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const localEnv = path.join(__dirname, '../../deploy/config/.env.local');
if (require('fs').existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv, override: false });
}

const tableName = process.argv[2];
seedData(tableName || undefined, { syncFirst: true }).catch(err => {
  console.error(err);
  process.exit(1);
});
