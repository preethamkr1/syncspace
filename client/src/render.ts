// ============================================================
// REMOTE CURSOR RENDERER
// ============================================================
//
// Responsibilities:
// - Create remote cursors
// - Update their targets
// - Reject stale packets
// - Estimate velocity
// - Smoothly render the latest target
// - Remove disconnected cursors
//
// No WebSocket logic.
// No React rendering.
// No position history buffer.
//
// One remote client = one small state object.
// ============================================================

import type {
    Participant,
} from "./connection";

import {
    calculateVelocity,
    smoothVelocity,
    interpolatePoint,
    type Vector2,
} from "./interpolation";


// ============================================================
// CONFIGURATION
// ============================================================

const POSITION_EPSILON =
    0.03;


const LARGE_DISTANCE =
    300;


// ============================================================
// CURSOR STATE
// ============================================================

type CursorState = {

    element:
        HTMLDivElement;

    target:
        Vector2;

    current:
        Vector2;

    velocity:
        Vector2;

    lastPacketTime:
        number;

    lastSequence:
        number;

    lastRenderedX:
        number;

    lastRenderedY:
        number;
};


// ============================================================
// RENDERER
// ============================================================

export class CursorRenderer {

    private cursors =
        new Map<
            string,
            CursorState
        >();


    private selfId:
        string | null =
        null;


    private animationFrame:
        number | null =
        null;


    // ========================================================
    // SELF ID
    // ========================================================

    setSelfId(
        clientId: string
    ): void {

        this.selfId =
            clientId;
    }


    // ========================================================
    // CREATE CURSOR
    // ========================================================

    create(
        participant: Participant
    ): void {

        if (
            participant.clientId ===
            this.selfId
        ) {

            return;
        }


        if (
            this.cursors.has(
                participant.clientId
            )
        ) {

            return;
        }


        const element =
            document.createElement(
                "div"
            );


        element.className =
            "remote-cursor";


        // ====================================================
        // PROPER POINTER CURSOR
        // ====================================================

        element.innerHTML = `

            <svg
                class="remote-pointer"
                width="24"
                height="32"
                viewBox="0 0 24 32"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >

                <path
                    d="
                        M2 1
                        L2 27
                        L9 21
                        L14 31
                        L18 29
                        L13 19
                        L23 19
                        Z
                    "
                    fill="${participant.color}"
                    stroke="#ffffff"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                />

            </svg>

            <span
                class="mouse-letter"
            >
                ${this.escapeHtml(
                    participant.name
                )}
            </span>
        `;


        // ====================================================
        // STYLE
        // ====================================================

        element.style.position =
            "fixed";


        element.style.left =
            "0";


        element.style.top =
            "0";


        element.style.zIndex =
            "9999";


        element.style.pointerEvents =
            "none";


        element.style.willChange =
            "transform";


        element.style.contain =
            "layout style paint";


        element.style.transform =
            `translate3d(
                ${participant.x}px,
                ${participant.y}px,
                0
            )`;


        // ====================================================
        // LABEL
        // ====================================================

        const label =
            element.querySelector(
                ".mouse-letter"
            );


        if (
            label instanceof
            HTMLElement
        ) {

            label.style.background =
                participant.color;


            label.style.color =
                "#ffffff";


            label.style.position =
                "absolute";


            label.style.left =
                "18px";


            label.style.top =
                "10px";


            label.style.padding =
                "3px 7px";


            label.style.borderRadius =
                "6px";


            label.style.fontSize =
                "11px";


            label.style.fontWeight =
                "700";


            label.style.lineHeight =
                "1";


            label.style.whiteSpace =
                "nowrap";


            label.style.boxShadow =
                "0 2px 8px rgba(0,0,0,0.25)";
        }


        // ====================================================
        // ADD
        // ====================================================

        document.body.appendChild(
            element
        );


        // ====================================================
        // STATE
        // ====================================================

        this.cursors.set(
            participant.clientId,
            {

                element,

                target: {

                    x:
                        participant.x,

                    y:
                        participant.y,
                },

                current: {

                    x:
                        participant.x,

                    y:
                        participant.y,
                },

                velocity: {

                    x: 0,

                    y: 0,
                },

                lastPacketTime:
                    performance.now(),

                lastSequence:
                    -1,

                lastRenderedX:
                    participant.x,

                lastRenderedY:
                    participant.y,
            }
        );
    }


