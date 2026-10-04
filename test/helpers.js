// Outils de test : client WebSocket avec latence simulée et attente de messages.
import { WebSocket } from 'ws';

export const nowSec = () => performance.now() / 1000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class TestClient {
  constructor(url, { latency = 0, jitter = 0 } = {}) {
    this.url = url;
    this.latency = latency; // ms, dans chaque sens
    this.jitter = jitter; // ms de variation aléatoire (sans réordonner, comme TCP)
    this.lastIn = 0;
    this.lastOut = 0;
    this.msgs = [];
    this.waiters = [];
    this.handlers = [];
  }

  open(name) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => {
        this.send({ type: 'hello', name });
        resolve(this);
      });
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        const deliver = () => {
          this.msgs.push(msg);
          for (const h of this.handlers) h(msg);
          this.waiters = this.waiters.filter((w) => {
            if (w.pred(msg)) {
              clearTimeout(w.timer);
              w.resolve(msg);
              return false;
            }
            return true;
          });
        };
        if (this.latency || this.jitter) setTimeout(deliver, this.delay('lastIn'));
        else deliver();
      });
    });
  }

  on(fn) {
    this.handlers.push(fn);
  }

  send(obj) {
    const str = JSON.stringify(obj);
    const go = () => this.ws.readyState === 1 && this.ws.send(str);
    if (this.latency || this.jitter) setTimeout(go, this.delay('lastOut'));
    else go();
  }

  delay(key) {
    const now = performance.now();
    const at = Math.max(this[key], now + this.latency + Math.random() * this.jitter);
    this[key] = at;
    return at - now;
  }

  waitFor(pred, timeout = 3000, label = '') {
    const existing = this.msgs.find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      w.timer = setTimeout(() => reject(new Error('timeout ' + label)), timeout);
      this.waiters.push(w);
    });
  }

  waitType(type, timeout, extra = () => true) {
    return this.waitFor((m) => m.type === type && extra(m), timeout, type);
  }

  clear() {
    this.msgs = [];
  }

  close() {
    this.ws.close();
  }
}
