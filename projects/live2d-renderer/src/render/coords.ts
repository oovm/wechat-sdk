/**
 * Shared model ↔ canvas coordinate helpers.
 *
 * Contract:
 * - Model / NDC positions are Y-up.
 * - Canvas2D pixels are Y-down.
 * - Convert geometry **once**. Never also flip texture V, and never CSS-flip the canvas.
 */

/** Model Y-up NDC → canvas pixel Y (origin top-left, Y-down). */
export function modelYUpToCanvasPixelY(
    modelY: number,
    canvasHeight: number,
): number {
    return (1 - modelY) * (canvasHeight / 2);
}

/** Model X NDC → canvas pixel X (origin top-left). */
export function modelXToCanvasPixelX(
    modelX: number,
    canvasWidth: number,
): number {
    return (modelX + 1) * (canvasWidth / 2);
}
