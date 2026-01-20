const https = require("https");
const notifier = require("node-notifier");
const express = require("express");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const CONFIG = {
  website: "https://lumineproxy.org/",
  interval: 10000,
  port: 3000
};

let currentState = {
  online: false,
  lastChecked: Date.now(),
  offlineSince: null 
};

app.get("/", (req, res) => {
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
      
      .downtime-container {
        display: none; 
        background: rgba(255, 51, 102, 0.1);
        border: 1px solid rgba(255, 51, 102, 0.3);
        border-radius: 8px;
        padding: 15px;
        margin-top: 15px;
      }
      
      .clock-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #ff3366;
        margin-bottom: 5px;
      }

      .downtime-val {
        font-family: 'JetBrains Mono', monospace;
        font-size: 28px;
        color: #fff;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(255, 51, 102, 0.5);
      }

      /* Progress Bar */
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

      <!-- Downtime Counter (Only shows when offline) -->
      <div id="downtimeBox" class="downtime-container">
        <div class="clock-label">Current Downtime</div>
        <div class="downtime-val" id="downtimeTimer">00:00:00</div>
      </div>

      <button onclick="enableSound()" class="btn">Enable Audio Alerts</button>
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

      let isOnline = false;
      let offlineSince = null;

      const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      function enableSound() {
        alertSound.play().then(() => { alertSound.pause(); alertSound.currentTime = 0; });
        if(Notification.permission !== "granted") Notification.requestPermission();
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
        offlineSince = data.offlineSince; // Update timestamp from server
        
        if (!isOnline) {
          downtimeBox.style.display = 'block';
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
  const options = { method: 'HEAD', timeout: 5000 };
  
  const req = https.request(CONFIG.website, options, (res) => {
    const online = res.statusCode >= 200 && res.statusCode < 300;
    handleState(online);
  });

  req.on('error', () => handleState(false));
  req.on('timeout', () => { req.destroy(); handleState(false); });
  req.end();
}

function handleState(isNowOnline) {
  const now = Date.now();

  if (!isNowOnline) {
    if (!currentState.offlineSince) {
      currentState.offlineSince = now;
      console.log(`[${new Date().toLocaleTimeString()}] Site went OFFLINE`);
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

  io.emit("statusUpdate", currentState);
}

setInterval(checkWebsite, CONFIG.interval);
checkWebsite();

server.listen(CONFIG.port, () => {
  console.log(`Monitor running at http://localhost:${CONFIG.port}`);
});
