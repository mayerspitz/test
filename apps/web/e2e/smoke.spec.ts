import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('search → generate → download', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await page.goto('/');
  await page.getByLabel('Location').fill('Brook');
  await page.getByRole('option', { name: 'Brooklyn, NY, US' }).click();
  await page.getByRole('button', { name: 'Generate' }).click();

  const sheet = page.getByRole('article', { name: 'Weather report' });
  await expect(sheet.getByRole('heading', { level: 1 })).toContainText('Brooklyn, NY — Weather');
  await expect(sheet.getByRole('heading', { name: 'Day-by-Day Breakdown' })).toBeVisible();
  await expect(sheet.getByRole('columnheader', { name: 'Rain amount' })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: /What Happens in Your Backyard/ })).toBeVisible();
  await expect(sheet.getByRole('columnheader', { name: 'Action' })).toBeVisible();

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^Brooklyn_Weather_[A-Z][a-z]{2}\d{1,2}-[A-Z][a-z]{2}\d{1,2}\.pdf$/,
  );
  const pdf = readFileSync((await download.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');

  // The browser only ever talks to our server, and never sees the API key.
  expect(requests.every((u) => !u.includes('accuweather.com') && !u.includes('test-key'))).toBe(
    true,
  );
});
