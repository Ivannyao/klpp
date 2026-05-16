# KLPP public server

KLPP needs a Node.js server. Static hosting like InfinityFree can show files, but it cannot keep rooms, players, answers, votes, timers, and QR join links alive.

## Run locally

```bash
npm start
```

Open `http://127.0.0.1:3000/klpp`.

## Deploy

Use any Node web host: Render, Railway, Fly.io, a VPS, or another service that can run `node server.js`.

Required settings:

- Build command: `npm install`
- Start command: `npm start`
- Port: the host should provide `PORT`; locally it falls back to `3000`
- Node version: `20+`

Recommended environment variables:

- `PUBLIC_URL=https://your-domain.example` if the host does not pass proxy headers correctly
- `TRUST_PROXY=true` when the app is behind Render/Railway/Nginx/Cloudflare

The QR code and copied invite link are generated from `PUBLIC_URL` first. If it is empty, the server uses `x-forwarded-proto` and `x-forwarded-host`, then falls back to the direct request host.

## Render quick start

This repo includes `render.yaml`, so on Render you can create a Blueprint from the repository. After deploy, open:

```text
https://your-render-app.onrender.com/klpp
```

If QR links show the wrong domain, set `PUBLIC_URL` to the exact public origin, for example:

```text
PUBLIC_URL=https://your-render-app.onrender.com
```
