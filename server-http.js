#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import HPRDataLoader from './data-loader.js';

// Configuration
const PORT = process.env.PORT || 3000;
const MAX_CONCURRENT_REQUESTS = 10;
// Increased the timeout for the long-lived SSE connection connect() call
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds (was 30s)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP
const MEMORY_THRESHOLD_MB = 450;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 60 seconds (how long it stays OPEN)
const SSE_HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds to prevent proxy timeout

// Initialize data loader
console.error('Loading HPR knowledge base data...');
const dataLoader = new HPRDataLoader();
await dataLoader.load();
console.error('Data loaded successfully!');

// Map to store active SSE transports, keyed by connectionId
const activeSseTransports = new Map();

// Circuit Breaker class for graceful degradation
class CircuitBreaker {
  constructor(threshold = CIRCUIT_BREAKER_THRESHOLD, timeout = CIRCUIT_BREAKER_TIMEOUT_MS) {
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.timeout;
        console.error(`Circuit breaker opened after ${this.failures} failures`);
      }
      throw error;
    }
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

const circuitBreaker = new CircuitBreaker();

// Request timeout wrapper
function withTimeout(promise, timeoutMs = REQUEST_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

// Concurrent request limiter
let activeRequests = 0;

function checkConcurrency() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    throw new Error('Server at capacity. Please try again later.');
  }
}

// Memory monitoring
let memoryWarning = false;

function checkMemory() {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;

  if (heapUsedMB > MEMORY_THRESHOLD_MB) {
    if (!memoryWarning) {
      console.error(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      memoryWarning = true;
    }
    throw new Error('Server under high load. Please try again later.');
  } else if (memoryWarning && heapUsedMB < MEMORY_THRESHOLD_MB * 0.8) {
    memoryWarning = false;
  }
}

setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  console.error(`Memory: ${heapUsedMB.toFixed(2)}MB, Active requests: ${activeRequests}`);
}, 30000);

// Helper function to strip HTML tags
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

// Helper to format episode for display
function formatEpisode(episode, includeNotes = false) {
  const host = dataLoader.getHost(episode.hostid);
  const seriesInfo = episode.series !== 0 ? dataLoader.getSeries(episode.series) : null;

  let result = `# HPR${String(episode.id).padStart(4, '0')}: ${episode.title}

**Date:** ${episode.date}
**Host:** ${host?.host || 'Unknown'} (ID: ${episode.hostid})
**Duration:** ${Math.floor(episode.duration / 60)}:${String(episode.duration % 60).padStart(2, '0')}
**Tags:** ${episode.tags}
**License:** ${episode.license}
**Downloads:** ${episode.downloads}

## Summary
${episode.summary}`;

  if (seriesInfo) {
    result += `

## Series
**${seriesInfo.name}**: ${stripHtml(seriesInfo.description)}`;
  }

  if (includeNotes && episode.notes) {
    result += `

## Host Notes
${stripHtml(episode.notes)}`;
  }

  return result;
}

