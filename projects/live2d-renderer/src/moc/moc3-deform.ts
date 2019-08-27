/**
 * moc3 deformer bake: warp grids + rotation affines along parent chains.
 *
 * Coordinate contract (observed on official MOC3 / Wanko):
 * - Root rotations author scale ≈ 1/pixelsPerUnit; children stay in pixels.
 * - Nested rotation under rotation: mulAffine; origins/children share parent units.
 * - Rotation under warp: origin is warp UV; fold 1/ppu into the local linear
 *   part before Jacobian composition so pixel children map UV → logical.
 */

import { warpPointsByMesh } from "./moc2-deform.js";
import {
    blendKeyformFloats,
    blendKeyformScalar,
    type Moc3KeyTables,
    resolveMoc3KeyformBlend,
} from "./moc3-keyforms.js";
import { CountIdx } from "./moc3-layout.js";
import type { Moc3Document } from "./moc3-reader.js";
import { moc3SectionF32, moc3SectionI32 } from "./moc3-reader.js";

const DEG2RAD = Math.PI / 180;
const WARP = 0;
const ROTATION = 1;

export interface Moc3Affine {
    originX: number;
    originY: number;
    /** Column 0 of linear part. */
    m00: number;
    m10: number;
    /** Column 1 of linear part. */
    m01: number;
    m11: number;
}

export type Moc3DeformerWorld =
    | { kind: "warp"; grid: Float32Array; rows: number; cols: number }
    | { kind: "rotation"; affine: Moc3Affine };

function mulAffine(parent: Moc3Affine, local: Moc3Affine): Moc3Affine {
    return {
        originX:
            parent.originX +
            parent.m00 * local.originX +
            parent.m01 * local.originY,
        originY:
            parent.originY +
            parent.m10 * local.originX +
            parent.m11 * local.originY,
        m00: parent.m00 * local.m00 + parent.m01 * local.m10,
        m10: parent.m10 * local.m00 + parent.m11 * local.m10,
        m01: parent.m00 * local.m01 + parent.m01 * local.m11,
        m11: parent.m10 * local.m01 + parent.m11 * local.m11,
    };
}

function affineFromRotationKeyform(
    baseAngle: number,
    angle: number,
    originX: number,
    originY: number,
    scale: number,
    reflectX: boolean,
    reflectY: boolean,
): Moc3Affine {
    const rad = (baseAngle + angle) * DEG2RAD;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const sx = reflectX ? -scale : scale;
    const sy = reflectY ? -scale : scale;
    return {
        originX,
        originY,
        m00: c * sx,
        m10: s * sx,
        m01: -s * sy,
        m11: c * sy,
    };
}

function applyAffineToPoints(src: Float32Array, a: Moc3Affine): Float32Array {
    // Root rotations author scale ≈ 1/ppu so pixel-sized children land in
    // logical units; nested rotations with scale≈1 keep parent-local units.
    // No magnitude heuristic — trust the authored scale.
    const out = new Float32Array(src.length);
    for (let i = 0; i + 1 < src.length; i += 2) {
        const x = src[i]!;
        const y = src[i + 1]!;
        out[i] = a.originX + a.m00 * x + a.m01 * y;
        out[i + 1] = a.originY + a.m10 * x + a.m11 * y;
    }
    return out;
}

/** Transform local points through a parent deformer's world state. */
export function applyParentToPoints(
    local: Float32Array,
    parent: Moc3DeformerWorld,
): Float32Array {
    if (parent.kind === "warp") {
        return warpPointsByMesh(local, parent.grid, parent.rows, parent.cols);
    }
    return applyAffineToPoints(local, parent.affine);
}

interface DeformerTables {
    types: Int32Array;
    specific: Int32Array;
    parents: Int32Array;
    bandIndex: Int32Array;
    enables: Int32Array;
    warpBand: Int32Array;
    warpKfBegin: Int32Array;
    warpKfCount: Int32Array;
    warpVertexCounts: Int32Array;
    warpRows: Int32Array;
    warpCols: Int32Array;
    warpPosBegins: Int32Array;
    rotBand: Int32Array;
    rotKfBegin: Int32Array;
    rotKfCount: Int32Array;
    rotBaseAngles: Float32Array;
    rotAngles: Float32Array;
    rotOriginX: Float32Array;
    rotOriginY: Float32Array;
    rotScales: Float32Array;
    rotReflectX: Int32Array;
    rotReflectY: Int32Array;
    positions: Float32Array;
    keyTables: Moc3KeyTables;
    deformerCount: number;
    pixelsPerUnit: number;
}

