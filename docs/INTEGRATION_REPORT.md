# Integration & Data-Preservation Report

Unified Flowdesk = **Flowdesk** (foundation) + **Attendance app** + **To Fly Accountant**, in one backend and one front-end, with **three independent MongoDB databases**.

## 1. Was any database migration performed?

**No.** No data was moved, merged, rewritten, dropped or reset. The three original databases are used in place, with their original collection names, ids, indexes and documents.

The only schema addition is one **new, empty, additive collection** in the Flowdesk database, `identitylinks` (explicit Flowdesk-user ↔ attendance-user links). Mongoose creates it lazily on the first link; nothing existing is altered.

## 2. Architecture

```
Browser (React/Vite, Flowdesk shell)
   │  one login (Flowdesk JWT + refresh)            lazy-loaded: /admin/attendance/*, /admin/finance/*
   ▼
Express (one process, one port)                      server/index.js
   ├─ /api/<all original Flowdesk routes>            unchanged
   ├─ /api/attendance/*   → modules/attendance       models bound to ATTENDANCE connection
   ├─ /api/finance/*      → modules/finance          models bound to ACCOUNTANT connection
   ├─ /api/modules/access|status                     capability map (UI) / DB health (admin)
   ├─ /api/identity/attendance/*                     reconciliation (admin)
   └─ /api/overview/summary                          cross-DB dashboard widgets
        │                       │                          │
   default mongoose         conn "attendance"         conn "finance"
   MONGODB_URI              ATTENDANCE_MONGODB_URI    ACCOUNTANT_MONGODB_URI
   (Flowdesk DB)            (Attendance DB)           (Accountant DB)
```

### Database connection map

| Module | Env var | Source of the name | Connection object | Models |
|---|---|---|---|---|
| Flowdesk | `MONGODB_URI` | **unchanged** | Mongoose default (`config/database.js`, untouched logic) | all original Flowdesk models + `IdentityLink` |
| Attendance | `ATTENDANCE_MONGODB_URI` | already used by Flowdesk (`routes/users.js`) and the accountant (`attendanceClient.js`) | `config/connections.js` → `attendance` | User, Attendance, Holiday, LeaveRequest, WFHRequest, RegularizationRequest, PushSubscription |
| Revenue & Finance | `ACCOUNTANT_MONGODB_URI` | new (the accountant used `MONGODB_URI`) | `config/connections.js` → `finance` | Client, Payment, Employee, SalaryPayment, Expense, Loan, EMIPayment, MonthlyAccounting, Invoice, Service, CompanySettings, Freelancer, FreelancerJob, FreelancerPayment |

All three standalone apps used the same name, `MONGODB_URI`, so it could not be reused for the modules. Flowdesk keeps it with its original meaning.

### Safeguards (all covered by automated tests)
* Module models are registered **only** on their own connection (`conn.model`), never on the default one. Same-named models (`Client`, `Service`, `User`) therefore never collide; collection names are exactly those the standalone apps produced.
* Missing variable ⇒ module disabled, API answers **503 naming the variable**; background jobs don't start. **No fallback** to any other database.
* A module URI that resolves to the same host+database as Flowdesk or another module is **refused** (they would share `users` / `clients` collections).
* Unreachable module DB ⇒ 503 for that module only, retried every 30 s; Flowdesk and other modules keep working. `STRICT_MODULE_DBS=true` makes the process exit instead.
* Connection strings and credentials are never logged or returned; error text is scrubbed. Startup reports missing variable **names** only.
* Graceful shutdown (SIGINT/SIGTERM) closes all connections.
* Cron jobs register once, only after the attendance DB is connected.

## 3. Authentication & identity

