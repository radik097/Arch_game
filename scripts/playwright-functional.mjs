import { chromium } from 'playwright';

const baseUrl = 'https://radik097.github.io/Arch_game/index.html';
const statsUrl = 'https://radik097.github.io/Arch_game/stats';
const results = [];

function record(name, ok, details = '') {
  results.push({ name, ok, details });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const title = await page.title();
  record('Page title loaded', title.toLowerCase().includes('arch trainer'), `title=${title}`);

  const welcomeOverlay = page.locator('.welcome-overlay');
  if (await welcomeOverlay.count().then((count) => count > 0)) {
    const startTraining = page.getByRole('button', { name: 'Start Training' });
    if (await startTraining.isVisible().catch(() => false)) {
      await startTraining.click();
      record('Welcome overlay handled', true, 'Start Training clicked');
    } else {
      const sandbox = page.getByRole('button', { name: 'Sandbox' });
      if (await sandbox.isVisible().catch(() => false)) {
        await sandbox.click();
        record('Welcome overlay handled', true, 'Sandbox clicked');
      } else {
        record('Welcome overlay handled', false, 'No actionable button found');
      }
    }
  } else {
    record('Welcome overlay handled', true, 'Overlay not shown');
  }

  const appVisible = await page.locator('text=ARCH TRAINER').first().isVisible().catch(() => false);
  record('App header visible', appVisible);

  const menuToggle = page.locator('button[aria-label="Toggle terminal menu"]');
  const hasMenuToggle = await menuToggle.count().then((count) => count > 0);
  record('Menu toggle exists', hasMenuToggle);

  if (hasMenuToggle) {
    await menuToggle.click();
    const startSessionVisible = await page.getByRole('button', { name: 'Start Session' }).isVisible().catch(() => false);
    record('Menu opens with Start Session', startSessionVisible);

    const printHelpBtn = page.getByRole('button', { name: 'Print Help' });
    const hasPrintHelp = await printHelpBtn.isVisible().catch(() => false);
    record('Print Help button exists', hasPrintHelp);
    if (hasPrintHelp) {
      await printHelpBtn.click();
      const helpText = await page.locator('text=sessionctl help').first().isVisible({ timeout: 5000 }).catch(() => false);
      record('Print Help writes to terminal', helpText);
    }
  }

  const lbBtn = page.getByRole('button', { name: 'LB' });
  const hasLB = await lbBtn.isVisible().catch(() => false);
  record('Leaderboard button exists', hasLB);
  if (hasLB) {
    await lbBtn.click();
    const lbFeedback = await page.locator('text=leaderboard').first().isVisible({ timeout: 6000 }).catch(() => false);
    record('Leaderboard action provides feedback', lbFeedback);
  }

  const hasHintBtn = await page.getByRole('button', { name: '?' }).isVisible().catch(() => false);
  record('Hint toggle button exists', hasHintBtn);

  if (hasMenuToggle) {
    await menuToggle.click();
    const sandboxBtn = page.getByRole('button', { name: 'Start Sandbox' });
    const sandboxVisible = await sandboxBtn.isVisible().catch(() => false);
    record('Start Sandbox button exists', sandboxVisible);
    if (sandboxVisible) {
      await sandboxBtn.click();
      const runIndicator = await page.locator('text=RUN').first().isVisible({ timeout: 8000 }).catch(() => false);
      record('Sandbox run starts (RUN indicator)', runIndicator);
    }
  }

  const statsPage = await context.newPage();
  await statsPage.goto(statsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const statsHeader = await statsPage.locator('text=STATS').first().isVisible().catch(() => false);
  record('/stats route renders', statsHeader);
  await statsPage.close();
} catch (error) {
  record('Suite execution', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const passed = results.filter((result) => result.ok).length;
const failed = results.length - passed;
console.log(JSON.stringify({ passed, failed, results }, null, 2));
process.exit(failed > 0 ? 2 : 0);