    // ========================================================
    // ESCAPE HTML
    // ========================================================

    private escapeHtml(
        value: string
    ): string {

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
    }


    // ========================================================
    // UPDATE LABEL
    // ========================================================

    private updateLabel(
        element: HTMLDivElement,
        name: string
    ): void {

        const label =
            element.querySelector(
                ".mouse-letter"
            );


        if (
            label instanceof
            HTMLElement
        ) {

            if (
                label.textContent !==
                name
            ) {

                label.textContent =
                    name;
            }
        }
    }


    // ========================================================
    // SYNC PARTICIPANTS
    // ========================================================

    sync(
        participants: Participant[],
        selfId: string
    ): void {

        this.selfId =
            selfId;


        const activeIds =
            new Set<string>();


        for (
            const participant of
            participants
        ) {

            if (
                participant.clientId ===
                selfId
            ) {

                continue;
            }


            activeIds.add(
                participant.clientId
            );


            this.create(
                participant
            );
        }


        // Remove stale participants.

        for (
            const clientId of
            this.cursors.keys()
        ) {

            if (
                !activeIds.has(
                    clientId
                )
            ) {

                this.remove(
                    clientId
                );
            }
        }
    }


    // ========================================================
    // RECEIVE CURSOR UPDATE
    // ========================================================

    update(
        clientId: string,
        name: string,
        color: string,
        x: number,
        y: number,
        sequence: number
    ): void {

        if (
            clientId ===
            this.selfId
        ) {

            return;
        }


        if (

            !Number.isFinite(x) ||

            !Number.isFinite(y) ||

            x < 0 ||

            y < 0
        ) {

            return;
        }


        let cursor =
            this.cursors.get(
                clientId
            );


        if (!cursor) {

            this.create({

                clientId,

                name,

                color,

                x,

                y,
            });


            cursor =
                this.cursors.get(
                    clientId
                );


            if (!cursor) {

                return;
            }
        }


        // ====================================================
        // STALE PACKET PROTECTION
        // ====================================================

        if (
            sequence <=
            cursor.lastSequence
        ) {

            return;
        }


        cursor.lastSequence =
            sequence;


        // ====================================================
        // NETWORK TIMING
        // ====================================================

        const now =
            performance.now();


        const deltaTime =
            Math.max(

                0.001,

                Math.min(

                    (
                        now -
                        cursor.lastPacketTime
                    ) / 1000,

                    0.1
                )
            );


        // ====================================================
        // VELOCITY
        // ====================================================

        const measuredVelocity =
            calculateVelocity(

                cursor.target,

                {
                    x,
                    y,
                },

                deltaTime
            );


        cursor.velocity =
            smoothVelocity(

                cursor.velocity,

                measuredVelocity
            );


        // ====================================================
        // TARGET
        // ====================================================

        cursor.target.x =
            x;


        cursor.target.y =
            y;


        cursor.lastPacketTime =
            now;


        // ====================================================
        // LABEL
        // ====================================================

        this.updateLabel(
            cursor.element,
            name
        );


        // Update pointer color.

        const pointer =
            cursor.element.querySelector(
                ".remote-pointer path"
            );


        if (
            pointer instanceof
            SVGPathElement
        ) {

            pointer.setAttribute(
                "fill",
                color
            );
        }


        const label =
            cursor.element.querySelector(
                ".mouse-letter"
            );


        if (
            label instanceof
            HTMLElement
        ) {

            label.style.background =
                color;
        }
    }


    // ========================================================
    // REMOVE
    // ========================================================

