# 🚀 FlowDesk — Agency Client Portal

A full-stack SaaS-style client portal built for performance marketing agencies.  
Manage clients, tasks, leads, social media, campaigns, and team workflows — all in one place with real-time updates and an AI assistant.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🔐 JWT Auth | Access + refresh token flow, bcrypt password hashing, rate-limited login |
| 👥 RBAC | 8 roles: Admin · Manager · Performance Marketer · Social Media Manager · Video Editor · Graphic Designer · Copywriter · Client |
| 🏢 Client Management | Full CRUD, services, contract/plan tracking, team assignment, portal access creation |
| 📋 Task System | Assign, prioritize, comment, status tracking, client-visible tasks, Kanban board |
| 📡 Real-Time Messaging | Socket.io 1:1 chat with typing indicators and unread counts |
| 📊 Reports | Manual metric entry: spend, revenue, ROAS, leads, conversions per channel |
| 📁 File Management | Upload/download, Cloudinary or local storage, categorized, client-accessible |
| 🔔 Notifications | In-app real-time notifications for messages, tasks, updates |
| 📈 Dashboards | Role-specific dashboards: Admin overview, Performance Marketer KPIs, Client portal |
| 📣 Social Media | Multi-account management, post scheduling, analytics, content calendar |
| 🎯 Client Leads | CSV import, batch management, lead status tracking, client-facing lead view |
| 🔁 Internal Leads | Agency's own sales pipeline with notes, activity log, follow-up tracking |
| 📅 Calendar | Per-client and team-wide calendar with event types and reminders |
| 📞 Call Tracker | Log and track client/prospect calls with outcomes and follow-up tasks |
| 🤖 AI Assistant | Groq-powered (LLaMA 3.3 70B) contextual assistant with streaming SSE, role-aware context |
| 💳 Payments | Payment verification workflow, renewal history, payment settings per client |
| 🔑 Credentials Manager | Securely store and share client platform credentials |
| 📄 Documents | Per-client document boards (SOPs, contracts, references) |
| 🎯 Client Targets | Monthly KPI target setting with visible/custom fields per client |
| 🗂️ Contacts | Agency-wide contact book (admin-only) |
| 🔍 Global Search | Cross-entity search: clients, tasks, leads, team members |
| 📜 Activity Log | Full audit trail of all entity changes (admin/manager) |
| 📡 API Logs | HTTP request logging with stats and admin viewer |
| 🌱 Seed Script | Full demo dataset: 7 team roles, 3 clients, tasks, leads, social posts, reports |

---

## 🧠 Tech Stack

**Frontend:** React 18 · Vite · Tailwind CSS · Radix UI · Recharts · Socket.io-client · Zustand · date-fns · lucide-react  
**Backend:** Node.js · Express.js · Socket.io · Multer · Nodemailer · Twilio  
**Database:** MongoDB (Mongoose)  
**Auth:** JWT (access + refresh tokens) · bcryptjs  
**AI:** Groq API (LLaMA 3.3 70B primary, LLaMA 3.1 8B fallback) via streaming SSE  
**Storage:** Local filesystem (default) or Cloudinary  
**Notifications:** Email (SMTP/Nodemailer) · WhatsApp (Twilio) · In-app real-time  

---

## 📁 Project Structure