* **Flowdesk is the only login.** Attendance and accountant logins (`/auth/login`, accountant `Admin`, their `JWT_SECRET`s) are not used; tokens from another app are rejected (tested).
* No passwords or hashes are copied between databases; no secrets changed.
* **Attendance identity**: Flowdesk user → attendance user by (1) an explicit admin-approved `IdentityLink`, else (2) an **exact e-mail match** (the rule both original apps already used), only if unique and not explicitly claimed by someone else. Never by name or ObjectId equality. `IDENTITY_EMAIL_FALLBACK=false` requires explicit links only.
* **Reconciliation UI**: *Settings & Administration → Identity Links* lists every Flowdesk account, how it resolves, and attendance profiles matching no one; admins create/remove links; differing e-mails need explicit confirmation.
* Unlinked users get a clear 403 (`ATTENDANCE_PROFILE_NOT_LINKED`) – historical attendance data stays untouched and reachable once linked.
* **Finance** has no per-user identity (the accountant app was a single-admin app); access is by Flowdesk role only. Finance employees ↔ attendance continue to match by e-mail, read-only, exactly as the accountant did.
* Not implemented: Flowdesk **Client** ↔ accountant **Client** linking (different entities; no safe automatic rule). The `IdentityLink` model is the extension point.

## 4. Roles & permissions (enforced on the backend)

| Capability | Default roles | Override env var |
|---|---|---|
| Use attendance (check in/out, leave, WFH, history) | all internal roles with a linked profile | `ATTENDANCE_ACCESS_ROLES` |
| Administer attendance (employees, records, reports, approvals, holidays) | `admin` | `ATTENDANCE_ADMIN_ROLES` |
| **View** finance (GET) | `admin` | `FINANCE_VIEW_ROLES` |
| **Modify** finance (POST/PUT/PATCH/DELETE) | `admin` | `FINANCE_WRITE_ROLES` |
| Manage identity links | `admin` | `IDENTITY_ADMIN_ROLES` |

`client` can never be granted these. Finance view and write are independent. Hiding menu items is cosmetic; every endpoint enforces the rule. Existing Flowdesk roles/permissions are unchanged.

## 5. Features preserved

**Flowdesk** – every route, page, role rule, Socket.IO, Groq assistant, uptime monitor, cron-like timers, uploads, notifications: code untouched except the 13 files listed in §7.

**Attendance** – check-in/out with **server-side haversine geofence**, WFH requests/approvals (WFH check-in), late/present status (IST rules), history/stats, leave requests & approvals (writes `on_leave` records), regularization requests & approvals, holidays, employee management, admin dashboard, records, monthly report, Excel export, web-push + 8-hour checkout reminder cron, push subscription endpoints, no-cache headers.

**Accountant** – clients (pause/resume/complete/reactivate/month values/reorder), payments/collections, invoices (stable numbering + PDF generation), employees & salaries (hikes history, proration, attendance-based deductions), freelancers (jobs/payments), expenses, EMI/loans, monthly accounting, dashboard, reports, services, company settings. Controllers and calculations are byte-for-byte the originals; only model binding and the auth guard changed.

## 6. Deliberate compatibility changes (please review)

