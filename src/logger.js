const MAX_LOGS = 200;
const logs = [];
function addLog(entry) { logs.unshift(entry); if (logs.length > MAX_LOGS) logs.pop(); }
function getLogs(limit=50) { return logs.slice(0,limit); }
module.exports = { addLog, getLogs };
