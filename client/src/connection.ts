// ============================================================
// CONNECTION / PROTOCOL
// ============================================================

export type ConnectionStatus =
    | "connecting"
    | "connected"
    | "disconnected";


export type Point = {
    x: number;
    y: number;
};


export type Participant = {
    clientId: string;
    name: string;
    color: string;
    x: number;
    y: number;
};


// ============================================================
// SERVER → CLIENT
// ============================================================

export type ServerMessage =
    | {
        type: "snapshot";
        self: Participant;
        participants: Participant[];
    }
    | {
        type: "presence";
        action: "joined" | "left";
        participant: Participant;
    }
    | {
        type: "cursor";
        clientId: string;
        name: string;
        color: string;
        seq: number;
        x: number;
        y: number;
    }
    | {
        type: "reaction";
        clientId: string;
        name: string;
        color: string;
        emoji: string;
        x: number;
        y: number;
    }
    | {
        type: "heartbeatAck";
        timestamp: number;
    }
    | {
        type: "error";
        message: string;
    };


// ============================================================
// CLIENT → SERVER
// ============================================================

export type ClientMessage =
    | {
        type: "join";
        clientId: string;
        roomId: string;
    }
    | {
        type: "cursor";
        seq: number;
        x: number;
        y: number;
    }
    | {
        type: "reaction";
        emoji: string;
        x: number;
        y: number;
    }
    | {
        type: "heartbeat";
        timestamp: number;
    };


// ============================================================
// CONNECTION CONTROLLER
// ============================================================

export type ConnectionController = {
    send: (
        message: ClientMessage
    ) => void;

    close: () => void;
};


// ============================================================
// CONFIGURATION
// ============================================================

// Cursor packets are limited to approximately
// 30 updates per second.

const CURSOR_UPDATE_INTERVAL =
    33;


// Heartbeat interval.

const HEARTBEAT_INTERVAL =
    5_000;


// Development server.

const SERVER_URL =
    "wss://syncspace-iuo1.onrender.com";


const ROOM_ID =
    "demo";


// ============================================================
// STABLE CLIENT ID
// ============================================================

function getClientId(): string {

    const key =
        "multiplayer-sync-client-id";


    const existing =
        sessionStorage.getItem(
            key
        );


    if (existing) {

        return existing;
    }


    const id =
        crypto.randomUUID();


    sessionStorage.setItem(
        key,
        id
    );


    return id;
}


// ============================================================
// BASIC VALIDATORS
// ============================================================

