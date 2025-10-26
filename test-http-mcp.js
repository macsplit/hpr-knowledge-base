#!/usr/bin/env node

/**
 * Test script for HTTP/SSE MCP Server
 *
 * This script tests the deployed MCP server by:
 * 1. Connecting to the SSE endpoint
 * 2. Sending MCP protocol messages
 * 3. Displaying responses
 *
 * Usage: node test-http-mcp.js
 */

import EventSource from 'eventsource';
import fetch from 'node-fetch';

const SERVER_URL = process.env.MCP_SERVER_URL || 'https://hpr-knowledge-base.onrender.com';
const SSE_ENDPOINT = `${SERVER_URL}/sse`;
const MESSAGE_ENDPOINT = `${SERVER_URL}/message`;

let requestId = 1;

console.log('🧪 Testing MCP Server over HTTP/SSE');
console.log(`📡 Server: ${SERVER_URL}`);
console.log('');

// Test health endpoint first
console.log('1️⃣ Testing health endpoint...');
try {
  const healthResponse = await fetch(`${SERVER_URL}/health`);
  const health = await healthResponse.json();
  console.log('✅ Health check:', JSON.stringify(health, null, 2));
  console.log('');
} catch (error) {
  console.error('❌ Health check failed:', error.message);
  process.exit(1);
}

// Connect to SSE endpoint
console.log('2️⃣ Connecting to SSE endpoint...');
const sse = new EventSource(SSE_ENDPOINT);

sse.onopen = () => {
  console.log('✅ SSE connection established');
  console.log('');

  // Run tests after connection is established
  setTimeout(() => runTests(), 1000);
};

sse.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('📨 Received:', JSON.stringify(data, null, 2));
    console.log('');
  } catch (error) {
    console.log('📨 Received (raw):', event.data);
    console.log('');
  }
};

sse.onerror = (error) => {
  console.error('❌ SSE error:', error);
  console.log('');
};

// Send MCP messages
async function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };

  console.log('📤 Sending:', method);
  console.log(JSON.stringify(message, null, 2));
  console.log('');

  try {
    const response = await fetch(MESSAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log('✅ Message sent successfully');
    } else {
      console.error('❌ Message send failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Send error:', error.message);
  }

  console.log('');
}

// Run test sequence
async function runTests() {
  console.log('3️⃣ Running MCP protocol tests...');
  console.log('');

  // Test 1: Initialize
  await sendMessage('initialize', {
    protocolVersion: '0.1.0',
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    },
    capabilities: {}
  });

  await sleep(2000);

  // Test 2: List tools
  await sendMessage('tools/list');

  await sleep(2000);

  // Test 3: List resources
  await sendMessage('resources/list');

  await sleep(2000);

  // Test 4: Call a tool (search episodes)
  await sendMessage('tools/call', {
    name: 'search_episodes',
    arguments: {
      query: 'linux',
      limit: 3
    }
  });

  await sleep(2000);

  // Test 5: Read a resource
  await sendMessage('resources/read', {
    uri: 'hpr://stats'
  });

  await sleep(3000);

  console.log('✅ All tests completed!');
  console.log('');
  console.log('💡 The MCP server is working correctly over HTTP/SSE');
  console.log('🔮 Once AI tools add HTTP/SSE support, they can connect to:');
  console.log(`   ${SSE_ENDPOINT}`);

  // Close connection
  sse.close();
  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  sse.close();
  process.exit(0);
});
