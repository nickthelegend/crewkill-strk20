import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isLocal = env.VITE_NETWORK === 'devnet';

  // HTTPS config: only for sepolia (WebAuthn requires HTTPS)
  let httpsConfig: any = false;
  if (!isLocal) {
    const keyPath = resolve(__dirname, 'localhost-key.pem');
    const certPath = resolve(__dirname, 'localhost.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      httpsConfig = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    }
  }

  return {
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      nodePolyfills({
        globals: { Buffer: true, global: true, process: true },
        protocolImports: true,
      }),
    ],
    server: {
      https: httpsConfig,
      // COOP/COEP headers: enable SharedArrayBuffer for bb.js WASM.
      // Only in local/devnet mode — in Sepolia mode these headers block
      // Cartridge Controller popup communication.
      ...(isLocal ? {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
        },
      } : {}),
      fs: {
        allow: [
          // Allow serving from project root (for SDK's WASM files in node_modules)
          resolve(__dirname, '..', '..'),
        ],
      },
    },
    optimizeDeps: {
      exclude: ['@aztec/bb.js', '@noir-lang/noir_js', '@noir-lang/acvm_js', '@noir-lang/noirc_abi', '@mental-poker/sdk'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    worker: {
      format: 'es',
      plugins: () => [
        wasm(),
        topLevelAwait(),
        nodePolyfills({
          globals: { Buffer: true, global: true, process: true },
          protocolImports: true,
        }),
      ],
    },
    resolve: {
      alias: {
        pino: 'pino/browser.js',
      },
      dedupe: ['starknet', 'buffer', 'vite-plugin-node-polyfills'],
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress unresolved import warnings for node polyfill shims
          if (warning.code === 'UNRESOLVED_IMPORT' && warning.exporter?.includes('vite-plugin-node-polyfills')) {
            return;
          }
          warn(warning);
        },
      },
    },
  };
});
