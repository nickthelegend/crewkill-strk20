import { useState, useEffect } from 'react';

interface Artifacts {
  circuits: Record<string, { bytecode: string; abi: unknown }>;
  vks: Record<string, Uint8Array>;
}

const CIRCUIT_NAMES = ['key_ownership', 'decrypt_card', 'shuffle_encrypt'];

export function useArtifacts() {
  const [artifacts, setArtifacts] = useState<Artifacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const circuits: Record<string, { bytecode: string; abi: unknown }> = {};
        const vks: Record<string, Uint8Array> = {};

        for (const name of CIRCUIT_NAMES) {
          // Load circuit JSON
          const circuitRes = await fetch(`/artifacts/${name}.json`);
          if (!circuitRes.ok) throw new Error(`Failed to load ${name}.json`);
          circuits[name] = await circuitRes.json();

          // Load VK binary
          const vkRes = await fetch(`/artifacts/vk_${name}`);
          if (!vkRes.ok) throw new Error(`Failed to load vk_${name}`);
          vks[name] = new Uint8Array(await vkRes.arrayBuffer());
        }

        if (!cancelled) {
          setArtifacts({ circuits, vks });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artifacts');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { artifacts, loading, error };
}
