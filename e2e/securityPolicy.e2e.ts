import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectScreen } from './helpers';

/** The Content-Security-Policy the deployed site sends (public/_headers) */
function deployedPolicy(): string {
  const headers = readFileSync(join(process.cwd(), 'public', '_headers'), 'utf-8');
  const line = headers.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  if (!line) throw new Error('No Content-Security-Policy in public/_headers');
  return line.trim().slice('Content-Security-Policy:'.length).trim();
}

/**
 * The built game under the deployed security policy (P15-17): the preview server doesn't
 * send _headers, so the test adds the policy to the page itself. Any blocked script, style,
 * font or image fails the test.
 */
test('the built game runs under the deployed security policy, with no debug handle', async ({ page }) => {
  const policy = deployedPolicy();
  expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);

  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    if (route.request().resourceType() !== 'document') return route.fulfill({ response });
    return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) =>
      console.error(`Content Security Policy blocked ${event.violatedDirective}: ${event.blockedURI}`)
    );
  });

  await page.goto('/');
  await expectScreen(page, 'hub');
  await page.locator('#hub-quick-race').click();
  await page.locator('#quick-race-start').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await expectScreen(page, 'racing');
  await page.waitForTimeout(2000);

  expect(violations, violations.join('\n')).toEqual([]);
  // The debug handle exists on the dev server only
  expect(await page.evaluate(() => '__game' in window)).toBe(false);
});
