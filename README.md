# RoomieTab — From bill to settled, without you.

RoomieTab is the settlement layer for rent-by-the-room. A landlord adds a property, its tenants, and a
bill — RoomieTab splits it to the exact day each tenant occupied the property (move-ins, move-outs, and
vacant rooms all accounted for) and gives each tenant a no-login link showing exactly how their share was
calculated.

## Features

- **Property & tenant management** — track properties, rooms, and tenants, including move-in/move-out dates.
- **Occupancy-aware bill splitting** — utility bills are split by person-days; rent is charged against
  effective-dated rates, prorated day-by-day across any mid-period rate change.
- **No-login tenant links** — tenants confirm payment and see a full breakdown without ever creating an account.
- **Payment status tracking** — pending / viewed / paid, per split.
- **Private bill attachments** — signed URLs, not public links.
- **Row-level security** — every table is scoped to the owning landlord via Supabase RLS.

## Tech stack

- **Frontend**: React 18 (Create React App), Tailwind CSS, Framer Motion, React Router
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Money-critical logic**: pure, unit-tested modules in `src/lib/` (`billSplit.js`, `rentCalc.js`) — integer
  cents, largest-remainder rounding, no floating-point drift

## Project structure

```
src/
├── components/          # Reusable UI (Header, Footer, Money, StatusBadge, SplitActions, TenantShell)
├── contexts/             # AuthContext, PropertyContext (all Supabase reads/writes)
├── lib/                  # Pure calculation modules + formatting helpers
├── pages/                # Home, Login, Dashboard, Properties, PropertyDetail, TenantBillView
├── App.js                # Routing + auth-gated layout
└── index.css             # Tailwind entrypoint + shared component classes
supabase/
└── migrations/           # Source of truth for schema — applied in filename order via the SQL Editor
```

## Development

```bash
npm install
npm start        # http://localhost:3000
npm test         # CI=true npx react-scripts test
npm run build
```

Schema changes go through `supabase/migrations/` — see that folder's `README.md` for the convention.

## Deployment

Auto-deploys to Netlify (`roomietab.netlify.app`) from `main`.

## Support

- **Email**: support@roomietab.com