    remove(
        clientId: string
    ): void {

        const cursor =
            this.cursors.get(
                clientId
            );


        if (!cursor) {

            return;
        }


        cursor.element.remove();


        this.cursors.delete(
            clientId
        );
    }


    // ========================================================
    // CLEAR
    // ========================================================

    clear(): void {

        for (
            const cursor of
            this.cursors.values()
        ) {

            cursor.element.remove();
        }


        this.cursors.clear();
    }


    // ========================================================
    // START
    // ========================================================

    start(): void {

        if (
            this.animationFrame !==
            null
        ) {

            return;
        }


        let previousTime =
            performance.now();


        const animate =
            (
                currentTime: number
            ): void => {

                const deltaSeconds =
                    Math.min(

                        Math.max(

                            (
                                currentTime -
                                previousTime
                            ) / 1000,

                            0.001
                        ),

                        0.05
                    );


                previousTime =
                    currentTime;


                // ==================================================
                // UPDATE EACH REMOTE CURSOR
                // ==================================================

                for (
                    const cursor of
                    this.cursors.values()
                ) {

                    const elapsed =
                        Math.min(

                            Math.max(

                                (
                                    currentTime -
                                    cursor.lastPacketTime
                                ) / 1000,

                                0
                            ),

                            0.030
                        );


                    const distanceX =
                        cursor.target.x -
                        cursor.current.x;


                    const distanceY =
                        cursor.target.y -
                        cursor.current.y;


                    const distance =
                        Math.sqrt(

                            distanceX *
                                distanceX +

                            distanceY *
                                distanceY
                        );


                    // ==================================================
                    // LARGE CORRECTION
                    // ==================================================

                    if (
                        distance >
                        LARGE_DISTANCE
                    ) {

                        cursor.current.x =
                            cursor.target.x;


                        cursor.current.y =
                            cursor.target.y;


                        cursor.velocity.x =
                            0;


                        cursor.velocity.y =
                            0;

                    } else {

                        // ==============================================
                        // ONE SMOOTH UPDATE
                        // ==============================================

                        const next =
                            interpolatePoint(

                                cursor.current,

                                cursor.target,

                                cursor.velocity,

                                elapsed,

                                deltaSeconds
                            );


                        cursor.current.x =
                            next.x;


                        cursor.current.y =
                            next.y;
                    }


                    // ==================================================
                    // SNAP TINY REMAINING ERROR
                    // ==================================================

                    if (
                        Math.abs(
                            cursor.target.x -
                            cursor.current.x
                        ) <
                        POSITION_EPSILON
                    ) {

                        cursor.current.x =
                            cursor.target.x;
                    }


                    if (
                        Math.abs(
                            cursor.target.y -
                            cursor.current.y
                        ) <
                        POSITION_EPSILON
                    ) {

                        cursor.current.y =
                            cursor.target.y;
                    }


                    // ==================================================
                    // ROUND ONLY FOR DOM OUTPUT
                    // ==================================================

                    const x =
                        Math.round(
                            cursor.current.x *
                            10
                        ) / 10;


                    const y =
                        Math.round(
                            cursor.current.y *
                            10
                        ) / 10;


                    if (

                        x ===
                            cursor.lastRenderedX &&

                        y ===
                            cursor.lastRenderedY
                    ) {

                        continue;
                    }


                    cursor.lastRenderedX =
                        x;


                    cursor.lastRenderedY =
                        y;


                    // ==================================================
                    // GPU-FRIENDLY MOVEMENT
                    // ==================================================

                    cursor.element.style.transform =
                        `translate3d(
                            ${x}px,
                            ${y}px,
                            0
                        )`;
                }


                this.animationFrame =
                    requestAnimationFrame(
                        animate
                    );
            };


        this.animationFrame =
            requestAnimationFrame(
                animate
            );
    }


    // ========================================================
    // STOP
    // ========================================================

    stop(): void {

        if (
            this.animationFrame !==
            null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );


            this.animationFrame =
                null;
        }
    }
}