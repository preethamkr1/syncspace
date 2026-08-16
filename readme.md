# Real-Time Multiplayer Cursor / State Sync

A lightweight real-time multiplayer synchronization system built from scratch using:

- React
- TypeScript
- Node.js
- Raw WebSocket API
- Node.js built-in HTTP and networking APIs

The application allows multiple browser clients to join the same room and see each other's cursor movement, participant presence, and reactions in real time.

The main focus of this project is not a large number of features. The focus is understanding and implementing the core ideas behind real-time synchronization:

- WebSocket communication
- Message protocol design
- High-frequency cursor throttling
- Sequence numbers and stale-message handling
- Smooth remote cursor rendering
- Presence management
- Reconnection
- Network-loss detection
- Reaction synchronization
- Type-safe message validation
- Clean separation between transport, protocol, and rendering


---

# 1. Project Overview

The application works as a small multiplayer room.

Each browser connects to the Node.js server using a persistent WebSocket connection.

The basic flow is:

```text
Browser Client
      |
      | WebSocket
      v
Node.js Server
      |
      | Validate message
      v
Room State
      |
      | Broadcast
      v
Other Connected Clients
      |
      v
Smooth Cursor / Reaction Rendering
```

For example, when Client A moves the mouse:

```text
Client A
   |
   | cursor update
   v
Client-side throttling
   |
   | sequence number
   v
WebSocket
   |
   v
Server
   |
   | validate
   | check sequence
   | find room
   v
Broadcast to room
   |
   +------> Client B
   |
   +------> Client C
   |
   +------> Client D
```

The server does not continuously store every historical cursor position.

It keeps the current participant state and relays new events to the other clients.


---

# 2. Main Features

## Real-Time Cursor Synchronization

Every connected client can see the cursor of the other participants in the same room.

Cursor movement is sent through WebSockets rather than HTTP polling.

The browser does not send every raw `mousemove` event directly to the network.

Instead, cursor updates are throttled to approximately 30 updates per second.

This reduces unnecessary network traffic while keeping the movement responsive.


## Multiple Clients

The demo supports multiple simultaneous clients in the same room.

The assignment requires testing with at least 3–5 clients, and the implementation is designed to comfortably demonstrate the required 3–10 client range.

For additional stress testing, the room is currently capped at 15 active participants.

Participant names are:

```text
A
B
C
D
E
F
G
H
I
J
K
L
M
N
O
```

The 16th client is rejected with a room-full message instead of receiving an inconsistent fallback name.


## Reactions

Participants can trigger a reaction at their current cursor position.

The reaction is sent to the server and broadcast to everyone in the room, including the participant who triggered it.

Example:

```text
Client A clicks ❤️

        |
        v

Server receives reaction

        |
        v

Server broadcasts reaction

    /       |       \
   v        v        v

Client A  Client B  Client C
```

Reactions are treated as short-lived events.

They are displayed temporarily and are not stored forever as historical state.


## Presence

The interface displays the number of active participants and a participant list.

When a client joins:

```text
presence: joined
```

is broadcast to the existing clients.

When a client leaves:

```text
presence: left
```

is broadcast to the remaining clients.

This prevents disconnected clients from remaining visible indefinitely.


## Stable Participant Identity

Each browser client receives a stable client ID.

The server associates the client ID with a human-readable participant identity.

The current room supports:

```text
A → B → C → D → E → F → G → H
  → I → J → K → L → M → N → O
```

The identity is retained when a client disconnects so that reconnecting clients can recover their previous identity.


---

# 3. Technology Stack

## Frontend

- React
- TypeScript
- CSS
- Browser WebSocket API
- `requestAnimationFrame()` for smooth rendering

## Backend

- Node.js
- TypeScript
- Node.js built-in HTTP server
- Raw WebSocket implementation
- In-memory room state

## Important

No external real-time synchronization framework is used.

The assignment specifically requires the synchronization logic to be implemented using the raw WebSocket API rather than libraries such as:

- Socket.IO
- Yjs
- Liveblocks
- PartyKit
- Ably
- Pusher

