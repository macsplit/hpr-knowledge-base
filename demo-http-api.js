#!/usr/bin/env node

/**
 * Simple demo of using the deployed MCP server
 *
 * This shows how you CAN use the HTTP/SSE server TODAY with custom code.
 * While major AI tools don't support it yet, YOU can access it programmatically.
 */

const SERVER_URL = 'https://hpr-knowledge-base.onrender.com';

console.log('🎙️  HPR Knowledge Base - HTTP API Demo\n');
console.log(`Connecting to: ${SERVER_URL}\n`);

// Simple fetch-based approach (works NOW)
async function searchHPR(query) {
  console.log(`🔍 Searching for: "${query}"`);

  // For demo purposes, we'll query the health endpoint
  // In a real integration, you'd implement the full MCP protocol
  const response = await fetch(`${SERVER_URL}/health`);
  const data = await response.json();

  console.log(`✅ Server is ${data.status}`);
  console.log(`📊 Memory usage: ${data.memory.used} / ${data.memory.threshold}`);
  console.log(`🔌 Active requests: ${data.activeRequests}`);
  console.log(`⚡ Circuit breaker: ${data.circuitBreaker}\n`);

  return data;
}

// Example: Your own search function that wraps the MCP server
async function myCustomSearch(topic) {
  console.log(`💡 This is YOUR custom function that queries the MCP server`);
  console.log(`   You can integrate this into any Node.js app, web app, etc.\n`);

  // In production, you'd implement the full MCP protocol here
  // For now, just showing the server is accessible
  const health = await searchHPR(topic);

  console.log(`🎯 What you can do with this:`);
  console.log(`   - Build a custom search UI`);
  console.log(`   - Integrate with your own AI chatbot`);
  console.log(`   - Create a Slack bot that queries HPR`);
  console.log(`   - Build a browser extension`);
  console.log(`   - Make a Discord bot`);
  console.log(`   - Anything that runs JavaScript!\n`);

  return health;
}

// Run the demo
try {
  await myCustomSearch('linux');

  console.log(`✅ Success! The HTTP/SSE server is live and accessible.\n`);
  console.log(`📚 Next steps:`);
  console.log(`   1. See CONFIGURATION.md for custom integration examples`);
  console.log(`   2. Implement full MCP protocol (JSON-RPC 2.0 over SSE)`);
  console.log(`   3. Or wait for your favorite AI tool to add MCP support\n`);
  console.log(`🔮 Future: When Claude.ai, ChatGPT, etc. add HTTP/SSE MCP support,`);
  console.log(`   they'll be able to connect to: ${SERVER_URL}/sse`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
