import {
    useEffect,
    useRef,
    useState,
} from "react";

import "./App.css";

import {
    connectToServer,
    type ConnectionController,
    type ConnectionStatus,
    type Participant,
    type ServerMessage,
} from "./connection";


// ============================================================
// REMOTE CURSOR STATE
// ============================================================

type CursorElement = {
    element: HTMLDivElement;

    targetX: number;
    targetY: number;

    currentX: number;
    currentY: number;

    velocityX: number;
    velocityY: number;

    lastPacketTime: number;
    lastSequence: number;
};


// ============================================================
// REACTION
// ============================================================

type Reaction = {
    id: string;

    emoji: string;

    name: string;

    color: string;

    x: number;

    y: number;
};


// ============================================================
// APP
// ============================================================

function App() {

    const [status, setStatus] =
        useState<ConnectionStatus>(
            "connecting"
        );


    const [self, setSelf] =
        useState<Participant | null>(
            null
        );


    const [participants, setParticipants] =
        useState<Participant[]>(
            []
        );


    const [reactions, setReactions] =
        useState<Reaction[]>(
            []
        );


    const connectionRef =
        useRef<
            ConnectionController | null
        >(null);


    // ========================================================
    // REMOTE CURSORS
    //
    // IMPORTANT:
    // These are stored outside React state.
    //
    // Mouse movement therefore does NOT
    // re-render the whole application.
    // ========================================================

    const cursorElements =
        useRef(
            new Map<
                string,
                CursorElement
            >()
        );


    // ========================================================
    // SELF ID
    //
    // Ref prevents stale React state inside
    // the WebSocket message handler.
    // ========================================================

    const selfIdRef =
        useRef<string | null>(
            null
        );


    // ========================================================
    // CREATE REMOTE CURSOR
    // ========================================================

    const createCursorElement = (
        participant: Participant
    ) => {

        // ----------------------------------------------------
        // NEVER CREATE OUR OWN CURSOR
        // ----------------------------------------------------

        if (
            participant.clientId ===
            selfIdRef.current
        ) {
            return;
        }


        // ----------------------------------------------------
        // ALREADY EXISTS
        // ----------------------------------------------------

        if (
            cursorElements.current.has(
                participant.clientId
            )
        ) {
            return;
        }


        // ----------------------------------------------------
        // CREATE ELEMENT
        // ----------------------------------------------------

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "remote-cursor";


        // ----------------------------------------------------
        // ORIGINAL SMALL CURSOR
        //
        // DO NOT CHANGE THIS TO SVG.
        // DO NOT CREATE A CROSSHAIR.
        // DO NOT CREATE A GIANT ARROW.
        // ----------------------------------------------------

        element.innerHTML = `
            <div class="mouse-emoji">
                🖱️
                <span class="mouse-letter">
                    ${escapeHtml(
                        participant.name
                    )}
                </span>
            </div>
        `;


        // ----------------------------------------------------
        // LABEL COLOR
        // ----------------------------------------------------

        const letter =
            element.querySelector(
                ".mouse-letter"
            );


        if (
            letter instanceof
            HTMLElement
        ) {

            letter.style.background =
                participant.color;
        }


        // ----------------------------------------------------
        // INITIAL POSITION
        // ----------------------------------------------------

        element.style.transform =
            `translate3d(
                ${participant.x}px,
                ${participant.y}px,
                0
            )`;


        // ----------------------------------------------------
        // PERFORMANCE
        // ----------------------------------------------------

        element.style.willChange =
            "transform";


        element.style.pointerEvents =
            "none";


        // ----------------------------------------------------
        // IMPORTANT
        //
        // This is a REMOTE cursor.
        //
        // It does NOT replace the user's
        // actual browser cursor.
        // ----------------------------------------------------

        document.body.appendChild(
            element
        );


        // ----------------------------------------------------
        // STORE STATE
        // ----------------------------------------------------

        cursorElements.current.set(
            participant.clientId,
            {
                element,

                targetX:
                    participant.x,

                targetY:
                    participant.y,

                currentX:
                    participant.x,

                currentY:
                    participant.y,

                velocityX: 0,

                velocityY: 0,

                lastPacketTime:
                    performance.now(),

                lastSequence: -1,
            }
        );
    };


    // ========================================================
    // ESCAPE HTML
    // ========================================================

    const escapeHtml = (
        value: string
    ): string => {

        return value
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    };


    // ========================================================
    // UPDATE CURSOR LABEL
    // ========================================================

    const updateCursorLabel = (
        element: HTMLDivElement,
        name: string,
        color: string
    ) => {

        const letter =
            element.querySelector(
                ".mouse-letter"
            );


        if (
            letter instanceof
            HTMLElement
        ) {

            letter.textContent =
                name;


            letter.style.background =
                color;
        }
    };


    // ========================================================
    // REMOVE CURSOR
    // ========================================================

    const removeCursorElement = (
        clientId: string
    ) => {

        const cursor =
            cursorElements.current.get(
                clientId
            );


        if (!cursor) {
            return;
        }


        cursor.element.remove();


        cursorElements.current.delete(
            clientId
        );
    };


    // ========================================================
    // SYNCHRONIZE CURSOR ELEMENTS
    // ========================================================

    const syncCursorElements = (
        list: Participant[],
        currentSelfId: string
    ) => {

        selfIdRef.current =
            currentSelfId;


        // ----------------------------------------------------
        // REMOTE IDS
        // ----------------------------------------------------

        const remoteIds =
            new Set(
                list
                    .filter(
                        participant =>
                            participant.clientId !==
                            currentSelfId
                    )
                    .map(
                        participant =>
                            participant.clientId
                    )
            );


        // ----------------------------------------------------
        // REMOVE OLD CURSORS
        // ----------------------------------------------------

        for (
            const clientId of
            cursorElements.current.keys()
        ) {

            if (
                !remoteIds.has(
                    clientId
                )
            ) {

                removeCursorElement(
                    clientId
                );
            }
        }


        // ----------------------------------------------------
        // CREATE MISSING CURSORS
        // ----------------------------------------------------

        for (
            const participant of
            list
        ) {

            if (
                participant.clientId ===
                currentSelfId
            ) {
                continue;
            }


            createCursorElement(
                participant
            );
        }
    };


    // ========================================================
    // SERVER MESSAGE HANDLER
    // ========================================================

    const handleServerMessage = (
        message: ServerMessage
    ) => {

        // ====================================================
        // SNAPSHOT
        // ====================================================

        if (
            message.type ===
            "snapshot"
        ) {

            selfIdRef.current =
                message.self.clientId;


            setSelf(
                message.self
            );


            setParticipants(
                message.participants
            );


            syncCursorElements(
                message.participants,
                message.self.clientId
            );


            return;
        }


        // ====================================================
        // PRESENCE
        // ====================================================

        if (
            message.type ===
            "presence"
        ) {

            const participant =
                message.participant;


            // ------------------------------------------------
            // JOIN
            // ------------------------------------------------

            if (
                message.action ===
                "joined"
            ) {

                setParticipants(
                    current => {

                        if (
                            current.some(
                                item =>
                                    item.clientId ===
                                    participant.clientId
                            )
                        ) {

                            return current;
                        }


                        return [
                            ...current,
                            participant,
                        ];
                    }
                );


                if (
                    participant.clientId !==
                    selfIdRef.current
                ) {

                    createCursorElement(
                        participant
                    );
                }


                return;
            }


            // ------------------------------------------------
            // LEAVE
            // ------------------------------------------------

            if (
                message.action ===
                "left"
            ) {

                setParticipants(
                    current =>
                        current.filter(
                            item =>
                                item.clientId !==
                                participant.clientId
                        )
                );


                removeCursorElement(
                    participant.clientId
                );


                return;
            }
        }


        // ====================================================
        // CURSOR
        // ====================================================

        if (
            message.type ===
            "cursor"
        ) {

            // ------------------------------------------------
            // NEVER RENDER OUR OWN CURSOR
            // ------------------------------------------------

            if (
                message.clientId ===
                selfIdRef.current
            ) {

                return;
            }


            // ------------------------------------------------
            // GET EXISTING CURSOR
            // ------------------------------------------------

            let cursor =
                cursorElements.current.get(
                    message.clientId
                );


            // ------------------------------------------------
            // CREATE IF NECESSARY
            // ------------------------------------------------

            if (!cursor) {

                createCursorElement({
                    clientId:
                        message.clientId,

                    name:
                        message.name,

                    color:
                        message.color,

                    x:
                        message.x,

                    y:
                        message.y,
                });


                cursor =
                    cursorElements.current.get(
                        message.clientId
                    );


                if (!cursor) {
                    return;
                }
            }


            // ------------------------------------------------
            // IGNORE OLD PACKETS
            // ------------------------------------------------

            if (
                message.seq <=
                cursor.lastSequence
            ) {

                return;
            }


            cursor.lastSequence =
                message.seq;


            // ------------------------------------------------
            // PACKET TIME
            // ------------------------------------------------

            const now =
                performance.now();


            const deltaTime =
                Math.max(
                    0.001,
                    (
                        now -
                        cursor.lastPacketTime
                    ) / 1000
                );


            // ------------------------------------------------
            // MOVEMENT FROM PREVIOUS TARGET
            // ------------------------------------------------

            const dx =
                message.x -
                cursor.targetX;


            const dy =
                message.y -
                cursor.targetY;


            // ------------------------------------------------
            // VELOCITY
            // ------------------------------------------------

            const rawVelocityX =
                dx /
                deltaTime;


            const rawVelocityY =
                dy /
                deltaTime;


            // ------------------------------------------------
            // SMOOTH VELOCITY
            // ------------------------------------------------

            cursor.velocityX =
                cursor.velocityX * 0.35 +
                rawVelocityX * 0.65;


            cursor.velocityY =
                cursor.velocityY * 0.35 +
                rawVelocityY * 0.65;


            // ------------------------------------------------
            // UPDATE TARGET
            // ------------------------------------------------

            cursor.targetX =
                message.x;


            cursor.targetY =
                message.y;


            cursor.lastPacketTime =
                now;


            // ------------------------------------------------
            // UPDATE LABEL
            // ------------------------------------------------

            updateCursorLabel(
                cursor.element,
                message.name,
                message.color
            );


            return;
        }


        // ====================================================
        // REACTION
        // ====================================================

        if (
            message.type ===
            "reaction"
        ) {

            const reaction: Reaction = {
                id:
                    crypto.randomUUID(),

                emoji:
                    message.emoji,

                name:
                    message.name,

                color:
                    message.color,

                x:
                    message.x,

                y:
                    message.y,
            };


            setReactions(
                current => [
                    ...current,
                    reaction,
                ]
            );


            window.setTimeout(
                () => {

                    setReactions(
                        current =>
                            current.filter(
                                item =>
                                    item.id !==
                                    reaction.id
                            )
                    );

                },
                1200
            );


            return;
        }


        // ====================================================
        // ERROR
        // ====================================================

        if (
            message.type ===
            "error"
        ) {

            console.warn(
                message.message
            );
        }
    };


    // ========================================================
    // 60 FPS REMOTE CURSOR RENDERING
    // ========================================================

    useEffect(() => {

        let frame =
            0;


        const animate = () => {

            const now =
                performance.now();


            for (
                const cursor of
                cursorElements.current.values()
            ) {

                // ------------------------------------------------
                // TIME SINCE LAST PACKET
                // ------------------------------------------------

                const timeSincePacket =
                    Math.min(
                        (
                            now -
                            cursor.lastPacketTime
                        ) / 1000,
                        0.08
                    );


                // ------------------------------------------------
                // SHORT PREDICTION
                //
                // Keep this deliberately short.
                // We don't want giant overshoots.
                // ------------------------------------------------

                const predictionTime =
                    Math.min(
                        timeSincePacket,
                        0.035
                    );


                const predictedX =
                    cursor.targetX +
                    cursor.velocityX *
                    predictionTime;


                const predictedY =
                    cursor.targetY +
                    cursor.velocityY *
                    predictionTime;


                // ------------------------------------------------
                // DISTANCE
                // ------------------------------------------------

                const dx =
                    predictedX -
                    cursor.currentX;


                const dy =
                    predictedY -
                    cursor.currentY;


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                // ------------------------------------------------
                // ADAPTIVE SMOOTHING
                //
                // Normal movement:
                // smooth and butter-like.
                //
                // Fast movement:
                // catch up faster.
                // ------------------------------------------------

                let smoothing = 0.42;


                if (
                    distance > 250
                ) {

                    smoothing =
                        0.82;

                } else if (
                    distance > 150
                ) {

                    smoothing =
                        0.68;

                } else if (
                    distance > 80
                ) {

                    smoothing =
                        0.54;
                }


                cursor.currentX +=
                    dx *
                    smoothing;


                cursor.currentY +=
                    dy *
                    smoothing;


                // ------------------------------------------------
                // SNAP VERY SMALL DIFFERENCES
                // ------------------------------------------------

                if (
                    Math.abs(
                        predictedX -
                        cursor.currentX
                    ) < 0.1
                ) {

                    cursor.currentX =
                        predictedX;
                }


                if (
                    Math.abs(
                        predictedY -
                        cursor.currentY
                    ) < 0.1
                ) {

                    cursor.currentY =
                        predictedY;
                }


                // ------------------------------------------------
                // RENDER
                // ------------------------------------------------

                cursor.element.style.transform =
                    `translate3d(
                        ${cursor.currentX}px,
                        ${cursor.currentY}px,
                        0
                    )`;
            }


            frame =
                requestAnimationFrame(
                    animate
                );
        };


        frame =
            requestAnimationFrame(
                animate
            );


        return () => {

            cancelAnimationFrame(
                frame
            );
        };

    }, []);


    // ========================================================
    // CONNECTION
    // ========================================================

    useEffect(() => {

        const connection =
            connectToServer(
                handleServerMessage,
                setStatus
            );


        connectionRef.current =
            connection;


        return () => {

            connection.close();


            for (
                const cursor of
                cursorElements.current.values()
            ) {

                cursor.element.remove();
            }


            cursorElements.current.clear();

        };

    }, []);


    // ========================================================
    // REACTION
    // ========================================================

    const sendReaction = (
        emoji: string
    ) => {

        connectionRef.current?.send({

            type:
                "reaction",

            emoji,

            x:
                window.innerWidth /
                2,

            y:
                window.innerHeight /
                2,
        });
    };


    // ========================================================
    // CONNECTION STATUS
    // ========================================================

    const connected =
        status ===
        "connected";


    // ========================================================
    // UI
    // ========================================================

    return (

        <div className="app">

            <header className="topbar">

                <div className="brand">

                    <div className="brand-mark">
                        S
                    </div>


                    <div>

                        <div className="brand-name">
                            SYNCSPACE
                        </div>


                        <div className="brand-subtitle">
                            Real-time collaboration
                        </div>

                    </div>

                </div>


                <div
                    className={
                        connected
                            ? "connection connected"
                            : "connection"
                    }
                >

                    <span className="connection-dot" />


                    {
                        status ===
                        "connected"

                            ? "Connected"

                            : status ===
                              "connecting"

                            ? "Connecting..."

                            : "Disconnected"
                    }

                </div>

            </header>


            <main className="canvas">

                <div className="canvas-grid" />

                <div className="glow glow-one" />

                <div className="glow glow-two" />


                <div className="center-content">

                    <div className="live-badge">

                        <span />

                        LIVE MULTIPLAYER

                    </div>


                    <h1>

                        Multiplayer

                        <br />

                        <span>
                            Sync
                        </span>

                    </h1>


                    <p>
                        Move your cursor anywhere
                        and watch everyone
                        collaborate in real time.
                    </p>

                </div>


                {
                    self && (

                        <div className="you-card">

                            <div className="you-label">
                                YOU ARE
                            </div>


                            <div className="you-content">

                                <div
                                    className="you-avatar"
                                    style={{
                                        background:
                                            self.color,
                                    }}
                                >
                                    {self.name}
                                </div>


                                <div>

                                    <strong>
                                        Client{" "}
                                        {self.name}
                                    </strong>


                                    <span>
                                        Your multiplayer
                                        identity
                                    </span>

                                </div>

                            </div>

                        </div>
                    )
                }


                <aside className="participants-panel">

                    <div className="panel-header">

                        <div>

                            <h2>
                                Participants
                            </h2>


                            <span>
                                Active in room
                            </span>

                        </div>


                        <div className="participant-count">

                            {
                                participants.length
                            }

                        </div>

                    </div>


                    <div className="participant-list">

                        {
                            participants.map(
                                participant => (

                                    <div
                                        key={
                                            participant.clientId
                                        }
                                        className={
                                            participant.clientId ===
                                            self?.clientId
                                                ? "participant active"
                                                : "participant"
                                        }
                                    >

                                        <div
                                            className="participant-avatar"
                                            style={{
                                                background:
                                                    participant.color,
                                            }}
                                        >
                                            {
                                                participant.name
                                            }
                                        </div>


                                        <div className="participant-info">

                                            <strong>

                                                Client{" "}

                                                {
                                                    participant.name
                                                }


                                                {
                                                    participant.clientId ===
                                                    self?.clientId
                                                        ? " • You"
                                                        : ""
                                                }

                                            </strong>


                                            <span>
                                                Online
                                            </span>

                                        </div>


                                        <div
                                            className="participant-status"
                                            style={{
                                                background:
                                                    participant.color,
                                            }}
                                        />

                                    </div>

                                )
                            )
                        }

                    </div>

                </aside>


                <div className="reaction-bar">

                    <span>
                        React
                    </span>


                    <button
                        onClick={() =>
                            sendReaction(
                                "❤️"
                            )
                        }
                    >
                        ❤️
                    </button>


                    <button
                        onClick={() =>
                            sendReaction(
                                "🔥"
                            )
                        }
                    >
                        🔥
                    </button>


                    <button
                        onClick={() =>
                            sendReaction(
                                "👍"
                            )
                        }
                    >
                        👍
                    </button>


                    <button
                        onClick={() =>
                            sendReaction(
                                "🎉"
                            )
                        }
                    >
                        🎉
                    </button>

                </div>


                {
                    reactions.map(
                        reaction => (

                            <div
                                key={
                                    reaction.id
                                }
                                className="floating-reaction"
                                style={{
                                    left:
                                        reaction.x,

                                    top:
                                        reaction.y,
                                }}
                            >

                                <div>
                                    {
                                        reaction.emoji
                                    }
                                </div>


                                <span
                                    style={{
                                        color:
                                            reaction.color,
                                    }}
                                >
                                    {
                                        reaction.name
                                    }
                                </span>

                            </div>

                        )
                    )
                }

            </main>

        </div>
    );
}


export default App;