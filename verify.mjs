import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const baseURL = 'http://localhost:9876';

async function measureWordCount(page, route, filename) {
  const html = readFileSync(`/Users/bswamy/github.com/bharathts07/second-thought/out/${filename}`, 'utf8');
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/g, ' ');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/g, ' ');
  let text = cleaned.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&[a-z#0-9]+;/g, ' ');
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function countPhrase(text, phrase) {
  const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return (text.match(regex) || []).length;
}

async function checkRepetitions(page) {
  const routes = [
    { name: 'landing', url: '/', file: 'index.html' },
    { name: 'press', url: '/press.html', file: 'press.html' },
    { name: 'settings', url: '/settings.html', file: 'settings.html' },
    { name: 'roadmap', url: '/roadmap.html', file: 'roadmap.html' }
  ];

  const phrases = [
    "on your own computer",
    "your own machine",
    "never blocks",
    "no console",
    "policy document",
    "reporting on anyone"
  ];

  const results = {};

  for (const route of routes) {
    await page.goto(`${baseURL}${route.url}`, { waitUntil: 'networkidle' });
    const bodyText = await page.locator('body').innerText();

    results[route.name] = {};
    for (const phrase of phrases) {
      results[route.name][phrase] = countPhrase(bodyText, phrase);
    }
  }

  return results;
}

async function checkPinnedBar(page, route, routeName) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });

  // Find the nav element
  const nav = page.locator('nav').first();

  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);

  // Check if still visible
  const isVisible = await nav.isVisible();
  const position = await nav.evaluate(el => window.getComputedStyle(el).position);
  const background = await nav.evaluate(el => window.getComputedStyle(el).background);
  const backgroundColor = await nav.evaluate(el => window.getComputedStyle(el).backgroundColor);

  return {
    route: routeName,
    visible: isVisible,
    position,
    background: background || backgroundColor
  };
}

async function checkNavStructure(page, route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });

  const nav = page.locator('nav').first();
  const hasSvg = await nav.locator('svg').count() > 0;
  const hasPrivacy = await nav.locator('text=Privacy').count() > 0;
  const ariaCurrent = await nav.locator('[aria-current]').count();

  return { hasSvg, hasPrivacy, ariaCurrent };
}

async function checkDeadLinks(page) {
  const routes = ['/', '/press.html', '/settings.html', '/roadmap.html'];
  const deadLinks = [];

  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    const links = await page.locator('a[href^="/"]').all();

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href || href === '/' || href.startsWith('/#')) continue;

      // Navigate and check
      const response = await page.goto(`${baseURL}${href}`, { waitUntil: 'domcontentloaded' });
      if (!response || response.status() === 404) {
        deadLinks.push({ from: route, to: href, status: response?.status() });
      }
    }
  }

  return deadLinks;
}

async function checkSettings(page) {
  await page.goto(`${baseURL}/settings.html`, { waitUntil: 'networkidle' });

  // Check if nav exists
  const hasNav = await page.locator('nav').count() > 0;

  // Get all section elements and check their backgrounds
  const sections = await page.locator('main > section, main > div').all();
  const backgrounds = [];
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

  for (const section of sections) {
    const bg = await section.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const width = await section.evaluate(el => el.offsetWidth);
    backgrounds.push({ bg, width, reachesEdge: width >= clientWidth });
  }

  return { hasNav, backgrounds, clientWidth };
}

async function checkRoadmap(page) {
  await page.goto(`${baseURL}/roadmap.html`, { waitUntil: 'networkidle' });

  // Get all main headings
  const headings = await page.locator('main h2, main h3').allTextContents();

  // Check if "Status" or "Current" appears before "Tiers"
  const statusIndex = headings.findIndex(h => h.toLowerCase().includes('status') || h.toLowerCase().includes('current'));
  const tiersIndex = headings.findIndex(h => h.toLowerCase().includes('tier'));

  const bodyText = await page.locator('main').innerText();

  return {
    statusFirst: statusIndex !== -1 && statusIndex < tiersIndex,
    mentionsWordingChecks: bodyText.toLowerCase().includes('wording check'),
    mentionsYourVoice: bodyText.toLowerCase().includes('your own voice') || bodyText.toLowerCase().includes('your voice'),
    hasPlaceholder: bodyText.toLowerCase().includes('placeholder'),
    hasAccuracyFigure: /\d+%|\d+\.\d+%|accuracy|precision|recall/i.test(bodyText) && !/placeholder/i.test(bodyText.match(/\d+%|\d+\.\d+%|accuracy|precision|recall/i)?.[0] || '')
  };
}