```
flowdesk/
├── package.json                    # Root: concurrent dev scripts
│
├── server/                         # Express API
│   ├── config/
│   │   ├── database.js             # MongoDB connection
│   │   ├── socket.js               # Socket.io setup + JWT auth middleware
│   │   └── cloudinary.js           # Cloudinary storage config
│   ├── middleware/
│   │   ├── auth.js                 # JWT protect + authorize + RBAC (8 roles)
│   │   ├── error.js                # Global error handler + asyncHandler
│   │   ├── apiLogger.js            # HTTP request logging middleware
│   │   └── aiRateLimiter.js        # Per-user AI request rate limiter
│   ├── models/
│   │   ├── User.js                 # Users: roles, notifications, refresh tokens
│   │   ├── Client.js               # Clients: services, team, contract, portal
│   │   ├── Task.js                 # Tasks: comments, priority, client visibility
│   │   ├── Update.js               # Timeline updates with metrics
│   │   ├── Message.js              # Conversation + Message models
│   │   ├── File.js                 # File metadata (local or Cloudinary)
│   │   ├── Report.js               # Performance reports with channel breakdown
│   │   ├── Lead.js                 # Client leads with batch/source tracking
│   │   ├── InternalLead.js         # Agency's own sales pipeline leads
│   │   ├── SocialPost.js           # Social media posts + analytics
│   │   ├── CalendarEvent.js        # Calendar events (team + client portal)
│   │   ├── CallLog.js              # Call tracking records
│   │   ├── ActivityLog.js          # Audit trail for all entity changes
│   │   ├── ApiLog.js               # HTTP request log entries
│   │   ├── Credential.js           # Encrypted client credentials store
│   │   ├── Contact.js              # Agency-wide contact book
│   │   ├── ClientTarget.js         # Monthly KPI targets per client
│   │   ├── Document.js             # Per-client document boards
│   │   ├── Service.js              # Agency services catalogue
│   │   ├── PaymentSettings.js      # Client payment configuration
│   │   ├── PaymentVerification.js  # Payment verification records
│   │   └── RenewalHistory.js       # Client contract renewal history
│   ├── routes/
│   │   ├── auth.js                 # Login, refresh, me, profile, change-password
│   │   ├── users.js                # User CRUD + notifications
│   │   ├── clients.js              # Client CRUD + overview + GMB + stats
│   │   ├── tasks.js                # Task CRUD + comments + stats
│   │   ├── updates.js              # Update CRUD
│   │   ├── messages.js             # Conversations + paginated messages
│   │   ├── files.js                # Upload + download + delete (multipart)
│   │   ├── reports.js              # Report CRUD + channel summary
│   │   ├── notifications.js        # Read/clear notifications
│   │   ├── leads.js                # Client leads: import CSV, batch mgmt, stats
│   │   ├── internalLeads.js        # Internal pipeline: notes, activity, import
│   │   ├── social.js               # Social accounts, posts, analytics, calendar
│   │   ├── calendar.js             # Calendar events (team + client portal views)
│   │   ├── callLogs.js             # Call log CRUD
│   │   ├── dashboard.js            # Dashboard stats, team analytics, PM KPIs
│   │   ├── activity.js             # Activity log viewer + entity history
│   │   ├── search.js               # Global cross-entity search
│   │   ├── ai.js                   # AI chat (streaming SSE + non-streaming)
│   │   ├── credentials.js          # Credential store CRUD
│   │   ├── contacts.js             # Contact book CRUD (admin-only)
│   │   ├── targets.js              # Monthly client targets CRUD
│   │   ├── documents.js            # Document boards CRUD
│   │   ├── services.js             # Services catalogue CRUD
│   │   ├── payments.js             # Payment settings, verifications, renewals
│   │   ├── events.js               # SSE event stream + simulate endpoint
│   │   └── apiLogs.js              # API log viewer + stats + clear
│   ├── services/
│   │   ├── groqService.js          # Groq LLM: streaming SSE, fallback model, retry
│   │   └── aiContextBuilder.js     # Builds role-aware context for AI prompts
│   ├── utils/
│   │   ├── jwt.js                  # Token generation + verification
│   │   ├── notifications.js        # createNotification + notifyTeam helpers
│   │   ├── activityLog.js          # logActivity helper
│   │   └── messaging.js            # Email (Nodemailer) + WhatsApp (Twilio) utils
│   ├── index.js                    # App entry: middleware, routes, Socket.io
│   ├── seed.js                     # Full demo data seeder
│   ├── seedServices.js             # Agency services seeder
│   ├── backfill-contracts.js       # One-time contract data backfill script
│   ├── .env.example
│   └── package.json
│
└── client/                         # React + Vite SPA
    ├── src/
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── AdminLayout.jsx         # Collapsible sidebar for team
    │   │   │   ├── ClientLayout.jsx        # Sidebar for client portal
    │   │   │   └── AuthLayout.jsx          # Centered login layout
    │   │   ├── shared/
    │   │   │   ├── LoadingScreen.jsx       # Spinner, StatCard, Avatar, EmptyState
    │   │   │   ├── NotificationPanel.jsx   # Real-time notification drawer
    │   │   │   ├── GlobalSearch.jsx        # Global search modal (Cmd+K)
    │   │   │   └── SkeletonLoaders.jsx     # Loading skeleton components
    │   │   ├── ai/
    │   │   │   ├── AIAssistant.jsx         # Floating AI chat widget
    │   │   │   └── ExportButton.jsx        # Data export helper
    │   │   ├── contract/
    │   │   │   ├── ContractAlertsBanner.jsx    # Contract expiry alerts
    │   │   │   ├── ContractInfoSection.jsx     # Client contract display
    │   │   │   └── PaymentSettingsSection.jsx  # Payment config UI
    │   │   └── ui/
    │   │       └── index.jsx               # Button, Input, Select, Modal, Toast, Tabs, Badge...
    │   ├── context/
    │   │   ├── authStore.js                # Zustand auth store (user, token, logout)
    │   │   └── SocketContext.jsx           # Socket.io React context + hooks
    │   ├── lib/
    │   │   ├── api.js                      # Axios instance with JWT interceptors + refresh
    │   │   └── utils.js                    # formatDate, formatCurrency, getStatusColor...
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   └── LoginPage.jsx
    │   │   ├── admin/                      # Team/admin views
    │   │   │   ├── Dashboard.jsx                   # Admin overview + analytics
    │   │   │   ├── PerformanceMarketerDashboard.jsx # PM-specific KPI dashboard
    │   │   │   ├── ClientsPage.jsx                 # Client list + create
    │   │   │   ├── ClientDetailPage.jsx            # Full client workspace (tabs)
    │   │   │   ├── TasksPage.jsx                   # All tasks across clients
    │   │   │   ├── MyTasksPage.jsx                 # Logged-in user's own tasks
    │   │   │   ├── KanbanPage.jsx                  # Drag-and-drop task board
    │   │   │   ├── LeadsPage.jsx                   # Client leads management
    │   │   │   ├── InternalLeadsPage.jsx           # Internal sales pipeline
    │   │   │   ├── CallTrackerPage.jsx             # Call log tracker
    │   │   │   ├── TeamPage.jsx                    # Team member management
    │   │   │   ├── TeamMemberDetailPage.jsx        # Individual team member profile
    │   │   │   ├── CalendarPage.jsx                # Team-wide calendar
    │   │   │   ├── SocialPage.jsx                  # Social media management
    │   │   │   ├── UpdatesPage.jsx                 # Client updates feed
    │   │   │   ├── ReportsPage.jsx                 # Performance reports
    │   │   │   ├── FilesPage.jsx                   # File manager
    │   │   │   ├── CredentialsPage.jsx             # Credentials vault
    │   │   │   ├── ContactsPage.jsx                # Contact book
    │   │   │   ├── PaymentVerificationsPage.jsx    # Payment verification queue
    │   │   │   ├── ActivityPage.jsx                # Audit log viewer
    │   │   │   ├── ApiLogsPage.jsx                 # API request log viewer
    │   │   │   └── SettingsPage.jsx                # App + profile settings
    │   │   ├── client/                     # Client portal views
    │   │   │   ├── Dashboard.jsx           # Client overview
    │   │   │   ├── CalendarPage.jsx        # Client calendar
    │   │   │   ├── UpdatesPage.jsx         # Agency updates for client
    │   │   │   ├── FilesPage.jsx           # Client file access
    │   │   │   ├── ReportsPage.jsx         # Client reports view
    │   │   │   ├── RequestsPage.jsx        # Submit + track task requests
    │   │   │   ├── LeadsPage.jsx           # Client's own leads
    │   │   │   ├── SocialPage.jsx          # Social account overview
    │   │   │   ├── DocumentsPage.jsx       # Client documents
    │   │   │   ├── PaymentPage.jsx         # Payment verification + history
    │   │   │   └── ChatPage.jsx            # Direct messaging with agency
    │   │   ├── LandingPage.jsx
    │   │   └── NotFoundPage.jsx
    │   ├── App.jsx                         # Routes + role-based redirects
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json                         # SPA rewrite rules for Vercel
    └── package.json
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)
- Groq API key (free at [console.groq.com](https://console.groq.com)) — required for AI Assistant
- (Optional) Cloudinary account for cloud file storage
- (Optional) SMTP credentials for email notifications
- (Optional) Twilio account for WhatsApp notifications

---

### 1. Clone & install

```bash
git clone <your-repo-url>
cd flowdesk

