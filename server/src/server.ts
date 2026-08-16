import http from "node:http";
import crypto from "node:crypto";
import type { Duplex } from "node:stream";

import {
    parseClientMessage,
    serializeServerMessage,
    type ClientMessage,
    type ServerMessage,
    type Participant,
} from "./protocol";


// ============================================================
// CONFIGURATION
// ============================================================

const PORT = 8080;
const MAX_PARTICIPANTS = 15;

const HEARTBEAT_INTERVAL = 5_000;
const HEARTBEAT_TIMEOUT = 15_000;

const WEBSOCKET_GUID =
    "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";


// ============================================================
// PARTICIPANT IDENTITIES
// ============================================================

const CLIENT_NAMES = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
];

const COLORS = [
    "#4F7CFF",
    "#A855F7",
    "#22C55E",
    "#F97316",
    "#EC4899",
    "#06B6D4",
    "#EAB308",
    "#EF4444",
    "#14B8A6",
    "#F43F5E",
    "#8B5CF6",
    "#10B981",
    "#F59E0B",
    "#06B6D4",
    "#6366F1",
];


// ============================================================
// TYPES
// ============================================================

type Identity = {
    name: string;
    color: string;
};

type Client = {
    socket: Duplex;

    clientId: string;

    name: string;

    color: string;

    roomId: string | null;

    x: number;

    y: number;

    lastSequence: number;

    lastHeartbeatAt: number;

    buffer: Buffer;

    cleanedUp: boolean;
};


// ============================================================
// SERVER STATE
// ============================================================

const clients =
    new Map<string, Client>();

const rooms =
    new Map<string, Set<string>>();


// Identity remains associated with the clientId so a
// reconnecting browser receives the same A-O identity.

const identities =
    new Map<string, Identity>();


// ============================================================
// HTTP SERVER
// ============================================================

const server =
    http.createServer();


// ============================================================
// WEBSOCKET UPGRADE
// ============================================================

server.on(
    "upgrade",
    (
        request,
        socket
    ) => {

        if (
            request.headers.upgrade?.toLowerCase() !==
            "websocket"
        ) {

            socket.destroy();

            return;
        }


        const websocketKey =
            request.headers[
                "sec-websocket-key"
            ];


        if (
            !websocketKey ||
            Array.isArray(websocketKey)
        ) {

            socket.destroy();

            return;
        }


        const acceptKey =
            crypto
                .createHash("sha1")
                .update(
                    websocketKey +
                    WEBSOCKET_GUID
                )
                .digest("base64");


        socket.write(
            [
                "HTTP/1.1 101 Switching Protocols",
                "Upgrade: websocket",
                "Connection: Upgrade",
                `Sec-WebSocket-Accept: ${acceptKey}`,
                "\r\n",
            ].join("\r\n")
        );


        const client: Client = {

            socket,

            clientId: "",

            name: "",

            color: "",

            roomId: null,

            x: 0,

            y: 0,

            lastSequence: -1,

            lastHeartbeatAt:
                Date.now(),

            buffer:
                Buffer.alloc(0),

            cleanedUp: false,
        };


        console.log(
            "WebSocket connection established"
        );


        socket.on(
            "data",
            (
                data: Buffer
            ) => {

                handleSocketData(
                    client,
                    data
                );
            }
        );


        socket.on(
            "error",
            (
                error: Error
            ) => {

                console.log(
                    `WebSocket socket error: ${error.message}`
                );

                cleanupClient(
                    client
                );
            }
        );


        socket.on(
            "close",
            () => {

                console.log(
                    "WebSocket socket closed"
                );

                cleanupClient(
                    client
                );
            }
        );
    }
);


// ============================================================
// IDENTITY
// ============================================================

function getOrCreateIdentity(
    clientId: string
): Identity | null {

    const existing =
        identities.get(
            clientId
        );


    if (existing) {

        return existing;
    }


    const usedNames =
        new Set(
            [...clients.values()]
                .map(
                    client =>
                        client.name
                )
        );


    const usedColors =
        new Set(
            [...clients.values()]
                .map(
                    client =>
                        client.color
                )
        );


    const name =
        CLIENT_NAMES.find(
            candidate =>
                !usedNames.has(
                    candidate
                )
        );


    if (!name) {

        return null;
    }


    const color =
        COLORS.find(
            candidate =>
                !usedColors.has(
                    candidate
                )
        ) ??
        COLORS[
            identities.size %
            COLORS.length
        ];


    const identity: Identity = {

        name,

        color,
    };


    identities.set(
        clientId,
        identity
    );


    return identity;
}


// ============================================================
// SOCKET DATA
// ============================================================

