export interface CanvasRgbaPixels {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

/**
 * Read RGBA pixels from a canvas for Cocos Texture2D.uploadData.
 * Prefers a 2D context on the source; otherwise blits through a scratch 2D canvas
 * (needed when the Live2D backend used WebGL2 / WebGPU).
 */
export function readCanvasRgba(
    source: HTMLCanvasElement,
    scratch?: HTMLCanvasElement | null,
): CanvasRgbaPixels | null {
    const width = source.width | 0;
    const height = source.height | 0;
    if (width <= 0 || height <= 0) return null;

    const direct = source.getContext("2d");
    if (direct) {
        try {
            const img = direct.getImageData(0, 0, width, height);
            return { width, height, data: img.data };
        } catch {
            // tainted or lost context — fall through
        }
    }

    const blit =
        scratch && scratch.width >= 0
            ? scratch
            : typeof document !== "undefined"
              ? document.createElement("canvas")
              : null;
    if (!blit) return null;
    if (blit.width !== width) blit.width = width;
    if (blit.height !== height) blit.height = height;
    const ctx = blit.getContext("2d");
    if (!ctx) return null;
    try {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(source, 0, 0);
        const img = ctx.getImageData(0, 0, width, height);
        return { width, height, data: img.data };
    } catch {
        return null;
    }
}
