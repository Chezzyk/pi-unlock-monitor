const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const WALLET_ADDRESS = process.env.PI_WALLET_ADDRESS || "";
const UNLOCK_DATE = "2026-10-29T00:00:00Z";
const CHECK_INTERVAL = 5 * 60 * 1000;

let lastCheck = null;
let lastResult = "Monitoring service started.";
let checkInProgress = false;

function log(message) {
console.log("[${new Date().toISOString()}] ${message}");
}

function checkWallet() {
if (!WALLET_ADDRESS) {
lastResult = "Missing PI_WALLET_ADDRESS environment variable.";
log(lastResult);
return;
}

if (checkInProgress) return;
checkInProgress = true;

const address = encodeURIComponent(WALLET_ADDRESS);
const url = "https://api.mainnet.minepi.com/accounts/${address}";

https.get(url, (response) => {
let data = "";

response.on("data", chunk => {
  data += chunk;
});

response.on("end", () => {
  lastCheck = new Date().toISOString();

  if (response.statusCode === 200) {
    try {
      const account = JSON.parse(data);
      lastResult =
        `Public account lookup succeeded. Sequence: ${account.sequence}. ` +
        "This does not confirm lockup expiration or transferable balance.";
    } catch {
      lastResult = "Account response could not be parsed.";
    }
  } else {
    lastResult = `Account lookup returned HTTP ${response.statusCode}.`;
  }

  log(lastResult);
  checkInProgress = false;
});

}).on("error", (error) => {
lastCheck = new Date().toISOString();
lastResult = "Account lookup failed: ${error.message}";
log(lastResult);
checkInProgress = false;
});
}

function checkUnlockDate() {
const now = Date.now();
const unlockTime = new Date(UNLOCK_DATE).getTime();

if (now >= unlockTime) {
log("Scheduled date reached. Verify unlock status in the official Pi Wallet.");
} else {
const daysLeft = Math.ceil((unlockTime - now) / 86400000);
log("${daysLeft} day(s) remain until the scheduled date.");
}
}

const server = http.createServer((req, res) => {
res.setHeader("Content-Type", "application/json; charset=utf-8");

if (req.url === "/health") {
res.writeHead(200);
res.end(JSON.stringify({
status: "running",
service: "Pi Unlock Monitor",
lastCheck,
lastResult
}));
return;
}

res.writeHead(200);
res.end(JSON.stringify({
service: "Pi Unlock Monitor",
status: "running",
scheduledUnlockDate: UNLOCK_DATE,
lastCheck,
lastResult,
warning: "Monitoring only. Actual lockup status must be verified in the official Pi Wallet."
}));
});

server.listen(PORT, "0.0.0.0", () => {
log("Web server listening on port ${PORT}");
checkUnlockDate();
checkWallet();
setInterval(() => {
checkUnlockDate();
checkWallet();
}, CHECK_INTERVAL);
});
