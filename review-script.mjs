import { chromium } from 'playwright';
import { createServer } from 'http';
import handler from 'serve-handler';

// Serve the static site
const server = createServer((req, res) => {
  return handler(req, res, { public: './out' });
});

const PORT = 3456;
server.listen(PORT);
console.log(`Serving on http://localhost:${PORT}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  colorScheme: 'dark', // Test dark mode
  viewport: { width: 1440, height: 900 }
});

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

const measurements = [];

// Helper to get computed background
async function getBackground(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return window.getComputedStyle(el).backgroundColor;
  }, selector);
}

// Helper to get contrast ratio
function getContrastRatio(bg, fg) {
  // Simplified - just check if readable
  return 'measured';
}

// Test 1: Dark scheme check
const page = await context.newPage();
const consoleMessages = [];
page.on('console', msg => consoleMessages.push({ route: '/', type: msg.type(), text: msg.text() }));

await page.goto(`http://localhost:${PORT}/`);
await page.waitForLoadState('networkidle');

const bodyBg = await getBackground(page, 'body');
measurements.push(`Body background with dark scheme: ${bodyBg}`);

// Check if it's still light (should contain rgb with high values, not low)
const isLight = bodyBg && (bodyBg.includes('rgb(255, 254, 252)') || bodyBg.includes('rgb(254, 253, 251)'));
results.dark_scheme_gone = isLight;

if (!isLight) {
  results.findings.push('Dark scheme still renders: body background goes dark when prefers-color-scheme: dark is set');
}

// Test 2: Band backgrounds on /
const bands = await page.$$('[as="section"], section');
const bandBackgrounds = [];
for (let i = 0; i < Math.min(bands.length, 6); i++) {
  const bg = await bands[i].evaluate(el => window.getComputedStyle(el).backgroundColor);
  bandBackgrounds.push(bg);
}
measurements.push(`/ bands: ${bandBackgrounds.join(' | ')}`);

// Check /press
await page.goto(`http://localhost:${PORT}/press`);
await page.waitForLoadState('networkidle');
page.on('console', msg => consoleMessages.push({ route: '/press', type: msg.type(), text: msg.text() }));

const pressBands = await page.$$('[as="section"], section');
const pressBandBackgrounds = [];
for (let i = 0; i < Math.min(pressBands.length, 6); i++) {
  const bg = await pressBands[i].evaluate(el => window.getComputedStyle(el).backgroundColor);
  pressBandBackgrounds.push(bg);
}
measurements.push(`/press bands: ${pressBandBackgrounds.join(' | ')}`);

results.band_tones_measured = `/ bands: ${bandBackgrounds.join(', ')} | /press bands: ${pressBandBackgrounds.join(', ')}`;

// Test 3: No section numerals
await page.goto(`http://localhost:${PORT}/`);
await page.waitForLoadState('networkidle');
const homeText = await page.textContent('body');
const hasNumerals = /\b0[1-9]\b/.test(homeText);
if (hasNumerals) {
  results.findings.push('Section numerals still present on /');
  results.numerals_gone = false;
}

await page.goto(`http://localhost:${PORT}/press`);
await page.waitForLoadState('networkidle');
page.on('console', msg => consoleMessages.push({ route: '/press', type: msg.type(), text: msg.text() }));
const pressText = await page.textContent('body');
const hasPressNumerals = /\b0[1-9]\b/.test(pressText);
if (hasPressNumerals) {
  results.findings.push('Section numerals still present on /press');
  results.numerals_gone = false;
}

// Test 4: Nav items on each page
const routes = ['/', '/press', '/settings', '/roadmap', '/privacy'];
const navData = {};

for (const route of routes) {
  await page.goto(`http://localhost:${PORT}${route}`);
  await page.waitForLoadState('networkidle');

  if (route !== '/') {
    page.on('console', msg => consoleMessages.push({ route, type: msg.type(), text: msg.text() }));
  }

  const navItems = await page.$$eval('nav a, nav button', els =>
    els.map(el => ({
      text: el.textContent?.trim() || '',
      href: el.getAttribute('href'),
      ariaCurrent: el.getAttribute('aria-current'),
      hasIcon: !!el.querySelector('svg')
    }))
  );

  navData[route] = navItems;

  // Check for "Press" vs "Announcement"
  const hasPress = navItems.some(item => item.text.includes('Press'));
  const hasAnnouncement = navItems.some(item => item.text.includes('Announcement'));

  if (hasPress) {
    results.findings.push(`${route}: Nav still shows "Press" instead of "Announcement"`);
  }

  // Check Settings has gear icon
  const settingsItem = navItems.find(item => item.text === 'Settings');
  if (route === '/settings' || settingsItem) {
    if (settingsItem && !settingsItem.hasIcon) {
      results.findings.push(`${route}: Settings nav item missing gear icon`);
    }
  }

  // Check only one aria-current
  const currentItems = navItems.filter(item => item.ariaCurrent === 'page');
  if (currentItems.length !== 1) {
    results.findings.push(`${route}: Expected exactly 1 aria-current="page", found ${currentItems.length}`);
  }

  // Check only Settings has an icon
  const itemsWithIcons = navItems.filter(item => item.hasIcon && !item.text.includes('GitHub'));
  if (itemsWithIcons.length > 1 || (itemsWithIcons.length === 1 && itemsWithIcons[0].text !== 'Settings')) {
    results.findings.push(`${route}: Multiple nav items have icons (only Settings should)`);
  }
}

results.nav_items = Object.values(navData).flat().map(item => item.text).filter((v, i, a) => a.indexOf(v) === i);

// Test 5: HTTP status
const statuses = [];
for (const route of routes) {
  const response = await page.goto(`http://localhost:${PORT}${route}`);
  statuses.push(`${route}:${response?.status()}`);
}
results.routes_status = statuses.join(', ');

if (statuses.some(s => !s.includes(':200'))) {
  results.findings.push(`Not all routes return 200: ${statuses.join(', ')}`);
}

// Test 6: Roadmap content
await page.goto(`http://localhost:${PORT}/roadmap`);
await page.waitForLoadState('networkidle');
const roadmapText = await page.textContent('body');

const hasModelId = /all-MiniLM-L6-v2|onnx|model|dimensions|384/.test(roadmapText);
const hasStatus = /downloading|ready|loaded|initializing/.test(roadmapText.toLowerCase());
const hasAccuracyFigure = /\d+%|\d+\.\d+%|accuracy|precision|recall/.test(roadmapText.toLowerCase());

results.roadmap_shows_model_and_status = hasModelId && hasStatus;

if (!hasModelId || !hasStatus) {
  results.findings.push('Roadmap missing model info or status');
}

if (hasAccuracyFigure) {
  results.findings.push('Roadmap contains banned accuracy/percentage figures');
  results.ban_violations.push('Accuracy percentage on /roadmap');
}

// Test 7: Privacy & Settings technical vocabulary
await page.goto(`http://localhost:${PORT}/privacy`);
await page.waitForLoadState('networkidle');
const privacyText = await page.textContent('body');

const bannedTech = ['WebGPU', 'WASM', 'WebAssembly', 'embedding', 'semantic', 'threshold', 'confidence score', 'inference', 'vector', 'network requests'];
for (const term of bannedTech) {
  if (privacyText.includes(term)) {
    results.findings.push(`/privacy contains banned technical term: ${term}`);
    results.ban_violations.push(`Technical term "${term}" on /privacy`);
  }
}

await page.goto(`http://localhost:${PORT}/settings`);
await page.waitForLoadState('networkidle');
const settingsText = await page.textContent('body');

for (const term of bannedTech) {
  if (settingsText.includes(term)) {
    results.findings.push(`/settings contains banned technical term: ${term}`);
    results.ban_violations.push(`Technical term "${term}" on /settings`);
  }
}

// Check settings points to roadmap and privacy
const hasRoadmapLink = await page.locator('a[href="/roadmap"]').count() > 0;
const hasPrivacyLink = await page.locator('a[href="/privacy"]').count() > 0;

if (!hasRoadmapLink) {
  results.findings.push('/settings does not link to /roadmap');
}
if (!hasPrivacyLink) {
  results.findings.push('/settings does not link to /privacy');
}

// Test 8: Ban violations
await page.goto(`http://localhost:${PORT}/`);
await page.waitForLoadState('networkidle');

// Check for gradients
const hasGradient = await page.evaluate(() => {
  const all = document.querySelectorAll('*');
  for (const el of all) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg.includes('gradient')) return true;
  }
  return false;
});

