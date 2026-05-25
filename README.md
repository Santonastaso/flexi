# flexi

Internal scheduler. React + Vite SPA backed by Supabase (Auth, Postgres,
RLS, Storage). Deployed as a static site to GitHub Pages on every push to
`main`.

## Stack

- `flexi-react-app/` — Vite 7 + React 19 + Zustand + React Query
- Supabase client-only — no backend service in this repo
- Sentry (optional) for browser error reporting

## Develop

```bash
cd flexi-react-app
cp .env.example .env.local        # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm ci --legacy-peer-deps
npm run dev                       # http://localhost:5173
```

## Deploy

Push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Build with the Vite env injected from GitHub Secrets.
2. Publish `flexi-react-app/dist` to GitHub Pages.

Custom domain is set via [`flexi-react-app/public/CNAME`](flexi-react-app/public/CNAME).

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project anon / publishable key |

Set in repo Settings → Secrets and variables → Actions. **Service role keys
must never be added here** — they would be baked into the public JS bundle.

## Tests

None yet. CI runs `npm ci` + `npm run build` only — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). ESLint is wired
locally but currently not gated.
