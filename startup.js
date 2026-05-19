#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteName = `${process.env.APP_ROLE ?? process.env.WEBSITE_SITE_NAME ?? ''}`;
const isApiApp = /api/i.test(siteName);
const targetScript = isApiApp
  ? path.join(__dirname, 'apps', 'api', 'dist', 'server.js')
  : path.join(__dirname, 'apps', 'web', 'server.js');

const proc = spawn('node', [targetScript], {
  stdio: 'inherit',
  env: { ...process.env }
});

proc.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

proc.on('exit', (code) => {
  process.exit(code);
});
