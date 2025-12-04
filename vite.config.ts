import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFile, mkdir } from 'fs/promises';

// Plugin to copy manifest and icons after build
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    async writeBundle() {
      // Copy manifest.json to dist
      await copyFile(
        resolve(__dirname, 'public', 'manifest.json'),
        resolve(__dirname, 'dist', 'manifest.json')
      );
      console.log('✓ Copied manifest.json to dist/');

      // Copy icons to dist
      await mkdir(resolve(__dirname, 'dist', 'icons'), { recursive: true });
      for (const size of [16, 48, 128]) {
        await copyFile(
          resolve(__dirname, 'public', 'icons', `icon-${size}.png`),
          resolve(__dirname, 'dist', 'icons', `icon-${size}.png`)
        );
      }
      console.log('✓ Copied icons to dist/icons/');
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
