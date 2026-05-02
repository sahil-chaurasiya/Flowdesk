# 🚀 To Fly Media — Client Portal System

A full-stack SaaS-style client portal for performance marketing agencies.  
Clients log in to track campaigns, view reports, chat with their team, and submit requests — all in real-time.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🔐 JWT Auth | Access + refresh token flow, bcrypt password hashing |
| 👥 RBAC | Admin · Manager · Team Member · Client roles |
| 🏢 Client Management | Full CRUD, services, plan, budget, portal user creation |
| 📋 Task System | Assign, prioritize, status tracking, client-visible tasks |
| 📡 Real-Time Chat | Socket.io 1:1 messaging with typing indicators |
| 📊 Reports | Manual metric entry: spend, revenue, ROAS, leads, conversions |
| 📁 File Uploads | Local or Cloudinary, categorized, client-accessible |
| 🔔 Notifications | In-app real-time notifications on new messages/updates/tasks |
| 📈 Dashboards | Admin overview + client-specific portal |
| 🌱 Seed Script | Demo data with 5 users, 3 clients, tasks, messages, reports |

---

## 🧠 Tech Stack

**Frontend:** React 18 · Vite · Tailwind CSS · ShadCN/Radix · Recharts · Socket.io-client · Zustand  
**Backend:** Node.js · Express.js · Socket.io  
**Database:** MongoDB (Mongoose)  
**Auth:** JWT (access + refresh tokens) · bcryptjs  
**Storage:** Local filesystem (default) or Cloudinary  

---

## 📁 Project Structure

```
toflymedia/
├── server/                     # Express API
│   ├── config/
│   │   ├── database.js         # MongoDB connection
│   │   ├── socket.js           # Socket.io setup + auth middleware
│   │   └── cloudinary.js       # File storage config
│   ├── middleware/
│   │   ├── auth.js             # JWT protect + authorize + RBAC
│   │   └── error.js            # Global error handler + asyncHandler
│   ├── models/
│   │   ├── User.js             # User with roles, notifications, refresh tokens
│   │   ├── Client.js           # Client with services, team, portal access
│   │   ├── Task.js             # Tasks with comments, client visibility
│   │   ├── Update.js           # Timeline updates with metrics
│   │   ├── Message.js          # Conversation + Message models
│   │   ├── File.js             # File metadata with storage type
│   │   └── Report.js           # Performance reports with channels
│   ├── routes/
│   │   ├── auth.js             # Login, refresh, me, change-password
│   │   ├── users.js            # User CRUD + notifications
│   │   ├── clients.js          # Client CRUD + overview + stats
│   │   ├── tasks.js            # Task CRUD + comments
│   │   ├── updates.js          # Update CRUD
│   │   ├── messages.js         # Conversations + real-time messages
│   │   ├── files.js            # Upload + download + delete
│   │   ├── reports.js          # Report CRUD + summary
│   │   └── notifications.js    # Read/clear notifications
│   ├── utils/
│   │   ├── jwt.js              # Token generation
│   │   ├── notifications.js    # createNotification + notifyTeam
│   │   └── seed.js             # Demo data seeder
│   ├── index.js                # App entry, middleware, route mounting
│   ├── .env.example
│   └── package.json
│
└── client/                     # React + Vite
    ├── src/
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── AdminLayout.jsx     # Collapsible sidebar for team
    │   │   │   ├── ClientLayout.jsx    # Sidebar for client portal
    │   │   │   └── AuthLayout.jsx      # Centered login layout
    │   │   ├── shared/
    │   │   │   ├── LoadingScreen.jsx   # Spinner, StatCard, Avatar, Card, EmptyState
    │   │   │   └── NotificationPanel.jsx
    │   │   └── ui/
    │   │       └── index.jsx           # Button, Input, Select, Modal, Toast, Tabs...
    │   ├── context/
    │   │   ├── authStore.js            # Zustand auth store
    │   │   └── SocketContext.jsx       # Socket.io React context
    │   ├── lib/
    │   │   ├── api.js                  # Axios instance with interceptors
    │   │   └── utils.js                # formatDate, formatCurrency, getStatusColor...
    │   ├── pages/
    │   │   ├── auth/LoginPage.jsx
    │   │   ├── admin/
    │   │   │   ├── Dashboard.jsx
    │   │   │   ├── ClientsPage.jsx
    │   │   │   ├── ClientDetailPage.jsx
    │   │   │   ├── TasksPage.jsx
    │   │   │   ├── MessagesPage.jsx
    │   │   │   ├── UpdatesPage.jsx     # also exports ReportsAdminPage, FilesAdminPage
    │   │   │   ├── TeamPage.jsx
    │   │   │   ├── ReportsPage.jsx
    │   │   │   └── FilesPage.jsx
    │   │   ├── client/
    │   │   │   ├── Dashboard.jsx
    │   │   │   ├── UpdatesPage.jsx     # also exports Files, Reports, Requests
    │   │   │   ├── FilesPage.jsx
    │   │   │   ├── ReportsPage.jsx
    │   │   │   ├── ChatPage.jsx
    │   │   │   └── RequestsPage.jsx
    │   │   └── NotFoundPage.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)
- (Optional) Cloudinary account for file uploads

---

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd toflymedia
```

---

### 2. Backend Setup

