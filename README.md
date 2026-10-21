# Space Mission Operations & Satellite Management System

> **Enterprise Space Mission Operations Console**  
> Built with **React, TypeScript, Node.js, Express.js, PostgreSQL, Redis, REST API, Docker, and Git/GitHub**.  
> *Notice: Spacecraft telemetry sensor data and pass logs are synthetically generated for mission operations simulation.*

---

## 🛰️ Project Overview

The **Space Mission Operations & Satellite Management System** provides an integrated aerospace flight control console for tracking spacecraft constellations, scheduling ground station passes, monitoring simulated avionics telemetry, and managing maintenance workflows with strict Role-Based Access Control (RBAC).

High-throughput read performance is accelerated by **Redis in-memory caching** for latest telemetry frames and mission control alerts, while transactional data is durably stored in **PostgreSQL**.

### Key Architectural Features
1. **Authentication & RBAC**:
   - Five distinct roles: **Flight Director (Admin)**, **Mission Operator**, **Ground-Station Coordinator**, **Maintenance Engineer**, and **Viewer**.
   - Server-enforced permissions on all routes (e.g., only Admin can delete spacecraft; only Coordinator can configure stations; only Engineer can log maintenance).
   - Strict Email & Password login: sessions are created after cryptographic verification of password hashes (bcryptjs) in PostgreSQL.
   - Self-registration with full name, email, password, and password confirmation validation.
   - Privilege escalation prevention: self-registration defaults strictly to Mission Operator; users cannot choose or grant themselves Admin access.
   - Active session guard: signing out invalidates the session and returns the user to the login screen; protected modules require active authenticated JWT sessions.
2. **PostgreSQL Relational Persistence**:
   - Complete schema with relational integrity: `users`, `satellites`, `ground_stations`, `missions`, `telemetry`, `maintenance_records`, `comm_logs`.
   - Foreign key constraints, indexing on lookup columns (`norad_id`, `satellite_id`, `station_id`, `timestamp`), and automatic schema initialization on startup.
   - Support for both persistent PostgreSQL instances and in-memory test databases (`pg-mem`).
3. **Redis Real-time Caching**:
   - **Latest Telemetry Caching**: Latest telemetry frames for any satellite are cached in Redis (`cache:telemetry:latest:${id}`), reducing database load during intensive tracking sweeps.
   - **Mission Control Alerts Caching**: Open critical maintenance incidents and system anomalies are cached in Redis (`cache:dashboard:alerts`), delivering sub-millisecond alert status updates.
   - **Automatic Cache Invalidation**: Caches are immediately purged and re-synchronized whenever fresh telemetry is synthesized or maintenance tickets are updated.
   - **Fault-Tolerant Resilience**: If Redis is offline, the backend transparently falls back to resilient in-memory caching without service interruption.
4. **Satellites & Orbital Ephemeris**:
   - Register, search, filter (LEO, MEO, GEO, SSO, Polar, Deep Space), edit, and decommission satellite records.
   - Tracks NORAD catalog ID, inclination, orbital altitude, mass, and operator.
5. **Ground Station Tracking Network**:
   - Manage parabolic antenna dishes, geographic coordinates, frequency bands (S/X/Ka-Band, UHF/VHF, Optical), and availability statuses.
   - Schedule inspection drawer showing all passes assigned to each station.
6. **Mission Scheduling & Conflict Detection**:
   - Create and schedule mission passes with strict chronological validation (`startTime < endTime`).
   - **Ground Station Overlap Conflict Rejection**: Automatically detects and rejects overlapping bookings for the same ground station (returns HTTP 409 Conflict with full details).
7. **Simulated Telemetry Monitoring**:
   - Time-series tracking of bus voltage, battery temperature, solar array output, RF signal strength, and subsystem statuses (OBC, AOCS, COMM, EPS).
   - Filterable by satellite and date range.
   - Interactive SVG sparklines and live batch generator button (generates 15 synthetic frames).
   - Explicitly labeled across all cards and tables as **SIMULATED DEMO DATA ONLY**.
8. **Maintenance & Servicing**:
   - Satellite maintenance records with severity levels (Critical, High, Medium, Low) and workflow progression (Scheduled -> In Progress -> Completed).