The project therefore implements the WebSocket transport and synchronization logic directly.


---

# 4. Project Structure

```text
multiplayer-sync-assignment/
│
├── server/
│   ├── src/
│   │   ├── server.ts
│   │   ├── room.ts
│   │   └── protocol.ts
│   │
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── connection.ts
│   │   ├── interpolation.ts
│   │   └── render.ts
│   │
│   └── package.json
│
├── README.md
│
└── ARCHITECTURE.md
```


---

# 5. Setup

## Requirements

Install:

- Node.js
- npm
- Git
- A modern browser such as Chrome, Edge, or Firefox

Recommended Node.js version:

```text
Node.js 20+
```


## Install Server Dependencies

Open a terminal:

```bash
cd server
npm install
```


## Install Client Dependencies

Open another terminal:

```bash
cd client
npm install
```


## Start the Server

From the `server` directory:

```bash
npm run dev
```

The server should start on:

```text
http://localhost:8080
```

The WebSocket endpoint is:

```text
ws://localhost:8080
```


## Start the Client

From the `client` directory:

```bash
npm run dev
```

Open the URL shown by Vite in the terminal.

For example:

```text
http://localhost:5173
```


---

# 6. Testing Multiple Clients

Open the client application in multiple browser tabs.

For example:

```text
Tab 1 → Client A
Tab 2 → Client B
Tab 3 → Client C
Tab 4 → Client D
Tab 5 → Client E
```

Move the mouse in each tab.

Each client should see the other clients' cursors moving.

The participant count should increase as clients join.

The participant should disappear when its connection is closed or considered lost.


## Recommended Test

Test at least:

```text
3 clients
5 clients
10 clients
```

The implementation also has a room limit of:

```text
15 clients
```

with identities:

```text
A → O
```


---

# 7. Protocol Design

The protocol is intentionally small.

The client and server communicate using JSON messages over WebSockets.

There are two directions:

```text
Client → Server

Server → Client
```


# 7.1 Client → Server Messages

## Join

Used when a client enters a room.

```ts
{
    type: "join",
    clientId: string,
    roomId: string
}
```

Example:

```json
{
    "type": "join",
    "clientId": "abc-123",
    "roomId": "demo"
}
```


## Cursor

Used for cursor movement.

```ts
{
    type: "cursor",
    seq: number,
    x: number,
    y: number
}
```

Example:

```json
{
    "type": "cursor",
    "seq": 42,
    "x": 540,
    "y": 320
}
```

The sequence number is increased for each cursor update.


## Reaction

Used for a discrete reaction event.

```ts
{
    type: "reaction",
    emoji: string,
    x: number,
    y: number
}
```

Example:

```json
{
    "type": "reaction",
    "emoji": "❤️",
    "x": 540,
    "y": 320
}
```


## Heartbeat

Used to tell the server that the client is still connected.

```ts
{
    type: "heartbeat"
}
```


---

# 7.2 Server → Client Messages

## Snapshot

Sent when a client joins.

```ts
{
    type: "snapshot",
    self: Participant,
    participants: Participant[]
}
```

A participant has:

```ts
{
    clientId: string,
    name: string,
    color: string,
    x: number,
    y: number
}
```

The snapshot allows a new client joining in the middle of a session to immediately know about the participants already in the room.


## Presence

Used when someone joins or leaves.

```ts
{
    type: "presence",
    action: "joined" | "left",
    participant: Participant
}
```


## Cursor

Broadcast when a remote participant moves.

```ts
{
    type: "cursor",
    clientId: string,
    name: string,
    color: string,
    seq: number,
    x: number,
    y: number
}
```


## Reaction

Broadcast when someone reacts.

```ts
{
    type: "reaction",
    clientId: string,
    name: string,
    color: string,
    emoji: string,
    x: number,
    y: number
}
```


## Error

Used when the server receives invalid or unsupported input.

```ts
{
    type: "error",
    message: string
}
```


---

# 8. Type Safety and Validation

Messages cross a network boundary, so incoming JSON cannot simply be trusted.

The project defines message types using TypeScript.

The server validates incoming messages before processing them.

