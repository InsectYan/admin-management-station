'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const localEnv = path.join(__dirname, '../../deploy/config/.env.local');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv, override: false });
}

const { syncSchema } = require('./db-cli');

syncSchema().catch(err => {
  console.error(err);
  process.exit(1);
});
