// Création du serveur (HTTP + WebSocket), séparée de index.js pour pouvoir la tester.

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { serveStatic } from './static.js';
import { Lobby } from './lobby.js';

export function startServer({ port = 3000, host = '0.0.0.0' } = {}) {
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });
  const lobby = new Lobby();

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    // Moins de latence : pas d'algorithme de Nagle sur la socket.
    if (req.socket && req.socket.setNoDelay) req.socket.setNoDelay(true);
    lobby.connect(ws);
  });

  // Détecte les connexions mortes (onglet fermé brutalement, Wi-Fi coupé...).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 15000);

  const ready = new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port)));

  function close() {
    clearInterval(heartbeat);
    lobby.close();
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { server, wss, lobby, ready, close };
}