The validation checks things such as:

- Message type
- Required fields
- String values
- Numeric values
- Cursor coordinates
- Sequence numbers
- Room ID
- Client ID
- Reaction values

Malformed JSON is rejected.

Unknown message types are rejected.

Invalid messages do not directly reach the room logic.

The basic flow is:

```text
Raw WebSocket message
        |
        v
JSON parsing
        |
        v
Protocol validation
        |
        +---- invalid → error
        |
        v
Typed message
        |
        v
Message handler
```


---

# 9. Cursor Throttling

Mouse movement is a high-frequency event.

A browser can generate many `mousemove` events every second.

Sending every event directly through the network would create unnecessary traffic.

Instead, the client throttles cursor updates to approximately:

```text
30 updates / second
```

or approximately:

```text
33 ms
```

between network updates.

The important distinction is:

```text
Mouse movement frequency
        ≠
Network update frequency
        ≠
Rendering frequency
```

The browser can continue rendering smoothly while the network uses a controlled update rate.


## Pending Position

If several mouse movements occur before the next network update is allowed, the client keeps the latest position rather than storing every intermediate position.

Conceptually:

```text
Mouse:

P1 → P2 → P3 → P4 → P5

Network:

P1 -------- P5
```

This keeps the latest useful state and avoids unnecessary buffering.

There is therefore no continuously growing history of cursor positions.


---

# 10. Sequence Numbers

Network messages may arrive late or out of order.

Each cursor update contains a sequence number.

Example:

```text
seq 10
seq 11
seq 12
seq 13
```

If the server has already processed:

```text
seq 13
```

and later receives:

```text
seq 11
```

the older update is rejected.

The rule is:

```text
new sequence > last sequence
```

Only newer cursor updates are accepted.

This prevents an older packet from moving a cursor backwards to stale state.


---

# 11. Interpolation and Smooth Rendering

The network does not deliver cursor updates at perfectly regular intervals.

For example:

```text
Update 1
      |
      | 25 ms
      v
Update 2
      |
      | 48 ms
      v
Update 3
      |
      | 20 ms
      v
Update 4
```

If the UI immediately jumps to each received position, the cursor can appear to teleport.

To avoid this, the rendering layer moves the displayed cursor smoothly toward the latest known network position.

The interpolation is based on the current rendered position and the latest target position.

Conceptually:

```text
Current position
       |
       v
    Smooth move
       |
       v
Target network position
```


## Why This Approach?

I chose a simple interpolation approach because this assignment focuses on understanding the synchronization loop rather than building a complex prediction engine.

Advantages:

- Simple to understand
- Small memory usage
- Easy to tune
- Smooth under normal network jitter
- Does not require storing an unlimited history
- Works well for a small number of simultaneous clients


## Latency vs Smoothness Tradeoff

There is always a tradeoff.

If the cursor follows the latest network position immediately:

```text
Lower visual latency
        +
More visible jitter
```

If the cursor is smoothed more aggressively:

```text
Higher visual delay
        +
Smoother movement
```

The implementation uses a small amount of smoothing rather than intentionally adding a large playback buffer.

The goal is to keep the cursor visually stable without making it feel noticeably behind.


## Network Throttling Test

The application can be tested using browser developer tools with network throttling.

Under slower network conditions:

```text
Network updates
      ↓
arrive irregularly
      ↓
interpolation
      ↓
cursor continues moving smoothly
```

This is one of the main reasons the rendering layer is separated from the WebSocket transport.


---

# 12. Memory Usage

The application does not keep every cursor position ever received.

For each participant, only the current state required for synchronization/rendering is retained.

For example:

```text
clientId
name
color
current position
sequence number
connection state
```

Temporary reaction elements are also removed after their animation.

This avoids unbounded memory growth from continuously storing cursor history.


---

# 13. Disconnect Handling

A client can disconnect in different ways.

## Normal Tab Close

When the browser closes the WebSocket:

```text
WebSocket close
      ↓
server cleanup
      ↓
remove client from room
      ↓
broadcast presence:left
      ↓
other clients remove cursor
```


## WebSocket Error