# Install all dependencies (server + client) in one step
npm run install:all
```

---

### 2. Backend configuration

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/toflymedia

# Generate strong secrets (32+ chars)
JWT_ACCESS_SECRET=your_super_secret_access_key_here_32chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here_32chars
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

CLIENT_URL=http://localhost:5173

# ── AI Assistant (Groq) ───────────────────────────────────────────────────────
# Get a free key at https://console.groq.com
GROQ_API_KEY=gsk_your_groq_api_key_here

# ── File Storage ──────────────────────────────────────────────────────────────
# 'local' saves to server/uploads/  |  'cloudinary' uses Cloudinary
FILE_STORAGE=local
LOCAL_UPLOAD_PATH=uploads/

# Only needed if FILE_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── Email (SMTP) — optional ───────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="FlowDesk <your_email@gmail.com>"

# ── WhatsApp (Twilio) — optional ──────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Seed demo data:**
```bash
npm run seed          # from project root
# or
cd server && node seed.js
```

**Start server:**
```bash
npm run dev:server    # development (nodemon)
npm start             # production
```

---

### 3. Frontend setup

```bash
cd client
npm install           # (or use npm run install:all from root)
npm run dev
```

**Build for production:**
```bash
npm run build
```

---

### 4. Run both together (from root)

```bash
npm run dev           # starts server + client concurrently
```

Open: `http://localhost:5173`

