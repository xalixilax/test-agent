import { copyFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function copyManifest() {
  // Copy manifest.json to dist
  await copyFile(
    join('public', 'manifest.json'),
    join('dist', 'manifest.json')
  );
  console.log('Copied manifest.json to dist/');

  // Copy icons to dist
  await mkdir(join('dist', 'icons'), { recursive: true });
  for (const size of [16, 48, 128]) {
    await copyFile(
      join('public', 'icons', `icon-${size}.png`),
      join('dist', 'icons', `icon-${size}.png`)
    );
    console.log(`Copied icon-${size}.png to dist/icons/`);
  }
}

copyManifest().catch(console.error);