async function checkBanViolations(page) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

  const violations = [];

  // Check for gradients
  const gradients = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const found = [];
    for (const el of allElements) {
      const bg = window.getComputedStyle(el).background;
      if (bg.includes('gradient')) found.push(el.tagName);
    }
    return found;
  });
  if (gradients.length > 0) violations.push(`gradient: ${gradients.join(', ')}`);

  // Check for icons
  const svgCount = await page.locator('svg').count();
  if (svgCount > 0) {
    const svgLocations = await page.locator('svg').all();
    const contexts = [];
    for (const svg of svgLocations.slice(0, 3)) {
      const parent = await svg.evaluateHandle(el => el.parentElement);
      const tag = await parent.evaluate(p => p.tagName);
      contexts.push(tag);
    }
    violations.push(`svg icons: ${svgCount} found in ${contexts.join(', ')}`);
  }

  // Check for images
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    const src = await img.getAttribute('src');
    if (!src?.includes('screenshot')) {
      violations.push(`image: ${alt || 'no alt'} at ${src}`);
    }
  }

  // Check for dark: variants in classes
  const darkVariants = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    return Array.from(allElements).filter(el =>
      el.className && typeof el.className === 'string' && el.className.includes('dark:')
    ).length;
  });
  if (darkVariants > 0) violations.push(`dark: variants: ${darkVariants} elements`);

  // Check for Tailwind palette colors (bg-blue-500, text-red-600, etc.)
  const tailwindColors = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const colorRegex = /-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d/;
    return Array.from(allElements).filter(el =>
      el.className && typeof el.className === 'string' && colorRegex.test(el.className)
    ).length;
  });
  if (tailwindColors > 0) violations.push(`Tailwind colors: ${tailwindColors} elements`);

  return violations;
}

async function checkDemo(page) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

  // Wait for demo to be ready
  await page.waitForSelector('[data-ready="true"]', { timeout: 10000 });

  // Click residency example
  const residencyButton = page.locator('button:has-text("residency")').first();
  await residencyButton.click();
  await page.waitForTimeout(500);

  // Check for High note
  const hasHighNote = await page.locator('text=/High/i').count() > 0;
  const hasUseThis = await page.locator('button:has-text("Use this")').count() > 0;
  const hasKeepMine = await page.locator('button:has-text("Keep mine")').count() > 0;

  // Check Send button
  const sendButton = page.locator('button:has-text("Send")').first();
  const isDisabled = await sendButton.isDisabled();

  return {
    demoReady: true,
    hasHighNote,
    hasUseThis,
    hasKeepMine,
    sendDisabled: isDisabled
  };
}

async function checkDarkMode(page) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(200);

  const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);

  return { bodyBg };
}

async function checkResponsive(page) {
  await page.setViewportSize({ width: 390, height: 844 });

  const routes = ['/', '/press.html', '/settings.html', '/roadmap.html'];
  const results = [];

  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    // Check nav
    const nav = page.locator('nav a');
    const navCount = await nav.count();
    const allVisible = await nav.evaluateAll(links =>
      links.every(link => {
        const rect = link.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
    );

    results.push({
      route,
      scrollWidth,
      clientWidth,
      overflows: scrollWidth > clientWidth,
      navLinksVisible: allVisible
    });
  }

  return results;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    wordCounts: {},
    repetitions: {},
    pinnedBar: [],
    nav: {},
    deadLinks: [],
    settings: {},
    roadmap: {},
    banViolations: [],
    darkMode: {},
    demo: {},
    consoleErrors: [],
    responsive: []
  };

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    results.consoleErrors.push(err.message);
  });

  try {
    // 1. Word counts
    results.wordCounts.index = measureWordCount(page, '/', 'index.html');
    results.wordCounts.press = measureWordCount(page, '/press', 'press.html');
    results.wordCounts.settings = measureWordCount(page, '/settings', 'settings.html');
    results.wordCounts.roadmap = measureWordCount(page, '/roadmap', 'roadmap.html');

    // 2. Repetitions
    results.repetitions = await checkRepetitions(page);

    // 3. Pinned bar
    for (const [route, file] of [['/', 'index'], ['/press.html', 'press'], ['/settings.html', 'settings'], ['/roadmap.html', 'roadmap']]) {
      results.pinnedBar.push(await checkPinnedBar(page, route, file));
    }

    // 4. Nav structure
    for (const route of ['/', '/press.html', '/settings.html', '/roadmap.html']) {
      const nav = await checkNavStructure(page, route);
      results.nav[route] = nav;
    }

    // 5. Dead links
    results.deadLinks = await checkDeadLinks(page);

    // 6. Settings
    results.settings = await checkSettings(page);

    // 7. Roadmap
    results.roadmap = await checkRoadmap(page);

    // 8. Ban violations
    results.banViolations = await checkBanViolations(page);

    // 9. Dark mode
    results.darkMode = await checkDarkMode(page);

    // 10. Demo
    try {
      results.demo = await checkDemo(page);
    } catch (e) {
      results.demo = { error: e.message };
    }

    // 11. Responsive
    results.responsive = await checkResponsive(page);

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error during checks:', error);
    throw error;
  } finally {
    await browser.close();
  }
})();
