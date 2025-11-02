import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to change one string into the other.
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

class HPRDataLoader {
  constructor() {
    this.episodes = [];
    this.hosts = [];
    this.comments = [];
    this.series = [];
    this.transcripts = new Map(); // Map of episode id to transcript text
  }

  /**
   * Load all data from JSON files and transcripts
   */
  async load() {
    console.error('Loading HPR data...');

    // Load JSON files
    this.episodes = this.loadJSON('hpr_metadata/episodes.json');
    this.hosts = this.loadJSON('hpr_metadata/hosts.json');
    this.comments = this.loadJSON('hpr_metadata/comments.json');
    this.series = this.loadJSON('hpr_metadata/series.json');

    console.error(`Loaded ${this.episodes.length} episodes`);
    console.error(`Loaded ${this.hosts.length} hosts`);
    console.error(`Loaded ${this.comments.length} comments`);
    console.error(`Loaded ${this.series.length} series`);

    // Load transcripts
    this.loadTranscripts();

    console.error(`Loaded ${this.transcripts.size} transcripts`);
    console.error('HPR data loading complete!');
  }

  /**
   * Load a JSON file
   */
  loadJSON(relativePath) {
    const filePath = join(__dirname, relativePath);
    try {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading ${relativePath}:`, error.message);
      return [];
    }
  }

  /**
   * Load all transcript files
   */
  loadTranscripts() {
    const transcriptsDir = join(__dirname, 'hpr_transcripts');
    try {
      const files = readdirSync(transcriptsDir);

      for (const file of files) {
        if (file.endsWith('.txt')) {
          // Extract episode ID from filename (e.g., hpr0016.txt -> 16)
          const match = file.match(/hpr(\d+)\.txt/);
          if (match) {
            const episodeId = parseInt(match[1], 10);
            const filePath = join(transcriptsDir, file);
            try {
              const content = readFileSync(filePath, 'utf-8');
              this.transcripts.set(episodeId, content);
            } catch (error) {
              console.error(`Error loading transcript ${file}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading transcripts directory:', error.message);
    }
  }

  /**
   * Get episode by ID
   */
  getEpisode(id) {
    return this.episodes.find(ep => ep.id === id);
  }

  /**
   * Get host by ID
   */
  getHost(id) {
    return this.hosts.find(host => host.hostid === id);
  }

  /**
   * Get series by ID
   */
  getSeries(id) {
    return this.series.find(s => s.id === id);
  }

  /**
   * Get transcript for episode
   */
  getTranscript(episodeId) {
    return this.transcripts.get(episodeId);
  }

  /**
   * Get comments for episode
   */
  getCommentsForEpisode(episodeId) {
    return this.comments.filter(c => c.eps_id === episodeId);
  }

  /**
   * Get episodes by host
   */
  getEpisodesByHost(hostId) {
    return this.episodes.filter(ep => ep.hostid === hostId);
  }

  /**
   * Get episodes in a series
   */
  getEpisodesInSeries(seriesId) {
    return this.episodes.filter(ep => ep.series === seriesId);
  }

