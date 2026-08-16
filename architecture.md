┌─────────────────────────────────────────┐
│                FRONTEND                 │
│                                         │
│ React + TypeScript + WebSocket API      │
└───────────────────┬─────────────────────┘
                    │
                    │ WebSocket
                    │ JSON Messages
                    ▼
┌─────────────────────────────────────────┐
│                 BACKEND                 │
│                                         │
│ Node.js + TypeScript                    │
│                                         │
│ WebSocket Server                        │
│        ↓                                │
│ Protocol Validation                     │
│        ↓                                │
│ Room Manager                            │
│        ↓                                │
│ Room State                              │
└─────────────────────────────────────────┘

# SyncSpace Architecture

## Folder Structure

```text
SyncSpace/
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── connection.ts
│   │   ├── interpolation.ts
│   │   ├── render.ts
│   │   ├── main.tsx
│   │   └── styles.css
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/
│   ├── src/
│   │   ├── server.ts
│   │   ├── protocol.ts
│   │   └── room.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── README.md
├── ARCHITECTURE.md
└── .gitignore

communication flow

Client
  │
  │ WebSocket
  ▼
Server
  │
  ▼
Protocol Validation
  │
  ▼
Room Manager
  │
  ▼
Broadcast
  │
  ▼
Other Clients
  │
  ▼
Interpolation
  │
  ▼
Remote Cursor