If a WebSocket error occurs, the server performs the same cleanup path.

This prevents the server from keeping an invalid client in the room.


## Network Loss

A network failure does not always produce an immediate clean WebSocket close.

Therefore the application uses heartbeat messages.

The client periodically sends:

```json
{
    "type": "heartbeat"
}
```

The server records the latest heartbeat time.

If a client stops responding for longer than the configured timeout, the server considers that connection dead and removes it.

Current timing:

```text
Heartbeat interval: approximately 5 seconds
Timeout: approximately 15 seconds
```

The resulting flow is:

```text
Client loses network
        |
        v
Heartbeats stop
        |
        v
Server detects timeout
        |
        v
Socket destroyed
        |
        v
Client removed from room
        |
        v
presence:left
        |
        v
Other clients remove cursor
```


---

# 14. Reconnection

The client connection layer attempts to reconnect when the WebSocket closes unexpectedly.

The reconnect delay increases when repeated attempts fail.

After reconnecting, the client joins the room again.

The server uses the client's stable client ID to restore its participant identity.

This prevents duplicate identities caused by a reconnect.

Example:

```text
Before disconnect:

Client A

Network lost

Reconnect

Client A
```

rather than:

```text
Client A

Network lost

Reconnect

Client B
```

The room snapshot also allows the reconnecting client to receive the current room state.


---

# 15. Reaction Synchronization

Reactions are discrete events rather than continuous state.

When a participant reacts:

```text
Client
  |
  | reaction
  v
Server
  |
  | broadcast
  +--------+
  |        |
  v        v
Client A  Client B
```

The sender is intentionally included in the broadcast.

Therefore the person who clicked also sees the reaction.

If several participants react at approximately the same time, each reaction remains an independent event.

For example:

```text
A → ❤️
B → 🔥
C → 👍
```

The server does not replace one reaction with another.


---

# 16. Simultaneous Actions and Ordering

Cursor movement uses sequence numbers because cursor state is continuous.

Reactions are independent events, so two reactions occurring at nearly the same time do not overwrite each other.

For more complicated shared state in a future version, such as two users editing the same object, a stronger conflict-resolution method would be needed.

Possible production approaches could include:

- Server-side ordering
- Version numbers
- Optimistic concurrency
- Operation-based synchronization
- CRDT-style approaches for applications that require them

These are not necessary for the current two-action demo.


---

# 17. Server Design

The server intentionally remains small.

The server is responsible for:

1. Accepting WebSocket connections
2. Parsing WebSocket frames
3. Validating application messages
4. Maintaining active clients
5. Maintaining room membership
6. Maintaining current participant state
7. Broadcasting events
8. Detecting dead connections
9. Cleaning up disconnected clients

The server does not perform client-side visual interpolation.

The server also does not store an unlimited event history.


---

# 18. Broadcast Fan-Out

For a room containing `n` clients, the server sends an event to the relevant clients in that room.

For example:

```text
Room
 |
 +-- Client A
 +-- Client B
 +-- Client C
 +-- Client D
```

If Client A sends a cursor update:

```text
Server
 |
 +--> B
 +--> C
 +--> D
```

The sender is excluded for cursor updates because the local client already knows its own cursor position.

For reactions, the sender is included intentionally because reactions are visual events that should also appear on the sender's screen.


---

# 19. Architecture Separation

The project separates the major responsibilities.

```text
CLIENT

connection.ts
     |
     | WebSocket transport
     v
protocol messages
     |
     v
render.ts
     |
     +--> cursor rendering
     +--> interpolation
     +--> reactions


SERVER

server.ts
     |
     | raw WebSocket transport
     v
protocol.ts
     |
     | validation/types
     v
room.ts
     |
     | room/presence/state
     v
broadcast
```

This separation means adding a new action type does not require rewriting the low-level WebSocket frame handling.

For example, a future:

```text
type: "spotlight"
```

could be added at the protocol/message-handling level without redesigning the WebSocket transport.


---

# 20. Why WebSockets?

WebSockets were chosen because the application needs two-way real-time communication.

The client needs to send:

```text
cursor
reaction
heartbeat
```

