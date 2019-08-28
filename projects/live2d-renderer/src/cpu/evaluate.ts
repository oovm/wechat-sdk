import type {
    FrameBlendMode,
    FrameDrawable,
    FrameSnapshot,
    ModelInstance,
    ModelProgram,
} from "@doki-land/live2d-core";

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

export function setParameterValue(
    instance: ModelInstance,
    parameterId: string,
    value: number,
): void {
    const index = instance.program.parameters.findIndex(
        (p) => p.id === parameterId,
    );
    if (index < 0) {
        throw new Error(
            `@doki-land/live2d-renderer: unknown parameter "${parameterId}"`,
        );
    }
    const p = instance.program.parameters[index]!;
    instance.parameterValues[index] = Math.min(p.max, Math.max(p.min, value));
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

/** CPU deform 鈫?FrameSnapshot. */
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
