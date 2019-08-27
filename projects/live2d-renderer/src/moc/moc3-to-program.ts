/**
 * Lower parsed MOC3 document → ModelProgram.
 *
 * Samples art-mesh keyforms at the given parameters, applies the parent
 * warp / rotation deformer chain, then moc3 Glue (seam pull), then normalize.
 * Constant flags (blend / invert-mask) and drawable mask tables are preserved.
 */

import type {
    DrawableProgram,
    ModelProgram,
    ParameterProgram,
} from "@doki-land/live2d-core";
import { decodeMoc3DrawableFlags } from "./drawable-flags.js";
import {
    applyParentToPoints,
    bakeMoc3Deformers,
    loadMoc3KeyTables,
} from "./moc3-deform.js";
import { applyMoc3Glues, loadMoc3Glues } from "./moc3-glue.js";
import {
    blendKeyformFloats,
    blendKeyformScalar,
    resolveMoc3KeyformBlend,
} from "./moc3-keyforms.js";
import { CountIdx } from "./moc3-layout.js";
import {
    type Moc3Document,
    moc3SectionF32,
    moc3SectionI16,
    moc3SectionI32,
    moc3SectionStrings,
} from "./moc3-reader.js";

function normalizePositions(
    positions: Float32Array,
    canvasWidth: number,
    canvasHeight: number,
    pixelsPerUnit: number,
): Float32Array {
    // Cubism deformer output is in logical units (canvas / ppu). Map to NDC.
    const ppu = pixelsPerUnit > 0 ? pixelsPerUnit : 1;
    const hw = canvasWidth > 0 ? (canvasWidth / ppu) * 0.5 : 0.5;
    const hh = canvasHeight > 0 ? (canvasHeight / ppu) * 0.5 : 0.5;
    const out = new Float32Array(positions.length);
    for (let i = 0; i + 1 < positions.length; i += 2) {
        out[i] = positions[i]! / hw;
        out[i + 1] = positions[i + 1]! / hh;
    }
    return out;
}

export interface Moc3ToProgramOptions {
    /** Parameter values by index; defaults to each param's defaultValue. */
    getParamByIndex?: (index: number) => number;
}

interface DraftDrawable {
    artMeshIndex: number;
    textureIndex: number;
    positions: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
    opacity: number;
    renderOrder: number;
    blendMode: number;
    invertedMask: boolean;
    rawMaskArtMeshes: number[];
    visible: boolean;
}

