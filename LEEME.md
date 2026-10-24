# El Rescate de Martín — servidor

Este paquete sirve el juego en un enlace normal y conecta a los dos jugadores del modo dúo.

- `server.js` — el servidor (página del juego + conexión en tiempo real por WebSocket)
- `public/index.html` — el juego completo
- `package.json` — dependencias (solo `ws`)
- `render.yaml` — configuración para Render

Para probarlo en tu ordenador: `npm install` y luego `npm start`, y abre http://localhost:3000
