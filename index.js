// lumine-monitor.js
const https = require("https");
const notifier = require("node-notifier");
const express = require("express");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const WEBSITE = "https://lumineproxy.org/";
let online = false;
const INTERVAL = 10000; // 10 seconds
let countdown = INTERVAL / 1000;

// Serve web page
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Lumine Proxy Monitor</title>
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #121212;
        color: white;
        font-family: sans-serif;
      }
      .panel {
        background-color: #1f1f1f;
        padding: 30px 50px;
        border-radius: 15px;
        text-align: center;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        margin-bottom: 80px; /* space for footer */
      }
      .status {
        font-size: 28px;
        margin-bottom: 15px;
      }
      .timer {
        font-size: 16px;
        color: #aaa;
      }
      footer {
        position: fixed;
        bottom: 0;
        width: 100%;
        text-align: center;
        padding: 15px 0;
        background-color: #1a1a1a;
      }
      button {
        padding: 12px 25px;
        font-size: 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        background-color: #4caf50;
        color: white;
      }
      button:hover {
        background-color: #45a049;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="status" id="status">Checking...</div>
      <div class="timer" id="timer">Next ping in 10s</div>
      <audio id="alertSound" src="https://www.soundjay.com/buttons/beep-07.wav" preload="auto"></audio>
    </div>

    <footer>
      <button onclick="visitSite()">Visit Website</button>
    </footer>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      const statusEl = document.getElementById("status");
      const timerEl = document.getElementById("timer");
      const sound = document.getElementById("alertSound");
      let lastOnline = false;
      let countdown = ${INTERVAL / 1000};

      // Update countdown every second
      setInterval(() => {
        countdown--;
        if (countdown <= 0) countdown = ${INTERVAL / 1000};
        timerEl.textContent = "Next ping in " + countdown + "s";
      }, 1000);

      socket.on("statusUpdate", data => {
        statusEl.textContent = data.online ? "Online ✅" : "Offline ❌";
        if (data.online && !lastOnline) {
          sound.play();
        }
        lastOnline = data.online;
        countdown = ${INTERVAL / 1000}; // reset timer on ping
      });

      function visitSite() {
        window.open("${WEBSITE}", "_blank");
      }
    </script>
  </body>
  </html>
  `);
});

// Ping the website
function checkWebsite() {
  https.get(WEBSITE, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (!online) {
        notifier.notify({
          title: "Lumine Proxy Online",
          message: `${WEBSITE} is now online!`,
        });
        console.log(`${WEBSITE} is online`);
      }
      online = true;
    } else {
      online = false;
      console.log(`${WEBSITE} responded with status code ${res.statusCode}`);
    }
    io.emit("statusUpdate", { online });
  }).on("error", (err) => {
    online = false;
    io.emit("statusUpdate", { online });
    console.log(`${WEBSITE} is offline: ${err.message}`);
  });
}

// Start monitoring every INTERVAL
setInterval(checkWebsite, INTERVAL);
checkWebsite(); // initial check

// Start server
server.listen(3000, () => {
  console.log("Lumine Proxy Monitor running at http://localhost:3000");
});
