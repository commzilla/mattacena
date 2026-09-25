# Mattacena API

REST API exposed by the WordPress plugin (`wp-plugin/mattacena-core`) and consumed by the staff app at `app.mattacena.com`.

Base URL: `https://mattacena.com/wp-json/mattacena/v1`

The app's client is `app/src/api/wp.ts`; the demo implementation with the same behaviour is `app/src/api/mock.ts`.

## Rules for every endpoint

- **CORS:** only `https://app.mattacena.com` (plus `http://localhost:5174` in development) may call the API.
- **Auth:** `X-MC-Token: <token>` header (`Authorization: Bearer` is also accepted, but SiteGround's Apache may strip it). Tokens are issued by `/auth/login`, stored hashed in the database, and expire after 30 days of inactivity. `/auth/logout` revokes the token.
- **Roles:** checked server-side on every request, never trusted from the client.

  | Role | Can |
  |---|---|
  | `titolare` | everything |
  | `responsabile` | bookings, floor plan in service mode, calendar, fidelity members |
  | `cameriere` | read today's bookings and floor plan; set status (arrivata, no-show); assign tables |

- **Caching:** responses send `Cache-Control: no-store`, and the SiteGround cache (SG Optimizer) excludes `/wp-json/mattacena/*`.
- **Errors:** JSON `{ "code": "…", "message": "…" }` with a human-readable Italian `message` the app shows as-is. `401` means the session has expired and the app goes back to the login screen.
- **Rate limit:** `/auth/login` allows 5 failed attempts per email per 15 minutes.

## Endpoints

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/me` | — | `User` |
| GET | `/bootstrap` | — | `{ areas, tables, settings }` |
| GET | `/bookings` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (max 120 days) | `Booking[]` |
| POST | `/bookings` | `BookingInput` | `Booking` |
| PATCH | `/bookings/{id}` | partial `BookingInput` | `Booking` |
| POST | `/bookings/{id}/status` | `{ status }` | `Booking` (also awards fidelity points on `arrivata`) |
| DELETE | `/bookings/{id}` | — | `204` (not allowed for `cameriere`) |

Still to be specified as the screens are ported: floor-plan editing (`/areas`, `/tables`), settings (`/settings`), fidelity (`/fidelity/...`) and the public endpoints used by the customer booking form.

## Shapes

The TypeScript definitions in `app/src/domain/types.ts` are the contract: `User`, `Area`, `Table`, `Booking`, `BookingInput`, `Settings`.

Dates are `YYYY-MM-DD` and times are `HH:MM`, both in the restaurant's local time (Europe/Rome).

## Migration from the current plugin

Existing data comes from the `nd-restaurant-reservations` tables:

| Current | New |
|---|---|
| `wjj_nd_rst_booking` | bookings |
| `wjj_nd_booking_areas` | areas |
| `wjj_nd_booking_tables`, `wjj_reserved_tables` | tables and booking–table assignments |
| `nd_rst_*` options, `nd_booking_discounts_settings` | settings |