  /**
   * Search episodes by keyword in title, summary, or tags with fuzzy matching fallback
   * Returns episodes with matchType indicator ('exact' or 'fuzzy')
   */
  searchEpisodes(query, options = {}) {
    const {
      limit = 20,
      hostId = null,
      seriesId = null,
      tag = null,
      fromDate = null,
      toDate = null,
      maxDistance = 3  // More lenient for longer episode titles
    } = options;

    const queryLower = query.toLowerCase();

    // Helper to check if episode matches filters (excluding query)
    const matchesFilters = (ep) => {
      const matchesHost = !hostId || ep.hostid === hostId;
      const matchesSeries = seriesId === null || ep.series === seriesId;
      const matchesTag = !tag || ep.tags.toLowerCase().includes(tag.toLowerCase());
      const matchesDateRange = (!fromDate || ep.date >= fromDate) &&
                                (!toDate || ep.date <= toDate);
      return matchesHost && matchesSeries && matchesTag && matchesDateRange;
    };

    // Try exact substring match first (fast path)
    let results = this.episodes.filter(ep => {
      const matchesQuery = !query ||
        ep.title.toLowerCase().includes(queryLower) ||
        ep.summary.toLowerCase().includes(queryLower) ||
        ep.tags.toLowerCase().includes(queryLower) ||
        ep.notes.toLowerCase().includes(queryLower);

      return matchesQuery && matchesFilters(ep);
    }).map(ep => ({
      ...ep,
      matchType: 'exact'
    }));

    // If no exact matches and we have a query, try fuzzy match on title
    if (results.length === 0 && query && query.trim().length > 0) {
      const fuzzyResults = this.episodes
        .filter(matchesFilters)
        .map(ep => {
          // Check if any word in the title is close to the query
          const titleWords = ep.title.toLowerCase().split(/\s+/);
          let minDistance = Infinity;

          for (const word of titleWords) {
            const distance = levenshteinDistance(queryLower, word);
            if (distance < minDistance) {
              minDistance = distance;
            }
          }

          return {
            episode: ep,
            distance: minDistance
          };
        })
        .filter(result => result.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .map(result => ({
          ...result.episode,
          matchType: 'fuzzy',
          matchDistance: result.distance
        }));

      results = fuzzyResults;
    }

    // Sort by date (newest first), maintaining match quality
    results.sort((a, b) => {
      // If both are fuzzy matches, sort by distance first, then date
      if (a.matchType === 'fuzzy' && b.matchType === 'fuzzy') {
        const distDiff = (a.matchDistance || 0) - (b.matchDistance || 0);
        if (distDiff !== 0) return distDiff;
      }
      return b.date.localeCompare(a.date);
    });

    return results.slice(0, limit);
  }

  /**
   * Search transcripts by keyword
   */
  searchTranscripts(query, options = {}) {
    const {
      limit = 20,
      contextLines = 3,
      terms = [],
      matchMode = 'auto',
      hostId = null,
      hostName = null,
      caseSensitive = false,
      wholeWord = false,
      maxMatchesPerEpisode = 5,
    } = options;

    const resolvedHostIds = new Set();
    if (hostId) {
      resolvedHostIds.add(Number(hostId));
    }
    if (hostName) {
      const hostMatches = this.searchHosts(hostName);
      hostMatches.forEach(host => resolvedHostIds.add(host.hostid));
    }
    const filterByHost = resolvedHostIds.size > 0;

    const explicitTerms = Array.isArray(terms)
      ? terms.map(t => (t ?? '').toString().trim()).filter(Boolean)
      : [];

    const splitQueryTerms = (matchMode === 'any' || matchMode === 'all')
      ? (query || '')
          .split(/[|,;\n]/)
          .map(part => part.trim())
          .filter(Boolean)
      : [];

    const hasQuery = typeof query === 'string' && query.trim().length > 0;

    let searchTerms = explicitTerms.length > 0 ? explicitTerms : splitQueryTerms;
    if (searchTerms.length === 0 && hasQuery) {
      searchTerms = [query.trim()];
    }

    let resolvedMatchMode = matchMode;
    if (!['any', 'all', 'phrase'].includes(resolvedMatchMode)) {
      resolvedMatchMode = searchTerms.length > 1 ? 'any' : 'phrase';
    }

    const effectiveTerms = resolvedMatchMode === 'phrase'
      ? [(hasQuery ? query.trim() : searchTerms[0] || '')].filter(Boolean)
      : searchTerms;

    if (effectiveTerms.length === 0) {
      return [];
    }

    const regexFlags = caseSensitive ? 'g' : 'gi';
    const matchers = effectiveTerms.map(term => {
      if (!term) return null;
      const escaped = escapeRegExp(term);
      const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
      try {
        return {
          term,
          regex: new RegExp(pattern, regexFlags),
        };
      } catch (error) {
        console.error(`Invalid search pattern for term "${term}":`, error.message);
        return null;
      }
    }).filter(Boolean);

    if (matchers.length === 0) {
      return [];
    }

    const results = [];

    for (const [episodeId, transcript] of this.transcripts) {
      if (results.length >= limit) break;

      const episode = this.getEpisode(episodeId);
      if (!episode) continue;

      if (filterByHost && !resolvedHostIds.has(episode.hostid)) {
        continue;
      }

      const lines = transcript.split(/\r?\n/);
      const matches = [];
      const matchedTerms = new Set();
      const termHitCounts = new Map();
      let truncated = false;

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const matchedOnLine = [];

        for (const matcher of matchers) {
          matcher.regex.lastIndex = 0;
          if (matcher.regex.test(line)) {
            matchedOnLine.push(matcher.term);
            matchedTerms.add(matcher.term);
            termHitCounts.set(matcher.term, (termHitCounts.get(matcher.term) || 0) + 1);
          }
        }

        if (matchedOnLine.length > 0) {
          const start = Math.max(0, index - contextLines);
          const end = Math.min(lines.length, index + contextLines + 1);
          const context = lines.slice(start, end).join('\n');

          matches.push({
            lineNumber: index + 1,
            terms: [...new Set(matchedOnLine)],
            context,
          });
        }

        if (matches.length >= maxMatchesPerEpisode) {
          truncated = true;
          break;
        }
      }

      if (matches.length === 0) {
        continue;
      }

      if (resolvedMatchMode === 'all' && matchedTerms.size < matchers.length) {
        continue;
      }

      results.push({
        episode,
        matches,
        matchSummary: {
          matchMode: resolvedMatchMode,
          matchedTerms: [...matchedTerms],
          totalMatches: matches.length,
          termHitCounts: Object.fromEntries(termHitCounts),
          truncated,
        },
      });
    }

    return results;
  }

  /**
   * Search hosts by name or email with fuzzy matching fallback
   * Returns hosts with matchType indicator ('exact' or 'fuzzy')
   */
  searchHosts(query, options = {}) {
    const { maxDistance = 2 } = options;
    const queryLower = query.toLowerCase();

    // Try exact substring match first (fast path)
    const exactMatches = this.hosts.filter(host =>
      host.host.toLowerCase().includes(queryLower) ||
      host.email.toLowerCase().includes(queryLower)
    ).map(host => ({
      ...host,
      matchType: 'exact'
    }));

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // Fall back to fuzzy match if no exact matches
    const fuzzyMatches = this.hosts
      .map(host => {
        const hostLower = host.host.toLowerCase();
        const emailLower = host.email.toLowerCase();
        const hostDistance = levenshteinDistance(queryLower, hostLower);
        const emailDistance = levenshteinDistance(queryLower, emailLower);
        const minDistance = Math.min(hostDistance, emailDistance);

        return {
          host,
          distance: minDistance
        };
      })
      .filter(result => result.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(result => ({
        ...result.host,
        matchType: 'fuzzy',
        matchDistance: result.distance
      }));

    return fuzzyMatches;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalEpisodes: this.episodes.length,
      totalHosts: this.hosts.length,
      totalComments: this.comments.length,
      totalSeries: this.series.length,
      totalTranscripts: this.transcripts.size,
      dateRange: {
        earliest: this.episodes.reduce((min, ep) => ep.date < min ? ep.date : min, this.episodes[0]?.date || ''),
        latest: this.episodes.reduce((max, ep) => ep.date > max ? ep.date : max, this.episodes[0]?.date || '')
      }
    };
  }
}

export default HPRDataLoader;
