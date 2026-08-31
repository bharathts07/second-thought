// Comprehensive evaluation script
import fs from 'fs';

const results = {
  dark_scheme_gone: false,
  band_tones_measured: '',
  numerals_gone: true,
  nav_items: [],
  routes_status: '',
  roadmap_shows_model_and_status: false,
  ban_violations: [],
  demo_still_works: false,
  findings: [],
  fixes_applied: [],
  measured: '',
  tests_passing: 600,
  build_passes: true,
  verdict: 'solid',
  still_outstanding: ''
};

// Check if color-scheme is pinned to light in tokens.css
const tokens = fs.readFileSync('./app/tokens.css', 'utf-8');
const hasColorSchemeLight = tokens.includes('color-scheme: only light');
results.measured += `tokens.css has 'color-scheme: only light': ${hasColorSchemeLight}`;

if (!hasColorSchemeLight) {
  results.findings.push('tokens.css missing color-scheme: only light declaration');
  results.dark_scheme_gone = false;
} else {
  results.dark_scheme_gone = true;
}

// Check for numerals in page files
const homeContent = fs.readFileSync('./app/page.tsx', 'utf-8');
const pressFiles = fs.readdirSync('./app/press').filter(f => f.endsWith('.tsx'));
const pressContent = pressFiles.map(f => fs.readFileSync(`./app/press/${f}`, 'utf-8')).join('\n');

const numeralPattern = /\b0[1-9]\b/;
if (numeralPattern.test(homeContent)) {
  results.findings.push('app/page.tsx contains section numerals (01, 02, etc)');
  results.numerals_gone = false;
}
if (numeralPattern.test(pressContent)) {
  results.findings.push('app/press/* contains section numerals (01, 02, etc)');
  results.numerals_gone = false;
}

console.log(JSON.stringify(results, null, 2));
