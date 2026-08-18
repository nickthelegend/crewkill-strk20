// Stub for pino logger — bb.js imports pino but it doesn't bundle for browser.
const noop = () => {};
const noopLogger: any = {
  info: noop,
  debug: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  trace: noop,
  silent: noop,
  child: () => noopLogger,
  level: 'silent',
};

export function pino() {
  return noopLogger;
}

export default pino;
