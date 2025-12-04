import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function createIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#3B82F6" rx="${size / 8}"/>
      <path d="M ${size * 0.3} ${size * 0.25} L ${size * 0.3} ${size * 0.75} L ${size * 0.7} ${size * 0.75} L ${size * 0.7} ${size * 0.25} Z" fill="none" stroke="white" stroke-width="${size / 16}"/>
      <path d="M ${size * 0.5} ${size * 0.25} L ${size * 0.5} ${size * 0.6}" stroke="white" stroke-width="${size / 16}"/>
    </svg>
  `;

  const iconPath = join('public', 'icons', `icon-${size}.png`);
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(iconPath);
  
  console.log(`Created ${iconPath}`);
}

async function main() {
  await mkdir(join('public', 'icons'), { recursive: true });
  await createIcon(16);
  await createIcon(48);
  await createIcon(128);
}

main().catch(console.error);