function handleSocketData(
    client: Client,
    data: Buffer
): void {

    if (
        client.cleanedUp
    ) {

        return;
    }


    client.buffer =
        Buffer.concat([
            client.buffer,
            data,
        ]);


    while (true) {

        const frame =
            readWebSocketFrame(
                client.buffer
            );


        if (!frame) {

            break;
        }


        client.buffer =
            frame.remaining;


        switch (
            frame.opcode
        ) {

            case 0x8:

                handleCloseFrame(
                    client
                );

                break;


            case 0x9:

                handlePingFrame(
                    client,
                    frame.payload
                );

                break;


            case 0xA:

                handlePongFrame(
                    client
                );

                break;


            case 0x1:

                handleTextMessage(
                    client,
                    frame.payload.toString(
                        "utf8"
                    )
                );

                break;


            default:

                break;
        }


        if (
            frame.opcode ===
            0x8
        ) {

            break;
        }
    }
}


// ============================================================
// CLOSE FRAME
// ============================================================

function handleCloseFrame(
    client: Client
): void {

    if (
        client.socket.destroyed
    ) {

        return;
    }


    client.socket.end();
}


// ============================================================
// WEBSOCKET PING
// ============================================================

function handlePingFrame(
    client: Client,
    payload: Buffer
): void {

    if (
        client.socket.destroyed
    ) {

        return;
    }


    sendWebSocketFrame(
        client.socket,
        payload,
        0xA
    );
}


// ============================================================
// WEBSOCKET PONG
// ============================================================

function handlePongFrame(
    client: Client
): void {

    client.lastHeartbeatAt =
        Date.now();
}


// ============================================================
// TEXT MESSAGE
// ============================================================

function handleTextMessage(
    client: Client,
    text: string
): void {

    let raw: unknown;


    try {

        raw =
            JSON.parse(
                text
            );

    } catch {

        sendError(
            client,
            "Invalid JSON message."
        );

        return;
    }


    const message =
        parseClientMessage(
            raw
        );


    if (!message) {

        sendError(
            client,
            "Malformed or unknown message."
        );

        return;
    }


    handleClientMessage(
        client,
        message
    );
}


// ============================================================
// MESSAGE DISPATCH
// ============================================================

function handleClientMessage(
    client: Client,
    message: ClientMessage
): void {

    switch (
        message.type
    ) {

        case "join":

            handleJoin(
                client,
                message
            );

            break;


        case "cursor":

            handleCursor(
                client,
                message
            );

            break;


        case "reaction":

            handleReaction(
                client,
                message
            );

            break;


        case "heartbeat":

            handleHeartbeat(
                client,
                message
            );

            break;
    }
}


// ============================================================
// APPLICATION HEARTBEAT + RTT ACK
// ============================================================

function handleHeartbeat(
    client: Client,
    message: Extract<
        ClientMessage,
        {
            type: "heartbeat";
        }
    >
): void {

    // Keep the existing dead-client detection.
    client.lastHeartbeatAt =
        Date.now();


    // Echo the browser timestamp only to
    // the client that sent the heartbeat.
    //
    // Client:
    //
    // RTT =
    // performance.now() - message.timestamp

    sendMessage(
        client,
        {

            type:
                "heartbeatAck",

            timestamp:
                message.timestamp,
        }
    );
}


// ============================================================
// JOIN
// ============================================================

function handleJoin(
    client: Client,
    message: Extract<
        ClientMessage,
        {
            type: "join";
        }
    >
): void {

    // One room per WebSocket connection.
    if (
        client.roomId !==
        null
    ) {

        return;
    }


    const room =
        getOrCreateRoom(
            message.roomId
        );


    // Enforce the 15-client limit.
    if (
        room.size >=
        MAX_PARTICIPANTS
    ) {

        sendError(
            client,
            "Room is full. Maximum 15 participants allowed."
        );


        client.socket.end();

        return;
    }


    client.clientId =
        message.clientId;


    const identity =
        getOrCreateIdentity(
            client.clientId
        );


    if (!identity) {

        sendError(
            client,
            "No participant identity is available."
        );


        client.socket.end();

        return;
    }


    client.name =
        identity.name;

    client.color =
        identity.color;

    client.lastSequence =
        -1;

    client.lastHeartbeatAt =
        Date.now();


    // Prevent duplicate active client IDs from
    // accidentally replacing an existing socket.
    const existing =
        clients.get(
            client.clientId
        );


    if (
        existing &&
        existing !== client
    ) {

        cleanupClient(
            existing
        );
    }


    clients.set(
        client.clientId,
        client
    );


    client.roomId =
        message.roomId;


    room.add(
        client.clientId
    );


    // Send snapshot to joining client.
    sendMessage(
        client,
        {

            type:
                "snapshot",

            self:
                toParticipant(
                    client
                ),

            participants:
                getRoomParticipants(
                    room
                ),
        }
    );


    // Tell everyone else.
    broadcastToRoom(
        client.roomId,

        {

            type:
                "presence",

            action:
                "joined",

            participant:
                toParticipant(
                    client
                ),
        },

        client.clientId
    );


    console.log(
        `${client.clientId} (${client.name}) joined room ${client.roomId}`
    );
}


