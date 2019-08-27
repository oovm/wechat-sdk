/**
 * moc3 keyform binding bands → multilinear blend weights.
 *
 * A drawable/deformer references a binding band; the band lists parameter
 * bindings; each binding has an ordered key table. Keyforms are laid out as
 * the cartesian product of those bindings (same structure as moc2 pivots).
 */

const EPS = 0.001;

export interface Moc3KeyTables {
    readonly bindingIndex: Int32Array;
    readonly bandBegin: Int32Array;
    readonly bandCount: Int32Array;
    readonly keysBegin: Int32Array;
    readonly keysCount: Int32Array;
    readonly keys: Float32Array;
    /** parameterIndex → bindings owned by that parameter */
    readonly paramBindingBegin: Int32Array;
    readonly paramBindingCount: Int32Array;
    readonly paramCount: number;
}

export interface KeyformBlend {
    /** Relative keyform indices within the object's keyform range. */
    readonly indices: number[];
    readonly weights: number[];
    readonly lerpCount: number;
}

interface PivotSample {
    index: number;
    weight: number;
}

function sampleKeys(
    keys: Float32Array,
    begin: number,
    count: number,
    value: number,
): PivotSample {
    if (count < 1) return { index: 0, weight: 0 };
    if (count === 1) return { index: 0, weight: 0 };

    const first = keys[begin] ?? 0;
    if (value < first + EPS) return { index: 0, weight: 0 };

    for (let i = 1; i < count; i++) {
        const lo = keys[begin + i - 1] ?? 0;
        const hi = keys[begin + i] ?? 0;
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

function bindingToParam(tables: Moc3KeyTables, bindingIndex: number): number {
    for (let p = 0; p < tables.paramCount; p++) {
        const begin = tables.paramBindingBegin[p] ?? -1;
        const count = tables.paramBindingCount[p] ?? 0;
        if (count <= 0 || begin < 0) continue;
        if (bindingIndex >= begin && bindingIndex < begin + count) return p;
    }
    return -1;
}

/** Resolve multilinear keyform blend for a binding-band index. */
export function resolveMoc3KeyformBlend(
    tables: Moc3KeyTables,
    bandIndex: number,
    getParamByIndex: (paramIndex: number) => number,
): KeyformBlend {
    if (bandIndex < 0 || bandIndex >= tables.bandCount.length) {
        return { indices: [0], weights: [], lerpCount: 0 };
    }
    const bindCount = tables.bandCount[bandIndex] ?? 0;
    const bindBegin = tables.bandBegin[bandIndex] ?? 0;
    if (bindCount <= 0) {
        return { indices: [0], weights: [], lerpCount: 0 };
    }

    const samples: PivotSample[] = [];
    const keyCounts: number[] = [];
    for (let i = 0; i < bindCount; i++) {
        const binding = tables.bindingIndex[bindBegin + i] ?? -1;
        if (binding < 0) {
            samples.push({ index: 0, weight: 0 });
            keyCounts.push(1);
            continue;
        }
        const paramIndex = bindingToParam(tables, binding);
        const kBegin = tables.keysBegin[binding] ?? 0;
        const kCount = Math.max(1, tables.keysCount[binding] ?? 1);
        const value = paramIndex >= 0 ? getParamByIndex(paramIndex) : 0;
        samples.push(sampleKeys(tables.keys, kBegin, kCount, value));
        keyCounts.push(kCount);
    }

    let lerpCount = 0;
    for (const s of samples) if (s.weight > 0) lerpCount++;

    const n = 1 << lerpCount;
    const indices = new Array<number>(n).fill(0);
    const weights: number[] = [];

    let stride = 1;
    let lerpDim = 0;
    for (let p = 0; p < samples.length; p++) {
        const s = samples[p]!;
        const pivotCount = keyCounts[p]!;
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

/** Blend parallel float keyform slices (each keyform starts at begins[kf]). */
export function blendKeyformFloats(
    values: Float32Array,
    begins: Int32Array,
    keyformBase: number,
    keyformCount: number,
    floatCount: number,
    blend: KeyformBlend,
): Float32Array {
    const out = new Float32Array(floatCount);
    if (keyformCount <= 0 || floatCount <= 0) return out;

    const pick = (rel: number): number => {
        const clamped = Math.min(keyformCount - 1, Math.max(0, rel));
        return begins[keyformBase + clamped] ?? 0;
    };

    if (blend.lerpCount <= 0) {
        const srcOff = pick(blend.indices[0] ?? 0);
        for (let i = 0; i < floatCount; i++) {
            out[i] = values[srcOff + i] ?? 0;
        }
        return out;
    }

    if (blend.lerpCount === 1) {
        const aOff = pick(blend.indices[0] ?? 0);
        const bOff = pick(blend.indices[1] ?? 0);
        const t = blend.weights[0]!;
        const u = 1 - t;
        for (let i = 0; i < floatCount; i++) {
            out[i] = (values[aOff + i] ?? 0) * u + (values[bOff + i] ?? 0) * t;
        }
        return out;
    }

    const corners = 1 << blend.lerpCount;
    const cornerW = new Float32Array(corners);
    for (let c = 0; c < corners; c++) {
        let w = 1;
        for (let d = 0; d < blend.lerpCount; d++) {
            const t = blend.weights[d]!;
            w *= (c & (1 << d)) === 0 ? 1 - t : t;
        }
        cornerW[c] = w;
    }
    for (let i = 0; i < floatCount; i++) {
        let sum = 0;
        for (let c = 0; c < corners; c++) {
            const srcOff = pick(blend.indices[c] ?? 0);
            sum += cornerW[c]! * (values[srcOff + i] ?? 0);
        }
        out[i] = sum;
    }
    return out;
}

/** Blend a scalar-per-keyform table (opacity / draw order / rotation fields). */
export function blendKeyformScalar(
    table: ArrayLike<number>,
    keyformBase: number,
    keyformCount: number,
    blend: KeyformBlend,
    fallback: number,
): number {
    if (keyformCount <= 0) return fallback;

    const pick = (rel: number): number => {
        const clamped = Math.min(keyformCount - 1, Math.max(0, rel));
        return table[keyformBase + clamped] ?? fallback;
    };

    if (blend.lerpCount <= 0) {
        return pick(blend.indices[0] ?? 0);
    }

    if (blend.lerpCount === 1) {
        const a = pick(blend.indices[0] ?? 0);
        const b = pick(blend.indices[1] ?? 0);
        const t = blend.weights[0]!;
        return a * (1 - t) + b * t;
    }

    const corners = 1 << blend.lerpCount;
    let sum = 0;
    for (let c = 0; c < corners; c++) {
        let w = 1;
        for (let d = 0; d < blend.lerpCount; d++) {
            const t = blend.weights[d]!;
            w *= (c & (1 << d)) === 0 ? 1 - t : t;
        }
        sum += w * pick(blend.indices[c] ?? 0);
    }
    return sum;
}
