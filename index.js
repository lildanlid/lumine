require('dotenv').config();
const https = require("https");
const notifier = require("node-notifier");
const express = require("express");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cookieParser());

const CONFIG = {
  website: "https://lumineproxy.org/",
  interval: 10000,
  port: process.env.PORT || 3000,
  maintenanceText: "Lumine is down for maintenance. Check the Discord for updates.",
  linkvertiseUserId: process.env.LINKVERTISE_USER_ID || "YOUR_ID_HERE" 
};

let currentState = {
  online: false,
  lastChecked: Date.now(),
  offlineSince: new Date('1/18/2026 10:21:00 PM').getTime(),
  reason: "checking"
};

function getLinkvertiseUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  const redirectTarget = `${protocol}://${host}/verify`;

  const base64Target = Buffer.from(redirectTarget).toString('base64');

  return `https://link-to.net/${CONFIG.linkvertiseUserId}/${Math.random().toString(36).substring(7)}/dynamic?r=${base64Target}`;
}

// --- ROUTE: Verification Handler ---
app.get("/verify", (req, res) => {
  const threeHours = 3 * 60 * 60 * 1000;

  res.cookie('access_granted', 'true', { maxAge: threeHours, httpOnly: true });

  res.redirect("/?status=authorized");
});

app.get("/", (req, res) => {
  const hasAccess = req.cookies['access_granted'];

  if (!hasAccess) {
    const taskLink = getLinkvertiseUrl(req);

    return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lumine Monitor | Verification</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&display=swap" rel="stylesheet">
      <style>
        body {
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            font-family: 'Inter', sans-serif;
            color: white;
        }
        .card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            padding: 40px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
            max-width: 400px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        h1 { font-weight: 300; margin-bottom: 20px; }
        p { color: rgba(255,255,255,0.7); margin-bottom: 30px; line-height: 1.5; }
        .btn {
            display: inline-block;
            background: #00ff88;
            color: #0f0c29;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        .btn:hover { transform: scale(1.05); box-shadow: 0 0 20px rgba(0,255,136,0.4); }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔒 Access Required</h1>
        <p>To use this site you must complete this task. It creates a Linkvertise task, and once completed, gives you <strong>3 hours</strong> of access to the website.</p>
        <a href="${taskLink}" class="btn">Complete Task & Unlock</a>
      </div>
    </body>
    </html>
    `);
  }

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lumine Monitor</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-color: #0f0c29;
        --card-bg: rgba(255, 255, 255, 0.05);
        --text-color: #ffffff;
        --success: #00ff88;
        --error: #ff3366;
        --warning: #ffaa00;
      }

      body {
        margin: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        font-family: 'Inter', sans-serif;
        color: var(--text-color);
        overflow: hidden;
      }

      .bg-animation {
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: -1;
        opacity: 0.3;
        background-image: radial-gradient(#ffffff 1px, transparent 1px);
        background-size: 40px 40px;
      }

      .container {
        position: relative;
        width: 90%;
        max-width: 420px;
        padding: 40px;
        background: var(--card-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        text-align: center;
      }

      h1 { font-size: 24px; margin: 0 0 5px 0; font-weight: 300; letter-spacing: 1px; }
      h2 { font-size: 14px; margin: 0 0 25px 0; color: rgba(255,255,255,0.4); }

      .status-circle {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        margin: 0 auto 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 35px;
        background: rgba(0,0,0,0.2);
        transition: all 0.5s;
      }

      .status-text { font-size: 24px; font-weight: 700; margin-bottom: 5px; }
      .status-sub { font-size: 12px; opacity: 0.6; margin-bottom: 25px; }

      .online .status-circle {
        background: rgba(0, 255, 136, 0.1);
        color: var(--success);
        box-shadow: 0 0 30px var(--success), inset 0 0 20px var(--success);
        border: 2px solid var(--success);
      }

      .offline .status-circle {
        background: rgba(255, 51, 102, 0.1);
        color: var(--error);
        box-shadow: 0 0 30px var(--error), inset 0 0 20px var(--error);
        border: 2px solid var(--error);
        animation: pulse 2s infinite;
      }

      .maintenance .status-circle {
        background: rgba(255, 170, 0, 0.1);
        color: var(--warning);
        box-shadow: 0 0 30px var(--warning), inset 0 0 20px var(--warning);
        border: 2px solid var(--warning);
        animation: pulse 2s infinite;
      }

      .downtime-container {
        display: none; 
        background: rgba(255, 51, 102, 0.1);
        border: 1px solid rgba(255, 51, 102, 0.3);
        border-radius: 8px;
        padding: 15px;
        margin-top: 15px;
      }

      .maintenance .downtime-container,
      .downtime-container.maintenance-mode {
        background: rgba(255, 170, 0, 0.1);
        border: 1px solid rgba(255, 170, 0, 0.3);
      }

      .clock-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #ff3366;
        margin-bottom: 5px;
      }

      .maintenance .clock-label,
      .clock-label.maintenance-mode {
        color: #ffaa00;
      }

      .downtime-val {
        font-family: 'JetBrains Mono', monospace;
        font-size: 28px;
        color: #fff;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(255, 51, 102, 0.5);
      }

      .progress-container {
        width: 100%;
        height: 2px;
        background: rgba(255,255,255,0.1);
        margin-bottom: 20px;
      }
      .progress-bar {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #00C9FF, #92FE9D);
        transform-origin: left;
        transform: scaleX(1);
        transition: transform 1s linear;
      }

      .btn {
        background: transparent;
        border: 1px solid rgba(255,255,255,0.2);
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        text-transform: uppercase;
        margin-top: 20px;
        transition: 0.2s;
      }
      .btn:hover { background: rgba(255,255,255,0.1); }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(255, 51, 102, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0); }
      }

      .access-timer {
        position: absolute;
        bottom: 10px;
        right: 15px;
        font-size: 10px;
        color: rgba(255,255,255,0.3);
      }
    </style>
  </head>
  <body>
    <div class="bg-animation"></div>

    <div class="container">
      <h1>LUMINE PROXY</h1>
      <h2>System Monitor</h2>

      <div id="statusIndicator" class="offline">
        <div class="status-circle"><i id="icon">⚡</i></div>
        <div class="status-text" id="statusText">Checking...</div>
        <div class="status-sub" id="statusDetails">Waiting for server</div>
      </div>

      <div class="progress-container">
        <div class="progress-bar" id="progressBar"></div>
      </div>

      <div id="downtimeBox" class="downtime-container">
        <div class="clock-label" id="clockLabel">Current Downtime</div>
        <div class="downtime-val" id="downtimeTimer">00:00:00</div>
      </div>

      <button onclick="enableSound()" class="btn">Enable Audio Alerts</button>
      <div class="access-timer">Session expires in 3h</div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();

      const statusInd = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');
      const statusDetails = document.getElementById('statusDetails');
      const icon = document.getElementById('icon');
      const progressBar = document.getElementById('progressBar');
      const downtimeBox = document.getElementById('downtimeBox');
      const downtimeTimer = document.getElementById('downtimeTimer');
      const clockLabel = document.getElementById('clockLabel');

      let isOnline = false;
      let offlineSince = null;
      let currentReason = '';

      const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      function enableSound() {
        alertSound.play().then(() => { alertSound.pause(); alertSound.currentTime = 0; });
        if(Notification.permission !== "granted") Notification.requestPermission();
      }

      const urlParams = new URLSearchParams(window.location.search);
      if(urlParams.get('status') === 'authorized') {
          // Send Device Notification
          if(Notification.permission === "granted") {
              new Notification("Access Granted", { body: "You have 3 hours of access to Lumine Monitor." });
          } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then(permission => {
                  if (permission === "granted") {
                      new Notification("Access Granted", { body: "You have 3 hours of access to Lumine Monitor." });
                  }
              });
          }
          window.history.replaceState({}, document.title, "/");
      }

      setInterval(() => {
        if (!isOnline && offlineSince) {
          const now = Date.now();
          const diff = now - offlineSince;

          if(diff >= 0) {
            const hrs = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            downtimeTimer.innerText = 
              (hrs < 10 ? "0"+hrs : hrs) + ":" + 
              (mins < 10 ? "0"+mins : mins) + ":" + 
              (secs < 10 ? "0"+secs : secs);
          }
        }
      }, 1000);

      socket.on('statusUpdate', (data) => {
        updateUI(data);
        resetBar();

        if (data.online && !isOnline) {
          triggerOnlineAlert();
        }

        isOnline = data.online;
        offlineSince = data.offlineSince;
        currentReason = data.reason;

        if (!isOnline) {
          downtimeBox.style.display = 'block';
          if (currentReason === 'maintenance') {
            downtimeBox.classList.add('maintenance-mode');
            clockLabel.classList.add('maintenance-mode');
            clockLabel.innerText = 'Maintenance Duration';
          } else {
            downtimeBox.classList.remove('maintenance-mode');
            clockLabel.classList.remove('maintenance-mode');
            clockLabel.innerText = 'Current Downtime';
          }
        } else {
          downtimeBox.style.display = 'none';
        }
      });

      function updateUI(data) {
        if (data.online) {
          statusInd.className = 'online';
          statusText.innerText = 'ONLINE';
          statusDetails.innerText = 'Connected Successfully';
          icon.innerText = '✓';
        } else if (data.reason === 'maintenance') {
          statusInd.className = 'maintenance';
          statusText.innerText = 'MAINTENANCE';
          statusDetails.innerText = 'Scheduled Maintenance';
          icon.innerText = '🔧';
        } else {
          statusInd.className = 'offline';
          statusText.innerText = 'OFFLINE';
          statusDetails.innerText = 'Connection Lost'; 
          icon.innerText = '✕';
        }
      }

      function triggerOnlineAlert() {
         alertSound.currentTime = 0;
         alertSound.play().catch(e => {}); 
         if(Notification.permission === "granted") new Notification("Lumine is Back Online!");
      }

      function resetBar() {
        progressBar.style.transition = 'none';
        progressBar.style.transform = 'scaleX(1)';
        setTimeout(() => {
          progressBar.style.transition = 'transform ${CONFIG.interval}ms linear';
          progressBar.style.transform = 'scaleX(0)';
        }, 50);
      }
    </script>
  </body>
  </html>
  `);
});

function checkWebsite() {
  const req = https.request(CONFIG.website, { method: 'GET', timeout: 5000 }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });

    res.on('end', () => {
      const statusOk = res.statusCode >= 200 && res.statusCode < 300;
      const hasMaintenance = body.includes(CONFIG.maintenanceText);

      if (!statusOk) handleState(false, 'error');
      else if (hasMaintenance) handleState(false, 'maintenance');
      else handleState(true, 'online');
    });
  });

  req.on('error', () => handleState(false, 'error'));
  req.on('timeout', () => { req.destroy(); handleState(false, 'timeout'); });
  req.end();
}

function handleState(isNowOnline, reason) {
  const now = Date.now();
  if (!isNowOnline) {
    if (!currentState.offlineSince) {
      currentState.offlineSince = now;
      const reasonText = reason === 'maintenance' ? 'MAINTENANCE MODE' : 'OFFLINE';
      console.log(`[${new Date().toLocaleTimeString()}] Site went ${reasonText}`);
    }
  } else {
    if (currentState.offlineSince) {
      console.log(`[${new Date().toLocaleTimeString()}] Site back ONLINE`);
      notifier.notify({ title: 'Lumine Proxy', message: 'Website is back Online!' });
    }
    currentState.offlineSince = null;
  }
  currentState.online = isNowOnline;
  currentState.lastChecked = now;
  currentState.reason = reason;
  io.emit("statusUpdate", currentState);
}

setInterval(checkWebsite, CONFIG.interval);
checkWebsite();

server.listen(CONFIG.port, () => {
  console.log(`Monitor running at http://localhost:${CONFIG.port}`);
});
