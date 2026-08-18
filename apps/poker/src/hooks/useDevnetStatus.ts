import { useState, useEffect } from 'react';

export function useDevnetStatus(url: string) {
  const [isAlive, setIsAlive] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'starknet_chainId', params: [], id: 1 }),
        });
        if (!cancelled) setIsAlive(res.ok);
      } catch {
        if (!cancelled) setIsAlive(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [url]);

  return { isAlive, checking };
}
