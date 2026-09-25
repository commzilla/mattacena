# Mattacena

Booking, floor plan and loyalty management for Mattacena (mattacena.com).

| Folder | What it is | Where it runs |
|---|---|---|
| `app/` | Staff app: an installable web app (PWA) for phone, tablet and desktop | Netlify → `app.mattacena.com` |
| `wp-plugin/` | WordPress plugin: data, rules and REST API | mattacena.com (SiteGround) |
| `docs/` | API contract between the two | — |

## Run the app locally

```bash
cd app
npm install
npm run dev
```

Without a `.env` file the app runs in **demo mode**: data is invented and stored in the browser. The login screen lists the demo accounts (password `demo`) for each role: titolare, responsabile di sala, cameriere.

To use the real WordPress API, copy `app/.env.example` to `app/.env` and set `VITE_API_MODE=wp`.

## Deploy

Netlify builds from `netlify.toml` at the repository root (base `app/`, output `app/dist`). Point `app.mattacena.com` to the Netlify site with a CNAME record.

## Status

- [x] App shell, login with roles, installable PWA
- [x] Oggi (list and table timeline), Prenotazioni, booking form
- [ ] Sala (2D floor plan), Calendario, Fidelity, Impostazioni, customer form: ready in the prototype, being ported
- [ ] WordPress plugin and API
