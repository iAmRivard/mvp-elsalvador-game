import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const imageDirectory = resolve(repositoryRoot, 'public', 'images');
const source = await readFile(resolve(imageDirectory, 'app-icon.svg'), 'utf8');
await mkdir(imageDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}</style>${source}`,
  );
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.locator('svg').evaluate((element, pixels) => {
      element.setAttribute('width', String(pixels));
      element.setAttribute('height', String(pixels));
    }, size);
    await page.locator('svg').screenshot({
      path: resolve(imageDirectory, `app-icon-${String(size)}.png`),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}

console.log('Generated PWA icons: 192px, 512px');
