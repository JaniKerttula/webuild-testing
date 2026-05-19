#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, 'apps', 'web');

// Start the web server from the web app directory
process.chdir(webDir);
const proc = spawn('node', ['server.js'], {
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
