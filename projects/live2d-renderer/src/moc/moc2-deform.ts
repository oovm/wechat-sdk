/**
 * moc2 default-pose deformer bake: affine + mesh-warp parent chain.
 * Clean-room from public moc2 layout / observed keyform semantics.
 */

import { interpolateKeyforms, resolveKeyformBlend } from "./moc2-keyforms.js";
import type {
    Moc2Affine,
    Moc2BaseDeformer,
    Moc2DrawableMesh,
    Moc2ModelImpl,
} from "./moc2-objects.js";

const DEG = Math.PI / 180;
const DST_BASE = "DST_BASE";

export function isRootBaseId(id: string | null | undefined): boolean {
    return !id || id === DST_BASE;
}

const IDENTITY: Moc2Affine = {
    kind: "affine",
    originX: 0,
    originY: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    reflectX: false,
    reflectY: false,
};

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Sample an affine deformer's keyforms at the given parameters. */
export function sampleAffine(
    deformer: Moc2BaseDeformer,
    getParam: (id: string) => number,
): Moc2Affine {
    const list = deformer.affines ?? [];
    if (list.length === 0) return { ...IDENTITY };
    if (list.length === 1) return { ...list[0]! };

    const { indices, weights, lerpCount } = resolveKeyformBlend(
        deformer.pivotManager,
        getParam,
    );

    const pick = (i: number) => list[indices[i] ?? 0] ?? list[0]!;

    if (lerpCount <= 0) return { ...pick(0) };

    if (lerpCount === 1) {
        const a = pick(0);
        const b = pick(1);
        const t = weights[0]!;
        return {
            kind: "affine",
            originX: lerp(a.originX, b.originX, t),
            originY: lerp(a.originY, b.originY, t),
            scaleX: lerp(a.scaleX, b.scaleX, t),
            scaleY: lerp(a.scaleY, b.scaleY, t),
            rotation: lerp(a.rotation, b.rotation, t),
            reflectX: a.reflectX,
            reflectY: a.reflectY,
        };
    }

    // Multilinear over corners (same weights as keyform blend).
    const corners = 1 << lerpCount;
    let ox = 0,
        oy = 0,
        sx = 0,
        sy = 0,
        rot = 0;
    for (let c = 0; c < corners; c++) {
        let w = 1;
        for (let d = 0; d < lerpCount; d++) {
            const t = weights[d]!;
            w *= (c & (1 << d)) === 0 ? 1 - t : t;
        }
        const a = pick(c);
        ox += w * a.originX;
        oy += w * a.originY;
        sx += w * a.scaleX;
        sy += w * a.scaleY;
        rot += w * a.rotation;
    }
    const base = pick(0);
    return {
        kind: "affine",
        originX: ox,
        originY: oy,
        scaleX: sx,
        scaleY: sy,
        rotation: rot,
        reflectX: base.reflectX,
        reflectY: base.reflectY,
    };
}

/** Apply a local affine (Core-compatible: totalScale ≈ scaleX). */
export function applyAffine(
    positions: Float32Array,
    aff: Moc2Affine,
    totalScale = aff.scaleX,
): Float32Array {
    const out = new Float32Array(positions.length);
    const sn = Math.sin(aff.rotation * DEG);
    const cs = Math.cos(aff.rotation * DEG);
    const rx = aff.reflectX ? -1 : 1;
    const ry = aff.reflectY ? -1 : 1;
    const m00 = cs * totalScale * rx;
    const m01 = -sn * totalScale * ry;
    const m10 = sn * totalScale * rx;
    const m11 = cs * totalScale * ry;
    const tx = aff.originX;
    const ty = aff.originY;
    for (let i = 0; i + 1 < positions.length; i += 2) {
        const x = positions[i]!;
        const y = positions[i + 1]!;
        out[i] = m00 * x + m01 * y + tx;
        out[i + 1] = m10 * x + m11 * y + ty;
    }
    return out;
}

/**
 * Warp points through a Live2D mesh deformer grid (sdk2 bilinear).
 * `rows` = _$o, `cols` = _$A; grid length = (rows+1)*(cols+1)*2.
 */
