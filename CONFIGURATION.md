# Configuration Guide

This guide explains how to connect various AI tools to the HPR Knowledge Base MCP Server.

## Table of Contents

- [Connection Methods](#connection-methods)
- [Claude Desktop](#claude-desktop)
- [Other MCP-Compatible Clients](#other-mcp-compatible-clients)
- [ChatGPT](#chatgpt)
- [GitHub Copilot](#github-copilot)
- [Google Gemini](#google-gemini)
- [Custom Integration](#custom-integration)
- [Troubleshooting](#troubleshooting)

---

## Connection Methods

The HPR Knowledge Base MCP Server supports two connection methods:

### 1. Local (Stdio) - **Recommended for now**

- **How it works**: AI tool spawns the Node.js server as a child process
- **Pros**: Faster, more reliable, works with all MCP clients
- **Cons**: Requires Node.js installed locally, data files on your machine
- **Setup**: Point to `index.js` in your config

### 2. Remote (HTTP/SSE) - **Future-ready**

- **How it works**: AI tool connects to deployed server via HTTPS
- **Pros**: No local setup, access from anywhere, shared deployment
- **Cons**: Limited client support currently, network latency
- **Setup**: Point to `https://hpr-knowledge-base.onrender.com/sse`

---

## Claude Desktop

### Status: ✅ Supported (Stdio only)

Claude Desktop currently **only supports local stdio connections**. Remote HTTP/SSE support may be added in future versions.

### Configuration

**Location**:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Local Configuration (Current)**:
```json
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "command": "node",
      "args": ["/absolute/path/to/knowledge_base/index.js"]
    }
  }
}
```

**Setup Steps**:

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/hpr-knowledge-base.git
   cd hpr-knowledge-base
   npm install
   ```

2. Get the absolute path:
   ```bash
   pwd
   # Copy the output, e.g., /home/user/Code/hpr/knowledge_base
   ```

3. Edit your Claude Desktop config file with the path above

4. **Completely quit** Claude Desktop (not just close window)

5. Restart Claude Desktop

6. Verify connection:
   - Look for MCP indicator (usually bottom-left)
   - Try asking: "Search HPR episodes about Linux"

**Remote Configuration (Not supported yet)**:
```json
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "url": "https://hpr-knowledge-base.onrender.com/sse"
    }
  }
}
```
*This will show an error: "expected string, received undefined" because Claude Desktop requires the `command` field.*

---

## Other MCP-Compatible Clients

### Status: ⚠️ Varies by client

Other tools implementing the Model Context Protocol may support either stdio, HTTP/SSE, or both.

### Stdio Configuration (Universal)

**Requirements**:
- Node.js 18+ installed
- Local copy of this repository
- `npm install` completed

**Generic Format**:
```json
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "command": "node",
      "args": ["/path/to/knowledge_base/index.js"]
    }
  }
}
```

### HTTP/SSE Configuration (Client-dependent)

**Requirements**:
- Internet connection
- Client supports HTTP/SSE transport

**Generic Format**:
```json
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "url": "https://hpr-knowledge-base.onrender.com/sse"
    }
  }
}
```

**Verify server is running**:
```bash
curl https://hpr-knowledge-base.onrender.com/health
```

**Expected response**:
```json
{
  "status": "ok",
  "memory": {
    "used": "140.32MB",
    "threshold": "450MB"
  },
  "activeRequests": 0,
  "circuitBreaker": "CLOSED"
}
```

---

## ChatGPT

### Status: ❌ Not supported

**Current State**: OpenAI's ChatGPT does not support the Model Context Protocol (MCP) as of January 2025.

**Alternative Options**:

1. **Use OpenAI API with MCP Client**:
   - Use a third-party MCP client that supports OpenAI models
   - Connect that client to this MCP server
   - Example: [mcp-cli](https://github.com/modelcontextprotocol/cli) (hypothetical)

2. **Wait for Official Support**:
   - OpenAI may add MCP support in future
   - Check [OpenAI's documentation](https://platform.openai.com/docs) for updates

3. **Export Data**:
   - Access the HPR data directly from `hpr_metadata/` and `hpr_transcripts/`
   - Use custom scripts to query and provide context to ChatGPT

---

## GitHub Copilot

### Status: ❌ Not supported

**Current State**: GitHub Copilot does not support the Model Context Protocol (MCP) as of January 2025.

**Alternative Options**:

1. **Use Copilot Chat Extensions** (if available):
   - Check if VS Code extensions exist that bridge MCP servers
   - Not currently available but may be developed

2. **Use Local Search Script**:
   - Create a VS Code task that searches HPR data
   - Manually copy results into Copilot chat

Example task (`.vscode/tasks.json`):
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Search HPR",
      "type": "shell",
      "command": "node",
      "args": [
        "${workspaceFolder}/knowledge_base/search-cli.js",
        "${input:query}"
      ]
    }
  ],
  "inputs": [
    {
      "id": "query",
      "description": "Search query",
      "type": "promptString"
    }
  ]
}
```