and the server needs to send:

```text
snapshot
presence
cursor
reaction
error
```

A persistent WebSocket connection avoids repeated HTTP polling.

The assignment specifically recommends WebSockets for this type of application.


---

# 21. Why Raw WebSockets?

The assignment requires implementing the synchronization system without using a real-time synchronization library.

Therefore the project uses:

```text
Browser WebSocket API
+
Node.js networking APIs
+
Own message protocol
+
Own room management
+
Own synchronization logic
```

This makes the networking and synchronization decisions visible rather than hiding them behind a library.


---

# 22. AI Usage Disclosure

AI tools were used during development, but the final implementation was reviewed, tested, modified, and integrated manually.

## Tool Used

```text
ChatGPT
```

The AI was used as a development assistant rather than as a replacement for understanding the project.

## What AI Was Used For

AI assistance was used for:

- Understanding the assignment requirements
- Planning the project structure
- Reviewing the WebSocket architecture
- Discussing protocol design
- Debugging TypeScript and WebSocket issues
- Reviewing cursor throttling logic
- Reviewing interpolation logic
- Finding possible cleanup and reconnection problems
- Improving code organization
- Simplifying large files
- Preparing documentation
- Preparing explanations for design decisions
- Checking the implementation against the assignment requirements

## What I Did

I was responsible for:

- Setting up the project
- Implementing and integrating the client and server
- Running the application
- Testing multiple clients
- Debugging connection and synchronization issues
- Making the final implementation decisions
- Changing and validating the code
- Testing disconnect/reconnect behavior
- Testing reactions
- Testing cursor synchronization
- Reviewing the final architecture
- Preparing the final submission

AI suggestions were not treated as automatically correct.

I checked the generated suggestions against the actual code and assignment requirements before using them.

Most importantly, I made sure I could explain the final implementation and the reason behind the main design decisions.


---

# 23. My Role

My role in this project was the primary developer responsible for building and understanding the synchronization system.

My main contributions were:

### Client

- React UI
- WebSocket connection handling
- Cursor tracking
- Cursor throttling
- Sequence number generation
- Reconnection handling
- Reaction interaction
- Smooth remote cursor rendering
- Participant display

### Server

- Raw WebSocket handling
- WebSocket frame parsing
- WebSocket frame creation
- Message validation
- Room management
- Participant management
- Cursor synchronization
- Reaction broadcasting
- Presence updates
- Heartbeat handling
- Network-loss cleanup
- Reconnection support

### Engineering

- Debugging synchronization issues
- Testing multiple browser clients
- Testing network loss
- Improving cursor smoothness
- Reducing unnecessary updates
- Reviewing memory usage
- Keeping transport, protocol, and rendering responsibilities separated
- Preparing documentation and architecture explanations


---

# 24. Testing Performed

The application was tested using multiple browser tabs connected to the same room.

## Cursor Test

```text
Client A moves
→ B/C/D see A

Client B moves
→ A/C/D see B
```

## Presence Test

```text
Open new tab
→ participant count increases

Close tab
→ participant count decreases
→ cursor disappears
```

## Reaction Test

```text
Client A reacts
→ A sees reaction
→ B sees reaction
→ C sees reaction
```

## Multiple Clients

The application is designed around the assignment's required range:

```text
3–10 simultaneous clients
```

A higher local room capacity of:

```text
15 clients
```

is also configured for additional testing.

## Network Loss Test

The browser's network throttling/offline tools can be used to simulate degraded connectivity.

The server heartbeat mechanism detects clients that stop sending heartbeats and removes them after the configured timeout.

## Reconnection Test

A disconnected client can reconnect and join the room again using its stable client ID.


---

# 25. Performance Decisions

The main performance decisions were made around cursor movement because it is the highest-frequency event.

## Decision 1: Throttle Cursor Updates

Instead of:

```text
mousemove
mousemove
mousemove
mousemove
mousemove
...
```

being sent directly to the server, the client sends approximately:

```text
30 updates / second
```

This reduces unnecessary network traffic.


## Decision 2: Keep Only Latest Pending Position

