/**
 * Pos/UV interleave with optional resident output buffer (GPU upload scratch).
 */

/** Interleave `[x,y]` + `[u,v]` into `[x,y,u,v,…]`. Reuses `into` when large enough. */
export function interleavePosUv(
    positions: Float32Array,
    uvs: Float32Array,
    into?: Float32Array,
): Float32Array {
    const n = Math.floor(positions.length / 2);
    const need = n * 4;
    const out = into && into.length >= need ? into : new Float32Array(need);
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        const p = i * 2;
        out[o] = positions[p]!;
        out[o + 1] = positions[p + 1]!;
        out[o + 2] = uvs[p] ?? 0;
        out[o + 3] = uvs[p + 1] ?? 0;
    }
    return out;
}

/** Byte length of the live interleaved prefix (vertexCount * 16). */
export function interleaveByteLength(positions: Float32Array): number {
    return Math.floor(positions.length / 2) * 16;
}
