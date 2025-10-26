# Hacker Public Radio Knowledge Base MCP Server

An MCP (Model Context Protocol) server providing access to the Hacker Public Radio (HPR) knowledge base, including episodes, transcripts, hosts, series, and community comments.

## About HPR

Hacker Public Radio is a community-driven podcast where hosts contribute content on topics of interest to hackers. All content is released under Creative Commons licenses, making it freely available for learning and sharing.

## Features

This MCP server provides:

- **Episode Search**: Search through thousands of HPR episodes by title, summary, tags, or host notes
- **Transcript Search**: Full-text search across all episode transcripts
- **Episode Details**: Get complete information about any episode including transcript and comments
- **Host Information**: Look up hosts and see all their contributions
- **Series Browsing**: Explore mini-series of related episodes
- **Statistics**: View overall HPR statistics and recent episodes

## Installation

### Prerequisites

- Node.js 18 or higher
- The HPR data files:
  - `hpr_metadata/` directory containing JSON files
  - `hpr_transcripts/` directory containing transcript files

### Setup

1. Install dependencies:

```bash
npm install
```

2. Make the server executable:

```bash
chmod +x index.js
```

## Usage

### Running Locally (Stdio Mode)

You can test the stdio server directly (for local MCP clients like Claude Desktop):

```bash
npm start
```

### Running as HTTP Server (Network Access)

For network access and public deployment, use the HTTP/SSE server:

```bash
npm run start:http
```

This starts an HTTP server on port 3000 (configurable via `PORT` environment variable) with:
- **SSE endpoint**: `http://localhost:3000/sse`
- **Health check**: `http://localhost:3000/health`
- Built-in rate limiting, compression, and graceful degradation

### Using with Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

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

Replace `/absolute/path/to/knowledge_base/` with the actual path to this directory.

### Using with Other MCP Clients

Any MCP-compatible client can connect to this server via stdio. The server will load all HPR data on startup and make it available through tools and resources.

## Available Tools

### 1. `search_episodes`

Search for episodes by keywords in title, summary, tags, or notes.

**Parameters:**
- `query` (string): Search query
- `limit` (number, optional): Maximum results (default: 20)
- `hostId` (number, optional): Filter by specific host
- `seriesId` (number, optional): Filter by specific series
- `tag` (string, optional): Filter by tag
- `fromDate` (string, optional): Filter from date (YYYY-MM-DD)
- `toDate` (string, optional): Filter to date (YYYY-MM-DD)

**Example:**
```
Search for episodes about "linux kernel" from 2020 onwards
```

### 2. `get_episode`

Get detailed information about a specific episode.

**Parameters:**
- `episodeId` (number, required): Episode ID
- `includeTranscript` (boolean, optional): Include transcript (default: true)
- `includeComments` (boolean, optional): Include comments (default: true)

**Example:**
```
Get details for episode 16 including transcript and comments
```

### 3. `search_transcripts`

Search through episode transcripts for specific keywords.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Maximum episodes to return (default: 20)
- `contextLines` (number, optional): Lines of context around matches (default: 3)

**Example:**
```
Search transcripts for mentions of "virtual machine"
```

### 4. `get_host_info`

Get information about a host and their episodes.

**Parameters:**
- `hostId` (number, optional): Host ID
- `hostName` (string, optional): Host name to search for
- `includeEpisodes` (boolean, optional): Include episode list (default: true)

**Example:**
```
Get information about host "klaatu" including all their episodes
```

### 5. `get_series_info`

Get information about a series and all its episodes.

**Parameters:**
- `seriesId` (number, required): Series ID

**Example:**
```
Get information about series 4 (Databases series)
```

## Available Resources

### `hpr://stats`
Overall statistics about the HPR knowledge base

### `hpr://episodes/recent`
List of 50 most recent episodes

### `hpr://hosts/all`
List of all HPR hosts with episode counts

### `hpr://series/all`
List of all HPR series with descriptions

## Data Structure

The server expects the following directory structure:

```
knowledge_base/
├── index.js
├── data-loader.js
├── package.json
├── hpr_metadata/
│   ├── episodes.json
│   ├── hosts.json
│   ├── comments.json
│   └── series.json
└── hpr_transcripts/
    ├── hpr0001.txt
    ├── hpr0002.txt
    └── ...
```

## Deployment

The HTTP/SSE server (`server-http.js`) is designed for public deployment with graceful degradation features:

### Features

- **Rate Limiting**: 50 requests per minute per IP address
- **Request Timeouts**: 30-second timeout per request
- **Concurrent Request Limiting**: Maximum 10 concurrent requests
- **Circuit Breaker**: Automatically stops accepting requests if failure rate is too high
- **Memory Monitoring**: Rejects requests if memory usage exceeds 450MB
- **Compression**: Gzip compression for all responses
- **CORS**: Enabled for cross-origin requests

### Recommended Hosting Options

#### Render.com (Recommended)
```bash
# Free tier available, $7/mo for always-on
# Auto-scaling and health checks built-in
```

#### Railway.app
```bash
# $5 free credit/month, pay-per-usage
# Scales to zero when idle
```

#### Fly.io
```bash
# Free tier: 256MB RAM
# Global edge deployment
```

### Environment Variables

- `PORT`: Server port (default: 3000)

### Health Check

The server provides a health check endpoint at `/health` for monitoring:

```bash
curl http://localhost:3000/health
```

Returns:
```json
{
  "status": "ok",
  "memory": {
    "used": "45.23MB",
    "threshold": "450MB"
  },
  "activeRequests": 2,
  "circuitBreaker": "CLOSED"
}
```

## Development

### Project Structure

- `index.js` - Stdio MCP server (for local use)
- `server-http.js` - HTTP/SSE MCP server (for network deployment)
- `data-loader.js` - Data loading and searching functionality
- `package.json` - Node.js package configuration

### Extending the Server

You can add new tools or resources by:

1. Adding new methods to `HPRDataLoader` in `data-loader.js`
2. Registering new tools in the `ListToolsRequestSchema` handler
3. Implementing tool logic in the `CallToolRequestSchema` handler

## License

This MCP server code is released under CC-BY-SA to match the HPR content license.

The Hacker Public Radio content itself is released under various Creative Commons licenses as specified in each episode's metadata.

## Credits

- **Hacker Public Radio**: https://hackerpublicradio.org
- **MCP SDK**: https://modelcontextprotocol.io

## Contributing

Contributions are welcome! This server can be extended with:

- Advanced search features (fuzzy matching, relevance ranking)
- Tag cloud generation
- Episode recommendations
- Audio file access
- Web interface for browsing

## Support

For issues related to:
- **This MCP server**: Open an issue in this repository
- **HPR content**: Visit https://hackerpublicradio.org
- **MCP protocol**: Visit https://modelcontextprotocol.io

## Example Queries

Here are some example queries you can try with an MCP client:

1. "Find episodes about Python programming from 2023"
2. "Show me all episodes by Ken Fallon"
3. "Search transcripts for discussions about encryption"
4. "What is the Database 101 series about?"
5. "Show me recent episodes about Linux"
6. "Find episodes tagged with 'security'"

Enjoy exploring the Hacker Public Radio knowledge base!
