# Free Temporary Cloudflare Domain Setup for Profile Vault

This guide shows how to use a free temporary Cloudflare URL like:

`https://random-name.trycloudflare.com`

This setup is good for testing and sharing quickly from your RDP.

## What this setup does

Your RDP will run:

- the backend server on port `4000`
- the built frontend from the same backend
- a free temporary Cloudflare Tunnel

That means one public URL will serve both:

- frontend
- backend API
- images

## Important notes

- This Cloudflare URL is temporary
- The URL may change whenever you restart the tunnel
- Cloudflare documents Quick Tunnels as intended for testing/development
- Cloudflare also notes Quick Tunnels have limits like a `200 concurrent request` cap

Official docs:
- Quick Tunnels: https://try.cloudflare.com/
- Cloudflare docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- General tunnel setup: https://developers.cloudflare.com/tunnel/setup/
- Downloads: https://developers.cloudflare.com/tunnel/downloads/

## 1. Install Node.js on the RDP

Download Node.js LTS:

- https://nodejs.org/en/download

Verify install:

```powershell
node -v
npm -v
```

## 2. Install project dependencies

From the project root:

```powershell
npm ci
npm --prefix server ci
```

If that fails:

```powershell
npm install
npm --prefix server install
```

## 3. Set up your backend environment

Edit `server/.env`:

```env
PORT=4000
MONGODB_URI=your-mongodb-atlas-uri
PUBLIC_BASE_URL=
GITHUB_MODELS_TOKEN=your-token
GITHUB_MODELS_MODEL=openai/gpt-4.1
GITHUB_MODELS_API_VERSION=2026-03-10
GITHUB_MODELS_IMAGE_MODEL=black-forest-labs/flux.2-klein-4b
GITHUB_MODELS_IMAGE_ENDPOINT=https://models.github.ai/inference/images/generations
```

For now, leave:

```env
PUBLIC_BASE_URL=
```

We will fill it in after Cloudflare gives you the temporary URL.

## 4. Set up your frontend environment

Edit your frontend `.env` file.

Use this:

```env
VITE_API_URL=
IMAGE_API_KEY=
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
```

Important:
- Do not use `http://localhost:4000` here for public sharing
- Leaving `VITE_API_URL` blank makes the frontend call the same origin using `/api/...`
- That is what you want when the backend serves the frontend build

## 5. Build the frontend

From the project root:

```powershell
npm run build
```

## 6. Run the backend server

Start the Express backend:

```powershell
npm --prefix server run start
```

Or for dev mode:

```powershell
npm --prefix server run dev
```

This backend serves:
- the API
- the frontend build from `dist`
- image files

## 7. Install Cloudflare Tunnel

Download `cloudflared`:

- https://developers.cloudflare.com/tunnel/downloads/

You can also install with Winget:

```powershell
winget install --id Cloudflare.cloudflared
```

Verify install:

```powershell
cloudflared --version
```

## 8. Start a free temporary Cloudflare tunnel

Run this on the RDP:

```powershell
cloudflared tunnel --url http://localhost:4000
```

Cloudflare will print a public URL like:

```text
https://random-name.trycloudflare.com
```

Official reference:
- https://try.cloudflare.com/
- https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/

## 9. Update `PUBLIC_BASE_URL`

Now copy the generated Cloudflare URL into `server/.env`:

```env
PUBLIC_BASE_URL=https://random-name.trycloudflare.com
```

Then restart the backend:

```powershell
npm --prefix server run start
```

Why:
- this helps backend-generated file/image URLs use the public Cloudflare URL instead of localhost

## 10. Final run order

Every time you want to serve the app from your RDP:

1. Build frontend if code changed

```powershell
npm run build
```

2. Start backend

```powershell
npm --prefix server run start
```

3. Start Cloudflare tunnel

```powershell
cloudflared tunnel --url http://localhost:4000
```

4. Copy the generated `trycloudflare.com` URL and open/share it

## 11. Troubleshooting

### Frontend loads but login does not work

Check:

- backend is running
- tunnel points to `http://localhost:4000`
- frontend `.env` has:

```env
VITE_API_URL=
```

not:

```env
VITE_API_URL=http://localhost:4000
```

### Images are broken or API points to localhost

Set in `server/.env`:

```env
PUBLIC_BASE_URL=https://your-current-trycloudflare-url
```

Then restart backend.

### Tunnel URL changed

That is normal for a free temporary Quick Tunnel.

If the tunnel restarts and gives a new URL:
1. copy the new URL
2. update `PUBLIC_BASE_URL`
3. restart backend

### Database issues

Make sure `MONGODB_URI` in `server/.env` points to a working MongoDB Atlas connection string.

Atlas signup:
- https://www.mongodb.com/products/try-free/platform/atlas-signup-from-mlab

## 12. Summary

Use this setup for free temporary public sharing:

- frontend `.env`

```env
VITE_API_URL=
```

- backend `server/.env`

```env
PORT=4000
MONGODB_URI=your-atlas-uri
PUBLIC_BASE_URL=https://your-current-trycloudflare-url
```

- run:

```powershell
npm run build
npm --prefix server run start
cloudflared tunnel --url http://localhost:4000
```

## Sources

- Cloudflare Quick Tunnels: https://try.cloudflare.com/
- Quick Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- Cloudflare Tunnel downloads: https://developers.cloudflare.com/tunnel/downloads/
- Cloudflare Tunnel setup: https://developers.cloudflare.com/tunnel/setup/
- Node.js downloads: https://nodejs.org/en/download
- MongoDB Atlas signup: https://www.mongodb.com/products/try-free/platform/atlas-signup-from-mlab
