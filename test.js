#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server is working
 * This simulates basic MCP protocol interactions
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

// Start the MCP server
const server = spawn('node', ['index.js']);

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // Try to parse complete JSON-RPC messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Received:', JSON.stringify(message, null, 2));
      } catch (e) {
        console.error('Failed to parse:', line);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Send initialization message
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method,
    params,
  };

  server.stdin.write(JSON.stringify(message) + '\n');
  console.log('Sent:', JSON.stringify(message, null, 2));
}

// Wait a bit for server to start, then send test messages
setTimeout(() => {
  console.log('\n=== Testing Initialization ===');
  sendMessage('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0',
    },
  });
}, 1000);

setTimeout(() => {
  console.log('\n=== Testing List Resources ===');
  sendMessage('resources/list');
}, 2000);

setTimeout(() => {
  console.log('\n=== Testing List Tools ===');
  sendMessage('tools/list');
}, 3000);

setTimeout(() => {
  console.log('\n=== Test complete, shutting down ===');
  server.kill();
  process.exit(0);
}, 5000);