---

## 🔐 Demo Login Credentials

After running `npm run seed`:

| Role | Email | Password |
|---|---|---|
| 👑 Admin | admin@toflymedia.com | Admin123! |
| 📊 Manager | manager@toflymedia.com | Manager123! |
| 📈 Performance Marketer | marketer@toflymedia.com | Marketer123! |
| 📱 Social Media Manager | social@toflymedia.com | Social123! |
| 🎬 Video Editor | editor@toflymedia.com | Editor123! |
| 🎨 Graphic Designer | designer@toflymedia.com | Designer123! |
| ✍️ Copywriter | copy@toflymedia.com | Copy123! |
| 🏢 Client (TechNova) | client@toflymedia.com | Client123! |
| 🏢 Client (Bloom & Co) | diana.client@toflymedia.com | Client123! |
| 🏢 Client (Foster Realty) | ryan.client@toflymedia.com | Client123! |

---

## 🛣️ API Reference

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | Public | Login, returns access + refresh tokens |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/logout` | User | Invalidate refresh token |
| GET | `/me` | User | Get current user + unread counts |
| PUT | `/profile` | User | Update name, avatar, preferences |
| PUT | `/change-password` | User | Change password |

### Users — `/api/users`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin/Manager | List team members |
| POST | `/` | Admin | Create team member |
| GET | `/:id` | Admin/Manager | Get user profile |
| PUT | `/:id` | Admin | Update user |
| DELETE | `/:id` | Admin | Delete user |
| GET | `/:id/notifications` | User | Get notifications |
| PUT | `/:id/notifications/read` | User | Mark notifications read |

### Clients — `/api/clients`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List clients (role-scoped) |
| POST | `/` | Admin/Manager | Create client |
| GET | `/stats/overview` | Admin/Manager | Dashboard KPI stats |
| GET | `/:id` | Role-checked | Get client details |
| PUT | `/:id` | Admin/Manager | Update client |
| DELETE | `/:id` | Admin | Delete client |
| GET | `/:id/overview` | Role-checked | Full overview with task stats |
| GET | `/:id/gmb` | Role-checked | GMB panel data |
| PUT | `/:id/gmb` | Admin/Manager | Update GMB data |

### Tasks — `/api/tasks`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List tasks (`?clientId=`, `?status=`, `?priority=`, `?assignedTo=`) |
| POST | `/` | Team | Create task |
| PUT | `/:id` | Team | Update task (team: status only; managers: full) |
| DELETE | `/:id` | Admin/Manager | Delete task |
| POST | `/:id/comments` | Team | Add comment |
| GET | `/stats` | Admin/Manager | Aggregate task stats |
| GET | `/my-requests` | Client | Client's own submitted requests |
| POST | `/my-requests` | Client | Submit a new client request |

### Updates — `/api/updates`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Any | List updates (`?clientId=`) |
| POST | `/` | Team | Create update |
| PUT | `/:id` | Team | Edit update |
| DELETE | `/:id` | Admin/Manager | Delete update |

### Messages — `/api/messages`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/conversations` | List all conversations |
| GET | `/conversations/:clientId` | Get or create conversation for client |
| GET | `/:conversationId` | Get messages (paginated) |
| POST | `/:conversationId` | Send a message |
| DELETE | `/message/:messageId` | Delete a message |

