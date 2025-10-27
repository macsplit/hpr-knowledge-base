#!/usr/bin/env node

/**
 * Quick test to verify tool annotations are present
 */

import EventSource from 'eventsource';
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3000';
const SSE_ENDPOINT = `${SERVER_URL}/sse`;
const MESSAGE_ENDPOINT = `${SERVER_URL}/message`;

let requestId = 1;
let sse;
let connectionId = null;

async function testAnnotations() {
  console.log('Testing tool annotations...\n');

  // Connect to SSE
  sse = new EventSource(SSE_ENDPOINT);

  await new Promise((resolve) => {
    sse.addEventListener('endpoint', (event) => {
      const url = new URL(event.data, SERVER_URL);
      connectionId = url.searchParams.get('sessionId');
      console.log(`Connected with session ID: ${connectionId}\n`);
      resolve();
    });
  });

  // Wait a moment for connection to stabilize
  await new Promise(resolve => setTimeout(resolve, 500));

  // Send tools/list request
  const message = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/list',
    params: {}
  };

  const messagePromise = new Promise((resolve) => {
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.result && data.result.tools) {
          resolve(data.result.tools);
        }
      } catch (e) {
        // Ignore
      }
    };
  });

  await fetch(MESSAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-connection-id': connectionId
    },
    body: JSON.stringify(message)
  });

  const tools = await messagePromise;

  console.log('Tool annotations check:\n');
  tools.forEach(tool => {
    const hasAnnotations = tool.annotations &&
                          tool.annotations.readOnlyHint === true &&
                          tool.annotations.openWorldHint === true;
    const status = hasAnnotations ? '✅' : '❌';
    console.log(`${status} ${tool.name}: annotations = ${JSON.stringify(tool.annotations || 'MISSING')}`);
  });

  sse.close();
  process.exit(0);
}

testAnnotations().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