9. **Mission Transceiver Communications**:
   - Flight loop logbook for telemetry passes, command uplinks, payload downlinks, and station handovers with RF signal quality indicators.
10. **Personnel Management**:
    - Flight Director console for inspecting registered personnel, updating roles, and toggling active access statuses.

---

## 📋 Technology Stack Compliance

| Technology | Implementation Layer | Purpose |
| :--- | :--- | :--- |
| **React 18** | Frontend UI | Single-page application, reactive state, aerospace UI |
| **TypeScript** | Frontend Type Safety | Strict interfaces for models, API contracts, props, and state |
| **Node.js** | Backend Runtime | Non-blocking asynchronous server runtime |
| **Express.js** | Backend Web Framework | REST API routing, JWT auth middleware, RBAC guards |
| **PostgreSQL** | Primary Database | Relational storage, foreign keys, ACID transactions, UUID keys |
| **Redis** | In-Memory Cache | Fast cache for latest spacecraft telemetry and mission alerts |
| **REST API** | API Architecture | Standardized JSON endpoints (`/api/auth`, `/api/satellites`, etc.) |
| **Docker** | Containerization | Multi-stage Dockerfiles (`client`, `server`) and `docker-compose.yml` |
| **Git / GitHub** | Version Control | Clean commit history, branch management, issue tracking |

---

## 🐳 Running with Docker (Recommended)

The entire application stack (Client, Server, PostgreSQL 16, Redis 7) is containerized and can be launched with a single command:

```powershell
docker compose up --build
```

### Container Architecture & Ports:

| Service | Container Name | Image / Build | Port Mapping | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `space_ops_client` | `./client` (Nginx Alpine) | `3000:80` | React + TypeScript SPA with Nginx reverse proxy |
| **Backend** | `space_ops_server` | `./server` (Node 20 Alpine) | `5000:5000` | Express REST API server |
| **PostgreSQL** | `space_ops_postgres` | `postgres:16-alpine` | `5432:5432` | Relational database with persistent volume |
| **Redis** | `space_ops_redis` | `redis:7-alpine` | `6379:6379` | Fast telemetry & alert cache with persistent volume |

Once running, access:
- **Flight Control Console**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check Endpoint**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

To stop the containers:
```powershell
docker compose down
```

---

## 💻 Local Development Setup (Without Docker)

### 1. Prerequisites
- **Node.js**: v20+ or v24 LTS
- **PowerShell** or **Bash**
- **PostgreSQL** (optional: backend includes `pg-mem` in-memory fallback for offline test environments)
- **Redis** (optional: backend includes in-memory cache fallback if Redis is not running locally)

### 2. Install Dependencies
```powershell
npm run install:all
```

