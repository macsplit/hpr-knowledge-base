#!/usr/bin/env node

/**
 * Test fuzzy search via HTTP/SSE MCP Server
 */

import EventSource from 'eventsource';
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3000';
const SSE_ENDPOINT = `${SERVER_URL}/sse`;
const MESSAGE_ENDPOINT = `${SERVER_URL}/message`;

let requestId = 1;
let sse;
let connectionId = null;

async function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };

  return new Promise(async (resolve) => {
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id === message.id) {
          sse.removeEventListener('message', handler);
          resolve(data.result);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    sse.addEventListener('message', handler);

    await fetch(MESSAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-connection-id': connectionId
      },
      body: JSON.stringify(message)
    });
  });
}

async function test() {
  console.log('Testing fuzzy search via HTTP/SSE MCP\n');

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

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 1: Search for host with typo
  console.log('=== Test 1: Fuzzy Host Search ===');
  console.log('Searching for host: "klattu" (typo for Klaatu)\n');

  const hostResult = await sendMessage('tools/call', {
    name: 'get_host_info',
    arguments: {
      hostName: 'klattu'
    }
  });

  const hostText = hostResult.content[0].text;
  const hostLines = hostText.split('\n').slice(0, 8);
  console.log(hostLines.join('\n'));
  console.log('');

  // Test 2: Search episodes with typo
  console.log('=== Test 2: Fuzzy Episode Search ===');
  console.log('Searching for episodes: "pythoon" (typo for python)\n');

  const episodeResult = await sendMessage('tools/call', {
    name: 'search_episodes',
    arguments: {
      query: 'pythoon',
      limit: 2
    }
  });

  const episodeText = episodeResult.content[0].text;
  // Extract just the first episode header
  const firstEpisode = episodeText.split('\n---\n')[0];
  const episodeLines = firstEpisode.split('\n').slice(0, 10);
  console.log(episodeLines.join('\n'));
  console.log('');

  console.log('✅ HTTP/SSE fuzzy search tests completed!\n');

  sse.close();
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
