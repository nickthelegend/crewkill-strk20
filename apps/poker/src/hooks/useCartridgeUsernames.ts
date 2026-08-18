import { useState, useEffect, useRef } from 'react';

const CARTRIDGE_LOOKUP_URL = 'https://api.cartridge.gg/accounts/lookup';

/**
 * Resolves a list of Starknet addresses to Cartridge usernames.
 * Returns a Map<address (lowercase), username>.
 * Addresses with no Cartridge account are omitted from the map.
 */
export function useCartridgeUsernames(addresses: string[]): Map<string, string> {
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const prevKeyRef = useRef('');

  const key = addresses
    .map(a => a.toLowerCase())
    .sort()
    .join(',');

  useEffect(() => {
    if (!key || key === prevKeyRef.current) return;
    const nonZero = addresses.filter(a => a !== '0x0' && a !== '0x');
    if (nonZero.length === 0) return;

    prevKeyRef.current = key;

    let cancelled = false;

    fetch(CARTRIDGE_LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: nonZero }),
    })
      .then(r => r.json())
      .then((data: { results?: { username: string; addresses: string[] }[] }) => {
        if (cancelled || !data.results) return;
        const map = new Map<string, string>();
        for (const entry of data.results) {
          for (const addr of entry.addresses) {
            map.set(addr.toLowerCase(), entry.username);
          }
        }
        setUsernames(map);
      })
      .catch(() => {
        // Silently ignore — usernames are cosmetic only
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return usernames;
}

/** Format an address for display: 0x1234…5678 */
export function shortAddress(address: string): string {
  if (!address || address === '0x0') return '';
  const hex = address.startsWith('0x') ? address : '0x' + address;
  if (hex.length <= 12) return hex;
  return hex.slice(0, 6) + '…' + hex.slice(-4);
}

/** Returns username if known, else short address, else fallback */
export function displayName(
  address: string | undefined | null,
  usernames: Map<string, string>,
  fallback: string,
): string {
  if (!address || address === '0x0') return fallback;
  const username = usernames.get(address.toLowerCase());
  if (username) return username;
  const short = shortAddress(address);
  return short || fallback;
}