function loadDeformerTables(
    doc: Moc3Document,
    keyTables: Moc3KeyTables,
): DeformerTables {
    return {
        types: moc3SectionI32(doc, "deformer.types"),
        specific: moc3SectionI32(doc, "deformer.specific_indices"),
        parents: moc3SectionI32(doc, "deformer.parent_deformer_indices"),
        bandIndex: moc3SectionI32(doc, "deformer.keyform_binding_band_indices"),
        enables: moc3SectionI32(doc, "deformer.enables"),
        warpBand: moc3SectionI32(
            doc,
            "warp_deformer.keyform_binding_band_indices",
        ),
        warpKfBegin: moc3SectionI32(doc, "warp_deformer.keyform_begin_indices"),
        warpKfCount: moc3SectionI32(doc, "warp_deformer.keyform_counts"),
        warpVertexCounts: moc3SectionI32(doc, "warp_deformer.vertex_counts"),
        warpRows: moc3SectionI32(doc, "warp_deformer.rows"),
        warpCols: moc3SectionI32(doc, "warp_deformer.cols"),
        warpPosBegins: moc3SectionI32(
            doc,
            "warp_deformer_keyform.keyform_position_begin_indices",
        ),
        rotBand: moc3SectionI32(
            doc,
            "rotation_deformer.keyform_binding_band_indices",
        ),
        rotKfBegin: moc3SectionI32(
            doc,
            "rotation_deformer.keyform_begin_indices",
        ),
        rotKfCount: moc3SectionI32(doc, "rotation_deformer.keyform_counts"),
        rotBaseAngles: moc3SectionF32(doc, "rotation_deformer.base_angles"),
        rotAngles: moc3SectionF32(doc, "rotation_deformer_keyform.angles"),
        rotOriginX: moc3SectionF32(doc, "rotation_deformer_keyform.origin_xs"),
        rotOriginY: moc3SectionF32(doc, "rotation_deformer_keyform.origin_ys"),
        rotScales: moc3SectionF32(doc, "rotation_deformer_keyform.scales"),
        rotReflectX: moc3SectionI32(
            doc,
            "rotation_deformer_keyform.reflect_xs",
        ),
        rotReflectY: moc3SectionI32(
            doc,
            "rotation_deformer_keyform.reflect_ys",
        ),
        positions: moc3SectionF32(doc, "keyform_position.xys"),
        keyTables,
        deformerCount: doc.counts[CountIdx.DEFORMERS] ?? 0,
        pixelsPerUnit: doc.canvas.pixelsPerUnit,
    };
}

