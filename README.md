# ISP Service Provision

Next.js front end for bandwidth provisioning, talking to a Spring Boot API.
Admins register customers, fund bandwidth pools and decide requests; customers
sign in to see their allocation and ask for more.

Branding follows the Tanzania Immigration emblem — navy, laurel green and gold,
set in Montserrat.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # then edit SPRING_API_URL
npm run dev                     # http://localhost:3000
```

Sign in with an account issued by the backend. Admins use a username; customers
use their email address.

### Without the backend

A mock API implementing the same contract ships with the repo:

```bash
npm run mock                    # :8080, 5 pools
POOL_COUNT=1 npm run mock       # 1 pool — vary 1..5 to check the pool table
```

Point the app at it and sign in as `admin` / `change-me` (admin) or
`ops@acme.co.tz` / `cust-pass-1` (customer):

```bash
SPRING_API_URL=http://localhost:8080 npm run dev
```

---

## Configuration

All settings are server-side only; none reach the browser.

| Variable | Purpose |
| --- | --- |
| `SPRING_API_URL` | Base URL of the Spring Boot API, e.g. `http://192.168.0.56:8080`. |
| `AUTH_COOKIE_NAME` | Cookie holding the Basic credential. Default `isp_auth`. |
| `COOKIE_SECURE` | `true` behind HTTPS so auth cookies are marked `Secure`. |
| `API_TIMEOUT_MS` | Fail-fast timeout for backend calls. Default `6000`. |
| `CUSTOMER_POOL_IDS` | Pool ids offered to customers, e.g. `1,2,3` — see *Known constraints*. |

---

## How authentication works

The API uses **HTTP Basic on every request** — there is no token endpoint, so
the credential itself must be replayed. The design keeps it off the browser
entirely:

1. `POST /api/auth/login` (a route handler in this app) base64-encodes
   `username:password` and verifies it against the backend.
2. On success the credential is stored in an **httpOnly** cookie. Browser
   JavaScript can never read it. A second, non-secret cookie holds the display
   name and role for routing.
3. Client components call `/api/proxy/*`, which attaches the credential
   server-side and forwards to Spring.

Because the browser never calls Spring directly, **the backend needs no CORS
configuration**.

`src/middleware.ts` guards every route: signed-out visitors go to `/login` (the
intended destination is preserved in `?next=`), and each role is confined to its
own area.

> **Note on Basic auth:** the credential is long-lived by nature. It is httpOnly
> and `SameSite=Lax`, but a token endpoint with short-lived credentials would be
> a genuine improvement if the backend can offer one.

---

## Features

### Admin

- **Dashboard** — customer count, pending requests, and remaining capacity
  across all pools. Flags any pending request that its pool cannot cover.
- **Customers** — register with validated details; search by name, email, phone
  or district. When the API generates a password it is shown **once**, on a
  blocking hand-off panel with copy-to-clipboard, since it is unrecoverable.
- **Bandwidth pools** — funded totals in a compact table, one row per pool, with
  per-direction utilisation. "Adjust" expands inline; lowering a total below what
  is already allocated is blocked before the request is sent (mirroring the
  backend's 422).
- **Requests** — filter by status, raise a request on a customer's behalf, and
  approve or reject. **Approval is disabled whenever the request exceeds the
  pool's remaining capacity**, with the exact shortfall shown in both directions.
  Rejection requires a reason, as the API mandates.

### Customer

- **Overview** — allocated download/upload and pending requests.
- **My requests** — full history plus a request form with a live preview of
  whether the chosen pool can cover it.
- **My details** — the record the ISP registered.

### Validation

- **Phone** — Tanzanian mobile only: `0XXXXXXXXX`, `255XXXXXXXXX` or
  `+255XXXXXXXXX`, where the digit after the prefix is 6 or 7. Spaces, hyphens
  and parentheses are accepted on input; the value is sent as `+255…` and
  displayed as `0712 345 678`.
- **Location** — every region of Tanzania with its districts; the district list
  is filtered by the chosen region and a mismatch is rejected.
- **Errors** — the backend's RFC 9457 `ProblemDetail.detail` is surfaced
  verbatim, so a 422 reads "Pool 1 cannot cover request 10: needs 400/500 Mbps
  (up/down), remaining 100/100 Mbps" rather than a generic failure.

---

## Project layout

```
src/
  app/
    admin/              Dashboard, customers, bandwidth pools, requests
    customer/           Overview, requests, profile
    login/              Sign-in
    api/auth/login      Verifies credentials, sets the session cookie
    api/auth/logout     Clears it
    api/proxy/[...path] Forwards to Spring with Basic auth attached
  components/           Shared UI and form primitives
  lib/
    api.ts              Server-side API client (Basic auth, ProblemDetail)
    client-api.ts       Browser client, via the proxy
    bandwidth.ts        Capacity maths and the approval guard
    tz.ts               Tanzanian phone and location rules
    validation.ts       Zod schemas mirroring the API's field rules
    session.ts          Cookie handling
  middleware.ts         Route guarding by role
mock/mock-spring.mjs    Stand-in backend
tests/                  Vitest suite
```

---

## Testing

```bash
npm test              # 257 tests
npm run test:watch
npm run test:coverage
npm run typecheck
```

Vitest with Testing Library. The suite covers the capacity guard and its exact
shortfall arithmetic, the phone and location rules, every Zod schema, the API
client's Basic auth and error mapping, the login and proxy route handlers, the
middleware's role separation in both directions, and each form's behaviour
including the one-time password hand-off and the approve/reject flows.

One test is a deliberate regression guard: password managers autofill DOM inputs
without firing React's `onChange`, which previously left the controlled state
empty so the login form silently refused to submit. The test fails against the
old implementation and passes against the fix.

---

## Known constraints

**The pool list is admin-only.** Customers get a 403 from
`GET /api/bandwidth/pools`, so their request form cannot show real pools or
their free capacity. As a stopgap it offers the ids in `CUSTOMER_POOL_IDS` and
deliberately shows **no capacity figures** for them, rather than inventing
numbers. Allowing customers to read the pool list would remove the need for this
setting entirely.

**Customer records cannot be edited.** The API exposes no update endpoint, so
there is no edit screen.

**Filtering and joins are client-side.** Request status filtering and the
customer-name lookup on requests both work from full lists. That is fine at
hundreds of records; server-side filtering and pagination would be needed
beyond that.

---

## Troubleshooting

**"Cannot reach the API service (No response from … within 6000ms)"**
The backend is not reachable. It names the exact URL it tried. Check that Spring
is running, that it binds `0.0.0.0` rather than `127.0.0.1` if it is on another
machine, and that the port is open in the firewall. `curl -u user:pass -X POST
http://<host>:8080/api/auth/login` from this machine is the fastest check.

**Styling or fonts look wrong after pulling changes**
Restart `npm run dev`; changes to `next.config.ts` and `.env.local` are only read
at startup.