| # | Change | Why |
|---|---|---|
| 1 | Attendance **login endpoint dropped**; `/auth/me`, `/profile`, `/change-password` kept | single sign-on via Flowdesk; attendance tokens would be meaningless |
| 2 | Attendance routes live under `/api/attendance/*` (`/admin`, `/wfh`, `/leave`, `/regularization`, `/holidays`, `/notifications`, `/users`, `/auth`) | several original paths collide with Flowdesk's `/api/auth`, `/users`, `/notifications` |
| 3 | Finance routes live under `/api/finance/*`; accountant `/auth/*` and `Admin` login removed; Settings → "Profile" tab removed | same reason; that tab edited the accountant's own login |
| 4 | **Attendance startup cleanup** (`deleteMany` of records before 2026-04-01 on every boot) is **OFF by default** (`ATTENDANCE_RETENTION_CLEANUP=true` re-enables) | automatic deletes against production data on each boot violate the no-destructive-operations rule |
| 5 | Render **keep-alive self-ping** off by default (`ATTENDANCE_KEEPALIVE_PING=true` + `BACKEND_URL`) | irrelevant to the unified server; the hard-coded onrender.com URL was removed |
| 6 | `GET /api/attendance/users` (list of all employees) is now **admin-only** | only the admin UI used it; employees could previously enumerate colleagues' e-mails |
| 7 | Attendance admin rights come from the **Flowdesk role**, not the attendance DB role | role values in another database are not trusted for authorization |
| 8 | `apiLogger` redacts request bodies for `/api/finance/*` | prevents copying financial data into Flowdesk's `apilogs` collection |
| 9 | `routes/users.js` (Flowdesk Team page) reuses the shared attendance connection when `ATTENDANCE_MONGODB_URI` is set; the **old guessed-URI behaviour is retained when it isn't** | backward compatible; no deployment needs new config |
| 10 | Service worker merged (push handlers appended; caching logic untouched); push deep links → `/admin/attendance` | one SW per scope |
| 11 | Seed scripts **not shipped**: accountant `seed.js` runs `deleteMany({})` on Admin/Client/Payment; attendance `seed.js` creates demo users; accountant `backfillPaidUntilMay2026.js` was a one-off data mutation | hazardous against real data; originals remain in your source ZIPs |
| 12 | Attendance "update notice" modal and standalone login/layouts not ported; `controllers/cronController.js` + `routes/cron.js` omitted | replaced by Flowdesk shell/login; the cron files were an unmounted duplicate of `cronJobs.js` behind an empty router |
| 13 | Admin without an attendance profile can administer but approvals leave `approvedBy/reviewedBy/createdBy` null (fields are optional); employee actions need a real profile | no synthetic records are ever written |
| 14 | Navigation regrouped into the requested sections (Overview, Clients & Team, Tasks & Projects, Attendance, Revenue & Finance, Reports & Analytics, Settings & Administration); **every existing item kept** | requested |
| 15 | Attendance's mongoose 7 → Flowdesk's mongoose 8 | single dependency; exercised paths pass (see verification) |

## 7. Original Flowdesk files modified (13) – all additive

`server/index.js` (mount modules, config report, connect module DBs, CORS extras) · `server/config/database.js` (shutdown closes all connections) · `server/middleware/apiLogger.js` (finance redaction) · `server/routes/users.js` (shared attendance connection) · `server/package.json` · `server/.env.example` · `client/src/App.jsx` · `client/src/components/layout/AdminLayout.jsx` · `client/src/pages/admin/Dashboard.jsx` (one widget) · `client/tailwind.config.js` (`attbrand`, `card`, `popover` tokens – none were used elsewhere) · `client/public/sw.js` · `client/package.json` · root `package.json`.

## 8. Limitations / manual steps

1. Set `ATTENDANCE_MONGODB_URI` and `ACCOUNTANT_MONGODB_URI` in your host (same strings the standalone apps used). Until then those modules show a "not configured" screen.
2. Reuse the attendance app's **VAPID keys** so existing browser push subscriptions keep working.
3. Open **Identity Links** once after first deploy and resolve any unmatched accounts.
4. Finance is **admin-only by default**; widen with `FINANCE_VIEW_ROLES` / `FINANCE_WRITE_ROLES` if desired.
5. The standalone apps can keep running against the same databases during transition. Be aware both would then run attendance cron/reminders (duplicate pushes) – stop the old attendance backend when you cut over.
6. Existing deployments' JWT_ACCESS_SECRET fallback (`'access_secret'`) in Flowdesk's `utils/jwt.js` is pre-existing and was not changed; set real secrets.
7. Invoice PDF generation loads jsPDF from cdnjs at runtime (pre-existing accountant behaviour).
8. The integrated screens are themed onto Flowdesk tokens by scoped adapter CSS; Flowdesk-native redesign of individual attendance/finance pages was not done (they were adapted, not rewritten).