```bash
cd server
npm install
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

# File storage: 'local' or 'cloudinary'
FILE_STORAGE=local

# Only needed if FILE_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

CLIENT_URL=http://localhost:5173
```

**Seed demo data:**
```bash
npm run seed
```

**Start server:**
```bash
npm run dev    # development (nodemon)
npm start      # production
```

---

### 3. Frontend Setup

```bash
cd ../client
npm install
```

Create `.env` (optional — Vite proxy handles API by default):
```env
VITE_API_URL=http://localhost:5000
```

**Start dev server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

---

### 4. Open in browser

```
http://localhost:5173
```

---

## 🔐 Demo Login Credentials

After running `npm run seed`:

| Role | Email | Password |
|---|---|---|
| 👑 Admin | admin@toflymedia.com | Admin123! |
| 📊 Manager | manager@toflymedia.com | Manager123! |
| 🎨 Designer | designer@toflymedia.com | Designer123! |
| 📈 Marketer | marketer@toflymedia.com | Marketer123! |
| 🏢 Client 1 (TechNova) | client@toflymedia.com | Client123! |
| 🏢 Client 2 (Bloom & Co) | diana.client@toflymedia.com | Client123! |

---

## 🛣️ API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login, returns JWT tokens |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| POST | `/api/auth/logout` | User | Invalidate tokens |
| GET | `/api/auth/me` | User | Get current user |
| PUT | `/api/auth/profile` | User | Update profile |
| PUT | `/api/auth/change-password` | User | Change password |

### Clients
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/clients` | Team+ | List clients (role-filtered) |
| POST | `/api/clients` | Admin/Manager | Create client |
| GET | `/api/clients/stats/overview` | Admin/Manager | Dashboard stats |
| GET | `/api/clients/:id` | Role-checked | Get client |
| PUT | `/api/clients/:id` | Admin/Manager | Update client |
| DELETE | `/api/clients/:id` | Admin | Delete client |
| GET | `/api/clients/:id/overview` | Role-checked | Full client overview |

### Tasks
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks` | Role-filtered | List tasks |
| POST | `/api/tasks` | Any | Create task (clients → requests) |
| GET | `/api/tasks/:id` | Role-checked | Get task |
| PUT | `/api/tasks/:id` | Team+ | Update task |
| DELETE | `/api/tasks/:id` | Admin/Manager | Delete task |
| POST | `/api/tasks/:id/comments` | Any | Add comment |

### Updates
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/updates` | Any | List updates |
| POST | `/api/updates` | Team | Create update |
| PUT | `/api/updates/:id` | Team | Edit update |
| DELETE | `/api/updates/:id` | Admin/Manager | Delete update |

### Messages (REST + Socket.io)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/messages/conversations` | List conversations |
| GET | `/api/messages/conversations/:clientId` | Get/create conversation |
| GET | `/api/messages/:conversationId` | Get messages (paginated) |
| POST | `/api/messages/:conversationId` | Send message |
| DELETE | `/api/messages/message/:messageId` | Delete message |

**Socket events:**
- `join:conversation` / `leave:conversation`
- `typing:start` / `typing:stop`
- `message:new` → emitted to room on new message
- `notification` → emitted to user room

### Files
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/files` | Role-filtered | List files |
| POST | `/api/files/upload` | Team | Upload file (multipart) |
| GET | `/api/files/:id` | Role-checked | Get file details |
| PUT | `/api/files/:id` | Team | Update metadata |
| DELETE | `/api/files/:id` | Admin/Manager | Delete file |

### Reports
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/reports` | Role-filtered | List reports |
| POST | `/api/reports` | Team | Create report |
| GET | `/api/reports/:id` | Role-checked | Get report |
| PUT | `/api/reports/:id` | Team | Update report |
| DELETE | `/api/reports/:id` | Admin/Manager | Delete report |
| GET | `/api/reports/client/:clientId/summary` | Role-checked | Aggregate summary |

---

## 🔒 RBAC Matrix

| Feature | Admin | Manager | Team Member | Client |
|---|---|---|---|---|
| Manage all clients | ✅ | ✅ | ❌ | ❌ |
| View assigned clients | ✅ | ✅ | ✅ | Own only |
| Create tasks | ✅ | ✅ | ✅ | Requests only |
| Post updates | ✅ | ✅ | ✅ | ❌ |
| Upload files | ✅ | ✅ | ✅ | ❌ |
| Create reports | ✅ | ✅ | ✅ | ❌ |
| Manage team | ✅ | ❌ | ❌ | ❌ |
| Chat | ✅ | ✅ | ✅ | ✅ |

---

## 🚀 Production Deployment

### Docker (recommended)

```dockerfile
# server/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
```

### Environment Variables for Production

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/toflymedia
JWT_ACCESS_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
FILE_STORAGE=cloudinary
CLIENT_URL=https://your-domain.com
```

### Serve Frontend from Express (optional)

Add to `server/index.js`:
```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
```

---

## 🛠️ Extending the System

- **Email notifications** — integrate Nodemailer or Resend in `utils/notifications.js`
- **Stripe billing** — add subscription management to Client model
- **White-labeling** — add `brandColor`, `logo`, `domain` to Client model
- **2FA** — add TOTP to User model using `speakeasy`
- **Activity log** — create an `AuditLog` model, middleware to track all changes
- **Zapier/webhooks** — add webhook URLs to Client model, fire on status changes

---

## 📄 License

MIT — Build on it, extend it, white-label it.
