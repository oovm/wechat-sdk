/**
 * moc3 Glue: pull paired vertices on art meshes A/B together.
 *
 * Layout (observed on Mao): `glue_info.position_indices` and `.weights` are
 * interleaved pairs `(idxA, idxB)` / `(weightA, weightB)` with weightA+weightB≈1.
 * Keyform `intensities` are Cubism "compatibility" (0..1).
 *
 *   target = wA·posA + wB·posB
 *   posA'  = lerp(posA, target, intensity)
 *   posB'  = lerp(posB, target, intensity)
 */

import {
    blendKeyformScalar,
    type Moc3KeyTables,
    resolveMoc3KeyformBlend,
} from "./moc3-keyforms.js";
import { CountIdx } from "./moc3-layout.js";
import {
    type Moc3Document,
    moc3SectionF32,
    moc3SectionI16,
    moc3SectionI32,
} from "./moc3-reader.js";

export interface Moc3GluePair {
    readonly indexA: number;
    readonly indexB: number;
    readonly weightA: number;
    readonly weightB: number;
}

export interface Moc3GlueDef {
    readonly meshA: number;
    readonly meshB: number;
    readonly pairs: readonly Moc3GluePair[];
    readonly band: number;
    readonly keyformBegin: number;
    readonly keyformCount: number;
}

/** Parse glue tables from a MOC3 document (empty when model has no glues). */
export function loadMoc3Glues(doc: Moc3Document): Moc3GlueDef[] {
    const glueCount = doc.counts[CountIdx.GLUES] ?? 0;
    if (glueCount <= 0) return [];

    const meshAs = moc3SectionI32(doc, "glue.art_mesh_index_as");
    const meshBs = moc3SectionI32(doc, "glue.art_mesh_index_bs");
    const infoBegins = moc3SectionI32(doc, "glue.info_begin_indices");
    const infoCounts = moc3SectionI32(doc, "glue.info_counts");
    const bands = moc3SectionI32(doc, "glue.keyform_binding_band_indices");
    const kfBegins = moc3SectionI32(doc, "glue.keyform_begin_indices");
    const kfCounts = moc3SectionI32(doc, "glue.keyform_counts");
    const weights = moc3SectionF32(doc, "glue_info.weights");
    const posIdx = moc3SectionI16(doc, "glue_info.position_indices");

    const out: Moc3GlueDef[] = [];
    for (let g = 0; g < glueCount; g++) {
        const begin = infoBegins[g] ?? 0;
        const count = infoCounts[g] ?? 0;
        const pairs: Moc3GluePair[] = [];
        for (let i = 0; i + 1 < count; i += 2) {
            pairs.push({
                indexA: posIdx[begin + i] ?? 0,
                indexB: posIdx[begin + i + 1] ?? 0,
                weightA: weights[begin + i] ?? 0.5,
                weightB: weights[begin + i + 1] ?? 0.5,
            });
        }
        out.push({
            meshA: meshAs[g] ?? -1,
            meshB: meshBs[g] ?? -1,
            pairs,
            band: bands[g] ?? -1,
            keyformBegin: kfBegins[g] ?? 0,
            keyformCount: kfCounts[g] ?? 0,
        });
    }
    return out;
}

/**
 * Apply all glues in-place to world-space per-mesh position buffers
 * (length = vertexCount * 2). Missing meshes are skipped.
 */
export function applyMoc3Glues(
    positionsByMesh: Map<number, Float32Array>,
    glues: readonly Moc3GlueDef[],
    keyTables: Moc3KeyTables,
    getParamByIndex: (index: number) => number,
    intensities: Float32Array,
): void {
    for (const glue of glues) {
        const posA = positionsByMesh.get(glue.meshA);
        const posB = positionsByMesh.get(glue.meshB);
        if (!posA || !posB) continue;

        const blend = resolveMoc3KeyformBlend(
            keyTables,
            glue.band,
            getParamByIndex,
        );
        const intensity = blendKeyformScalar(
            intensities,
            glue.keyformBegin,
            glue.keyformCount,
            blend,
            1,
        );
        if (intensity <= 0) continue;

        for (const p of glue.pairs) {
            const oa = p.indexA * 2;
            const ob = p.indexB * 2;
            if (oa + 1 >= posA.length || ob + 1 >= posB.length) continue;

            const ax = posA[oa]!;
            const ay = posA[oa + 1]!;
            const bx = posB[ob]!;
            const by = posB[ob + 1]!;
            const tx = p.weightA * ax + p.weightB * bx;
            const ty = p.weightA * ay + p.weightB * by;
            posA[oa] = ax + (tx - ax) * intensity;
            posA[oa + 1] = ay + (ty - ay) * intensity;
            posB[ob] = bx + (tx - bx) * intensity;
            posB[ob + 1] = by + (ty - by) * intensity;
        }
    }
}

/** Mean Euclidean distance between glued vertex pairs (for tests). */
export function meanGlueSeamDistance(
    positionsByMesh: ReadonlyMap<number, Float32Array>,
    glue: Moc3GlueDef,
): number {
    const posA = positionsByMesh.get(glue.meshA);
    const posB = positionsByMesh.get(glue.meshB);
    if (!posA || !posB || glue.pairs.length === 0) return 0;
    let sum = 0;
    let n = 0;
    for (const p of glue.pairs) {
        const oa = p.indexA * 2;
        const ob = p.indexB * 2;
        if (oa + 1 >= posA.length || ob + 1 >= posB.length) continue;
        const dx = posA[oa]! - posB[ob]!;
        const dy = posA[oa + 1]! - posB[ob + 1]!;
        sum += Math.hypot(dx, dy);
        n++;
    }
    return n > 0 ? sum / n : 0;
}
