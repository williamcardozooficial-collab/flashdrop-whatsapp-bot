
const logs = [];
const MAX_LOGS = 100;

function log(type, message) {
  const entry = {
    type,
    message,
    timestamp: new Date().toISOString()
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function getLogs() {
  return logs;
}

module.exports = { log, getLogs };