function isObject(
    value: unknown
): value is Record<string, unknown> {

    return (
        typeof value ===
            "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}


function isString(
    value: unknown
): value is string {

    return typeof value ===
        "string";
}


function isFiniteNumber(
    value: unknown
): value is number {

    return (
        typeof value ===
            "number" &&
        Number.isFinite(value)
    );
}


// ============================================================
// PARTICIPANT VALIDATION
// ============================================================

function isParticipant(
    value: unknown
): value is Participant {

    if (
        !isObject(value)
    ) {

        return false;
    }


    return (

        isString(
            value.clientId
        ) &&

        isString(
            value.name
        ) &&

        isString(
            value.color
        ) &&

        isFiniteNumber(
            value.x
        ) &&

        isFiniteNumber(
            value.y
        )
    );
}


// ============================================================
// SERVER MESSAGE VALIDATION
// ============================================================

function parseServerMessage(
    raw: unknown
): ServerMessage | null {

    if (
        !isObject(raw)
    ) {

        return null;
    }


    const type =
        raw.type;


    if (
        !isString(type)
    ) {

        return null;
    }


    // ========================================================
    // SNAPSHOT
    // ========================================================

    if (
        type ===
        "snapshot"
    ) {

        if (
            !isParticipant(
                raw.self
            ) ||

            !Array.isArray(
                raw.participants
            )
        ) {

            return null;
        }


        if (
            !raw.participants.every(
                isParticipant
            )
        ) {

            return null;
        }


        return {

            type: "snapshot",

            self:
                raw.self,

            participants:
                raw.participants,
        };
    }


    // ========================================================
    // PRESENCE
    // ========================================================

    if (
        type ===
        "presence"
    ) {

        if (
            raw.action !==
                "joined" &&

            raw.action !==
                "left"
        ) {

            return null;
        }


        if (
            !isParticipant(
                raw.participant
            )
        ) {

            return null;
        }


        return {

            type: "presence",

            action:
                raw.action,

            participant:
                raw.participant,
        };
    }


    // ========================================================
    // CURSOR
    // ========================================================

    if (
        type ===
        "cursor"
    ) {

        if (

            !isString(
                raw.clientId
            ) ||

            !isString(
                raw.name
            ) ||

            !isString(
                raw.color
            ) ||

            !isFiniteNumber(
                raw.seq
            ) ||

            !isFiniteNumber(
                raw.x
            ) ||

            !isFiniteNumber(
                raw.y
            )
        ) {

            return null;
        }


        if (

            !Number.isInteger(
                raw.seq
            ) ||

            raw.seq < 0 ||

            raw.x < 0 ||

            raw.y < 0
        ) {

            return null;
        }


        return {

            type: "cursor",

            clientId:
                raw.clientId,

            name:
                raw.name,

            color:
                raw.color,

            seq:
                raw.seq,

            x:
                raw.x,

            y:
                raw.y,
        };
    }


    // ========================================================
    // REACTION
    // ========================================================

    if (
        type ===
        "reaction"
    ) {

        if (

            !isString(
                raw.clientId
            ) ||

            !isString(
                raw.name
            ) ||

            !isString(
                raw.color
            ) ||

            !isString(
                raw.emoji
            ) ||

            !isFiniteNumber(
                raw.x
            ) ||

            !isFiniteNumber(
                raw.y
            )
        ) {

            return null;
        }


        return {

            type: "reaction",

            clientId:
                raw.clientId,

            name:
                raw.name,

            color:
                raw.color,

            emoji:
                raw.emoji,

            x:
                raw.x,

            y:
                raw.y,
        };
    }


    // ========================================================
    // HEARTBEAT ACK
    // ========================================================

    if (
        type ===
        "heartbeatAck"
    ) {

        if (
            !isFiniteNumber(
                raw.timestamp
            )
        ) {

            return null;
        }


        return {

            type:
                "heartbeatAck",

            timestamp:
                raw.timestamp,
        };
    }


    // ========================================================
    // ERROR
    // ========================================================

    if (
        type ===
        "error"
    ) {

        if (
            !isString(
                raw.message
            )
        ) {

            return null;
        }


        return {

            type: "error",

            message:
                raw.message,
        };
    }


    return null;
}


// ============================================================
// CONNECT
// ============================================================

export function connectToServer(
    onMessage: (
        message: ServerMessage
    ) => void,

    onStatusChange: (
        status: ConnectionStatus
    ) => void,

    onLatencyChange?: (
        latency: number
    ) => void
): ConnectionController {

    const clientId =
        getClientId();


    let socket:
        WebSocket | null =
        null;


    let closedByUser =
        false;


    let reconnectTimer:
        number | null =
        null;


    let heartbeatTimer:
        number | null =
        null;


    let cursorTimer:
        number | null =
        null;


    let reconnectDelay =
        500;


    let sequence =
        0;


    // ========================================================
    // CURSOR THROTTLING
    // ========================================================

    let lastCursorSentAt =
        0;


    let pendingCursor:
        Point | null =
        null;


    // ========================================================
    // LATENCY
    // ========================================================

    let currentLatency =
        0;


    const updateLatency =
        (
            latency: number
        ): void => {

            if (
                !Number.isFinite(
                    latency
                )
            ) {

                return;
            }


            // Ignore impossible values.
            const safeLatency =
                Math.max(
                    0,
                    Math.min(
                        latency,
                        5_000
                    )
                );


            // Smooth the displayed RTT instead of
            // jumping on every heartbeat.

            currentLatency =
                currentLatency === 0

                    ? safeLatency

                    : currentLatency * 0.7 +
                      safeLatency * 0.3;


            onLatencyChange?.(
                Math.round(
                    currentLatency
                )
            );
        };


    // ========================================================
    // SEND
    // ========================================================

    const send = (
        message: ClientMessage
    ): void => {

        if (

            !socket ||

            socket.readyState !==
                WebSocket.OPEN
        ) {

            return;
        }


        try {

            socket.send(
                JSON.stringify(
                    message
                )
            );

        } catch {

            // Socket may have closed between
            // readyState check and send.
        }
    };


    // ========================================================
    // HEARTBEAT
    // ========================================================

    const stopHeartbeat =
        (): void => {

            if (
                heartbeatTimer !==
                null
            ) {

                window.clearInterval(
                    heartbeatTimer
                );


                heartbeatTimer =
                    null;
            }
        };


    const sendHeartbeat =
        (): void => {

            // performance.now() is monotonic,
            // making it suitable for RTT measurement.

            send({

                type:
                    "heartbeat",

                timestamp:
                    performance.now(),
            });
        };


    const startHeartbeat =
        (): void => {

            stopHeartbeat();


            sendHeartbeat();


            heartbeatTimer =
                window.setInterval(
                    sendHeartbeat,
                    HEARTBEAT_INTERVAL
                );
        };


    // ========================================================
    // CURSOR SEND
    // ========================================================

    const flushCursor =
        (): void => {

            if (
                !pendingCursor
            ) {

                return;
            }


            const point =
                pendingCursor;


            pendingCursor =
                null;


            lastCursorSentAt =
                performance.now();


            sequence += 1;


            send({

                type:
                    "cursor",

                seq:
                    sequence,

                x:
                    point.x,

                y:
                    point.y,
            });
        };


    const sendCursor =
        (
            point: Point
        ): void => {

            pendingCursor =
                point;


            const now =
                performance.now();


            const elapsed =
                now -
                lastCursorSentAt;


            if (
                elapsed >=
                CURSOR_UPDATE_INTERVAL
            ) {

                flushCursor();

                return;
            }


            if (
                cursorTimer ===
                null
            ) {

                cursorTimer =
                    window.setTimeout(
                        () => {

                            cursorTimer =
                                null;


                            flushCursor();
                        },

                        Math.max(
                            0,

                            CURSOR_UPDATE_INTERVAL -
                            elapsed
                        )
                    );
            }
        };


    // ========================================================
    // MOUSE TRACKING
    // ========================================================

    const handleMouseMove =
        (
            event: MouseEvent
        ): void => {

            sendCursor({

                x:
                    event.clientX,

                y:
                    event.clientY,
            });
        };


    window.addEventListener(
        "mousemove",
        handleMouseMove,
        {
            passive: true,
        }
    );


    // ========================================================
    // RECONNECT
    // ========================================================

    const scheduleReconnect =
        (): void => {

            if (

                closedByUser ||

                reconnectTimer !==
                    null
            ) {

                return;
            }


            reconnectTimer =
                window.setTimeout(
                    () => {

                        reconnectTimer =
                            null;


                        connect();


                        reconnectDelay =
                            Math.min(
                                reconnectDelay * 2,
                                5_000
                            );
                    },

                    reconnectDelay
                );
        };


    // ========================================================
    // CONNECT
    // ========================================================

    const connect =
        (): void => {

            if (
                closedByUser
            ) {

                return;
            }


            onStatusChange(
                "connecting"
            );


            socket =
                new WebSocket(
                    SERVER_URL
                );


            // ====================================================
            // OPEN
            // ====================================================

            socket.onopen =
                (): void => {

                    reconnectDelay =
                        500;


                    onStatusChange(
                        "connected"
                    );


                    send({

                        type:
                            "join",

                        clientId,

                        roomId:
                            ROOM_ID,
                    });


                    startHeartbeat();
                };


            // ====================================================
            // MESSAGE
            // ====================================================

            socket.onmessage =
                (
                    event: MessageEvent
                ): void => {

                    let raw:
                        unknown;


                    try {

                        raw =
                            JSON.parse(
                                event.data
                            );

                    } catch {

                        console.warn(
                            "Invalid server JSON rejected."
                        );

                        return;
                    }


                    const message =
                        parseServerMessage(
                            raw
                        );


                    if (
                        !message
                    ) {

                        console.warn(
                            "Invalid server message rejected."
                        );

                        return;
                    }


                    // --------------------------------------------
                    // RTT
                    // --------------------------------------------

                    if (
                        message.type ===
                        "heartbeatAck"
                    ) {

                        const elapsed =
                            performance.now() -
                            message.timestamp;


                        updateLatency(
                            elapsed
                        );


                        return;
                    }


                    onMessage(
                        message
                    );
                };


            // ====================================================
            // ERROR
            // ====================================================

            socket.onerror =
                (): void => {

                    onStatusChange(
                        "disconnected"
                    );
                };


            // ====================================================
            // CLOSE
            // ====================================================

            socket.onclose =
                (): void => {

                    socket =
                        null;


                    stopHeartbeat();


                    onStatusChange(
                        "disconnected"
                    );


                    if (
                        closedByUser
                    ) {

                        return;
                    }


                    scheduleReconnect();
                };
        };


    // ========================================================
    // CLOSE
    // ========================================================

    const close =
        (): void => {

            closedByUser =
                true;


            // Stop reconnect.
            if (
                reconnectTimer !==
                null
            ) {

                window.clearTimeout(
                    reconnectTimer
                );


                reconnectTimer =
                    null;
            }


            // Stop heartbeat.
            stopHeartbeat();


            // Stop cursor timer.
            if (
                cursorTimer !==
                null
            ) {

                window.clearTimeout(
                    cursorTimer
                );


                cursorTimer =
                    null;
            }


            pendingCursor =
                null;


            // Remove mouse listener.
            window.removeEventListener(
                "mousemove",
                handleMouseMove
            );


            // Close socket.
            socket?.close();


            socket =
                null;
        };


    // ========================================================
    // START
    // ========================================================

    connect();


    return {

        send,

        close,
    };
}