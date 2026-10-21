const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const WALLET_ADDRESS = (process.env.PI_WALLET_ADDRESS || "").trim();
const UNLOCK_DATE = "2026-10-29T00:00:00Z";
const CHECK_INTERVAL = 5 * 60 * 1000;

let lastCheck = null;
let lastResult = "Monitor starting.";
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

const url =
"https://api.mainnet.minepi.com/accounts/" +
encodeURIComponent(WALLET_ADDRESS);

const request = https.get(url, {
headers: {
Accept: "application/json",
"User-Agent": "Pi-Unlock-Monitor/1.0"
},
timeout: 15000
}, (response) => {
let body = "";

response.on("data", chunk => {
  body += chunk;
  if (body.length > 4000) {
    response.destroy();
  }
});

response.on("end", () => {
  lastCheck = new Date().toISOString();

  if (response.statusCode === 200) {
    try {
      const account = JSON.parse(body);
      lastResult =
        "Public account lookup succeeded. Sequence: " +
        String(account.sequence) +
        ". This does not verify the Pi lockup or transferable balance.";
    } catch {
      lastResult = "HTTP 200 received, but response was not valid JSON.";
    }
  } else {
    let detail = body.replace(/\s+/g, " ").slice(0, 300);
    lastResult =
      `Pi API HTTP ${response.statusCode}: ` +
      (detail || "No response body returned.");
  }

  log(lastResult);
  checkInProgress = false;
});

});

request.on("timeout", () => {
request.destroy(new Error("Request timed out"));
});

request.on("error", error => {
lastCheck = new Date().toISOString();
lastResult = "Account lookup failed: " + error.message;
log(lastResult);
checkInProgress = false;
});
}

function checkUnlockDate() {
const remaining =
new Date(UNLOCK_DATE).getTime() - Date.now();

if (remaining <= 0) {
log("Scheduled date reached. Check unlock status in the official Pi Wallet.");
} else {
log(
Math.ceil(remaining / 86400000) +
" day(s) remain until the scheduled date."
);
}
}

const server = http.createServer((req, res) => {
res.setHeader("Content-Type", "application/json; charset=utf-8");

res.writeHead(200);
res.end(JSON.stringify({
status: "running",
service: "Pi Unlock Monitor",
scheduledUnlockDate: UNLOCK_DATE,
lastCheck,
lastResult,
note: "This monitor cannot independently confirm lockup expiration or transfer Pi."
}));
});

server.listen(PORT, "0.0.0.0", () => {
log("Monitor web server started on port " + PORT);
checkUnlockDate();
checkWallet();
setInterval(() => {
checkUnlockDate();
checkWallet();
}, CHECK_INTERVAL);
});
