/**
 * Sample moc2 keyform tables at given parameter values (default-pose bake).
 */

import type { Moc2Pivot, Moc2PivotManager } from "./moc2-objects.js";

const EPS = 0.001;

interface PivotSample {
    index: number;
    /** 0 → exact at index; (0,1) → lerp index..index+1 */
    weight: number;
}

function samplePivot(pivot: Moc2Pivot, value: number): PivotSample {
    const count = pivot.pivotCount;
    const values = pivot.pivotValues;
    if (count < 1) return { index: 0, weight: 0 };
    if (count === 1) return { index: 0, weight: 0 };

    const first = values[0] ?? 0;
    if (value < first + EPS) return { index: 0, weight: 0 };

    for (let i = 1; i < count; i++) {
        const lo = values[i - 1] ?? 0;
        const hi = values[i] ?? 0;
        if (value < hi + EPS) {
            if (value > hi - EPS) return { index: i, weight: 0 };
            const span = hi - lo;
            return {
                index: i - 1,
                weight: span === 0 ? 0 : (value - lo) / span,
            };
        }
    }
    return { index: count - 1, weight: 0 };
}

/**
 * Build keyform indices + lerp weights for a pivot manager
 * (multilinear blend over pivoting parameters).
 */
export function resolveKeyformBlend(
    manager: Moc2PivotManager | null | undefined,
    getParam: (id: string) => number,
): { indices: number[]; weights: number[]; lerpCount: number } {
    if (!manager || manager.pivots.length === 0) {
        return { indices: [0], weights: [], lerpCount: 0 };
    }

    const samples = manager.pivots.map((p) =>
        samplePivot(p, getParam(p.paramId)),
    );
    let lerpCount = 0;
    for (const s of samples) if (s.weight > 0) lerpCount++;

    const n = 1 << lerpCount;
    const indices = new Array<number>(n).fill(0);
    const weights: number[] = [];

    let stride = 1;
    let lerpDim = 0;
    for (let p = 0; p < samples.length; p++) {
        const s = samples[p]!;
        const pivotCount = Math.max(1, manager.pivots[p]?.pivotCount ?? 1);
        if (s.weight === 0) {
            const add = s.index * stride;
            for (let i = 0; i < n; i++) indices[i]! += add;
        } else {
            const a = s.index * stride;
            const b = (s.index + 1) * stride;
            const dimMask = 1 << lerpDim;
            for (let i = 0; i < n; i++) {
                indices[i]! += (i & dimMask) === 0 ? a : b;
            }
            weights[lerpDim] = s.weight;
            lerpDim++;
        }
        stride *= pivotCount;
    }

    return { indices, weights, lerpCount };
}

/** Interpolate a list of float keyforms (each length `floatCount`). */
export function interpolateKeyforms(
    keyforms: readonly Float32Array[],
    manager: Moc2PivotManager | null | undefined,
    getParam: (id: string) => number,
    floatCount: number,
): Float32Array {
    const out = new Float32Array(floatCount);
    if (keyforms.length === 0) return out;

    const { indices, weights, lerpCount } = resolveKeyformBlend(
        manager,
        getParam,
    );

    if (lerpCount <= 0) {
        const src = keyforms[indices[0] ?? 0] ?? keyforms[0]!;
        const n = Math.min(floatCount, src.length);
        out.set(src.subarray(0, n));
        return out;
    }

    if (lerpCount === 1) {
        const a = keyforms[indices[0]!] ?? keyforms[0]!;
        const b = keyforms[indices[1]!] ?? a;
        const t = weights[0]!;
        const u = 1 - t;
        for (let i = 0; i < floatCount; i++) {
            out[i] = (a[i] ?? 0) * u + (b[i] ?? 0) * t;
        }
        return out;
    }

    if (lerpCount === 2) {
        const a = keyforms[indices[0]!] ?? keyforms[0]!;
        const b = keyforms[indices[1]!] ?? a;
        const c = keyforms[indices[2]!] ?? a;
        const d = keyforms[indices[3]!] ?? a;
        const t = weights[0]!;
        const s = weights[1]!;
        const u = 1 - t;
        const v = 1 - s;
        const w00 = v * u;
        const w10 = v * t;
        const w01 = s * u;
        const w11 = s * t;
        for (let i = 0; i < floatCount; i++) {
            out[i] =
                w00 * (a[i] ?? 0) +
                w10 * (b[i] ?? 0) +
                w01 * (c[i] ?? 0) +
                w11 * (d[i] ?? 0);
        }
        return out;
    }

    const corners = 1 << lerpCount;
    const cornerW = new Float32Array(corners);
    for (let c = 0; c < corners; c++) {
        let w = 1;
        for (let d = 0; d < lerpCount; d++) {
            const t = weights[d]!;
            w *= (c & (1 << d)) === 0 ? 1 - t : t;
        }
        cornerW[c] = w;
    }
    for (let i = 0; i < floatCount; i++) {
        let sum = 0;
        for (let c = 0; c < corners; c++) {
            const src = keyforms[indices[c]!] ?? keyforms[0]!;
            sum += cornerW[c]! * (src[i] ?? 0);
        }
        out[i] = sum;
    }
    return out;
}

/** Interpolate a scalar table (draw order / opacity) parallel to keyform combos. */
export function interpolateScalarTable(
    table: ArrayLike<number> | null | undefined,
    manager: Moc2PivotManager | null | undefined,
    getParam: (id: string) => number,
    fallback: number,
): number {
    if (!table || table.length === 0) return fallback;
    const perKey: Float32Array[] = [];
    for (let i = 0; i < table.length; i++) {
        const f = new Float32Array(1);
        f[0] = table[i]!;
        perKey.push(f);
    }
    const sampled = interpolateKeyforms(perKey, manager, getParam, 1);
    return sampled[0] ?? fallback;
}