The client does not queue every mouse position.

It keeps the latest position waiting to be sent.

This prevents a large backlog when the browser produces mouse events faster than the network update rate.


## Decision 3: Render Separately From Networking

Networking and visual rendering are separate.

The network determines the latest known remote state.

The rendering loop determines how that state appears visually.

This allows the UI to remain smooth even when packets arrive at uneven times.


## Decision 4: Sequence Numbers

Sequence numbers prevent stale cursor packets from moving the cursor backwards.


---

# 26. Known Limitations

This project intentionally focuses on the assignment scope rather than production infrastructure.

Current limitations include:

- Room state is stored in server memory.
- Server restart removes current room state.
- No database persistence.
- No authentication.
- No authorization.
- One server process is used.
- Horizontal scaling is not implemented.
- No Redis/pub-sub layer.
- The room is intentionally limited to 15 active participants.
- The interpolation model is intentionally simple.
- No advanced CRDT or collaborative editing model is implemented.
- No production-grade rate limiting is implemented.
- No production monitoring/observability stack is included.
- The current demo is designed for a small number of simultaneous clients rather than hundreds or thousands.


---

# 27. Horizontal Scaling

The current implementation intentionally uses one server process.

For example:

```text
Clients
   |
   v
Node.js Server
   |
   v
In-memory Rooms
```

If multiple server instances were introduced:

```text
                 Load Balancer
                 /     |     \
                /      |      \
               v       v       v
           Server 1 Server 2 Server 3
               \       |       /
                \      |      /
                 Redis Pub/Sub
```

The problem is that clients in the same room could connect to different server instances.

For example:

```text
Client A → Server 1
Client B → Server 2
```

If Client A sends a cursor event, Server 1 needs a way to notify Server 2.

A shared pub/sub system such as Redis could be used for this.

The production flow could become:

```text
Client A
   |
   v
Server 1
   |
   v
Redis Pub/Sub
   |
   v
Server 2
   |
   v
Client B
```

The current project does not implement this because the assignment explicitly focuses on a minimal single-server synchronization engine.

This is a scaling design discussion rather than a claim that horizontal scaling is already implemented.


---

# 28. Production Improvements

If this project were developed into a production system, I would consider adding:

- Authentication
- Authorization
- TLS/WSS
- Input size limits
- Message rate limiting
- Per-client reaction rate limits
- Redis/pub-sub for multiple server instances
- Persistent storage where required
- Structured logging
- Metrics
- Distributed tracing
- Load testing
- Automated integration tests
- Graceful server shutdown
- Health checks
- Connection monitoring
- Better abuse protection


---

# 29. Why the Server Does Not Store Every Cursor Position

Cursor movement is continuously changing state.

Storing every position would create unnecessary memory growth.

For example, instead of:

```text
A:
x1,y1
x2,y2
x3,y3
x4,y4
x5,y5
...
```

the server mainly needs:

```text
A:
current x
current y
latest sequence
```

The old cursor positions are no longer useful after the newer position has been accepted.

This keeps the synchronization state small and predictable.


---

# 30. Design Tradeoffs

## Simplicity vs. Complexity

The system deliberately uses a small protocol instead of introducing a large synchronization framework.

This makes the behavior easier to understand and debug.

## Bandwidth vs. Responsiveness

30 Hz cursor updates reduce bandwidth compared with sending every mouse event while still providing frequent position updates.

## Smoothness vs. Latency

Interpolation makes remote movement smoother but can introduce a small visual delay.

A more aggressive smoothing system could look smoother but feel less responsive.

The current implementation chooses a balanced approach.

## Server State vs. Client State

The server maintains the authoritative room membership and current participant information.

The client is responsible for the visual representation of remote movement.

This keeps the server simple while allowing the browser to render smoothly.


---

# 31. Interview / Demo Flow

During the live demonstration, the application can be explained in this order:

### Step 1 — Open Multiple Clients

Open 3–5 browser tabs.

Show:

```text
A
B
C
D
E
```

appearing in the participant list.


### Step 2 — Move Cursors

Move the mouse in different tabs.

Explain:

