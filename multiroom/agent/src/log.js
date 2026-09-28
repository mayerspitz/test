export function createLogger(tag) {
  const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
  return {
    info: (...a) => console.log(stamp(), `[${tag}]`, ...a),
    warn: (...a) => console.warn(stamp(), `[${tag}] WARN`, ...a),
    error: (...a) => console.error(stamp(), `[${tag}] ERROR`, ...a),
  };
}