// Create MCP server factory
function createMCPServer() {
  const server = new Server(
    {
      name: 'hpr-knowledge-base',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'hpr://stats',
          mimeType: 'text/plain',
          name: 'HPR Statistics',
          description: 'Overall statistics about the HPR knowledge base',
        },
        {
          uri: 'hpr://episodes/recent',
          mimeType: 'text/plain',
          name: 'Recent Episodes',
          description: 'List of 50 most recent HPR episodes',
        },
        {
          uri: 'hpr://hosts/all',
          mimeType: 'text/plain',
          name: 'All Hosts',
          description: 'List of all HPR hosts',
        },
        {
          uri: 'hpr://series/all',
          mimeType: 'text/plain',
          name: 'All Series',
          description: 'List of all HPR series',
        },
      ],
    };
  });

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === 'hpr://stats') {
      const stats = dataLoader.getStats();
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `# Hacker Public Radio Statistics

**Total Episodes:** ${stats.totalEpisodes}
**Total Hosts:** ${stats.totalHosts}
**Total Comments:** ${stats.totalComments}
**Total Series:** ${stats.totalSeries}
**Transcripts Available:** ${stats.totalTranscripts}

**Date Range:** ${stats.dateRange.earliest} to ${stats.dateRange.latest}

Hacker Public Radio is a community-driven podcast released under Creative Commons licenses.
All content is contributed by the community, for the community.`,
          },
        ],
      };
    }

    if (uri === 'hpr://episodes/recent') {
      const recent = dataLoader.searchEpisodes('', { limit: 50 });
      const text = recent.map(ep => {
        const host = dataLoader.getHost(ep.hostid);
        return `**HPR${String(ep.id).padStart(4, '0')}** (${ep.date}) - ${ep.title} by ${host?.host || 'Unknown'}`;
      }).join('\n');

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `# Recent Episodes\n\n${text}`,
          },
        ],
      };
    }

    if (uri === 'hpr://hosts/all') {
      const hosts = dataLoader.hosts
        .filter(h => h.valid === 1)
        .map(h => {
          const episodeCount = dataLoader.getEpisodesByHost(h.hostid).length;
          return `**${h.host}** (ID: ${h.hostid}) - ${episodeCount} episodes`;
        })
        .join('\n');

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `# All HPR Hosts\n\n${hosts}`,
          },
        ],
      };
    }

    if (uri === 'hpr://series/all') {
      const series = dataLoader.series
        .filter(s => s.valid === 1 && s.private === 0)
        .map(s => {
          const episodeCount = dataLoader.getEpisodesInSeries(s.id).length;
          return `**${s.name}** (ID: ${s.id}) - ${episodeCount} episodes\n  ${stripHtml(s.description)}`;
        })
        .join('\n\n');

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `# All HPR Series\n\n${series}`,
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_episodes',
          description: 'Search HPR episodes by keywords in title, summary, tags, or host notes. Can filter by host, series, tags, and date range.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (searches title, summary, tags, and notes)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 20)',
              },
              hostId: {
                type: 'number',
                description: 'Filter by host ID',
              },
              seriesId: {
                type: 'number',
                description: 'Filter by series ID',
              },
              tag: {
                type: 'string',
                description: 'Filter by tag',
              },
              fromDate: {
                type: 'string',
                description: 'Filter episodes from this date (YYYY-MM-DD)',
              },
              toDate: {
                type: 'string',
                description: 'Filter episodes to this date (YYYY-MM-DD)',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_episode',
          description: 'Get detailed information about a specific HPR episode including transcript if available',
          inputSchema: {
            type: 'object',
            properties: {
              episodeId: {
                type: 'number',
                description: 'Episode ID number',
              },
              includeTranscript: {
                type: 'boolean',
                description: 'Include full transcript if available (default: true)',
              },
              includeComments: {
                type: 'boolean',
                description: 'Include community comments (default: true)',
              },
            },
            required: ['episodeId'],
          },
        },
        {
          name: 'search_transcripts',
          description: 'Search through episode transcripts for specific keywords or phrases',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query to find in transcripts',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of episodes to return (default: 20)',
              },
              contextLines: {
                type: 'number',
                description: 'Number of lines of context around matches (default: 3)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_host_info',
          description: 'Get information about an HPR host including all their episodes',
          inputSchema: {
            type: 'object',
            properties: {
              hostId: {
                type: 'number',
                description: 'Host ID number',
              },
              hostName: {
                type: 'string',
                description: 'Host name (will search if hostId not provided)',
              },
              includeEpisodes: {
                type: 'boolean',
                description: 'Include list of all episodes by this host (default: true)',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_series_info',
          description: 'Get information about an HPR series including all episodes in the series',
          inputSchema: {
            type: 'object',
            properties: {
              seriesId: {
                type: 'number',
                description: 'Series ID number',
              },
            },
            required: ['seriesId'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'search_episodes') {
        const results = dataLoader.searchEpisodes(args.query || '', {
          limit: args.limit || 20,
          hostId: args.hostId,
          seriesId: args.seriesId,
          tag: args.tag,
          fromDate: args.fromDate,
          toDate: args.toDate,
        });

        const text = results.length > 0
          ? results.map(ep => formatEpisode(ep, false)).join('\n\n---\n\n')
          : 'No episodes found matching your search criteria.';

        return {
          content: [
            {
              type: 'text',
              text: `# Search Results (${results.length} episodes found)\n\n${text}`,
            },
          ],
        };
      }

      if (name === 'get_episode') {
        const episode = dataLoader.getEpisode(args.episodeId);

        if (!episode) {
          return {
            content: [
              {
                type: 'text',
                text: `Episode ${args.episodeId} not found.`,
              },
            ],
          };
        }

        let text = formatEpisode(episode, true);

        // Add transcript if requested and available
        if (args.includeTranscript !== false) {
          const transcript = dataLoader.getTranscript(args.episodeId);
          if (transcript) {
            text += `\n\n## Transcript\n\n${transcript}`;
          } else {
            text += `\n\n## Transcript\n\n*No transcript available for this episode.*`;
          }
        }

        // Add comments if requested
        if (args.includeComments !== false) {
          const comments = dataLoader.getCommentsForEpisode(args.episodeId);
          if (comments.length > 0) {
            text += `\n\n## Comments (${comments.length})\n\n`;
            text += comments.map(c =>
              `**${c.comment_author_name}** (${c.comment_timestamp})${c.comment_title ? ` - ${c.comment_title}` : ''}\n${c.comment_text}`
            ).join('\n\n---\n\n');
          }
        }

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }

      if (name === 'search_transcripts') {
        const results = dataLoader.searchTranscripts(args.query, {
          limit: args.limit || 20,
          contextLines: args.contextLines || 3,
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No transcripts found containing "${args.query}".`,
              },
            ],
          };
        }

        const text = results.map(result => {
          const { episode, matches } = result;
          const host = dataLoader.getHost(episode.hostid);

          let episodeText = `# HPR${String(episode.id).padStart(4, '0')}: ${episode.title}
**Host:** ${host?.host || 'Unknown'} | **Date:** ${episode.date}

**Matches found:** ${matches.length}

`;

          matches.forEach(match => {
            episodeText += `### Line ${match.lineNumber}
\`\`\`
${match.context}
\`\`\`

`;
          });

          return episodeText;
        }).join('\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `# Transcript Search Results (${results.length} episodes)\n\nSearching for: "${args.query}"\n\n${text}`,
            },
          ],
        };
      }

      if (name === 'get_host_info') {
        let host;

        if (args.hostId) {
          host = dataLoader.getHost(args.hostId);
        } else if (args.hostName) {
          const hosts = dataLoader.searchHosts(args.hostName);
          host = hosts[0];
        }

        if (!host) {
          return {
            content: [
              {
                type: 'text',
                text: 'Host not found.',
              },
            ],
          };
        }

        let text = `# ${host.host}

**Host ID:** ${host.hostid}
**Email:** ${host.email}
**License:** ${host.license}
**Profile:** ${stripHtml(host.profile)}
`;

        if (args.includeEpisodes !== false) {
          const episodes = dataLoader.getEpisodesByHost(host.hostid);
          text += `\n**Total Episodes:** ${episodes.length}\n\n## Episodes\n\n`;

          // Sort by date (newest first)
          episodes.sort((a, b) => b.date.localeCompare(a.date));

          text += episodes.map(ep =>
            `**HPR${String(ep.id).padStart(4, '0')}** (${ep.date}) - ${ep.title}\n  ${ep.summary}`
          ).join('\n\n');
        }

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }

      if (name === 'get_series_info') {
        const series = dataLoader.getSeries(args.seriesId);

        if (!series) {
          return {
            content: [
              {
                type: 'text',
                text: `Series ${args.seriesId} not found.`,
              },
            ],
          };
        }

        const episodes = dataLoader.getEpisodesInSeries(args.seriesId);

        let text = `# ${series.name}

**Series ID:** ${series.id}
**Description:** ${stripHtml(series.description)}
**Total Episodes:** ${episodes.length}

## Episodes in Series

`;

        // Sort by date
        episodes.sort((a, b) => a.date.localeCompare(b.date));

        text += episodes.map((ep, index) => {
          const host = dataLoader.getHost(ep.hostid);
          return `${index + 1}. **HPR${String(ep.id).padStart(4, '0')}** (${ep.date}) - ${ep.title} by ${host?.host || 'Unknown'}\n   ${ep.summary}`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Create Express app
const app = express();

// Create a single MCP server instance
const mcpServer = createMCPServer();

// Trust first proxy hop (Render/Heroku) without allowing arbitrary spoofing
app.set('trust proxy', 1);

// Enable CORS
app.use(cors());

// Enable compression
app.use(compression());

// Apply JSON body parsing globally for the SDK to read POST bodies.
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;

  res.json({
    status: 'ok',
    memory: {
      used: `${heapUsedMB.toFixed(2)}MB`,
      threshold: `${MEMORY_THRESHOLD_MB}MB`,
    },
    activeRequests,
    circuitBreaker: circuitBreaker.state,
  });
});

// ⭐ NEW ENDPOINT: Circuit breaker reset
app.post('/reset', (req, res) => {
  if (circuitBreaker.state === 'OPEN') {
    circuitBreaker.reset();
    console.error('Circuit breaker manually reset.');
    res.json({ status: 'ok', message: 'Circuit breaker reset to CLOSED.' });
  } else {
    res.json({ status: 'ok', message: 'Circuit breaker already CLOSED.' });
  }
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  let pingInterval = null; 
  let transport;

  try {
    // Check system health
    checkMemory();
    checkConcurrency();

    activeRequests++;
    console.error(`New SSE connection. Active requests: ${activeRequests}`);

    // Create SSE transport, specifying the POST message path
    transport = new SSEServerTransport('/message', res); 
    activeSseTransports.set(transport.sessionId, transport);

    // Connect server with timeout and circuit breaker
    // This calls transport.start() internally, which sets up headers and sends the endpoint event.
    await circuitBreaker.execute(() => mcpServer.connect(transport));

    // 2. Start the heartbeat/ping interval (after transport.start() has set up res.write)
    pingInterval = setInterval(() => {
        // Send a comment line every 20s to keep the proxy alive
        res.write(':\n');
    }, SSE_HEARTBEAT_INTERVAL_MS); 

    // Handle connection close (will execute when client closes the connection)
    req.on('close', () => {
      activeRequests--;
      if (pingInterval) {
          clearInterval(pingInterval); 
      }
      if (transport) {
        activeSseTransports.delete(transport.sessionId);
      }
      console.error(`SSE connection closed. Active requests: ${activeRequests}`);
      // Ensure the server stream is ended gracefully if it hasn't already
      if (!res.writableEnded) {
        res.end();
      }
    });

  } catch (error) {
    // Handle error during connection establishment or connection timeout
    activeRequests--;
    if (pingInterval) {
        clearInterval(pingInterval); 
    }
    if (transport) {
      activeSseTransports.delete(transport.sessionId);
    }
    console.error('SSE connection error:', error.message);

    if (!res.headersSent) {
      // Case 1: Error before SSE headers were flushed (e.g., checkMemory failed)
      // We can still set the status code.
      res.status(503).json({
        error: error.message,
        circuitBreaker: circuitBreaker.state,
      });
    } else {
      // Case 2: Error after SSE headers were flushed (stream is open)
      // Send an SSE 'error' event and end the connection.
      const errorData = JSON.stringify({ 
          message: error.message, 
          circuitBreaker: circuitBreaker.state 
      });
      res.write(`event: error\ndata: ${errorData}\n\n`);
      res.end(); 
    }
  }
});

// POST endpoint for MCP messages
app.post('/message', async (req, res) => {
  const headerConnectionId = req.headers['x-connection-id'];
  const queryConnectionId = req.query.sessionId;
  const connectionId = headerConnectionId || queryConnectionId;
  const transport = activeSseTransports.get(connectionId);

  if (transport) {
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error processing MCP message via POST:', error);
      res.status(400).json({ error: 'Bad Request', message: error.message });
    }
  } else {
    res.status(404).json({ error: 'Not Found', message: 'No active SSE connection for this ID.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.error(`HPR Knowledge Base MCP Server running on http://localhost:${PORT}`);
  console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`Health check: http://localhost:${PORT}/health`);
  console.error(`Configuration:`);
  console.error(`  - Max concurrent requests: ${MAX_CONCURRENT_REQUESTS}`);
  console.error(`  - Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
  console.error(`  - Rate limit: ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s`);
  console.error(`  - Memory threshold: ${MEMORY_THRESHOLD_MB}MB`);
  console.error(`  - SSE Heartbeat: ${SSE_HEARTBEAT_INTERVAL_MS / 1000}s`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.error('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
