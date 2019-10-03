/** Shared untextured preview colors (Canvas2D / WebGL2 / WebGPU parity). */

export const PREVIEW_FILL = {
    r: 0x5b / 255,
    g: 0x8d / 255,
    b: 0xef / 255,
    a: 1,
} as const;

export const PREVIEW_STROKE = {
    r: 0x1b / 255,
    g: 0x3a / 255,
    b: 0x6b / 255,
    a: 1,
} as const;

/** Expand triangle indices into a line-list (each edge twice-wound). */
export function triangleEdgesToLineList(indices: Uint16Array): Uint16Array {
    const out = new Uint16Array(Math.floor(indices.length / 3) * 6);
    let o = 0;
    for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = indices[i]!;
        const b = indices[i + 1]!;
        const c = indices[i + 2]!;
        out[o++] = a;
        out[o++] = b;
        out[o++] = b;
        out[o++] = c;
        out[o++] = c;
        out[o++] = a;
    }
    return out;
}
