#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, 'apps', 'api');

// Start the API server from the api app directory
process.chdir(apiDir);
const proc = spawn('node', ['dist/server.js'], {
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
