# Deployment and Subdomain Setup

This app supports two portals from the same production build:

- Civilian portal: `https://your-domain.com`
- Emergency service portal: `https://service.your-domain.com`

The app detects the portal from the hostname. Subdomains named `service`, `services`, `responder`, `responders`, or `admin` open the emergency service role automatically. For local testing, `/service` and `/responder` also open the service portal.

## Build

```bash
npm run build
```

Deploy the generated `dist` folder.

## Hosting Rules

Both domains should point to the same deployed app:

- `your-domain.com` -> production app
- `service.your-domain.com` -> the same production app

For single-page app routing, configure all unknown paths to return `index.html`.

Example rewrite rule:

```text
/* /index.html 200
```

## API Notes

The current Vite dev server provides local placeholder/proxy endpoints for:

- `/api/roboflow`
- `/api/roboflow-webrtc`
- `/api/yolo`
- `/api/live-gps`

For production, move these endpoints to a backend or serverless functions so API keys stay private.