// ============================================================
// CURSOR
// ============================================================

function handleCursor(
    client: Client,
    message: Extract<
        ClientMessage,
        {
            type: "cursor";
        }
    >
): void {

    if (
        client.roomId ===
        null
    ) {

        return;
    }


    // Reject stale/out-of-order packets.
    if (
        message.seq <=
        client.lastSequence
    ) {

        return;
    }


    client.lastSequence =
        message.seq;

    client.x =
        message.x;

    client.y =
        message.y;


    broadcastToRoom(
        client.roomId,

        {

            type:
                "cursor",

            clientId:
                client.clientId,

            name:
                client.name,

            color:
                client.color,

            seq:
                message.seq,

            x:
                message.x,

            y:
                message.y,
        },

        client.clientId
    );
}


// ============================================================
// REACTION
// ============================================================

function handleReaction(
    client: Client,
    message: Extract<
        ClientMessage,
        {
            type: "reaction";
        }
    >
): void {

    if (
        client.roomId ===
        null
    ) {

        return;
    }


    // Reactions are broadcast to everyone,
    // including the sender.
    broadcastToRoom(

        client.roomId,

        {

            type:
                "reaction",

            clientId:
                client.clientId,

            name:
                client.name,

            color:
                client.color,

            emoji:
                message.emoji,

            x:
                message.x,

            y:
                message.y,
        }
    );
}


// ============================================================
// ROOM
// ============================================================

function getOrCreateRoom(
    roomId: string
): Set<string> {

    let room =
        rooms.get(
            roomId
        );


    if (!room) {

        room =
            new Set<string>();


        rooms.set(
            roomId,
            room
        );
    }


    return room;
}


// ============================================================
// ROOM PARTICIPANTS
// ============================================================

function getRoomParticipants(
    room: Set<string>
): Participant[] {

    const participants:
        Participant[] = [];


    for (
        const clientId of
        room
    ) {

        const client =
            clients.get(
                clientId
            );


        if (!client) {

            continue;
        }


        participants.push(
            toParticipant(
                client
            )
        );
    }


    return participants;
}


// ============================================================
// PARTICIPANT
// ============================================================

function toParticipant(
    client: Client
): Participant {

    return {

        clientId:
            client.clientId,

        name:
            client.name,

        color:
            client.color,

        x:
            client.x,

        y:
            client.y,
    };
}


// ============================================================
// BROADCAST
// ============================================================

function broadcastToRoom(
    roomId: string | null,
    message: ServerMessage,
    excludeClientId?: string
): void {

    if (
        roomId ===
        null
    ) {

        return;
    }


    const room =
        rooms.get(
            roomId
        );


    if (!room) {

        return;
    }


    for (
        const clientId of
        room
    ) {

        if (
            clientId ===
            excludeClientId
        ) {

            continue;
        }


        const client =
            clients.get(
                clientId
            );


        if (!client) {

            continue;
        }


        sendMessage(
            client,
            message
        );
    }
}


// ============================================================
// SEND MESSAGE
// ============================================================

function sendMessage(
    client: Client,
    message: ServerMessage
): void {

    if (
        client.socket.destroyed
    ) {

        return;
    }


    const payload =
        Buffer.from(
            serializeServerMessage(
                message
            )
        );


    try {

        sendWebSocketFrame(
            client.socket,
            payload,
            0x1
        );

    } catch {

        cleanupClient(
            client
        );
    }
}


// ============================================================
// SEND ERROR
// ============================================================

function sendError(
    client: Client,
    message: string
): void {

    sendMessage(
        client,
        {

            type:
                "error",

            message,
        }
    );
}


// ============================================================
// CLEANUP
// ============================================================

function cleanupClient(
    client: Client
): void {

    if (
        client.cleanedUp
    ) {

        return;
    }


    client.cleanedUp =
        true;


    if (
        !client.clientId
    ) {

        return;
    }


    if (
        clients.get(
            client.clientId
        ) === client
    ) {

        clients.delete(
            client.clientId
        );
    }


    if (
        client.roomId ===
        null
    ) {

        return;
    }


    const room =
        rooms.get(
            client.roomId
        );


    if (!room) {

        return;
    }


    room.delete(
        client.clientId
    );


    // Notify remaining clients.
    broadcastToRoom(
        client.roomId,

        {

            type:
                "presence",

            action:
                "left",

            participant:
                toParticipant(
                    client
                ),
        }
    );


    if (
        room.size ===
        0
    ) {

        rooms.delete(
            client.roomId
        );
    }


    console.log(
        `${client.clientId} (${client.name}) left room ${client.roomId}`
    );
}


