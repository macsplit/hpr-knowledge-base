# Configuration Guide

This guide explains how to connect various AI tools to the HPR Knowledge Base MCP Server.

**Last Updated**: October 2025

**Major Update**: MCP adoption has accelerated significantly in 2025! Most major AI tools now support the Model Context Protocol, with many supporting remote HTTP/SSE connections.

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

### 1. Local (Stdio) - **Fastest performance**

- **How it works**: AI tool spawns the Node.js server as a child process
- **Pros**: Fastest, no network latency, full offline access
- **Cons**: Requires Node.js installed locally, data files on your machine
- **Setup**: Point to `index.js` in your config
- **Supported by**: Claude Desktop, GitHub Copilot (via extensions), custom clients

### 2. Remote (HTTP/SSE + Streamable HTTP) - **✨ NOW WIDELY SUPPORTED!**

- **How it works**: AI tool connects to deployed server via HTTPS
- **Pros**: No local setup, access from anywhere, shared deployment, multi-user
- **Cons**: Network latency (minimal), requires internet connection
- **Setup**: Point to `https://hpr-knowledge-base.onrender.com/sse`
- **Supported by**: Claude Desktop (Pro/Team/Enterprise), ChatGPT (all paid plans), custom clients
- **Note**: Some clients support newer Streamable HTTP protocol (superior to SSE)

---

## Claude Desktop

### Status: ✅ Fully Supported (Both Stdio and Remote HTTP/SSE)

**Major Update (June 2025)**: Claude Desktop now supports **remote MCP servers** via HTTP/SSE and Streamable HTTP!

**Availability**:
- Remote MCP support: Claude Pro, Team, and Enterprise plans (currently in beta)
- Local stdio support: All plans including Free

**Supported Protocols**:
- SSE (Server-Sent Events) - Original remote transport
- Streamable HTTP - New protocol (superior performance, added July 2025)
- OAuth authentication supported for secure remote servers

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

**Remote Configuration (✅ NOW SUPPORTED - Pro/Team/Enterprise)**:
```json
{
  "mcpServers": {
    "hpr-knowledge-base": {
      "url": "https://hpr-knowledge-base.onrender.com/sse",
      "transport": "sse"
    }
  }
}
```

**Note**: Remote MCP support requires Claude Pro, Team, or Enterprise plan. Free plan users should use local (stdio) configuration above.

**Official Documentation**: See [Building Custom Connectors via Remote MCP Servers](https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) for more details.

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

### Status: ✅ Supported (Remote HTTP/SSE only - October 2025)

**Major Update**: OpenAI added full MCP support across ChatGPT in 2025!

**Timeline**:
- **March 2025**: OpenAI officially adopted MCP standard
- **September 2025**: Developer mode beta with read/write MCP support
- **October 2025**: Full MCP support rolled out to all paid plans

**Availability**:
- Pro, Plus, Business, Enterprise, and Education accounts (web only)
- Developer mode for Plus and Pro users (beta)

**Supported Protocols**:
- Remote servers only (HTTP/SSE and Streamable HTTP)
- **Does NOT support local stdio servers** (different from Claude Desktop)

**Capabilities**:
- Read operations (search, document retrieval) via Deep Research feature
- Write operations (updates, triggers) in Developer mode beta
- Currently limited compared to Claude's implementation (no local servers, basic UI)

### Configuration

**Adding Remote MCP Server to ChatGPT**:

1. Go to Settings → Connectors (on web ChatGPT)
2. Click "Add Connector" or "Add MCP Server"
3. Enter server details:
   - **Name**: HPR Knowledge Base
   - **URL**: `https://hpr-knowledge-base.onrender.com/sse`
   - **Type**: Remote MCP Server (SSE)
4. Save and enable the connector

**Developer Mode** (for write operations):
1. Go to Settings → Connectors → Advanced
2. Enable "Developer mode"
3. Add your MCP server as above
4. Now you can perform write actions

**Limitations**:
- No local stdio support (must use remote servers)
- No MCP server catalog (manual configuration only)
- Basic implementation compared to Claude Desktop
- Web-only (no desktop app MCP support)

---

## GitHub Copilot

### Status: ✅ Supported (MCP Tools - October 2025)

**Major Update**: GitHub Copilot has rolled out MCP support with Agent Mode in VS Code!

**Timeline**:
- **June 2025**: Remote GitHub MCP Server in public preview
- **September 2025**: Deprecation of GitHub App-based Copilot Extensions in favor of MCP
- **October 2025**: Agent mode with MCP support rolled out to all VS Code users
- **October 17, 2025**: Enhanced MCP support in Copilot CLI with better local server setup
- **October 28, 2025**: Per-server allowlist functionality rolling out to IDEs

**Availability**:
- All GitHub Copilot subscribers in VS Code and Visual Studio
- Copilot CLI with enhanced MCP support

**Important Limitations**:
- **MCP Tools**: ✅ Fully supported
- **MCP Resources**: ❌ Not yet supported (unlike Claude Desktop)
- This means Copilot can call MCP tools but can't directly access MCP resources

### Configuration

**Adding MCP Server to GitHub Copilot (VS Code)**:

The exact configuration method varies, but here's the general approach based on October 2025 documentation:

