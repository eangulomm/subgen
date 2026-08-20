import { expect, test } from '@playwright/test';

const minimalWave = Buffer.from(
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  'base64',
);

test('selects a file, configures output, processes, edits, and downloads SRT', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Subtítulos para cualquier video/i }),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'private-sample.wav', mimeType: 'audio/wav', buffer: minimalWave });
  await expect(page.getByText('private-sample.wav')).toBeVisible();
  await page.getByLabel('Idioma hablado').selectOption('en');
  await page.getByLabel('Subtítulos', { exact: true }).selectOption('bilingual');
  await page.getByRole('button', { name: /Generar subtítulos/i }).click();
  await expect(page.getByRole('heading', { name: 'Subtítulos generados' })).toBeVisible();
  await expect(page.getByText('private-sample.en-es.srt')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar .SRT' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('private-sample.en-es.srt');
});

test('has no automatically detectable accessibility violations on the landing state', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
});
