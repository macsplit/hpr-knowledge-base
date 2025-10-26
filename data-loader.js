import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
   * Search episodes by keyword in title, summary, or tags
   */
  searchEpisodes(query, options = {}) {
    const {
      limit = 20,
      hostId = null,
      seriesId = null,
      tag = null,
      fromDate = null,
      toDate = null
    } = options;

    const queryLower = query.toLowerCase();
    let results = this.episodes.filter(ep => {
      // Basic text search
      const matchesQuery = !query ||
        ep.title.toLowerCase().includes(queryLower) ||
        ep.summary.toLowerCase().includes(queryLower) ||
        ep.tags.toLowerCase().includes(queryLower) ||
        ep.notes.toLowerCase().includes(queryLower);

      // Filter by host
      const matchesHost = !hostId || ep.hostid === hostId;

      // Filter by series
      const matchesSeries = seriesId === null || ep.series === seriesId;

      // Filter by tag
      const matchesTag = !tag || ep.tags.toLowerCase().includes(tag.toLowerCase());

      // Filter by date range
      const matchesDateRange = (!fromDate || ep.date >= fromDate) &&
                                (!toDate || ep.date <= toDate);

      return matchesQuery && matchesHost && matchesSeries && matchesTag && matchesDateRange;
    });

    // Sort by date (newest first)
    results.sort((a, b) => b.date.localeCompare(a.date));

    return results.slice(0, limit);
  }

  /**
   * Search transcripts by keyword
   */
  searchTranscripts(query, options = {}) {
    const { limit = 20, contextLines = 3 } = options;
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [episodeId, transcript] of this.transcripts) {
      const lines = transcript.split('\n');
      const matches = [];

      // Find all matching lines
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(queryLower)) {
          // Get context around the match
          const start = Math.max(0, index - contextLines);
          const end = Math.min(lines.length, index + contextLines + 1);
          const context = lines.slice(start, end).join('\n');

          matches.push({
            lineNumber: index + 1,
            line: line.trim(),
            context: context
          });
        }
      });

      if (matches.length > 0) {
        const episode = this.getEpisode(episodeId);
        if (episode) {
          results.push({
            episode,
            matches: matches.slice(0, 5) // Limit matches per episode
          });
        }
      }

      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Search hosts by name or email
   */
  searchHosts(query) {
    const queryLower = query.toLowerCase();
    return this.hosts.filter(host =>
      host.host.toLowerCase().includes(queryLower) ||
      host.email.toLowerCase().includes(queryLower)
    );
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