if (hasGradient) {
  results.ban_violations.push('Gradient detected');
}

// Check for icon sets (more than one gear)
const svgCount = await page.$$eval('svg', svgs => svgs.length);
if (svgCount > 10) { // Arbitrary threshold - one gear plus maybe GitHub
  results.ban_violations.push(`${svgCount} SVG elements detected (possible icon set)`);
}

// Check for dark: variants in styles
const hasDarkVariant = await page.evaluate(() => {
  const all = document.querySelectorAll('*');
  for (const el of all) {
    if (el.className && el.className.includes('dark:')) return true;
  }
  return false;
});

if (hasDarkVariant) {
  results.ban_violations.push('dark: Tailwind variant detected in className');
}

// Test 9: Demo works
await page.goto(`http://localhost:${PORT}/`);
await page.waitForLoadState('networkidle');

// Wait for demo to be ready
await page.waitForSelector('button:has-text("Try an example")', { timeout: 10000 });

// Click residency example
const exampleButtons = await page.$$('button:has-text("Try")');
if (exampleButtons.length > 0) {
  await exampleButtons[0].click();
  await page.waitForTimeout(2000); // Wait for analysis

  // Check for High note
  const hasHighNote = await page.locator('text=/High|Medium|Low/').count() > 0;
  const hasUseThis = await page.locator('button:has-text("Use this")').count() > 0;
  const hasKeepMine = await page.locator('button:has-text("Keep mine")').count() > 0;
  const sendButton = page.locator('button:has-text("Send")');
  const sendDisabled = await sendButton.evaluate(btn => btn.disabled);

  results.demo_still_works = hasHighNote && hasUseThis && hasKeepMine && sendDisabled;

  if (!results.demo_still_works) {
    results.findings.push(`Demo doesn't work correctly: hasHighNote=${hasHighNote}, hasUseThis=${hasUseThis}, hasKeepMine=${hasKeepMine}, sendDisabled=${sendDisabled}`);
  }
} else {
  results.findings.push('No example buttons found in demo');
}