**Socket.io events:**
- `join:conversation` / `leave:conversation` — join/leave a room
- `typing:start` / `typing:stop` — typing indicators
- `message:new` — emitted to room when a new message arrives
- `notification` — emitted to user's personal room

### Files — `/api/files`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Role-filtered | List files (`?clientId=`, `?category=`) |
| POST | `/upload` | Team | Upload file (multipart/form-data) |
| GET | `/:id` | Role-checked | Get file metadata |
| PUT | `/:id` | Team | Update file metadata |
| DELETE | `/:id` | Admin/Manager | Delete file |

### Reports — `/api/reports`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Role-filtered | List reports (`?clientId=`, `?month=`) |
| POST | `/` | Team | Create report |
| GET | `/:id` | Role-checked | Get report |
| PUT | `/:id` | Team | Update report |
| DELETE | `/:id` | Admin/Manager | Delete report |
| GET | `/client/:clientId/summary` | Role-checked | Aggregate channel summary |

### Leads — `/api/leads`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List leads (`?clientId=`, `?batchId=`, `?status=`) |
| POST | `/upload` | Admin/Manager | Import leads from CSV |
| GET | `/batches` | Team | List import batches |
| GET | `/stats` | Team | Lead stats by status/source |
| PUT | `/:id` | Admin/Manager | Update lead |
| DELETE | `/batch/:batchId` | Admin/Manager | Delete entire batch |
| PATCH | `/:id/client-update` | Client | Client updates lead status |
| PATCH | `/:id/dispute` | Admin/Manager | Flag lead as disputed |

### Internal Leads — `/api/internal-leads`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List internal leads |
| POST | `/` | Team | Create internal lead |
| GET | `/stats` | Team | Pipeline stats |
| GET | `/follow-ups-today` | Team | Today's follow-up list |
| GET | `/:id` | Team | Get lead detail |
| PUT | `/:id` | Team | Update lead |
| DELETE | `/:id` | Team | Delete lead |
| POST | `/:id/notes` | Team | Add note |
| DELETE | `/:id/notes/:noteId` | Team | Delete note |
| POST | `/:id/activity` | Team | Log activity |
| POST | `/import` | Team | Bulk CSV import |

