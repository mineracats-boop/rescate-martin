// Servidor de "El Rescate de Martín": sirve el juego y conecta a los jugadores del modo dúo.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
const htmlGz = zlib.gzipSync(html, { level: 9 });

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/salud') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url !== '/' && url !== '/index.html') { res.writeHead(404); return res.end('No encontrado'); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(gz ? htmlGz : html);
});

// salas: nombre -> Map(id -> {ws, p})
const rooms = new Map();
let nextId = 1;
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

function broadcast(room, from, msg) {
  const r = rooms.get(room); if (!r) return;
  const data = JSON.stringify(msg);
  for (const [id, c] of r) if (id !== from && c.ws.readyState === 1) c.ws.send(data);
}

wss.on('connection', ws => {
  const id = 'p' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);
  let room = null;
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'join' && typeof m.room === 'string' && /^[a-z0-9-]{1,40}$/.test(m.room) && !room) {
      room = m.room; if (!rooms.has(room)) rooms.set(room, new Map());
      const r = rooms.get(room);
      if (r.size >= 4) { ws.close(); return; }
      r.set(id, { ws, p: m.p || {} });
      const peers = [...r].filter(([k]) => k !== id).map(([k, c]) => ({ peer: k, p: c.p }));
      ws.send(JSON.stringify({ t: 'welcome', you: id, peers }));
      broadcast(room, id, { t: 'pres', from: id, p: m.p || {} });
    } else if (!room) return;
    else if (m.t === 'pres') { const c = rooms.get(room).get(id); if (c) c.p = m.p || {}; broadcast(room, id, { t: 'pres', from: id, p: m.p || {} }); }
    else if (m.t === 'emit' && typeof m.topic === 'string') broadcast(room, id, { t: 'emit', from: id, topic: m.topic, data: m.data });
  });
  ws.on('close', () => {
    if (!room) return; const r = rooms.get(room); if (!r) return;
    r.delete(id); broadcast(room, id, { t: 'left', from: id }); if (!r.size) rooms.delete(room);
  });
});

setInterval(() => { wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} }); }, 25000);

server.listen(PORT, () => console.log('Rescate de Martín escuchando en el puerto ' + PORT));
