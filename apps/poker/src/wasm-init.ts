import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';

// @ts-ignore -- Vite ?url import returns a string URL to the asset
import acvmWasmUrl from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
// @ts-ignore
import noircWasmUrl from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';

let initialized = false;

/**
 * Initialize ACVM, NoirC, and Garaga WASM modules.
 * Must be called before any proof generation (Noir/bb.js usage).
 */
export async function initWasm(): Promise<void> {
  if (initialized) return;

  // Init Noir WASM modules in parallel
  await Promise.all([
    initACVM(fetch(acvmWasmUrl)),
    initNoirC(fetch(noircWasmUrl)),
  ]);
  console.log('[WASM] ACVM + NoirC initialized');

  // Init Garaga WASM
  try {
    const garaga: any = await import('garaga');
    if (typeof garaga.init === 'function') {
      await garaga.init();
      console.log('[WASM] Garaga initialized');
    }
  } catch (e) {
    console.warn('[WASM] Garaga init failed (will retry on first use):', e);
  }

  initialized = true;
}
