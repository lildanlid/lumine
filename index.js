// monitor-web.js
const express = require("express");
const http = require("http");
const https = require("https");
const notifier = require("node-notifier");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + "/public"));
app.use(express.json());

// Data
let websites = [];
let status = {};

// Serve the main page
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Website Monitor</title>
    <style>
      body { font-family: sans-serif; padding: 20px; }
      input, button { padding: 5px; margin: 5px; }
      ul { list-style: none; padding: 0; }
      li { margin: 5px 0; }
      .online { color: green; }
      .offline { color: red; }
    </style>
  </head>
  <body>
    <h1>Website Monitor</h1>
    <input id="urlInput" placeholder="Enter website URL"/>
    <button onclick="addSite()">Add Website</button>
    <ul id="sites"></ul>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      const sitesList = document.getElementById("sites");

      function addSite() {
        const url = document.getElementById("urlInput").value;
        if (!url) return;
        socket.emit("addWebsite", url);
        document.getElementById("urlInput").value = "";
      }

      function removeSite(url) {
        socket.emit("removeWebsite", url);
      }

      socket.on("statusUpdate", data => {
        sitesList.innerHTML = "";
        data.forEach(site => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="${site.online ? 'online' : 'offline'}">${site.url} - ${site.online ? 'Online' : 'Offline'}</span> 
                          <button onclick="removeSite('${site.url}')">Remove</button>`;
          sitesList.appendChild(li);
        });
      });
    </script>
  </body>
  </html>
  `);
});

// Socket.IO for live updates
io.on("connection", (socket) => {
  socket.emit("statusUpdate", websites.map(url => ({ url, online: status[url] || false })));

  socket.on("addWebsite", (url) => {
    if (!websites.includes(url)) websites.push(url);
    socket.emit("statusUpdate", websites.map(u => ({ url: u, online: status[u] || false })));
  });

  socket.on("removeWebsite", (url) => {
    websites = websites.filter(u => u !== url);
    socket.emit("statusUpdate", websites.map(u => ({ url: u, online: status[u] || false })));
  });
});

// Check websites
function checkWebsite(url) {
  const lib = url.startsWith("https") ? https : http;
  const req = lib.get(url, (res) => {
    if (!status[url]) {
      notifier.notify({
        title: "Website Online",
        message: `${url} is now online!`,
      });
      console.log(`${url} is online`);
    }
    status[url] = true;
    io.emit("statusUpdate", websites.map(u => ({ url: u, online: status[u] || false })));
  });

  req.on("error", () => {
    status[url] = false;
    io.emit("statusUpdate", websites.map(u => ({ url: u, online: status[u] || false })));
  });

  req.setTimeout(5000, () => {
    req.abort();
    status[url] = false;
    io.emit("statusUpdate", websites.map(u => ({ url: u, online: status[u] || false })));
  });
}

// Start monitoring
setInterval(() => {
  websites.forEach(checkWebsite);
}, 10000); // every 10 seconds

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