1. **Enable Agent Mode** in VS Code settings
2. **Configure MCP Server** via VS Code settings or config file
3. **Allow the Server** using the per-server allowlist (rolling out Oct 28+)

**For Remote Server** (Recommended):
```json
{
  "github.copilot.mcp.servers": {
    "hpr-knowledge-base": {
      "url": "https://hpr-knowledge-base.onrender.com/sse",
      "transport": "sse"
    }
  }
}
```

**For Local Server**:
```json
{
  "github.copilot.mcp.servers": {
    "hpr-knowledge-base": {
      "command": "node",
      "args": ["/absolute/path/to/knowledge_base/index.js"]
    }
  }
}
```

**Note**: Configuration format may vary. Refer to official GitHub Copilot documentation for exact syntax as MCP integration is actively being enhanced.

**Resources**:
- [Extending GitHub Copilot Chat with MCP](https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp)
- [GitHub Copilot Changelog](https://github.blog/changelog/)

---

## Google Gemini

### Status: ✅ Supported (Via SDK Integration - April 2025)

**Major Update**: Google officially announced MCP support for Gemini in April 2025!

**Timeline**:
- **March 31, 2025**: Google CEO Sundar Pichai confirms MCP support plans
- **April 2025**: Official MCP compatibility announced for Gemini ecosystem
- **2025**: Active integration with Google DeepMind engineers

**Availability**:
- MCP integration via Google Gemini SDK
- Support for major LLM provider integration (Anthropic, OpenAI, Google Gemini)
- Multiple community-built MCP servers for Gemini available

**Current Status**:
- SDK-level integration (not direct UI integration like ChatGPT/Claude)
- Requires developer implementation using FastMCP or similar libraries
- Can be integrated with Claude Desktop, Cursor, Windsurf, and other MCP clients

### Integration Options

**Option 1: Use Gemini with MCP-Compatible IDE** (Recommended):

Many IDEs that support MCP can use Gemini as the LLM backend:
- Configure HPR MCP server in the IDE
- Select Gemini as your LLM
- IDE routes MCP tool calls through Gemini

**Option 2: SDK Integration** (Developers):

Use FastMCP or Google's Gemini SDK to integrate:
```python
from google.generativeai import gemini
from fastmcp import FastMCP

# Configure Gemini model
model = gemini.GenerativeModel('gemini-2.5-pro')

# Connect to HPR MCP server
mcp = FastMCP(server_url='https://hpr-knowledge-base.onrender.com/sse')

# Use Gemini with MCP tools
response = model.generate_content(
    "Search HPR for Linux episodes",
    tools=mcp.get_tools()
)
```

**Option 3: Community MCP Servers**:

Several community-built Gemini MCP servers are available:
- [mcp-gemini-server](https://github.com/bsmi021/mcp-gemini-server)
- [Gemini MCP Tool](https://lobehub.com/mcp/jamubc-gemini-mcp-tool)
- Check [Glama](https://glama.ai/mcp/servers) for more

**Resources**:
- [Google Gemini MCP Integration Guide](https://medium.com/google-cloud/model-context-protocol-mcp-with-google-gemini-llm-a-deep-dive-full-code-ea16e3fac9a3)
- [FastMCP with Gemini 2.0](https://www.marktechpost.com/2025/04/21/a-step-by-step-coding-guide-to-defining-custom-model-context-protocol-mcp-server-and-client-tools-with-fastmcp-and-integrating-them-into-google-gemini-2-0s-function%E2%80%91calling-workflow/)

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

## Summary Table (October 2025)

| AI Tool | MCP Support | Stdio | HTTP/SSE | Streamable HTTP | Notes |
|---------|-------------|-------|----------|-----------------|-------|
| **Claude Desktop** | ✅ Full | ✅ Yes (All plans) | ✅ Yes (Pro/Team/Enterprise) | ✅ Yes | Most comprehensive MCP implementation |
| **ChatGPT** | ✅ Yes | ❌ No | ✅ Yes (Paid plans) | ✅ Yes | Web only, basic implementation, Developer mode for writes |
| **GitHub Copilot** | ⚠️ Partial | ✅ Yes | ✅ Yes | ⚠️ Unknown | MCP Tools supported, Resources not yet supported |
| **Google Gemini** | ⚠️ SDK only | ⚠️ Via integration | ⚠️ Via integration | ⚠️ Via integration | Requires SDK integration, no direct UI support |
| **Custom MCP Client** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | Full support with MCP SDK |

**Legend**:
- ✅ = Fully supported
- ⚠️ = Partially supported or requires additional setup
- ❌ = Not supported

**Key Changes Since January 2025**:
- **March 2025**: OpenAI officially adopted MCP
- **April 2025**: Google announced Gemini MCP support
- **June 2025**: Claude Desktop added remote MCP servers (beta)
- **September 2025**: GitHub deprecated Copilot Extensions in favor of MCP
- **October 2025**: ChatGPT rolled out full MCP support to all paid plans
- **October 2025**: GitHub Copilot Agent Mode with MCP launched to all VS Code users

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

**Last Updated**: October 2025
**MCP Specification**: 2025-03-26 (with Streamable HTTP extension)
**Server Version**: 1.0.0

**Note**: MCP is rapidly evolving. Check tool-specific documentation for latest configuration details.
