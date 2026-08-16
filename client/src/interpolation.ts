// ============================================================
// INTERPOLATION / SHORT EXTRAPOLATION
// ============================================================
//
// Keeps remote cursors visually smooth when network packets
// arrive at irregular intervals.
//
// We intentionally DO NOT keep a position history buffer.
//
// Each remote client has only:
// - latest target
// - current visual position
// - estimated velocity
//
// Strategy:
//
// 1. Receive a new target.
// 2. Estimate movement velocity.
// 3. Smooth that velocity.
// 4. Predict only a very short distance ahead.
// 5. Smooth the visual cursor toward that predicted point.
//
// This keeps latency low while avoiding teleporting.
// ============================================================

export type Vector2 = {
    x: number;
    y: number;
};


// ============================================================
// CONFIGURATION
// ============================================================

// Never predict too far.
//
// 30 ms is enough to hide a small part of network delay
// without making the cursor feel like it is moving by itself.

export const MAX_PREDICTION_TIME =
    0.030;


// Ignore extremely small packet intervals when calculating
// velocity.

export const MIN_DELTA_TIME =
    0.001;


// Do not allow a huge network gap to create an unrealistic
// velocity.

export const MAX_DELTA_TIME =
    0.100;


// Previous velocity contribution.
//
// Lower value = reacts faster to direction changes.

export const VELOCITY_MEMORY =
    0.25;


// Maximum predicted velocity.
//
// Prevents delayed packets from creating a huge jump.

export const MAX_VELOCITY =
    5000;


// ============================================================
// LINEAR INTERPOLATION
// ============================================================

export function lerp(
    current: number,
    target: number,
    amount: number
): number {

    return (
        current +
        (
            target -
            current
        ) *
        amount
    );
}


// ============================================================
// 2D LERP
// ============================================================

export function lerpPoint(
    current: Vector2,
    target: Vector2,
    amount: number
): Vector2 {

    return {

        x:
            lerp(
                current.x,
                target.x,
                amount
            ),

        y:
            lerp(
                current.y,
                target.y,
                amount
            ),
    };
}


// ============================================================
// DISTANCE
// ============================================================

export function distanceBetween(
    a: Vector2,
    b: Vector2
): number {

    const dx =
        b.x -
        a.x;

    const dy =
        b.y -
        a.y;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


// ============================================================
// VELOCITY
// ============================================================

export function calculateVelocity(
    previous: Vector2,
    next: Vector2,
    deltaTime: number
): Vector2 {

    const safeDelta =
        Math.max(
            MIN_DELTA_TIME,

            Math.min(
                deltaTime,
                MAX_DELTA_TIME
            )
        );


    let velocity: Vector2 = {

        x:
            (
                next.x -
                previous.x
            ) /
            safeDelta,

        y:
            (
                next.y -
                previous.y
            ) /
            safeDelta,
    };


    // --------------------------------------------------------
    // Limit velocity
    // --------------------------------------------------------

    const magnitude =
        Math.sqrt(
            velocity.x *
                velocity.x +

            velocity.y *
                velocity.y
        );


    if (
        magnitude >
        MAX_VELOCITY
    ) {

        const scale =
            MAX_VELOCITY /
            magnitude;


        velocity = {

            x:
                velocity.x *
                scale,

            y:
                velocity.y *
                scale,
        };
    }


    return velocity;
}


// ============================================================
// VELOCITY SMOOTHING
// ============================================================

export function smoothVelocity(
    previous: Vector2,
    measured: Vector2
): Vector2 {

    return {

        x:
            previous.x *
                VELOCITY_MEMORY +

            measured.x *
                (
                    1 -
                    VELOCITY_MEMORY
                ),

        y:
            previous.y *
                VELOCITY_MEMORY +

            measured.y *
                (
                    1 -
                    VELOCITY_MEMORY
                ),
    };
}


// ============================================================
// SHORT EXTRAPOLATION
// ============================================================

export function predictPoint(
    target: Vector2,
    velocity: Vector2,
    elapsedSeconds: number
): Vector2 {

    const predictionTime =
        Math.min(
            Math.max(
                elapsedSeconds,
                0
            ),

            MAX_PREDICTION_TIME
        );


    return {

        x:
            target.x +
            velocity.x *
            predictionTime,

        y:
            target.y +
            velocity.y *
            predictionTime,
    };
}


// ============================================================
// SMOOTHING FACTOR
// ============================================================
//
// We deliberately use ONE smoothing stage.
//
// Large correction:
//     catch up faster
//
// Small correction:
//     smooth and stable
//
// This is much simpler than stacking multiple lerps.
// ============================================================

export function getSmoothingFactor(
    distance: number
): number {

    if (
        distance >
        180
    ) {

        return 0.40;
    }


    if (
        distance >
        80
    ) {

        return 0.28;
    }


    if (
        distance >
        20
    ) {

        return 0.20;
    }


    return 0.14;
}


// ============================================================
// FRAME-RATE INDEPENDENT SMOOTHING
// ============================================================
//
// Converts the smoothing constant into a frame-rate
// independent factor.
//
// This means 60 FPS and a temporary 45 FPS frame rate
// behave similarly.
// ============================================================

export function getFrameSmoothing(
    baseFactor: number,
    deltaSeconds: number
): number {

    const frameFactor =
        Math.max(
            0.001,
            deltaSeconds
        );


    return (
        1 -
        Math.pow(
            1 -
            baseFactor,

            frameFactor *
            60
        )
    );
}


// ============================================================
// COMPLETE VISUAL UPDATE
// ============================================================

export function interpolatePoint(
    current: Vector2,
    target: Vector2,
    velocity: Vector2,
    elapsedSeconds: number,
    deltaSeconds = 1 / 60
): Vector2 {

    const predicted =
        predictPoint(
            target,
            velocity,
            elapsedSeconds
        );


    const distance =
        distanceBetween(
            current,
            predicted
        );


    // Large correction should not take seconds to catch up.

    if (
        distance >
        300
    ) {

        return {

            x:
                target.x,

            y:
                target.y,
        };
    }


    const baseFactor =
        getSmoothingFactor(
            distance
        );


    const smoothing =
        getFrameSmoothing(
            baseFactor,
            deltaSeconds
        );


    return lerpPoint(
        current,
        predicted,
        smoothing
    );
}