### Social — `/api/social`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/accounts` | Team | List social accounts |
| POST | `/accounts` | Admin/Manager | Connect social account |
| PUT | `/accounts/:id` | Admin/Manager | Update account |
| DELETE | `/accounts/:id` | Admin/Manager | Remove account |
| GET | `/posts` | Team | List posts (`?clientId=`, `?status=`) |
| POST | `/posts` | Team | Create/schedule post |
| GET | `/posts/:id` | Team | Get post |
| PUT | `/posts/:id` | Team | Update post |
| DELETE | `/posts/:id` | Admin/Manager | Delete post |
| GET | `/analytics` | Team | Get analytics (`?clientId=`, `?days=`) |
| GET | `/calendar` | Team | Posts calendar view |

### Calendar — `/api/calendar`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List events (team view) |
| GET | `/clients` | Team | Get client list for filter |
| POST | `/` | Team | Create event |
| PUT | `/:id` | Team | Update event |
| DELETE | `/:id` | Team | Delete event |
| GET | `/client-portal` | Client | Client's portal calendar |

### Call Logs — `/api/call-logs`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List call logs (`?clientId=`) |
| POST | `/` | Team | Create call log |
| GET | `/:id` | Team | Get call log |
| PUT | `/:id` | Team | Update call log |
| DELETE | `/:id` | Admin/Manager | Delete call log |

### AI Assistant — `/api/ai`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/chat/stream` | Team | Streaming SSE chat (primary) |
| POST | `/chat` | Team | Non-streaming chat |
| GET | `/settings` | Admin | Get AI config |

### Dashboard — `/api/dashboard`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Admin/Manager | Overview KPIs |
| GET | `/team` | Admin/Manager | Team workload stats |
| GET | `/analytics/tasks` | Admin/Manager | Task trend analytics |
| GET | `/analytics/leads` | Admin/Manager | Lead funnel analytics |
| GET | `/analytics/productivity` | Admin/Manager | Team productivity |
| GET | `/pm/kpis` | Admin/PM | Performance marketer KPIs |
| GET | `/pm/activity-stats` | Admin/PM | PM activity breakdown |

### Credentials — `/api/credentials`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Role-filtered | List credentials (`?clientId=`) |
| POST | `/` | Admin/Manager/Client | Store credential |
| PUT | `/:id` | Admin/Manager/Client | Update credential |
| DELETE | `/:id` | Admin | Delete credential |

### Contacts — `/api/contacts`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin | List contacts |
| POST | `/` | Admin | Create contact |
| PUT | `/:id` | Admin | Update contact |
| DELETE | `/:id` | Admin | Delete contact |

### Targets — `/api/targets`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | Get targets (`?client=`, `?month=`) |
| GET | `/months` | Team | List months with targets |
| PUT | `/` | Admin/Manager | Upsert targets |
| DELETE | `/` | Admin | Delete targets |

### Documents — `/api/documents`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Role-filtered | List documents (`?client=`) |
| GET | `/:id` | Role-checked | Get document |
| POST | `/` | Admin/Manager | Create document board |
| PUT | `/:id` | Team | Update document |
| DELETE | `/:id` | Admin/Manager | Delete document |

### Payments — `/api/payments`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/settings` | Any | Get payment settings |
| PUT | `/settings` | Admin | Update payment settings |
| GET | `/verifications` | Admin/Manager | List verifications |
| POST | `/verifications` | Client | Submit payment verification |
| PUT | `/verifications/:id` | Admin/Manager | Approve/reject verification |
| GET | `/renewals` | Admin/Manager | List renewal history |
| POST | `/renewals` | Admin/Manager | Add renewal record |

