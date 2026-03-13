import { chromium } from 'playwright';

const BASE_URL = 'https://radik097.github.io/Arch_game/index.html';
const STATS_URL = 'https://radik097.github.io/Arch_game/stats';

const checks = [];

function addCheck(name, ok, details = '') {
  checks.push({ name, ok, details });
}

function summarize() {
  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;
  return { passed, failed, checks };
}

async function clickIfVisible(page, roleName) {
  const button = page.getByRole('button', { name: roleName });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    return true;
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const title = await page.title();
    addCheck('Page title is Arch Trainer', title.toLowerCase().includes('arch trainer'), `title=${title}`);

    const welcomeHandled =
      (await clickIfVisible(page, 'Start Training')) ||
      (await clickIfVisible(page, 'Sandbox')) ||
      !(await page.locator('.welcome-overlay').isVisible().catch(() => false));
    addCheck('Welcome overlay handled', welcomeHandled);

    const headerVisible = await page.locator('text=ARCH TRAINER').first().isVisible().catch(() => false);
    addCheck('Header visible', headerVisible);

    const menuToggle = page.locator('button[aria-label="Toggle terminal menu"]');
    const menuExists = (await menuToggle.count()) > 0;
    addCheck('Menu toggle exists', menuExists);

    if (menuExists) {
      await menuToggle.click();

      const hasStartSession = await page.getByRole('button', { name: 'Start Session' }).isVisible().catch(() => false);
      addCheck('Menu opens', hasStartSession);

      const hasPrintHelp = await page.getByRole('button', { name: 'Print Help' }).isVisible().catch(() => false);
      addCheck('Print Help present', hasPrintHelp);
      if (hasPrintHelp) {
        await page.getByRole('button', { name: 'Print Help' }).click();
        const helpOutput = await page.locator('text=sessionctl help').first().isVisible({ timeout: 5000 }).catch(() => false);
        addCheck('Help output appears', helpOutput);
      }

      await menuToggle.click();
      const hasSandbox = await page.getByRole('button', { name: 'Start Sandbox' }).isVisible().catch(() => false);
      addCheck('Sandbox button present', hasSandbox);
      if (hasSandbox) {
        await page.getByRole('button', { name: 'Start Sandbox' }).click();
        const runVisible = await page.locator('text=RUN').first().isVisible({ timeout: 10000 }).catch(() => false);
        addCheck('Sandbox run starts', runVisible);
      }
    }

    const lbVisible = await page.getByRole('button', { name: 'LB' }).isVisible().catch(() => false);
    addCheck('LB button present', lbVisible);
    if (lbVisible) {
      await page.getByRole('button', { name: 'LB' }).click();
      const lbResult = await page
        .locator('text=sessionctl: requesting leaderboard, text=leaderboard unavailable, text=leaderboard top')
        .first()
        .isVisible({ timeout: 6000 })
        .catch(() => false);
      addCheck('LB action returns result', lbResult);
    }

    const statsPage = await context.newPage();
    await statsPage.goto(STATS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const statsRendered =
      (await statsPage.locator('text=STATS').first().isVisible().catch(() => false)) ||
      (await statsPage.locator('text=Loading').first().isVisible().catch(() => false)) ||
      (await statsPage.locator('text=Failed').first().isVisible().catch(() => false));
    addCheck('/stats route responds', statsRendered);
    await statsPage.close();
  } catch (error) {
    addCheck('Script execution', false, error instanceof Error ? error.message : String(error));
  } finally {
    await browser.close();
  }

  const report = summarize();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failed > 0 ? 2 : 0);
}

run();
