#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import HPRDataLoader from './data-loader.js';

// Initialize data loader
const dataLoader = new HPRDataLoader();
await dataLoader.load();

// Create MCP server
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
    result += `\n\n## Series
**${seriesInfo.name}**: ${stripHtml(seriesInfo.description)}`;
  }

  if (includeNotes && episode.notes) {
    result += `\n\n## Host Notes\n${stripHtml(episode.notes)}`;
  }

  return result;
}

function formatTranscriptSearchResults(results, args) {
  if (results.length === 0) {
    return '';
  }

  const descriptorParts = [];
  if (args.query) {
    descriptorParts.push(`phrase="${args.query}"`);
  }
  if (Array.isArray(args.terms) && args.terms.length > 0) {
    descriptorParts.push(`terms=[${args.terms.join(', ')}]`);
  }
  if (descriptorParts.length === 0) {
    descriptorParts.push('"no explicit query provided"');
  }

  const firstSummary = results[0]?.matchSummary || {};
  const matchMode = firstSummary.matchMode || 'phrase';
  const contextLines = args.contextLines ?? 3;
  const caseSensitive = args.caseSensitive ? 'yes' : 'no';
  const wholeWord = args.wholeWord ? 'yes' : 'no';
  const maxMatches = args.maxMatchesPerEpisode ?? 5;
  const hostFilters = [];
  if (args.hostId) hostFilters.push(`ID ${args.hostId}`);
  if (args.hostName) hostFilters.push(`name "${args.hostName}"`);

  let text = `# Transcript Search Results (${results.length} episodes)\n\n`;
  text += `Searching for: ${descriptorParts.join(' | ')}\n`;
  text += `Match mode: ${matchMode} | Context lines: ${contextLines} | Case sensitive: ${caseSensitive} | Whole word: ${wholeWord}\n`;
  text += `Maximum matches per episode: ${maxMatches}\n`;
  if (hostFilters.length > 0) {
    text += `Host filter: ${hostFilters.join(' & ')}\n`;
  }
  text += '\n## Summary\n';

  text += results.map(result => {
    const host = dataLoader.getHost(result.episode.hostid);
    const matchedTerms = result.matchSummary.matchedTerms.length > 0
      ? result.matchSummary.matchedTerms.join(', ')
      : 'N/A';
    const termCounts = Object.entries(result.matchSummary.termHitCounts || {});
    const termCountText = termCounts.length > 0
      ? termCounts.map(([term, count]) => `${term}: ${count}`).join(', ')
      : null;
    const truncatedNote = result.matchSummary.truncated ? ' (truncated)' : '';
    let line = `- HPR${String(result.episode.id).padStart(4, '0')}: ${result.episode.title} — ${result.matchSummary.totalMatches} match${result.matchSummary.totalMatches === 1 ? '' : 'es'}${truncatedNote}; terms: ${matchedTerms}`;
    if (termCountText) {
      line += ` (${termCountText})`;
    }
    line += ` | Host: ${host?.host || 'Unknown'} (${result.episode.date})`;
    return line;
  }).join('\n');

  text += '\n\n';

  results.forEach(result => {
    const host = dataLoader.getHost(result.episode.hostid);
    const matchedTerms = result.matchSummary.matchedTerms.length > 0
      ? result.matchSummary.matchedTerms.join(', ')
      : 'N/A';
    const termCounts = Object.entries(result.matchSummary.termHitCounts || {});
    const termCountText = termCounts.length > 0
      ? termCounts.map(([term, count]) => `${term}: ${count}`).join(', ')
      : null;

    text += `## HPR${String(result.episode.id).padStart(4, '0')}: ${result.episode.title}
**Host:** ${host?.host || 'Unknown'} | **Date:** ${result.episode.date}
**Matched terms:** ${matchedTerms}
**Matches captured:** ${result.matchSummary.totalMatches}${result.matchSummary.truncated ? ' (additional matches omitted after reaching limit)' : ''}
`;
    if (termCountText) {
      text += `**Term counts:** ${termCountText}\n`;
    }
    text += '\n';

    result.matches.forEach((match, index) => {
      const termInfo = match.terms && match.terms.length > 0
        ? ` | terms: ${match.terms.join(', ')}`
        : '';
      text += `### Match ${index + 1} (line ${match.lineNumber}${termInfo})
\`\`\`
${match.context}
\`\`\`

`;
    });
  });

  return text;
}

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const stats = dataLoader.getStats();

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
        description: 'Search through episode transcripts using phrases or multiple terms with AND/OR matching and optional host filters',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search phrase to find in transcripts. Combine with terms/matchMode for advanced searches.',
            },
            terms: {
              type: 'array',
              items: { type: 'string' },
              description: 'Explicit list of terms to search for; useful when pairing with matchMode "any" or "all".',
            },
            matchMode: {
              type: 'string',
              enum: ['any', 'all', 'phrase'],
              description: 'How to interpret the query/terms. "phrase" (default) matches the phrase exactly, "any" matches if any term is present, "all" requires every term.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of episodes to return (default: 20)',
            },
            contextLines: {
              type: 'number',
              description: 'Number of lines of context around matches (default: 3)',
            },
            hostId: {
              type: 'number',
              description: 'Restrict matches to a given host ID.',
            },
            hostName: {
              type: 'string',
              description: 'Restrict matches to hosts whose name contains this value.',
            },
            caseSensitive: {
              type: 'boolean',
              description: 'Perform a case-sensitive search (default: false).',
            },
            wholeWord: {
              type: 'boolean',
              description: 'Match whole words only (default: false).',
            },
            maxMatchesPerEpisode: {
              type: 'number',
              description: 'Maximum number of excerpt matches to include per episode (default: 5).',
            },
          },
          required: [],
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
      const searchOptions = {
        limit: args.limit || 20,
        contextLines: args.contextLines ?? 3,
        terms: args.terms,
        matchMode: args.matchMode,
        hostId: args.hostId,
        hostName: args.hostName,
        caseSensitive: args.caseSensitive,
        wholeWord: args.wholeWord,
        maxMatchesPerEpisode: args.maxMatchesPerEpisode ?? 5,
      };

      const results = dataLoader.searchTranscripts(args.query || '', searchOptions);

      if (results.length === 0) {
        const descriptorParts = [];
        if (args.query) descriptorParts.push(`phrase "${args.query}"`);
        if (Array.isArray(args.terms) && args.terms.length > 0) descriptorParts.push(`terms [${args.terms.join(', ')}]`);
        if (args.hostId || args.hostName) descriptorParts.push('host filter applied');
        const description = descriptorParts.length > 0 ? descriptorParts.join(', ') : 'the provided criteria';

        return {
          content: [
            {
              type: 'text',
              text: `No transcripts found matching ${description}.`,
            },
          ],
        };
      }

      const formatArgs = {
        ...args,
        contextLines: searchOptions.contextLines,
        maxMatchesPerEpisode: searchOptions.maxMatchesPerEpisode,
      };

      const text = formatTranscriptSearchResults(results, formatArgs);

      return {
        content: [
          {
            type: 'text',
            text,
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HPR Knowledge Base MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
