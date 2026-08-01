# Batch Reunion — Frontend

React + Vite + Tailwind. Mobile-first RSVP & voting site for the 25-year batch reunion (19 Dec 2026).

## Pages
- `/` Landing — countdown, live vote stats, attendee wall (public)
- `/register`, `/login` — accounts
- `/dashboard` — the editable RSVP form (vote, food, guests, T-shirt, message)
- `/admin` — responses table, live summary, CSV export, remove member (admin only)

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` to the backend at `http://localhost:5050`, so run
`gt_backend` alongside it. No `.env` needed locally.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: New Project → import the repo. Framework preset: **Vite**.
3. Add an environment variable:
   - `VITE_API_URL` = your deployed backend URL, e.g. `https://gt-backend.vercel.app`
4. Deploy. `vercel.json` handles SPA routing.

> Note: `VITE_API_URL` is baked in at build time, so redeploy the frontend if the
> backend URL changes.
