// Point d'entrée : serveur HTTP (fichiers du jeu) + WebSocket (/ws) pour le mode en ligne.

import os from 'node:os';
import { startServer } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = startServer({ port: PORT, host: HOST });

app.ready.then((port) => {
  console.log(`Dodge Arena prêt sur http://localhost:${port}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) console.log(`  Réseau local : http://${ni.address}:${port}`);
    }
  }
});

function shutdown() {
  app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
