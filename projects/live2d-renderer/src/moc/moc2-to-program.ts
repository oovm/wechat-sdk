/**
 * Lower parsed moc2 ModelImpl → CPU ModelProgram.
 *
 * Samples drawable keyforms at the given parameters (defaults if omitted),
 * then applies the parent affine / mesh deformer chain into canvas space.
 * Blend mode (color composition) and clipId → maskIndices are preserved.
 */

import type {
    DrawableProgram,
    ModelProgram,
    ParameterProgram,
} from "@doki-land/live2d-core";
import { FrameBlendMode } from "@doki-land/live2d-core";
import { decodeMoc2ColorComposition } from "./drawable-flags.js";
import { bakeDeformerOps, transformDrawablePositions } from "./moc2-deform.js";
import {
    interpolateKeyforms,
    interpolateScalarTable,
} from "./moc2-keyforms.js";
import type {
    Moc2DrawableMesh,
    Moc2ModelImpl,
    Moc2ParamDef,
} from "./moc2-objects.js";

function buildParamGetter(
    params: readonly Moc2ParamDef[],
    overrides?: ReadonlyMap<string, number> | ((id: string) => number),
): (id: string) => number {
    if (typeof overrides === "function") return overrides;
    const defaults = new Map<string, number>();
    for (const p of params) defaults.set(p.id, p.defaultValue);
    if (overrides) {
        for (const [k, v] of overrides) defaults.set(k, v);
    }
    return (id: string) => defaults.get(id) ?? 0;
}

/** Build a parameter getter from a ModelProgram-aligned value array. */
export function moc2ParamGetterFromValues(
    params: readonly ParameterProgram[] | readonly Moc2ParamDef[],
    values: ArrayLike<number>,
): (id: string) => number {
    const byId = new Map<string, number>();
    for (let i = 0; i < params.length; i++) {
        byId.set(params[i]!.id, values[i] ?? params[i]!.defaultValue);
    }
    return (id: string) => byId.get(id) ?? 0;
}

function normalizePositions(
    positions: Float32Array,
    canvasWidth: number,
    canvasHeight: number,
): Float32Array {
    // moc2 draw coords are in canvas pixels with origin at the corner
    // (typically bottom-left after deform). Map [0, canvas] → NDC [-1, 1]
    // so the model sits in the viewport center like moc3.
    const w = canvasWidth > 0 ? canvasWidth : 1;
    const h = canvasHeight > 0 ? canvasHeight : 1;
    const out = new Float32Array(positions.length);
    for (let i = 0; i + 1 < positions.length; i += 2) {
        out[i] = (positions[i]! / w) * 2 - 1;
        out[i + 1] = (positions[i + 1]! / h) * 2 - 1;
    }
    return out;
}

interface DraftDrawable {
    id: string;
    textureIndex: number;
    positions: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
    opacity: number;
    renderOrder: number;
    blendMode: number;
    clipId: string | null;
    visible: boolean;
}

function lowerDrawable(
    mesh: Moc2DrawableMesh,
    getParam: (id: string) => number,
    ops: ReturnType<typeof bakeDeformerOps>,
    canvasWidth: number,
    canvasHeight: number,
    partVisible: boolean,
): DraftDrawable {
    const floatCount = mesh.numPoints * 2;
    const local = interpolateKeyforms(
        mesh.keyforms,
        mesh.pivotManager,
        getParam,
        floatCount,
    );
    const world = transformDrawablePositions(mesh, local, ops);
    const positions = normalizePositions(world, canvasWidth, canvasHeight);
    const opacity = interpolateScalarTable(
        mesh.opacities,
        mesh.pivotManager,
        getParam,
        1,
    );
    const renderOrder = Math.round(
        interpolateScalarTable(
            mesh.drawOrders,
            mesh.pivotManager,
            getParam,
            mesh.averageDrawOrder,
        ),
    );

    const blendMode =
        (mesh.optionFlags & 1) !== 0
            ? decodeMoc2ColorComposition(mesh.colorComposition)
            : FrameBlendMode.Normal;

    return {
        id: mesh.id,
        textureIndex: mesh.textureIndex,
        positions,
        uvs: new Float32Array(mesh.uvs),
        indices: new Uint16Array(mesh.indices),
        opacity,
        renderOrder,
        blendMode,
        clipId: mesh.clipId,
        visible: partVisible,
    };
}

export interface Moc2ToProgramOptions {
    /** Override parameter values; defaults to each param's defaultValue. */
    getParam?: (id: string) => number;
}

/** Convert a parsed moc2 model into a CPU ModelProgram at the given pose. */
export function moc2ModelToProgram(
    model: Moc2ModelImpl,
    options: Moc2ToProgramOptions = {},
): ModelProgram {
    const paramDefs = model.paramDefSet?.params ?? [];
    const parameters: ParameterProgram[] = paramDefs.map((p) => ({
        id: p.id,
        min: p.min,
        max: p.max,
        defaultValue: p.defaultValue,
    }));
    const getParam = options.getParam ?? buildParamGetter(paramDefs);
    const ops = bakeDeformerOps(model, getParam);

    const drafts: DraftDrawable[] = [];
    for (const part of model.parts) {
        for (const mesh of part.drawData) {
            drafts.push(
                lowerDrawable(
                    mesh,
                    getParam,
                    ops,
                    model.canvasWidth,
                    model.canvasHeight,
                    part.visible,
                ),
            );
        }
    }

    drafts.sort((a, b) => a.renderOrder - b.renderOrder);

    const idToIndex = new Map<string, number>();
    for (let i = 0; i < drafts.length; i++) {
        idToIndex.set(drafts[i]!.id, i);
    }

    const drawables: DrawableProgram[] = drafts.map((d, index) => {
        const maskIndices: number[] = [];
        if (d.clipId) {
            // clipId may be a single id or comma-separated list (Cubism 2).
            for (const raw of d.clipId.split(",")) {
                const id = raw.trim();
                if (!id) continue;
                const mapped = idToIndex.get(id);
                if (mapped !== undefined) maskIndices.push(mapped);
            }
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
            invertedMask: false,
            maskIndices,
            visible: d.visible,
            deformParamIndex: -1,
            deformDeltas: null,
        };
    });

    return {
        format: "moc2",
        codec: "moc2",
        parameters,
        drawables,
    };
}