function evalDeformer(
    index: number,
    tables: DeformerTables,
    getParamByIndex: (i: number) => number,
    cache: (Moc3DeformerWorld | null)[],
): Moc3DeformerWorld | null {
    if (index < 0 || index >= tables.deformerCount) return null;
    const hit = cache[index];
    if (hit) return hit;
    if ((tables.enables[index] ?? 1) === 0) {
        cache[index] = null;
        return null;
    }

    const type = tables.types[index] ?? WARP;
    const specific = tables.specific[index] ?? 0;
    const parentIndex = tables.parents[index] ?? -1;
    const parentWorld =
        parentIndex >= 0
            ? evalDeformer(parentIndex, tables, getParamByIndex, cache)
            : null;

    let world: Moc3DeformerWorld | null = null;

    if (type === ROTATION) {
        const band = tables.rotBand[specific] ?? -1;
        const kfBegin = tables.rotKfBegin[specific] ?? 0;
        const kfCount = tables.rotKfCount[specific] ?? 0;
        const blend = resolveMoc3KeyformBlend(
            tables.keyTables,
            band,
            getParamByIndex,
        );
        const angle = blendKeyformScalar(
            tables.rotAngles,
            kfBegin,
            kfCount,
            blend,
            0,
        );
        const ox = blendKeyformScalar(
            tables.rotOriginX,
            kfBegin,
            kfCount,
            blend,
            0,
        );
        const oy = blendKeyformScalar(
            tables.rotOriginY,
            kfBegin,
            kfCount,
            blend,
            0,
        );
        const scale = blendKeyformScalar(
            tables.rotScales,
            kfBegin,
            kfCount,
            blend,
            1,
        );
        const reflectX =
            blendKeyformScalar(
                tables.rotReflectX,
                kfBegin,
                kfCount,
                blend,
                0,
            ) >= 0.5;
        const reflectY =
            blendKeyformScalar(
                tables.rotReflectY,
                kfBegin,
                kfCount,
                blend,
                0,
            ) >= 0.5;

        // Origins stay in the same units as sibling children. Root rotations
        // use scale≈1/ppu so pixel origins compose correctly via mulAffine;
        // do not /ppu here (that double-scales under small parent scale).
        const local = affineFromRotationKeyform(
            tables.rotBaseAngles[specific] ?? 0,
            angle,
            ox,
            oy,
            scale,
            reflectX,
            reflectY,
        );

        if (!parentWorld) {
            world = { kind: "rotation", affine: local };
        } else if (parentWorld.kind === "rotation") {
            world = {
                kind: "rotation",
                affine: mulAffine(parentWorld.affine, local),
            };
        } else {
            // Parent warp: rotation origin is in warp UV [0,1], but children
            // (and nested rotation origins) are authored in pixels — same as
            // root rotations that bake scale≈1/ppu. Fold 1/ppu into the local
            // linear part before Jacobian composition so pixel children land
            // in UV, then J maps UV → logical.
            const ppu = tables.pixelsPerUnit > 0 ? tables.pixelsPerUnit : 1;
            const alreadyPixelScale = Math.hypot(local.m00, local.m11) < 0.05;
            const s = alreadyPixelScale ? 1 : 1 / ppu;
            const localPx: Moc3Affine = {
                originX: local.originX,
                originY: local.originY,
                m00: local.m00 * s,
                m10: local.m10 * s,
                m01: local.m01 * s,
                m11: local.m11 * s,
            };
            const eps = 1 / 64;
            const probe = new Float32Array([
                localPx.originX,
                localPx.originY,
                localPx.originX + eps,
                localPx.originY,
                localPx.originX,
                localPx.originY + eps,
            ]);
            const warped = applyParentToPoints(probe, parentWorld);
            const j00 = (warped[2]! - warped[0]!) / eps;
            const j10 = (warped[3]! - warped[1]!) / eps;
            const j01 = (warped[4]! - warped[0]!) / eps;
            const j11 = (warped[5]! - warped[1]!) / eps;
            world = {
                kind: "rotation",
                affine: {
                    originX: warped[0]!,
                    originY: warped[1]!,
                    m00: j00 * localPx.m00 + j01 * localPx.m10,
                    m10: j10 * localPx.m00 + j11 * localPx.m10,
                    m01: j00 * localPx.m01 + j01 * localPx.m11,
                    m11: j10 * localPx.m01 + j11 * localPx.m11,
                },
            };
        }
    } else {
        const band = tables.warpBand[specific] ?? -1;
        const kfBegin = tables.warpKfBegin[specific] ?? 0;
        const kfCount = tables.warpKfCount[specific] ?? 0;
        const vertexCount = tables.warpVertexCounts[specific] ?? 0;
        const rows = tables.warpRows[specific] ?? 0;
        const cols = tables.warpCols[specific] ?? 0;
        const blend = resolveMoc3KeyformBlend(
            tables.keyTables,
            band,
            getParamByIndex,
        );
        let grid = blendKeyformFloats(
            tables.positions,
            tables.warpPosBegins,
            kfBegin,
            kfCount,
            vertexCount * 2,
            blend,
        );
        if (parentWorld) {
            grid = applyParentToPoints(grid, parentWorld);
        }
        // moc2-style: rows/cols are cell counts → (rows+1)*(cols+1) points.
        world = { kind: "warp", grid, rows, cols };
    }

    cache[index] = world;
    return world;
}

/** Bake all deformers to world space at the given parameters. */
export function bakeMoc3Deformers(
    doc: Moc3Document,
    keyTables: Moc3KeyTables,
    getParamByIndex: (i: number) => number,
): (Moc3DeformerWorld | null)[] {
    const tables = loadDeformerTables(doc, keyTables);
    const cache: (Moc3DeformerWorld | null)[] = new Array(
        tables.deformerCount,
    ).fill(null);
    for (let i = 0; i < tables.deformerCount; i++) {
        evalDeformer(i, tables, getParamByIndex, cache);
    }
    return cache;
}

export function loadMoc3KeyTables(doc: Moc3Document): Moc3KeyTables {
    return {
        bindingIndex: moc3SectionI32(doc, "keyform_binding_index.indices"),
        bandBegin: moc3SectionI32(doc, "keyform_binding_band.begin_indices"),
        bandCount: moc3SectionI32(doc, "keyform_binding_band.counts"),
        keysBegin: moc3SectionI32(doc, "keyform_binding.keys_begin_indices"),
        keysCount: moc3SectionI32(doc, "keyform_binding.keys_counts"),
        keys: moc3SectionF32(doc, "keys.values"),
        paramBindingBegin: moc3SectionI32(
            doc,
            "parameter.keyform_binding_begin_indices",
        ),
        paramBindingCount: moc3SectionI32(
            doc,
            "parameter.keyform_binding_counts",
        ),
        paramCount: doc.counts[CountIdx.PARAMETERS] ?? 0,
    };
}
