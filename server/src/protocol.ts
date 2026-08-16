// ============================================================
// PROTOCOL TYPES
// ============================================================

export type Participant = {
    clientId: string;
    name: string;
    color: string;
    x: number;
    y: number;
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
        action:
            | "joined"
            | "left";
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
// VALIDATION HELPERS
// ============================================================

function isObject(
    value: unknown
): value is Record<string, unknown> {

    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}


function isString(
    value: unknown
): value is string {

    return typeof value === "string";
}


function isFiniteNumber(
    value: unknown
): value is number {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}


function isValidPosition(
    value: unknown
): value is number {

    return (
        isFiniteNumber(value) &&
        value >= 0
    );
}


function isValidSequence(
    value: unknown
): value is number {

    return (
        isFiniteNumber(value) &&
        Number.isInteger(value) &&
        value >= 0
    );
}


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

        isValidPosition(
            value.x
        ) &&

        isValidPosition(
            value.y
        )
    );
}


// ============================================================
// CLIENT → SERVER VALIDATION
// ============================================================

export function parseClientMessage(
    raw: unknown
): ClientMessage | null {

    if (
        !isObject(raw)
    ) {

        return null;
    }


    if (
        !isString(raw.type)
    ) {

        return null;
    }


    // ========================================================
    // JOIN
    // ========================================================

    if (
        raw.type === "join"
    ) {

        if (

            !isString(
                raw.clientId
            ) ||

            !isString(
                raw.roomId
            )
        ) {

            return null;
        }


        if (

            raw.clientId.length === 0 ||

            raw.clientId.length > 128 ||

            raw.roomId.length === 0 ||

            raw.roomId.length > 128
        ) {

            return null;
        }


        return {

            type:
                "join",

            clientId:
                raw.clientId,

            roomId:
                raw.roomId,
        };
    }


    // ========================================================
    // CURSOR
    // ========================================================

    if (
        raw.type === "cursor"
    ) {

        if (

            !isValidSequence(
                raw.seq
            ) ||

            !isValidPosition(
                raw.x
            ) ||

            !isValidPosition(
                raw.y
            )
        ) {

            return null;
        }


        return {

            type:
                "cursor",

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
        raw.type === "reaction"
    ) {

        if (

            !isString(
                raw.emoji
            ) ||

            !isValidPosition(
                raw.x
            ) ||

            !isValidPosition(
                raw.y
            )
        ) {

            return null;
        }


        if (

            raw.emoji.length === 0 ||

            raw.emoji.length > 16
        ) {

            return null;
        }


        return {

            type:
                "reaction",

            emoji:
                raw.emoji,

            x:
                raw.x,

            y:
                raw.y,
        };
    }


    // ========================================================
    // HEARTBEAT
    // ========================================================

    if (
        raw.type === "heartbeat"
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
                "heartbeat",

            timestamp:
                raw.timestamp,
        };
    }


    return null;
}


// ============================================================
// SERVER SERIALIZATION
// ============================================================

export function serializeServerMessage(
    message: ServerMessage
): string {

    return JSON.stringify(
        message
    );
}


// ============================================================
// SERVER → CLIENT VALIDATION
// ============================================================

export function parseServerMessage(
    raw: unknown
): ServerMessage | null {

    if (
        !isObject(raw)
    ) {

        return null;
    }


    if (
        !isString(raw.type)
    ) {

        return null;
    }


    // ========================================================
    // SNAPSHOT
    // ========================================================

    if (
        raw.type === "snapshot"
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

            type:
                "snapshot",

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
        raw.type === "presence"
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

            type:
                "presence",

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
        raw.type === "cursor"
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

            !isValidSequence(
                raw.seq
            ) ||

            !isValidPosition(
                raw.x
            ) ||

            !isValidPosition(
                raw.y
            )
        ) {

            return null;
        }


        return {

            type:
                "cursor",

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
        raw.type === "reaction"
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

            !isValidPosition(
                raw.x
            ) ||

            !isValidPosition(
                raw.y
            )
        ) {

            return null;
        }


        if (

            raw.emoji.length === 0 ||

            raw.emoji.length > 16
        ) {

            return null;
        }


        return {

            type:
                "reaction",

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
        raw.type ===
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
        raw.type ===
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

            type:
                "error",

            message:
                raw.message,
        };
    }


    return null;
}