#!/usr/bin/env node

/**
 * Test script for fuzzy search functionality
 * Tests both episode and host fuzzy matching
 */

import HPRDataLoader from './data-loader.js';

console.log('Loading HPR data...\n');
const dataLoader = new HPRDataLoader();
await dataLoader.load();
console.log('Data loaded!\n');

// Test 1: Exact host match (should use exact matching)
console.log('=== Test 1: Exact Host Match ===');
console.log('Query: "ken"\n');
const exactHosts = dataLoader.searchHosts('ken');
console.log(`Found ${exactHosts.length} results (exact match)`);
exactHosts.slice(0, 3).forEach(host => {
  console.log(`  - ${host.host} (${host.hostid}) [matchType: ${host.matchType}]`);
});
console.log('');

// Test 2: Fuzzy host match with typo
console.log('=== Test 2: Fuzzy Host Match (typo) ===');
console.log('Query: "klattu" (should match "klaatu")\n');
const fuzzyHosts = dataLoader.searchHosts('klattu');
console.log(`Found ${fuzzyHosts.length} results`);
fuzzyHosts.forEach(host => {
  console.log(`  - ${host.host} (${host.hostid}) [matchType: ${host.matchType}, distance: ${host.matchDistance}]`);
});
console.log('');

// Test 3: Another fuzzy host match
console.log('=== Test 3: Fuzzy Host Match (another typo) ===');
console.log('Query: "dav" (should find hosts like "Dave")\n');
const fuzzyHosts2 = dataLoader.searchHosts('dav');
console.log(`Found ${fuzzyHosts2.length} results`);
fuzzyHosts2.slice(0, 5).forEach(host => {
  console.log(`  - ${host.host} (${host.hostid}) [matchType: ${host.matchType}${host.matchDistance ? ', distance: ' + host.matchDistance : ''}]`);
});
console.log('');

// Test 4: Exact episode search
console.log('=== Test 4: Exact Episode Match ===');
console.log('Query: "linux" (exact match in title/summary)\n');
const exactEpisodes = dataLoader.searchEpisodes('linux', { limit: 3 });
console.log(`Found ${exactEpisodes.length} results`);
exactEpisodes.forEach(ep => {
  console.log(`  - HPR${String(ep.id).padStart(4, '0')}: ${ep.title} [matchType: ${ep.matchType}]`);
});
console.log('');

// Test 5: Fuzzy episode search with typo
console.log('=== Test 5: Fuzzy Episode Match (typo) ===');
console.log('Query: "linx" (should match episodes with "linux" in title)\n');
const fuzzyEpisodes = dataLoader.searchEpisodes('linx', { limit: 3 });
console.log(`Found ${fuzzyEpisodes.length} results`);
fuzzyEpisodes.forEach(ep => {
  console.log(`  - HPR${String(ep.id).padStart(4, '0')}: ${ep.title.substring(0, 60)}... [matchType: ${ep.matchType}${ep.matchDistance ? ', distance: ' + ep.matchDistance : ''}]`);
});
console.log('');

// Test 6: Another fuzzy episode search
console.log('=== Test 6: Fuzzy Episode Match (misspelling) ===');
console.log('Query: "pythoon" (should match "python")\n');
const fuzzyEpisodes2 = dataLoader.searchEpisodes('pythoon', { limit: 3 });
console.log(`Found ${fuzzyEpisodes2.length} results`);
fuzzyEpisodes2.forEach(ep => {
  console.log(`  - HPR${String(ep.id).padStart(4, '0')}: ${ep.title.substring(0, 60)}... [matchType: ${ep.matchType}${ep.matchDistance ? ', distance: ' + ep.matchDistance : ''}]`);
});
console.log('');

// Test 7: No match (distance too large)
console.log('=== Test 7: No Match (distance too large) ===');
console.log('Query: "xyzabc" (should find nothing)\n');
const noMatch = dataLoader.searchHosts('xyzabc');
console.log(`Found ${noMatch.length} results`);
console.log('');

console.log('✅ All fuzzy search tests completed!');
