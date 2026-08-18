export const NETWORK = import.meta.env.VITE_NETWORK ?? 'devnet';
export const isLocal = NETWORK === 'devnet';
