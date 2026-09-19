#!/usr/bin/env node
const fs = require('fs');
const s = fs.readFileSync('/tmp/ops-deploy/128/.ops-home/.s/components/devsapp.cn/v3/agentrun/dist/index.js', 'utf8');
// find initFC2Client / Ahs( / fc2
const keys = ['function Ahs', 'initFC2Client', 'new FC', 'FCClient', 'proxy', 'HTTPS_PROXY', 'getProxy', 'tunnel'];
for (const k of keys) {
  let i = 0;
  let c = 0;
  while ((i = s.indexOf(k, i)) >= 0 && c < 2) {
    console.log('\n====', k, '@', i, '====');
    console.log(s.slice(Math.max(0, i - 60), i + 500));
    i += k.length;
    c++;
  }
}