### 3. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```powershell
cp server/.env.example server/.env
```

Contents of `server/.env`:
```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/space_mission_ops
REDIS_URL=redis://localhost:6379
JWT_SECRET=space_mission_operations_super_secret_jwt_key_2026_demo
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
AUTO_SEED=true
```

### 4. Database Seeding
To populate PostgreSQL with demo satellites, ground stations, missions, simulated telemetry, and user accounts:
```powershell
npm run seed
```
*(Note: If the database is empty when the server first boots, it automatically runs the seed routine!)*

### 5. Launch Development Servers
```powershell
npm run dev
```
Or use the Windows helper launcher:
```powershell
.\start-dev.ps1
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend Server**: [http://localhost:5000](http://localhost:5000)

---

## 🔑 Pre-Configured Demo Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Flight Director (Admin)** | `admin@spaceops.local` | `MissionControl2026!` | Full privileges: CRUD all resources, manage personnel |
| **Mission Operator** | `operator@spaceops.local` | `MissionControl2026!` | Mission planning, communication logs, telemetry generation |
| **Station Coordinator** | `coordinator@spaceops.local` | `MissionControl2026!` | Ground station network management, tracking scheduling |
| **Maintenance Engineer** | `engineer@spaceops.local` | `MissionControl2026!` | Spacecraft health tickets, preventative maintenance |

---

## 🧪 Testing and Verification

### 1. Automated Vitest Backend Test Suite
The project includes automated integration tests testing authentication, RBAC restrictions, CRUD behavior, simulated telemetry filtering, password confirmation validation, duplicate email rejection, role-only bypass rejection, and ground station schedule conflict rejection:
```powershell
npm test
```

### 2. TypeScript Compilation & Frontend Build
Verify that the TypeScript types compile with zero errors:
```powershell
npm run build
```

### 3. End-to-End Live Verification Script
While the backend server is running:
```powershell
node server/src/scripts/verify-e2e.js
```

---

## 📂 Project Structure

```
FSD SATELLITE/
├── docker-compose.yml          # Multi-container orchestration (Client, Server, Postgres, Redis)
├── .env.example                # Root environment template
├── .gitignore                  # Gitignore excluding node_modules, dist, and .env
├── package.json                # Root package with multi-package scripts
├── start-dev.ps1               # PowerShell launcher
├── start-dev.bat               # Windows batch launcher
├── README.md                   # Complete architectural documentation
├── server/                     # Node.js + Express + PostgreSQL + Redis backend
│   ├── Dockerfile              # Production Node 20 Alpine container
│   ├── .dockerignore
│   ├── package.json
│   ├── .env.example
│   ├── vitest.config.js
│   ├── src/
│   │   ├── app.js              # Express app configuration & middleware
│   │   ├── server.js           # Server bootstrap & graceful shutdown
│   │   ├── config/
│   │   │   ├── db.js           # PostgreSQL connection pool & schema initialization
│   │   │   └── redis.js        # Redis client & telemetry/alert cache helpers
│   │   ├── models/             # PostgreSQL models (User, Satellite, GroundStation, Mission, Telemetry, Maintenance, CommLog)
│   │   ├── controllers/        # REST API business logic with Redis caching
│   │   ├── middleware/         # JWT Auth, Role RBAC, error handlers
│   │   ├── routes/             # RESTful API endpoints
│   │   ├── utils/              # Ground station conflict checker & telemetry simulator
│   │   └── scripts/            # PostgreSQL seed script and E2E verification
│   └── tests/                  # Vitest test files
└── client/                     # React + TypeScript + Vite frontend
    ├── Dockerfile              # Multi-stage build with Nginx Alpine web server
    ├── nginx.conf              # Nginx reverse proxy configuration (/api -> backend)
    ├── .dockerignore
    ├── package.json
    ├── tsconfig.json           # TypeScript project configuration
    ├── tsconfig.node.json
    ├── vite.config.ts          # Vite configuration with API proxy
    ├── index.html              # Entry HTML with aerospace typography
    └── src/
        ├── main.tsx            # React root with AuthProvider
        ├── App.tsx             # Module router and telemetry disclaimer banner
        ├── types/              # Full TypeScript model interfaces and API types
        ├── api/                # Typed REST API client
        ├── context/            # AuthContext & typed session hooks
        ├── styles/             # Aerospace dark mode design system
        ├── components/         # Navbar, AuthModal, ToastContainer
        └── views/              # DashboardView, SatellitesView, MissionsView, GroundStationsView, SimulatedTelemetryView, MaintenanceView, CommLogsView, UserManagementView, LoginView
```

---

## 📜 Compliance Checklist

- [x] **React**: Modern component architecture, state management, modular design.
- [x] **TypeScript**: Full static typing across client (`types/`, `api/`, `components/`, `views/`, `context/`).
- [x] **Node.js**: Non-blocking runtime powering the mission operations server.
- [x] **Express.js**: RESTful API endpoints with JWT authentication and RBAC authorization middleware.
- [x] **PostgreSQL**: Relational storage with foreign key constraints, indexes, and automated schema migration.
- [x] **Redis**: In-memory caching for latest spacecraft telemetry and mission control alerts with automatic invalidation.
- [x] **REST API**: Clean JSON API specification with status codes (200, 201, 400, 401, 403, 404, 409 Conflict).
- [x] **Docker**: Dockerfiles (`client`, `server`) and `docker-compose.yml` orchestrating client, server, PostgreSQL 16, and Redis 7.
- [x] **Git / GitHub**: Clean repository structure with `.gitignore` and zero hardcoded secrets.
- [x] **Relational Persistence & Fast Caching**: 100% migrated to PostgreSQL + Redis with zero legacy document store dependencies across all source code, models, tests, and documentation.