### Activity — `/api/activity`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin/Manager | Full activity log (paginated, filterable) |
| GET | `/entity/:type/:id` | Admin/Manager | Activity for specific entity |

### Search — `/api/search`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | Global search (`?q=`) across clients, tasks, leads, users |

### API Logs — `/api/logs`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin | List API logs (paginated) |
| GET | `/stats` | Admin | Request stats by route/method |
| DELETE | `/` | Admin | Clear all logs |

### Services — `/api/services`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Team | List services catalogue |
| POST | `/` | Admin/Manager | Create service |
| PUT | `/:id` | Admin/Manager | Update service |
| DELETE | `/:id` | Admin | Delete service |

### Events (SSE) — `/api/events`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin/Manager | Subscribe to server-sent events stream |
| GET | `/types` | Any | List event type definitions |
| POST | `/simulate` | Admin | Simulate an event (dev/testing) |

---

## 🔒 RBAC Matrix

| Feature | Admin | Manager | Perf. Marketer | Social Mgr | Video Editor | Designer | Copywriter | Client |
|---|---|---|---|---|---|---|---|---|
| All clients | ✅ | ✅ | Own | Own | Own | Own | Own | Own |
| Create/delete clients | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tasks (full CRUD) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Requests only |
| Kanban board | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Internal leads | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Client leads | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | View own |
| Social management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | View own |
| Reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | View own |
| Files | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | View own |
| Credentials | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | View own |
| Team management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Contacts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| API logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Activity log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PM Dashboard | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Assistant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Payment verification | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Submit |

---

## 🤖 AI Assistant

The AI Assistant uses **Groq** (free API) with LLaMA 3.3 70B as the primary model and LLaMA 3.1 8B as an automatic fallback on rate-limit.

**How it works:**
- Context is always built **server-side** in `aiContextBuilder.js` — the frontend never controls what data the AI sees
- Each user gets a role-aware context: admins see full workspace data, team members see their assigned work, clients see only their own data
- Responses stream via **Server-Sent Events** (SSE) for real-time typing effect
- A per-user rate limiter (`aiRateLimiter.js`) prevents abuse
- Keep-alive pings every 5s prevent proxy timeouts on long responses

**Setup:** Add `GROQ_API_KEY=gsk_...` to your `.env`. Without it, the AI feature is disabled but everything else works normally.

---

## 🚀 Production Deployment

### Environment variables for production

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/toflymedia
JWT_ACCESS_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
GROQ_API_KEY=gsk_your_key
FILE_STORAGE=cloudinary
CLIENT_URL=https://your-domain.com
```

### Serve frontend from Express

Add to `server/index.js` for single-server deploys:
```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
```

### Deploy frontend to Vercel

The `client/vercel.json` already includes the SPA rewrite rule. Just point Vercel at the `client/` directory.

### Docker (server only)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
```

---

## 🐛 Known Fixes

| Issue | File | Fix |
|---|---|---|
| Tasks tab on client detail page showed all clients' tasks | `server/routes/tasks.js` | Backend now accepts both `?client=` and `?clientId=` query params (frontend sends `clientId`, backend was only reading `client`) |

---

## 🛠️ Extending the System

- **Email notifications** — already wired via Nodemailer in `utils/messaging.js`; add SMTP env vars to enable
- **WhatsApp notifications** — already wired via Twilio in `utils/messaging.js`; add Twilio env vars to enable
- **Stripe billing** — add subscription fields to Client model, create `/api/billing` routes
- **White-labeling** — add `brandColor`, `logo`, `customDomain` to Client model
- **2FA** — add TOTP to User model using `speakeasy`
- **Zapier/webhooks** — add webhook URLs to Client model, fire in route handlers on key events
- **Mobile app** — REST API + Socket.io are fully decoupled; point any mobile client at the same backend

---

## 📄 License

MIT — build on it, extend it, white-label it.