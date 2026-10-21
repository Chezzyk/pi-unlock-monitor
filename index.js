const https = require("https");

const CONFIG = {
walletAddress: process.env.PI_WALLET_ADDRESS || "",
unlockDate: "2026-10-29T00:00:00Z",
checkIntervalMs: 5 * 60 * 1000
};

function log(message) {
console.log("[${new Date().toISOString()}] ${message}");
}

function checkConfiguration() {
if (!CONFIG.walletAddress) {
log("Waiting for PI_WALLET_ADDRESS to be configured.");
return false;
}

log("Wallet address is configured.");
return true;
}

function checkUnlockDate() {
const now = Date.now();
const unlockTime = new Date(CONFIG.unlockDate).getTime();

if (now >= unlockTime) {
log("Scheduled unlock date reached. Verify transferability in the official Pi Wallet.");
} else {
const daysLeft = Math.ceil((unlockTime - now) / 86400000);
log("Scheduled unlock is approaching: ${daysLeft} day(s) remaining.");
}
}

function checkWalletAddress() {
if (!checkConfiguration()) return;

const address = encodeURIComponent(CONFIG.walletAddress);
const url = "https://api.mainnet.minepi.com/accounts/${address}";

https.get(url, (response) => {
let data = "";

response.on("data", chunk => data += chunk);

response.on("end", () => {
  if (response.statusCode === 200) {
    try {
      const account = JSON.parse(data);
      log(`Public account lookup succeeded. Sequence: ${account.sequence}`);
      log("This does not confirm the locked amount or unlock status.");
    } catch {
      log("The public account response could not be parsed.");
    }
  } else {
    log(`Public account lookup returned HTTP ${response.statusCode}.`);
  }
});

}).on("error", (error) => {
log("Public account lookup failed: ${error.message}");
});
}

function runCheck() {
log("Starting Pi unlock monitoring check.");
checkUnlockDate();
checkWalletAddress();
}

runCheck();
setInterval(runCheck, CONFIG.checkIntervalMs);
