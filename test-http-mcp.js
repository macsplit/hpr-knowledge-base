#!/usr/bin/env node

/**
 * Test script for HTTP/SSE MCP Server
 *
 * This script tests the deployed MCP server by:
 * 1. Resetting the Circuit Breaker on the server.
 * 2. Connecting to the SSE endpoint.
 * 3. Sending MCP protocol messages sequentially.
 * 4. Displaying responses and closing the connection cleanly.
 *
 * Usage: node test-http-mcp.js
 */

import EventSource from 'eventsource';
import fetch from 'node-fetch';

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
const SSE_ENDPOINT = `${SERVER_URL}/sse`;
const MESSAGE_ENDPOINT = `${SERVER_URL}/message`;
const RESET_ENDPOINT = `${SERVER_URL}/reset`; // New endpoint for circuit breaker reset

let requestId = 1;
let sse; // Declare outside for scope
let connectionId = null; // To store the connection ID from the server

console.log('-- Testing MCP Server over HTTP/SSE');
console.log(`-- Server: ${SERVER_URL}`);
console.log(`-- Message Endpoint: ${MESSAGE_ENDPOINT}`);
console.log('');

// === 0. Reset Circuit Breaker ===
async function resetCircuitBreaker() {
    console.log('0. Resetting Circuit Breaker...');
    try {
        const resetResponse = await fetch(RESET_ENDPOINT, { method: 'POST' });
        const result = await resetResponse.json();
        console.log(`OK Reset check: ${result.message}`);
    } catch (error) {
        console.error('ERROR Circuit breaker reset failed (Server not fully up or endpoint missing):', error.message);
    }
    console.log('');
}

// === 1. Test Health Endpoint ===
async function checkHealth() {
    console.log('1. Testing health endpoint...');
    try {
        const healthResponse = await fetch(`${SERVER_URL}/health`);
        const health = await healthResponse.json();
        console.log('OK Health check:', JSON.stringify(health, null, 2));
        console.log('');
    } catch (error) {
        console.error('ERROR Health check failed:', error.message);
        process.exit(1);
    }
}

// === 2. Connect to SSE Endpoint ===
function connectSSE() {
  return new Promise((resolve, reject) => {
    console.log('2. Connecting to SSE endpoint...');
    // Use the EventSource polyfill to handle the SSE GET connection
    sse = new EventSource(SSE_ENDPOINT);

    sse.onopen = () => {
      console.log('OK SSE connection established');
      // Resolve the promise once the connection is open
      resolve();
    };

    sse.addEventListener('endpoint', (event) => {
        // The endpoint event data contains the sessionId in the URL
        const url = new URL(event.data, SERVER_URL);
        connectionId = url.searchParams.get('sessionId');
        console.log(`OK Received sessionId: ${connectionId}`);
    });

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('RECEIVED:', JSON.stringify(data, null, 2));
      } catch (error) {
        console.log('RECEIVED (raw):', event.data);
      }
      console.log('');
    };

    sse.onerror = (error) => {
      // Log and ignore to let the rest of the test run, as EventSource auto-reconnects
      console.error('ERROR SSE error:', error.message || JSON.stringify(error));
    };
  });
}

// === 3. Send MCP Message (POST) ===
async function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };

  console.log('SENDING:', method);
  console.log(JSON.stringify(message, null, 2));
  console.log('');

  try {
    const response = await fetch(MESSAGE_ENDPOINT, {
      method: 'POST',
      headers: { 
            'Content-Type': 'application/json',
            'x-connection-id': connectionId // Include the connection ID
        },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log('OK Message sent successfully');
    } else {
      // Log the full error response body if it's not successful
      const errorBody = await response.text();
      console.error('ERROR Message send failed:', response.status, response.statusText, errorBody);
    }
  } catch (error) {
    console.error('ERROR Send error:', error.message);
  }
  console.log('');
}

// === Main Test Sequence ===
async function runTests() {
    // Ensure the health check runs first
    await checkHealth();
    
    // Ensure the circuit breaker is reset before trying to connect
    await resetCircuitBreaker(); 
    
    // Establish a fresh, single connection for the test sequence
    await connectSSE();
    // Wait for connectionId to be received
    while (connectionId === null) {
        await sleep(100);
    }
    await sleep(1000); // Give the server a moment to finalize setup
    
    // Log the start of the protocol tests
    console.log('3. Running MCP protocol tests...');
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

    await sleep(1000);

    // Test 2: List tools
    await sendMessage('tools/list');

    await sleep(1000);

    // Test 3: List resources
    await sendMessage('resources/list');

    await sleep(1000);

    // Test 4: Call a tool (search episodes)
    await sendMessage('tools/call', {
      name: 'search_episodes',
      arguments: {
        query: 'linux',
        limit: 3
      }
    });

    await sleep(1000);

    // Test 5: Read a resource
    await sendMessage('resources/read', {
      uri: 'hpr://stats'
    });

    await sleep(2000);

    console.log('OK All tests completed!');
    console.log('');
    console.log('-- The MCP server is working correctly over HTTP/SSE');
    console.log('-- Once AI tools add HTTP/SSE support, they can connect to:');
    console.log(`   ${SSE_ENDPOINT}`);

    // Close connection explicitly at the end of the test run to stop auto-reconnects
    sse.close();
    process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the test sequence
runTests();

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n-- Closing connection...');
  if (sse) sse.close();
  process.exit(0);
});