/** Convert a parsed MOC3 document into a ModelProgram at the given pose. */
export function moc3DocumentToProgram(
    doc: Moc3Document,
    options: Moc3ToProgramOptions = {},
): ModelProgram {
    const meshCount = doc.counts[CountIdx.ART_MESHES] ?? 0;
    const paramCount = doc.counts[CountIdx.PARAMETERS] ?? 0;

    const paramIds = moc3SectionStrings(doc, "parameter.ids");
    const maxValues = moc3SectionF32(doc, "parameter.max_values");
    const minValues = moc3SectionF32(doc, "parameter.min_values");
    const defaultValues = moc3SectionF32(doc, "parameter.default_values");

    const parameters: ParameterProgram[] = [];
    for (let i = 0; i < paramCount; i++) {
        parameters.push({
            id: paramIds[i] || `param_${i}`,
            min: minValues[i] ?? 0,
            max: maxValues[i] ?? 0,
            defaultValue: defaultValues[i] ?? 0,
        });
    }

    const getParamByIndex =
        options.getParamByIndex ??
        ((index: number) => defaultValues[index] ?? 0);

    const keyTables = loadMoc3KeyTables(doc);
    const deformers = bakeMoc3Deformers(doc, keyTables, getParamByIndex);
    const glues = loadMoc3Glues(doc);
    const glueIntensities = moc3SectionF32(doc, "glue_keyform.intensities");

    const visibles = moc3SectionI32(doc, "art_mesh.visibles");
    const enables = moc3SectionI32(doc, "art_mesh.enables");
    const textureIndices = moc3SectionI32(doc, "art_mesh.texture_indices");
    const drawableFlags = moc3SectionI32(doc, "art_mesh.drawable_flags");
    const vertexCounts = moc3SectionI32(doc, "art_mesh.vertex_counts");
    const uvBegins = moc3SectionI32(doc, "art_mesh.uv_begin_indices");
    const indexBegins = moc3SectionI32(
        doc,
        "art_mesh.position_index_begin_indices",
    );
    const indexCounts = moc3SectionI32(doc, "art_mesh.position_index_counts");
    const keyformBegins = moc3SectionI32(doc, "art_mesh.keyform_begin_indices");
    const keyformCounts = moc3SectionI32(doc, "art_mesh.keyform_counts");
    const bandIndices = moc3SectionI32(
        doc,
        "art_mesh.keyform_binding_band_indices",
    );
    const parentDeformers = moc3SectionI32(
        doc,
        "art_mesh.parent_deformer_indices",
    );
    const maskBegins = moc3SectionI32(doc, "art_mesh.mask_begin_indices");
    const maskCounts = moc3SectionI32(doc, "art_mesh.mask_counts");
    const maskArtMeshes = moc3SectionI32(doc, "drawable_mask.art_mesh_indices");

    const keyformOpacities = moc3SectionF32(doc, "art_mesh_keyform.opacities");
    const keyformDrawOrders = moc3SectionF32(
        doc,
        "art_mesh_keyform.draw_orders",
    );
    const keyformPosBegins = moc3SectionI32(
        doc,
        "art_mesh_keyform.keyform_position_begin_indices",
    );

    const keyformPositions = moc3SectionF32(doc, "keyform_position.xys");
    const uvsAll = moc3SectionF32(doc, "uv.xys");
    const indicesAll = moc3SectionI16(doc, "position_index.indices");

    const cw = doc.canvas.canvasWidth;
    const ch = doc.canvas.canvasHeight;
    const ppu = doc.canvas.pixelsPerUnit;

    // World positions for every mesh that participates in glue or draw.
    const worldByMesh = new Map<number, Float32Array>();
    const meshMeta = new Map<
        number,
        {
            textureIndex: number;
            uvs: Float32Array;
            indices: Uint16Array;
            opacity: number;
            renderOrder: number;
            blendMode: number;
            invertedMask: boolean;
            rawMaskArtMeshes: number[];
            visible: boolean;
        }
    >();

    for (let i = 0; i < meshCount; i++) {
        if ((enables[i] ?? 1) === 0) continue;

        const vertexCount = vertexCounts[i] ?? 0;
        const indexCount = indexCounts[i] ?? 0;
        if (vertexCount <= 0 || indexCount < 3) continue;

        const kfBegin = keyformBegins[i] ?? 0;
        const kfCount = keyformCounts[i] ?? 0;
        if (kfCount <= 0) continue;

        const band = bandIndices[i] ?? -1;
        const blend = resolveMoc3KeyformBlend(keyTables, band, getParamByIndex);

        const local = blendKeyformFloats(
            keyformPositions,
            keyformPosBegins,
            kfBegin,
            kfCount,
            vertexCount * 2,
            blend,
        );

        const parentIndex = parentDeformers[i] ?? -1;
        const parent =
            parentIndex >= 0 ? (deformers[parentIndex] ?? null) : null;
        const world = parent ? applyParentToPoints(local, parent) : local;
        worldByMesh.set(i, world);

        const uvBegin = uvBegins[i] ?? 0;
        const uvs = new Float32Array(vertexCount * 2);
        for (let v = 0; v < vertexCount * 2; v++) {
            uvs[v] = uvsAll[uvBegin + v] ?? 0;
        }

        const indexBegin = indexBegins[i] ?? 0;
        const indices = new Uint16Array(indexCount);
        for (let t = 0; t < indexCount; t++) {
            indices[t] = indicesAll[indexBegin + t] ?? 0;
        }

        const opacity = blendKeyformScalar(
            keyformOpacities,
            kfBegin,
            kfCount,
            blend,
            1,
        );
        const renderOrder = Math.round(
            blendKeyformScalar(keyformDrawOrders, kfBegin, kfCount, blend, i),
        );

        const flags = decodeMoc3DrawableFlags(drawableFlags[i] ?? 0);
        const maskCount = maskCounts[i] ?? 0;
        const maskBegin = maskBegins[i] ?? 0;
        const rawMasks: number[] = [];
        for (let m = 0; m < maskCount; m++) {
            const mi = maskArtMeshes[maskBegin + m];
            if (mi !== undefined && mi >= 0) rawMasks.push(mi);
        }

        meshMeta.set(i, {
            textureIndex: Math.max(0, textureIndices[i] ?? 0),
            uvs,
            indices,
            opacity,
            renderOrder,
            blendMode: flags.blendMode,
            invertedMask: flags.invertedMask,
            rawMaskArtMeshes: rawMasks,
            visible: (visibles[i] ?? 1) !== 0,
        });
    }

    applyMoc3Glues(
        worldByMesh,
        glues,
        keyTables,
        getParamByIndex,
        glueIntensities,
    );

    const drafts: DraftDrawable[] = [];
    for (const [artMeshIndex, world] of worldByMesh) {
        const meta = meshMeta.get(artMeshIndex);
        if (!meta) continue;
        drafts.push({
            artMeshIndex,
            textureIndex: meta.textureIndex,
            positions: normalizePositions(world, cw, ch, ppu),
            uvs: meta.uvs,
            indices: meta.indices,
            opacity: meta.opacity,
            renderOrder: meta.renderOrder,
            blendMode: meta.blendMode,
            invertedMask: meta.invertedMask,
            rawMaskArtMeshes: meta.rawMaskArtMeshes,
            visible: meta.visible,
        });
    }

    drafts.sort((a, b) => a.renderOrder - b.renderOrder);

    const artToProgram = new Map<number, number>();
    for (let i = 0; i < drafts.length; i++) {
        artToProgram.set(drafts[i]!.artMeshIndex, i);
    }

    const drawables: DrawableProgram[] = drafts.map((d, index) => {
        const maskIndices: number[] = [];
        for (const art of d.rawMaskArtMeshes) {
            const mapped = artToProgram.get(art);
            if (mapped !== undefined) maskIndices.push(mapped);
        }
        return {
            index,
            textureIndex: d.textureIndex,
            positions: d.positions,
            uvs: d.uvs,
            indices: d.indices,
            opacity: d.opacity,
            renderOrder: d.renderOrder,
            blendMode: d.blendMode,
            invertedMask: d.invertedMask,
            maskIndices,
            visible: d.visible,
            deformParamIndex: -1,
            deformDeltas: null,
        };
    });

    return {
        format: "moc3",
        codec: "moc3",
        parameters,
        drawables,
    };
}
