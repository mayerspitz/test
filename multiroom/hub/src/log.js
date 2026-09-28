export function createLogger(quiet = false) {
  const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
  return {
    info: (...a) => { if (!quiet) console.log(stamp(), ...a); },
    warn: (...a) => console.warn(stamp(), 'WARN', ...a),
    error: (...a) => console.error(stamp(), 'ERROR', ...a),
  };
}