// ============================================================
// WEBSOCKET FRAME READER
// ============================================================

function readWebSocketFrame(
    buffer: Buffer
):
    | {
        opcode: number;
        payload: Buffer;
        remaining: Buffer;
    }
    | null {

    if (
        buffer.length <
        2
    ) {

        return null;
    }


    const firstByte =
        buffer[0];

    const secondByte =
        buffer[1];


    const opcode =
        firstByte &
        0x0f;


    const masked =
        (
            secondByte &
            0x80
        ) !== 0;


    let payloadLength =
        secondByte &
        0x7f;


    let offset =
        2;


    // 16-bit payload length.
    if (
        payloadLength ===
        126
    ) {

        if (
            buffer.length <
            offset + 2
        ) {

            return null;
        }


        payloadLength =
            buffer.readUInt16BE(
                offset
            );


        offset += 2;
    }


    // 64-bit payload length.
    else if (
        payloadLength ===
        127
    ) {

        if (
            buffer.length <
            offset + 8
        ) {

            return null;
        }


        const high =
            buffer.readUInt32BE(
                offset
            );


        const low =
            buffer.readUInt32BE(
                offset + 4
            );


        if (
            high !==
            0
        ) {

            throw new Error(
                "WebSocket frame too large."
            );
        }


        payloadLength =
            low;


        offset += 8;
    }


    const maskLength =
        masked
            ? 4
            : 0;


    if (
        buffer.length <
        offset +
        maskLength +
        payloadLength
    ) {

        return null;
    }


    let mask:
        Buffer | null =
        null;


    if (masked) {

        mask =
            buffer.subarray(
                offset,
                offset + 4
            );


        offset += 4;
    }


    const payload =
        Buffer.from(
            buffer.subarray(
                offset,
                offset +
                payloadLength
            )
        );


    if (mask) {

        for (
            let i = 0;
            i < payload.length;
            i++
        ) {

            payload[i] ^=
                mask[
                    i % 4
                ];
        }
    }


    return {

        opcode,

        payload,

        remaining:
            buffer.subarray(
                offset +
                payloadLength
            ),
    };
}


// ============================================================
// WEBSOCKET FRAME WRITER
// ============================================================

function sendWebSocketFrame(
    socket: Duplex,
    payload: Buffer,
    opcode = 0x1
): void {

    if (
        socket.destroyed
    ) {

        return;
    }


    const length =
        payload.length;


    let header:
        Buffer;


    // Small payload.
    if (
        length <
        126
    ) {

        header =
            Buffer.alloc(2);


        header[0] =
            0x80 |
            opcode;


        header[1] =
            length;
    }


    // Medium payload.
    else if (
        length <
        65_536
    ) {

        header =
            Buffer.alloc(4);


        header[0] =
            0x80 |
            opcode;


        header[1] =
            126;


        header.writeUInt16BE(
            length,
            2
        );
    }


    // Large payload.
    else {

        header =
            Buffer.alloc(10);


        header[0] =
            0x80 |
            opcode;


        header[1] =
            127;


        header.writeUInt32BE(
            0,
            2
        );


        header.writeUInt32BE(
            length,
            6
        );
    }


    if (
        socket.destroyed
    ) {

        return;
    }


    socket.write(
        Buffer.concat([
            header,
            payload,
        ])
    );
}


// ============================================================
// HEARTBEAT MONITOR
// ============================================================

function checkHeartbeat(): void {

    const now =
        Date.now();


    for (
        const client of
        clients.values()
    ) {

        if (
            client.cleanedUp
        ) {

            continue;
        }


        const elapsed =
            now -
            client.lastHeartbeatAt;


        // Remove clients that have stopped sending
        // application heartbeats.
        if (
            elapsed >
            HEARTBEAT_TIMEOUT
        ) {

            console.log(
                `${client.clientId} (${client.name}) heartbeat timeout - removing client`
            );


            cleanupClient(
                client
            );


            if (
                !client.socket.destroyed
            ) {

                client.socket.destroy();
            }


            continue;
        }


        // Also send a WebSocket-level ping.
        if (
            !client.socket.destroyed
        ) {

            try {

                sendWebSocketFrame(
                    client.socket,
                    Buffer.alloc(0),
                    0x9
                );

            } catch {

                cleanupClient(
                    client
                );

                client.socket.destroy();
            }
        }
    }
}


const heartbeatTimer =
    setInterval(
        checkHeartbeat,
        HEARTBEAT_INTERVAL
    );


heartbeatTimer.unref();


// ============================================================
// START SERVER
// ============================================================

server.listen(
    PORT,
    () => {

        console.log(
            `Server listening on http://localhost:${PORT}`
        );
    }
);