export function warpPointsByMesh(
    src: Float32Array,
    grid: Float32Array,
    rows: number,
    cols: number,
): Float32Array {
    const out = new Float32Array(src.length);
    const o = rows;
    const A = cols;
    // Core: index = ix + iy * (o + 1); o=_$o (rows), A=_$A (cols)
    const stride = o + 1;

    // Exterior basis (lazy).
    let ready = false;
    let cx = 0,
        cy = 0,
        bl = 0,
        bk = 0,
        bf = 0,
        be = 0;

    const g = (ix: number, iy: number): [number, number] => {
        const i = (ix + iy * stride) * 2;
        return [grid[i] ?? 0, grid[i + 1] ?? 0];
    };

    for (let i = 0; i + 1 < src.length; i += 2) {
        const lx = src[i]!;
        const ly = src[i + 1]!;
        const bd = lx * o;
        const a7 = ly * A;

        if (bd < 0 || a7 < 0 || o <= bd || A <= a7) {
            if (!ready) {
                ready = true;
                const [x00, y00] = g(0, 0);
                const [x10, y10] = g(o, 0);
                const [x01, y01] = g(0, A);
                const [x11, y11] = g(o, A);
                cx = 0.25 * (x00 + x10 + x01 + x11);
                cy = 0.25 * (y00 + y10 + y01 + y11);
                const aM = x11 - x00;
                const aL = y11 - y00;
                const bh = x10 - x01;
                const bg = y10 - y01;
                bl = (aM + bh) * 0.5;
                bk = (aL + bg) * 0.5;
                bf = (aM - bh) * 0.5;
                be = (aL - bg) * 0.5;
                cx -= 0.5 * (bl + bf);
                cy -= 0.5 * (bk + be);
            }
            if (lx > -2 && lx < 3 && ly > -2 && ly < 3) {
                // Clamp to nearest in-bound cell bilinear (good enough for bake).
                const u = Math.min(1, Math.max(0, lx));
                const v = Math.min(1, Math.max(0, ly));
                const bd2 = u * o;
                const a72 = v * A;
                const ix = Math.min(o - 1, Math.max(0, bd2 | 0));
                const iy = Math.min(A - 1, Math.max(0, a72 | 0));
                const bn = bd2 - ix;
                const bm = a72 - iy;
                const base = 2 * (ix + iy * stride);
                if (bn + bm < 1) {
                    out[i] =
                        (grid[base] ?? 0) * (1 - bn - bm) +
                        (grid[base + 2] ?? 0) * bn +
                        (grid[base + 2 * stride] ?? 0) * bm;
                    out[i + 1] =
                        (grid[base + 1] ?? 0) * (1 - bn - bm) +
                        (grid[base + 3] ?? 0) * bn +
                        (grid[base + 2 * stride + 1] ?? 0) * bm;
                } else {
                    out[i] =
                        (grid[base + 2 * stride + 2] ?? 0) * (bn - 1 + bm) +
                        (grid[base + 2 * stride] ?? 0) * (1 - bn) +
                        (grid[base + 2] ?? 0) * (1 - bm);
                    out[i + 1] =
                        (grid[base + 2 * stride + 3] ?? 0) * (bn - 1 + bm) +
                        (grid[base + 2 * stride + 1] ?? 0) * (1 - bn) +
                        (grid[base + 3] ?? 0) * (1 - bm);
                }
            } else {
                out[i] = cx + lx * bl + ly * bf;
                out[i + 1] = cy + lx * bk + ly * be;
            }
            continue;
        }

        const bn = bd - (bd | 0);
        const bm = a7 - (a7 | 0);
        const base = 2 * ((bd | 0) + (a7 | 0) * stride);
        if (bn + bm < 1) {
            out[i] =
                (grid[base] ?? 0) * (1 - bn - bm) +
                (grid[base + 2] ?? 0) * bn +
                (grid[base + 2 * stride] ?? 0) * bm;
            out[i + 1] =
                (grid[base + 1] ?? 0) * (1 - bn - bm) +
                (grid[base + 3] ?? 0) * bn +
                (grid[base + 2 * stride + 1] ?? 0) * bm;
        } else {
            out[i] =
                (grid[base + 2 * stride + 2] ?? 0) * (bn - 1 + bm) +
                (grid[base + 2 * stride] ?? 0) * (1 - bn) +
                (grid[base + 2] ?? 0) * (1 - bm);
            out[i + 1] =
                (grid[base + 2 * stride + 3] ?? 0) * (bn - 1 + bm) +
                (grid[base + 2 * stride + 1] ?? 0) * (1 - bn) +
                (grid[base + 3] ?? 0) * (1 - bm);
        }
    }
    return out;
}