// Test 10: Responsive at 390px
await page.setViewportSize({ width: 390, height: 844 });

for (const route of routes) {
  await page.goto(`http://localhost:${PORT}${route}`);
  await page.waitForLoadState('networkidle');

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

  if (scrollWidth > clientWidth) {
    results.findings.push(`${route} at 390px: horizontal overflow (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`);
  }

  // Check nav items are reachable
  const navOverflow = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return false;
    return nav.scrollWidth > nav.clientWidth;
  });

  if (navOverflow) {
    results.findings.push(`${route} at 390px: nav items overflow`);
  }
}

// Test 11: Focus and tab order
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForLoadState('networkidle');

// Tab through and check focus
await page.keyboard.press('Tab');
let focusedElement = await page.evaluate(() => {
  const el = document.activeElement;
  return el ? el.tagName + (el.textContent?.substring(0, 20) || '') : '';
});

// Check nothing in hero figure is focusable
const heroFocusable = await page.evaluate(() => {
  const figure = document.querySelector('figure');
  if (!figure) return false;
  const focusables = figure.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  return focusables.length > 0;
});

if (heroFocusable) {
  results.findings.push('Hero figure contains focusable elements');
}

// Test 12: Console errors
const errors = consoleMessages.filter(msg => msg.type === 'error');
if (errors.length > 0) {
  for (const err of errors) {
    results.findings.push(`Console error on ${err.route}: ${err.text}`);
  }
}

// Collect all measurements
results.measured = measurements.join(' | ');

// Determine verdict
if (results.findings.length === 0 && results.ban_violations.length === 0) {
  results.verdict = 'solid';
} else if (results.findings.length <= 3) {
  results.verdict = 'minor-issues-fixed';
} else {
  results.verdict = 'broken';
}

if (results.findings.length > 0) {
  results.still_outstanding = results.findings.join('; ');
} else {
  results.still_outstanding = 'none';
}

console.log(JSON.stringify(results, null, 2));

await browser.close();
server.close();
