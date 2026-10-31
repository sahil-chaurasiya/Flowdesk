# Verification Report

Everything below was **actually executed** in the build sandbox (Node 22, MongoDB 8.3 `mongod` from conda-forge on `127.0.0.1`, headless Chromium). Test databases are named `flowdesk_test`, `attendance_test`, `accountant_test`; the harness refuses any other name before dropping anything. **No real or production database was touched** – none was available.

## Results

| Check | Command | Result |
|---|---|---|
| Backend automated tests | `npm test --prefix server` | **24 / 24 pass** |
| Frontend production build | `npm run build --prefix client` (`vite build`) | **success**, 2758 modules; Attendance and Finance emitted as separate lazy chunks |
| Finance TypeScript type-check | `tsc --noEmit --strict` over `client/src/modules/finance` | **0 errors** |
| Browser smoke test (production build + real API + real DBs) | `server/tests/ui/ui_smoke.py` (Playwright) | **35 / 35 checks pass** (heading-case false negatives in the first run were a test-script issue and were re-verified case-insensitively) |
| Syntax check of merged service worker | `node --check client/public/sw.js` | ok |

### What the 24 backend tests cover
*Unit (4)*: credential scrubbing; "same database" detection; models bound to their own connection and **not** to the default one; original collection names preserved; role defaults are least-privilege / env-overridable / `client` never grantable.

*Multi-database end-to-end (14)*, booting the real `index.js` as a child process:
* Flowdesk health + login contract unchanged
* unauthenticated → 401 on every module endpoint; a token signed with another app's secret → 401
* **pre-existing records in the attendance DB survive boot** (the retention delete does not run)
* attendance: e-mail-matched employee works; **server-side geofence** rejects a far check-in and accepts an in-radius one; the record lands in the attendance DB and in **no other** database
* identity: unlinked user → 403; non-admin cannot manage links; differing e-mails need confirmation (409); duplicate claims refused; explicit link grants access; an explicit claim removes automatic e-mail access for the original holder
* admin without attendance profile can use admin screens but cannot check in
* finance: admin-only default matrix on read **and** write; CRUD lands only in the accountant DB, **Flowdesk's `clients` collection stays empty**; dashboard math (revenue 12 000 − expenses 3 000 = 9 000); finance request bodies are redacted in Flowdesk's `apilogs`
* overview aggregates two databases independently and respects permissions
* `/api/modules/status` admin-only, no connection strings
* **missing `ACCOUNTANT_MONGODB_URI`** → 503 + variable name, Flowdesk and attendance keep working, name (not value) printed
* module URI equal to Flowdesk's → refused
* **unreachable module DB** (with a password in the URI) → 503 for that module only; password never appears in logs or responses; `STRICT_MODULE_DBS=true` exits with code 1

*Attendance workflows (6)*: leave request/overlap/approval (writes `on_leave` to the attendance DB, employee cannot approve); WFH request/approval and WFH-permitted remote check-in; regularization request/approval creating the corrected record; holidays (admin writes, all read); employee creation lands only in the attendance DB; admin records, monthly report and **Excel export** (ExcelJS under Mongoose 8).

### What the browser test covers
Login as admin and as an employee on the **production build**; overview widgets showing real figures from two DBs; sidebar sections and role-based items; every finance page and every attendance admin page renders without crashing; **hard refresh on deep links** (`/admin/finance/clients`, `/admin/attendance/manage`); finance data from the accountant DB shown in the UI; employee blocked from finance UI and API (403), redirected from attendance admin, and sees no finance widget. Screenshots were inspected in light and dark themes; one real visual defect (invisible clock digits from hard-coded dark panels) was found and fixed.

## NOT verified – please test in your environment
* **Your real databases / Atlas** and real data volumes. Only synthetic data shaped like the originals was used. Do a first run against a **copy** of production.
* Mongoose 7 → 8 for attendance: exercised paths pass; **less common paths** (e.g. every report filter, every admin filter combination, `getEmployeeLeaveSummary`, employee history pagination) were not individually driven.
* **Web-push** delivery and the 8-hour reminder cron: no VAPID keys / push-capable browser in the sandbox. Push *disabled* behaviour was confirmed to be quiet; delivery was not.
* Real **GPS** in browsers (the server geofence was tested with coordinates; the browser geolocation hook was not).
* Flowdesk's original features beyond login/health/dashboard/Team-attendance code path (Socket.IO, Groq assistant, Twilio/SMTP/Cloudinary, uploads, uptime monitor) were **not regression-tested**; their code is untouched, and the server boots with them unconfigured.
* Invoice PDF download (needs internet access to cdnjs); the other finance pages were rendered, but create/edit forms were exercised via API for clients/payments/expenses only – not every form (salary payment, EMI, freelancer jobs, accounting upsert) through the UI.
* Mobile/responsive layouts and the Flowdesk colour themes other than light and dark.
* Windows/Mac behaviour, and `STRICT_MODULE_DBS` / CORS behaviour behind your real proxy.
* No performance/load testing; `/api/overview/summary` runs the accountant dashboard query set (including its per-client loop) each time the dashboard opens.
