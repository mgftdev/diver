const stamp = () => new Date().toISOString();

const write = (stream, level, args) => {
  stream(`${stamp()} ${level.padEnd(5)}`, ...args);
};

export const logger = {
  info: (...args) => write(console.log, 'info', args),
  warn: (...args) => write(console.warn, 'warn', args),
  error: (...args) => write(console.error, 'error', args),
};
