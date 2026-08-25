import type {
    FrameBlendMode,
    FrameDrawable,
    FrameSnapshot,
    ModelInstance,
    ModelProgram,
} from "@doki-land/live2d-core";
import type { DrawableMesh } from "../types.js";

/** Create a runtime instance with default parameter values. */
export function createModelInstance(program: ModelProgram): ModelInstance {
    const parameterValues = new Float32Array(program.parameters.length);
    for (let i = 0; i < program.parameters.length; i++) {
        parameterValues[i] = program.parameters[i]?.defaultValue ?? 0;
    }
    return {
        program,
        parameterValues,
        timeSeconds: 0,
    };
}

const paramIndexCache = new WeakMap<object, Map<string, number>>();

function parameterIndex(instance: ModelInstance, parameterId: string): number {
    let map = paramIndexCache.get(instance.program);
    if (!map) {
        map = new Map();
        for (let i = 0; i < instance.program.parameters.length; i++) {
            map.set(instance.program.parameters[i]!.id, i);
        }
        paramIndexCache.set(instance.program, map);
    }
    const index = map.get(parameterId);
    return index ?? -1;
}

export function setParameterValue(
    instance: ModelInstance,
    parameterId: string,
    value: number,
): void {
    const index = parameterIndex(instance, parameterId);
    if (index < 0) {
        throw new Error(
            `@doki-land/live2d-renderer: unknown parameter "${parameterId}"`,
        );
    }
    const p = instance.program.parameters[index]!;
    instance.parameterValues[index] = Math.min(p.max, Math.max(p.min, value));
}

/** O(1) id → parameter index for a compiled program. */
export function resolveParameterIndex(
    instance: ModelInstance,
    parameterId: string,
): number | undefined {
    const index = parameterIndex(instance, parameterId);
    return index >= 0 ? index : undefined;
}

function paramWeight(instance: ModelInstance, paramIndex: number): number {
    const p = instance.program.parameters[paramIndex];
    if (!p) return 0;
    const v = instance.parameterValues[paramIndex] ?? p.defaultValue;
    if (v >= p.defaultValue) {
        const span = p.max - p.defaultValue;
        return span === 0 ? 0 : (v - p.defaultValue) / span;
    }
    const span = p.defaultValue - p.min;
    return span === 0 ? 0 : (v - p.defaultValue) / span;
}

/** CPU deform → FrameSnapshot. */
export function evaluateFrame(instance: ModelInstance): FrameSnapshot {
    const drawables: FrameDrawable[] = [];

    for (const d of instance.program.drawables) {
        const positions = new Float32Array(d.positions);
        if (d.deformParamIndex >= 0 && d.deformDeltas) {
            const w = paramWeight(instance, d.deformParamIndex);
            for (let i = 0; i < positions.length; i++) {
                positions[i] = positions[i]! + w * d.deformDeltas[i]!;
            }
        }
        drawables.push({
            index: d.index,
            textureIndex: d.textureIndex,
            positions,
            uvs: d.uvs,
            indices: d.indices,
            opacity: d.opacity,
            blendMode: d.blendMode as FrameBlendMode,
            renderOrder: d.renderOrder,
            visible: d.visible,
            invertedMask: d.invertedMask,
            maskIndices: d.maskIndices,
        });
    }

    drawables.sort((a, b) => a.renderOrder - b.renderOrder);

    return {
        timeSeconds: instance.timeSeconds,
        drawables,
    };
}

/**
 * Write CPU deform into resident meshes (stable identity).
 * `poseOpacity[i]` mirrors base opacity before host multipliers.
 */
export function evaluateFrameInto(
    instance: ModelInstance,
    meshes: readonly DrawableMesh[],
    poseOpacity: Float32Array,
): void {
    const byIndex = new Map<number, DrawableMesh>();
    for (const m of meshes) byIndex.set(m.index, m);

    for (const d of instance.program.drawables) {
        const sink = byIndex.get(d.index);
        if (!sink) continue;
        let positions = sink.vertexPositions;
        if (positions.length !== d.positions.length) {
            positions = new Float32Array(d.positions.length);
            sink.vertexPositions = positions;
        }
        positions.set(d.positions);
        if (d.deformParamIndex >= 0 && d.deformDeltas) {
            const w = paramWeight(instance, d.deformParamIndex);
            for (let i = 0; i < positions.length; i++) {
                positions[i] = positions[i]! + w * d.deformDeltas[i]!;
            }
        }
        sink.opacity = d.opacity;
        sink.renderOrder = d.renderOrder;
        sink.visible = d.visible;
        if (d.index >= 0 && d.index < poseOpacity.length) {
            poseOpacity[d.index] = d.opacity;
        }
    }
}

/** Stable fingerprint for golden tests (positions + topology). */
export function fingerprintSnapshot(snapshot: FrameSnapshot): string {
    const parts: string[] = [`t=${snapshot.timeSeconds.toFixed(4)}`];
    for (const d of snapshot.drawables) {
        parts.push(
            `d${d.index}:tex=${d.textureIndex};nV=${d.positions.length / 2};nI=${d.indices.length}`,
        );
        for (let i = 0; i < d.positions.length; i++) {
            parts.push(d.positions[i]?.toFixed(5) ?? "0");
        }
        for (let i = 0; i < d.indices.length; i++) {
            parts.push(String(d.indices[i]));
        }
    }
    return parts.join("|");
}