---

## Google Gemini

### Status: ❌ Not supported

**Current State**: Google Gemini does not support the Model Context Protocol (MCP) as of January 2025.

**Alternative Options**:

1. **Use Gemini API with Custom Integration**:
   - Query the HPR MCP server via HTTP
   - Format results for Gemini API
   - Example in [Custom Integration](#custom-integration) section

2. **Wait for Extensions Support**:
   - Google may add extension/tool support to Gemini
   - MCP could be integrated when available

3. **Use Vertex AI** (for enterprises):
   - Vertex AI may support custom data sources
   - Load HPR data into Vertex AI knowledge base

---

## Custom Integration

### Option 1: Direct MCP Client

Build a custom client that:
1. Connects to the MCP server (stdio or HTTP/SSE)
2. Sends tool calls via JSON-RPC 2.0
3. Receives responses
4. Formats results for your AI tool

**Example: Python Client (Stdio)**

```python
import json
import subprocess
import sys

# Start MCP server
process = subprocess.Popen(
    ['node', '/path/to/index.js'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Initialize
init_request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "0.1.0",
        "clientInfo": {
            "name": "custom-client",
            "version": "1.0.0"
        }
    }
}

process.stdin.write(json.dumps(init_request).encode() + b'\n')
process.stdin.flush()

response = json.loads(process.stdout.readline())
print(response)

# List tools
list_tools = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
}

process.stdin.write(json.dumps(list_tools).encode() + b'\n')
process.stdin.flush()

response = json.loads(process.stdout.readline())
print("Available tools:", response)

# Search episodes
search_request = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "search_episodes",
        "arguments": {
            "query": "linux kernel",
            "limit": 5
        }
    }
}

process.stdin.write(json.dumps(search_request).encode() + b'\n')
process.stdin.flush()

response = json.loads(process.stdout.readline())
print("Search results:", response)
```

### Option 2: HTTP/SSE Client

**Example: Node.js Client**

```javascript
import EventSource from 'eventsource';

const sse = new EventSource('https://hpr-knowledge-base.onrender.com/sse');

sse.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

sse.onerror = (error) => {
  console.error('SSE error:', error);
};

// Send messages via POST
async function callTool(name, args) {
  const response = await fetch('https://hpr-knowledge-base.onrender.com/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });
  return response.json();
}

// Search episodes
const results = await callTool('search_episodes', {
  query: 'python programming',
  limit: 10
});

console.log(results);
```

### Option 3: REST API Wrapper

Create a simple REST API that wraps the MCP server:

```javascript
import express from 'express';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());

let mcpProcess;
let requestId = 1;

// Start MCP server
function startMCP() {
  mcpProcess = spawn('node', ['/path/to/index.js']);
  // ... handle stdio communication
}

// REST endpoint
app.post('/api/search', async (req, res) => {
  const { query, limit = 10 } = req.body;

  // Send to MCP server
  const result = await callMCPTool('search_episodes', { query, limit });

  res.json(result);
});

app.listen(3001);
```

---

## MCP Protocol Reference

For developers building custom integrations:

### JSON-RPC 2.0 Format

All MCP messages follow JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": { }
}
```

### Available Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize connection |
| `tools/list` | List available tools |
| `tools/call` | Execute a tool |
| `resources/list` | List available resources |
| `resources/read` | Read a resource |

### Tool Schemas

See [README.md](README.md#available-tools) for detailed tool documentation.

---

## Troubleshooting

### Claude Desktop: "Could not load app settings"

**Error**: `invalid_type: expected string, received undefined`

**Cause**: Using `url` field instead of `command`

**Solution**: Use local stdio configuration:
```json
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "command": "node",
      "args": ["/absolute/path/to/index.js"]
    }
  }
}
```

### Claude Desktop: MCP server not appearing

**Checklist**:
1. Config file in correct location
2. Absolute path (not relative) to `index.js`
3. Node.js installed and in PATH
4. `npm install` completed successfully
5. Claude Desktop fully restarted (quit completely)

**Test manually**:
```bash
cd /path/to/knowledge_base
node index.js
# Should start without errors
# Press Ctrl+C to exit
```

### Remote Server: Connection refused

**Check server status**:
```bash
curl https://hpr-knowledge-base.onrender.com/health
```

**Common issues**:
- Free tier spun down (first request takes 30-60s to wake)
- Deployment failed (check Render logs)
- Network/firewall blocking HTTPS

### Remote Server: 502 Bad Gateway

**Causes**:
- Server starting up (wait 2-3 minutes after deployment)
- Data loading in progress
- Server crashed (check Render logs)

**Check Render logs for**:
```
Loading HPR knowledge base data...
Data loaded successfully!
HPR Knowledge Base MCP Server running on...
```

### Tool calls timing out

**For local**:
- First startup loads 4,511 episodes (10-30 seconds)
- Subsequent requests are fast (data cached in memory)

**For remote**:
- Free tier: Slower hardware, allow 30s for large queries
- Network latency adds 100-500ms
- Consider paid tier ($7/mo) for better performance

### JSON parsing errors

**Symptoms**: Invalid JSON responses

**Causes**:
- Server logs mixed with JSON-RPC messages (stdio)
- Malformed requests

**Solution for stdio**: Server logs go to stderr, JSON-RPC to stdout. Ensure your client reads stdout only for protocol messages.

---

## Future Compatibility

### MCP Adoption Roadmap

As the Model Context Protocol gains adoption:

**Expected in 2025**:
- More IDEs supporting MCP (VS Code, JetBrains)
- AI assistants adding MCP integration
- Standardized HTTP/SSE transport in MCP clients

**What this means for you**:
- HTTP/SSE configuration will become more useful
- One deployed server can serve multiple AI tools
- Less need for local installations

### Staying Updated

**Watch for**:
- Claude Desktop updates adding HTTP/SSE support
- Official MCP client libraries for popular AI platforms
- Third-party bridges/proxies for non-MCP tools

**Resources**:
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK on GitHub](https://github.com/modelcontextprotocol/sdk)
- This repository's releases for updates

---

## Summary Table

| AI Tool | MCP Support | Stdio | HTTP/SSE | Notes |
|---------|-------------|-------|----------|-------|
| **Claude Desktop** | ✅ Yes | ✅ Yes | ❌ No | Official MCP support, stdio only |
| **Claude API** | ⚠️ Custom | ✅ Via wrapper | ✅ Via wrapper | Requires custom integration |
| **ChatGPT** | ❌ No | ❌ No | ❌ No | No MCP support yet |
| **GitHub Copilot** | ❌ No | ❌ No | ❌ No | No MCP support yet |
| **Google Gemini** | ❌ No | ❌ No | ❌ No | No MCP support yet |
| **Custom MCP Client** | ✅ Yes | ✅ Yes | ✅ Yes | Full support with MCP SDK |

---

## Quick Start Commands

### Test Local Server
```bash
cd /path/to/knowledge_base
npm install
node index.js
# Press Ctrl+C to exit
```

### Test Remote Server
```bash
curl https://hpr-knowledge-base.onrender.com/health
```

### Configure Claude Desktop (Linux)
```bash
cat > ~/.config/Claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "command": "node",
      "args": ["/home/user/Code/hpr/knowledge_base/index.js"]
    }
  }
}
EOF
```

### Test MCP Protocol Manually
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"0.1.0","clientInfo":{"name":"test","version":"1.0.0"}}}' | node index.js
```

---

## Need Help?

- **Issues**: Open an issue on GitHub
- **MCP Protocol**: See https://modelcontextprotocol.io
- **Claude Desktop**: See https://docs.claude.com
- **HPR Content**: Visit https://hackerpublicradio.org

---

**Last Updated**: January 2025
**MCP Version**: 0.1.0
**Server Version**: 1.0.0
