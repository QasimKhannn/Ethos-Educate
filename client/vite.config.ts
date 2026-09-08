import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { createRequire } from 'module';
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

/**
 * vite-plugin-node-polyfills uses @rollup/plugin-inject to replace bare globals (e.g. `process`)
 * with imports like `import process from 'vite-plugin-node-polyfills/shims/process'`. When the
 * consuming module (e.g. recoil) is hoisted to the monorepo root, Vite 7's ESM resolver walks up
 * from there and never finds the shims (installed only in client/node_modules). This map resolves
 * the shim specifiers to absolute paths via CJS require.resolve anchored to the client directory.
 */
const NODE_POLYFILL_SHIMS: Record<string, string> = {
  'vite-plugin-node-polyfills/shims/process': require.resolve(
    'vite-plugin-node-polyfills/shims/process',
  ),
  'vite-plugin-node-polyfills/shims/buffer': require.resolve(
    'vite-plugin-node-polyfills/shims/buffer',
  ),
  'vite-plugin-node-polyfills/shims/global': require.resolve(
    'vite-plugin-node-polyfills/shims/global',
  ),
};

// https://vitejs.dev/config/
const backendPort = (process.env.BACKEND_PORT && Number(process.env.BACKEND_PORT)) || 3080;
const backendURL =
  process.env.BACKEND_URL ||
  (process.env.HOST && process.env.HOST !== '0.0.0.0'
    ? `http://${process.env.HOST}:${backendPort}`
    : `http://localhost:${backendPort}`);

export default defineConfig(() => ({
  base: '',
  server: {
    allowedHosts:
      (process.env.VITE_ALLOWED_HOSTS && process.env.VITE_ALLOWED_HOSTS.split(',')) || [],
    host: true,
    port: (process.env.PORT && Number(process.env.PORT)) || 3090,
    strictPort: false,
    proxy: {
      '/api': {
        target: backendURL,
        changeOrigin: true,
      },
      '/oauth': {
        target: backendURL,
        changeOrigin: true,
      },
    },
  },
  // Set the directory where environment variables are loaded from and restrict prefixes
  envDir: '../',
  envPrefix: ['VITE_', 'SCRIPT_', 'DOMAIN_', 'ALLOW_'],
  plugins: [
    react(),
    {
      name: 'node-polyfills-shims-resolver',
      resolveId(id) {
        return NODE_POLYFILL_SHIMS[id] ?? null;
      },
    },
    nodePolyfills(),
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      devOptions: {
        enabled: false, // disable service worker registration in development mode
      },
      useCredentials: true,
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: [
          '**/*.{js,css}',
          'assets/favicon*.png',
          'assets/icon-*.png',
          'assets/apple-touch-icon*.png',
          'assets/maskable-icon.png',
          'manifest.webmanifest',
        ],
        globIgnores: ['images/**/*', '**/*.map'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      includeAssets: [],
      manifest: {
        name: 'Ethos',
        short_name: 'Ethos',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#009688',
        icons: [
          {
            src: 'assets/favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
          {
            src: 'assets/favicon-16x16.png',
            sizes: '16x16',
            type: 'image/png',
          },
          {
            src: 'assets/apple-touch-icon-180x180.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: 'assets/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/maskable-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    sourcemapExclude({ excludeNodeModules: true }),
    compression({
      threshold: 10240,
    }),
  ],
  publicDir: './public',
  build: {
    sourcemap: process.env.NODE_ENV === 'development',
    outDir: './dist',
    minify: 'terser',
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.[0] && /\.(woff|woff2|eot|ttf|otf)$/.test(assetInfo.names[0])) {
            return 'assets/fonts/[name][extname]';
          }
          return 'assets/[name].[hash][extname]';
        },
      },
      /**
       * Ignore "use client" warning since we are not using SSR
       * @see {@link https://github.com/TanStack/query/pull/5161#issuecomment-1477389761 Preserve 'use client' directives TanStack/query#5161}
       */
      onwarn(warning, warn) {
        if (warning.message.includes('Error when using sourcemap')) {
          return;
        }
        warn(warning);
      },
    },
    chunkSizeWarningLimit: 1500,
  },
  resolve: {
    alias: {
      '~': path.join(__dirname, 'src/'),
      $fonts: path.resolve(__dirname, 'public/fonts'),
      'micromark-extension-math': 'micromark-extension-llm-math',
    },
  },
}));

interface SourcemapExclude {
  excludeNodeModules?: boolean;
}

export function sourcemapExclude(opts?: SourcemapExclude): Plugin {
  return {
    name: 'sourcemap-exclude',
    transform(code: string, id: string) {
      if (opts?.excludeNodeModules && id.includes('node_modules')) {
        return {
          code,
          // https://github.com/rollup/rollup/blob/master/docs/plugin-development/index.md#source-code-transformations
          map: { mappings: '' },
        };
      }
    },
  };
}
