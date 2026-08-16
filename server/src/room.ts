// server/src/room.ts

import type {
    Participant,
} from "./protocol";


// ============================================================
// CONFIGURATION
// ============================================================

export const MAX_PARTICIPANTS = 15;


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
// SOCKET
// ============================================================

export type ClientSocket = {
    send: (data: string) => void;
};


// ============================================================
// ACTIVE CLIENT
// ============================================================

type RoomClient = {
    participant: Participant;

    socket: ClientSocket;

    lastSequence: number;
};


// ============================================================
// ROOM
// ============================================================

export class Room {

    private readonly clients =
        new Map<
            string,
            RoomClient
        >();


    private readonly identityNames =
        new Map<
            string,
            string
        >();


    private readonly identityColors =
        new Map<
            string,
            string
        >();


    constructor(
        public readonly id: string
    ) {}


    // ========================================================
    // CAPACITY
    // ========================================================

    isFull(): boolean {

        return (
            this.clients.size >=
            MAX_PARTICIPANTS
        );
    }


    size(): number {

        return this.clients.size;
    }


    isEmpty(): boolean {

        return (
            this.clients.size ===
            0
        );
    }


    // ========================================================
    // ADD CLIENT
    // ========================================================

    addClient(
        clientId: string,
        socket: ClientSocket
    ): Participant | null {

        if (
            this.isFull()
        ) {

            return null;
        }


        const name =
            this.getOrCreateName(
                clientId
            );


        if (!name) {

            return null;
        }


        const color =
            this.getOrCreateColor(
                clientId
            );


        const participant:
            Participant = {

            clientId,

            name,

            color,

            x: 0,

            y: 0,
        };


        this.clients.set(
            clientId,

            {

                participant,

                socket,

                lastSequence: -1,
            }
        );


        return participant;
    }


    // ========================================================
    // REMOVE CLIENT
    // ========================================================

    removeClient(
        clientId: string
    ): Participant | null {

        const client =
            this.clients.get(
                clientId
            );


        if (!client) {

            return null;
        }


        this.clients.delete(
            clientId
        );


        return {
            ...client.participant,
        };
    }


    // ========================================================
    // GET CLIENT
    // ========================================================

    getClient(
        clientId: string
    ): RoomClient | undefined {

        return this.clients.get(
            clientId
        );
    }


    // ========================================================
    // GET PARTICIPANTS
    // ========================================================

    getParticipants():
        Participant[] {

        return Array.from(
            this.clients.values()
        ).map(
            client => ({
                ...client.participant,
            })
        );
    }


    // ========================================================
    // UPDATE CURSOR
    // ========================================================

    updateCursor(
        clientId: string,
        sequence: number,
        x: number,
        y: number
    ): Participant | null {

        const client =
            this.clients.get(
                clientId
            );


        if (!client) {

            return null;
        }


        if (
            sequence <=
            client.lastSequence
        ) {

            return null;
        }


        client.lastSequence =
            sequence;


        client.participant.x =
            x;


        client.participant.y =
            y;


        return {
            ...client.participant,
        };
    }


    // ========================================================
    // BROADCAST
    // ========================================================

    broadcast(
        message: unknown,
        exceptClientId?: string
    ): void {

        const serialized =
            JSON.stringify(
                message
            );


        for (
            const [
                clientId,
                client,
            ] of this.clients
        ) {

            if (
                clientId ===
                exceptClientId
            ) {

                continue;
            }


            try {

                client.socket.send(
                    serialized
                );

            } catch {

                // Server-level cleanup handles
                // failed sockets.
            }
        }
    }


    // ========================================================
    // IDENTITY
    // ========================================================

    private getOrCreateName(
        clientId: string
    ): string | null {

        const existing =
            this.identityNames.get(
                clientId
            );


        if (existing) {

            return existing;
        }


        const usedNames =
            new Set(
                this.identityNames.values()
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


        this.identityNames.set(
            clientId,
            name
        );


        return name;
    }


    private getOrCreateColor(
        clientId: string
    ): string {

        const existing =
            this.identityColors.get(
                clientId
            );


        if (existing) {

            return existing;
        }


        const usedColors =
            new Set(
                this.identityColors.values()
            );


        const color =
            COLORS.find(
                candidate =>
                    !usedColors.has(
                        candidate
                    )
            ) ??
            COLORS[
                this.identityColors.size %
                COLORS.length
            ];


        this.identityColors.set(
            clientId,
            color
        );


        return color;
    }
}


// ============================================================
// ROOM MANAGER
// ============================================================

export class RoomManager {

    private readonly rooms =
        new Map<
            string,
            Room
        >();


    // ========================================================
    // GET OR CREATE
    // ========================================================

    getOrCreateRoom(
        roomId: string
    ): Room {

        let room =
            this.rooms.get(
                roomId
            );


        if (!room) {

            room =
                new Room(
                    roomId
                );


            this.rooms.set(
                roomId,
                room
            );
        }


        return room;
    }


    // ========================================================
    // GET
    // ========================================================

    getRoom(
        roomId: string
    ): Room | undefined {

        return this.rooms.get(
            roomId
        );
    }


    // ========================================================
    // EMPTY ROOM CLEANUP
    // ========================================================

    removeIfEmpty(
        roomId: string
    ): void {

        const room =
            this.rooms.get(
                roomId
            );


        if (
            room &&
            room.isEmpty()
        ) {

            this.rooms.delete(
                roomId
            );
        }
    }
}