# PalawanSU Hotel PMS — Desktop App Setup

## Project Structure

```
artifacts/hotel-pms/
├── electron/
│   ├── main.cjs        ← Electron main process (creates window, starts API server)
│   └── preload.cjs     ← Securely exposes API port to the React app
├── src/                ← React frontend (same code used for web & desktop)
│   ├── main.tsx        ← Detects Electron and sets API base URL
│   └── ...
├── package.json        ← Includes electron:dev and electron:build scripts
└── vite.config.ts      ← Supports both web and Electron build modes
```

## Running Locally (Windows / Mac / Linux)

### Prerequisites

- Node.js 20+
- npm or pnpm

### Database (SQLite)

The API uses **SQLite** via `better-sqlite3`. Data is stored in a single file.

| Environment | Default database file |
|-------------|------------------------|
| API dev (`pnpm` / `npm` in monorepo) | `./data/petrocorex.db` (relative to API server cwd) |
| Electron **host** (packaged) | `%APPDATA%\<app name>\petrocorex.db` (see `electron/main.cjs` `getDbPath`) |

Override with **`DATABASE_PATH`** (absolute or relative path to the `.db` file).

Optional: `DATABASE_URL=file:./relative.db` is also supported by `@workspace/db` for tooling compatibility.

### 1. Clone and install

```bash
git clone <repo-url>
cd workspace
pnpm install
# or from hotel-pms only:
cd hotel-pms && npm install
```

### 2. Push the database schema (when you add tables)

From monorepo root, with `DATABASE_PATH` set if not using the default file:

```bash
DATABASE_PATH=./data/petrocorex.db pnpm --filter @workspace/db run push
```

### 3. Run in Electron development mode

```bash
# Terminal 1 — API server (port 3001, SQLite under ./data/petrocorex.db)
cd PetroCoreX-Next/artifacts/api-server && npm run dev

# Terminal 2 — Electron app
cd hotel-pms && cross-env API_PORT=3001 npm run electron:dev
```

The Electron window opens and connects to the local API server.

## Offline LAN Deployment (Hostel Setup)

For multi-PC offline use, deploy in **Host/Client** topology:

- **Host PC** (front desk): runs backend + SQLite file
- **Client PCs**: run UI and connect to host via LAN (`http://<host-ip>:3001`)

### Why this matters

- If every PC has its own SQLite file, data does **not** sync.
- If all PCs use one **host** API + one DB file, data stays consistent on the LAN.

### Static IP / Local DNS

Reserve a static IP on router/DHCP for the host (example `192.168.1.10`) or map a local DNS name (example `pms-host.local`).
Use this in **Settings > LAN Server Configuration** on client installs.

### Build the desktop installer

```bash
cd hotel-pms
npm run electron:build
```

Output is placed in `dist/electron-dist/`:

- **Windows**: installer + portable `.exe`
- **Mac**: `.dmg`
- **Linux**: `.AppImage` + `.deb`

### Dedicated installers

```bash
npm run electron:build:host
npm run electron:build:client
```

## Architecture

```
┌─────────────────────────────────────────┐
│          Electron Desktop App           │
│  Main process starts bundled API (host) │
│  Renderer calls http://localhost:3001   │
│  SQLite file on host PC userData        │
└─────────────────────────────────────────┘
```

## Backups and Restore

- Automatic local backup is scheduled daily on **host mode** (copies `petrocorex.db`).
- Manual backup and restore: **Settings > Backup & Restore**.
- Restoring replaces the live DB file; restart the app after restore.

## Failure Behavior (Host Down)

- Client installs need the host API reachable.
- If the host is off, clients show a warning and live operations are unavailable unless you add failover.

## Default Login

- **Username**: `admin`
- **Password**: `admin123`

(If login fails, ensure the API implements auth against the same database.)