type WorldOp =
    | { kind: "affine"; aff: Moc2Affine; totalScale: number }
    | { kind: "mesh"; grid: Float32Array; rows: number; cols: number };

function applyOp(positions: Float32Array, op: WorldOp): Float32Array {
    if (op.kind === "affine") {
        return applyAffine(positions, op.aff, op.totalScale);
    }
    return warpPointsByMesh(positions, op.grid, op.rows, op.cols);
}

function sampleMeshGrid(
    deformer: Moc2BaseDeformer,
    getParam: (id: string) => number,
): Float32Array {
    const rows = deformer.rows ?? 0;
    const cols = deformer.cols ?? 0;
    const floatCount = (rows + 1) * (cols + 1) * 2;
    return interpolateKeyforms(
        deformer.keyforms ?? [],
        deformer.pivotManager,
        getParam,
        floatCount,
    );
}

function collectDeformers(model: Moc2ModelImpl): Map<string, Moc2BaseDeformer> {
    const map = new Map<string, Moc2BaseDeformer>();
    for (const part of model.parts) {
        for (const d of part.baseData) {
            if (d.id) map.set(d.id, d);
        }
    }
    return map;
}

function topoOrder(defs: Map<string, Moc2BaseDeformer>): string[] {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const out: string[] = [];

    const visit = (id: string) => {
        if (done.has(id) || !defs.has(id)) return;
        if (visiting.has(id)) return; // cycle guard
        visiting.add(id);
        const def = defs.get(id)!;
        if (!isRootBaseId(def.targetBaseId)) {
            visit(def.targetBaseId!);
        }
        visiting.delete(id);
        done.add(id);
        out.push(id);
    };

    for (const id of defs.keys()) visit(id);
    return out;
}

/** Build world-space deformer ops at the given parameter values. */
export function bakeDeformerOps(
    model: Moc2ModelImpl,
    getParam: (id: string) => number,
): Map<string, WorldOp> {
    const defs = collectDeformers(model);
    const world = new Map<string, WorldOp>();

    for (const id of topoOrder(defs)) {
        const def = defs.get(id)!;
        const parentId = def.targetBaseId;
        const parentOp =
            !isRootBaseId(parentId) && parentId
                ? world.get(parentId)
                : undefined;

        if (def.kind === "affineDeformer") {
            const local = sampleAffine(def, getParam);
            if (!parentOp) {
                world.set(id, {
                    kind: "affine",
                    aff: local,
                    totalScale: local.scaleX,
                });
            } else if (parentOp.kind === "affine") {
                const origin = applyOp(
                    new Float32Array([local.originX, local.originY]),
                    parentOp,
                );
                const composed: Moc2Affine = {
                    ...local,
                    originX: origin[0]!,
                    originY: origin[1]!,
                    rotation: local.rotation + parentOp.aff.rotation,
                };
                world.set(id, {
                    kind: "affine",
                    aff: composed,
                    totalScale: parentOp.totalScale * local.scaleX,
                });
            } else {
                // Parent is mesh: move origin through mesh; keep local rotation.
                const origin = applyOp(
                    new Float32Array([local.originX, local.originY]),
                    parentOp,
                );
                world.set(id, {
                    kind: "affine",
                    aff: {
                        ...local,
                        originX: origin[0]!,
                        originY: origin[1]!,
                    },
                    totalScale: local.scaleX,
                });
            }
            continue;
        }

        // mesh deformer
        let grid = sampleMeshGrid(def, getParam);
        if (parentOp) {
            grid = applyOp(grid, parentOp);
        }
        world.set(id, {
            kind: "mesh",
            grid,
            rows: def.rows ?? 0,
            cols: def.cols ?? 0,
        });
    }

    return world;
}

/** Transform drawable local positions into model/canvas space. */
export function transformDrawablePositions(
    mesh: Moc2DrawableMesh,
    local: Float32Array,
    ops: Map<string, WorldOp>,
): Float32Array {
    const parent = mesh.targetBaseId;
    if (isRootBaseId(parent) || !parent) return local;
    const op = ops.get(parent);
    if (!op) return local;
    return applyOp(local, op);
}

export type { WorldOp };
