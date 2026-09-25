# mattacena-core (WordPress plugin)

Backend for the staff app: logins, roles and the REST API described in [`docs/API.md`](../docs/API.md).

It works **on top of the existing Restaurant Reservations tables** (`wjj_nd_rst_booking`, `wjj_nd_booking_areas`, `wjj_nd_booking_tables`, `wjj_reserved_tables`), so bookings made with the website form appear in the app and changes made in the app appear in the old admin screens. The old plugin stays active for the public booking form until the new form replaces it.

What it adds:

- three tables: `mc_tokens` (app sessions, hashed), `mc_booking_meta` (booking source and discount), `mc_audit` (who changed what);
- three roles: Mattacena – Titolare, Responsabile di sala, Cameriere. WordPress administrators are treated as Titolare. Staff roles cannot open wp-admin;
- options `mc_week` (lunch and dinner hours), `mc_layout` (floor-plan positions), `mc_restaurant_id`.

It never alters or drops the legacy tables' structure.

## Install

Copy `mattacena-core/` to `wp-content/plugins/` and activate it. To allow other browser origins than `https://app.mattacena.com`, define `MC_ALLOWED_ORIGINS` in `wp-config.php`.