```text
mousemove
→ throttle
→ sequence number
→ WebSocket
→ server validation
→ room broadcast
→ remote rendering
```


### Step 3 — Demonstrate Reaction

Click a reaction.

Show that the reaction appears to all participants, including the sender.


### Step 4 — Demonstrate Network Throttling

Use browser developer tools to throttle the network.

Explain that packets arrive at irregular intervals, but interpolation moves the remote cursor smoothly toward the latest known position.


### Step 5 — Close a Tab

Close one client.

Explain:

```text
WebSocket close
→ cleanup
→ remove from room
→ presence:left
→ other clients remove cursor
```


### Step 6 — Demonstrate Network Loss

Disable or throttle the network.

Explain:

```text
heartbeat stops
→ server timeout
→ connection removed
→ presence:left
```

This prevents zombie cursors.


### Step 7 — Explain Scaling

Explain that the current implementation is intentionally single-server and that Redis/pub-sub could be introduced when multiple server instances are required.


---

# 32. Important Design Decisions

| Problem | Decision |
|---|---|
| Real-time communication | Raw WebSocket |
| High-frequency cursor events | ~30 Hz throttling |
| Stale messages | Sequence numbers |
| Smooth remote cursor | Client-side interpolation |
| Room state | In-memory |
| Presence | Join/leave messages |
| Network failure | Heartbeat + timeout |
| Reconnection | Client reconnect logic |
| New client state | Snapshot |
| Reactions | Event broadcast |
| Message safety | TypeScript + runtime validation |
| Participant identity | Stable client ID + A–O names |
| Maximum room size | 15 |
| Horizontal scaling | Documented design, not implemented |
| Persistence | Not implemented |


---

# 33. Assignment Requirement Coverage

## Core Synchronization Engine

- [x] Raw WebSocket transport
- [x] Multiple clients
- [x] Shared cursor state
- [x] Reaction action
- [x] New-client snapshot
- [x] Client-side interpolation
- [x] Disconnect handling
- [x] Reconnection
- [x] Sequence-based ordering
- [x] Type-safe protocol
- [x] Runtime validation


## Example Demo

- [x] Multiple simultaneous clients
- [x] Cursor synchronization
- [x] Reaction visible to participants
- [x] Participant count
- [x] Presence list
- [x] Tab-close handling
- [x] Network-loss handling


## Server

- [x] Room management
- [x] Presence management
- [x] Broadcast fan-out
- [x] Heartbeat
- [x] Dead-client cleanup
- [x] No external synchronization library


## Code Architecture

- [x] Transport separated from protocol
- [x] Protocol separated from rendering
- [x] Type definitions separated from WebSocket frame handling
- [x] Cursor rendering separated from networking


---

# 34. Optional / Future Improvements

The assignment lists several optional bonus ideas.

The current project does not claim all of these as implemented.

Possible future improvements include:

- More advanced extrapolation
- Adaptive throttling based on measured RTT
- More advanced conflict resolution
- Per-client latency/jitter visualization
- Horizontal scaling using Redis/pub-sub
- Authentication
- Persistent room state


---

# 35. Final Summary

This project is intentionally small.

The goal was not to build a huge multiplayer platform.

The goal was to understand and implement the important parts of a real-time synchronization system:

```text
Message Design
      ↓
WebSocket Transport
      ↓
Validation
      ↓
Room State
      ↓
Broadcast
      ↓
Ordering
      ↓
Interpolation
      ↓
Smooth Rendering
      ↓
Failure Handling
```

The implementation demonstrates how real-time multiplayer synchronization can be built without relying on a synchronization framework.

The main engineering focus was keeping the system:

- Simple
- Understandable
- Type-safe
- Network-aware
- Smooth
- Resistant to stale messages
- Able to handle disconnects
- Easy to explain and extend


---

# 36. Author

**Primary Developer:** K R Preetham

The implementation, integration, debugging, testing, synchronization logic, UI work, and final technical decisions were handled as part of the project development.

AI tools were used as development assistance and were disclosed above. The final code was reviewed and tested so that the implementation can be explained during the technical discussion.