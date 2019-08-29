import type {
    FrameDrawable,
    FrameSnapshot,
    InternalModel,
    ModelInstance,
    ModelProgram,
    ModelSettings,
} from "@doki-land/live2d-core";
import { detectModelSettingsFormat } from "@doki-land/live2d-core";
import { isCpuProgramBytes, parseCpuProgram } from "../cpu/cpu-program.js";
import {
    createModelInstance,
    evaluateFrame,
    setParameterValue,
} from "../cpu/evaluate.js";
import type {
    ModelBackend,
    ModelBackendOptions,
    ParameterBinding,
} from "../model-runtime.js";
import type { BlendMode, DrawableMesh } from "../types.js";
import { type Moc3Document, parseMoc3Document } from "./moc3-reader.js";
import { moc3DocumentToProgram } from "./moc3-to-program.js";
import {
    cascadedPartOpacity,
    readMoc3PartTables,
} from "./moc3-parts.js";

function toDrawableMesh(d: FrameDrawable): DrawableMesh {
    return {
        index: d.index,
        textureIndex: d.textureIndex,
        vertexPositions: d.positions,
        uvs: d.uvs,
        indices: d.indices,
        opacity: d.opacity,
        blendMode: d.blendMode as BlendMode,
        invertedMask: d.invertedMask,
        renderOrder: d.renderOrder,
        dynamicFlag: true,
        maskIndices: [...d.maskIndices],
        visible: d.visible,
    };
}

function paramFingerprint(values: ArrayLike<number>): string {
    let s = "";
    for (let i = 0; i < values.length; i++) {
        s += `${values[i]?.toFixed(5)},`;
    }
    return s;
}

interface Moc3State {
    /** Present for official MOC3; null for cpu-program fixtures. */
    doc: Moc3Document | null;
    instance: ModelInstance;
    lastFrame: FrameSnapshot | null;
    bakedFingerprint: string;
    /** Runtime PartOpacity overrides (id → 0..1). */
    partOpacity: Map<string, number>;
}

const stateByModel = new WeakMap<InternalModel, Moc3State>();

function bakePose(state: Moc3State): void {
    if (!state.doc) {
        state.lastFrame = evaluateFrame(state.instance);
        return;
    }

    const values = Float32Array.from(state.instance.parameterValues);
    const timeSeconds = state.instance.timeSeconds;
    const fp = paramFingerprint(values);
    if (fp === state.bakedFingerprint && state.lastFrame) return;

    const program = moc3DocumentToProgram(state.doc, {
        getParamByIndex: (i) => values[i] ?? 0,
    });
    const next = createModelInstance(program);
    next.parameterValues.set(values);
    next.timeSeconds = timeSeconds;
    state.instance = next;
    state.bakedFingerprint = fp;
    state.lastFrame = evaluateFrame(next);
}

/** moc3 model backend — official `.moc3` or CPU `.program.json` fixture. */
export class Moc3Backend implements ModelBackend {
    readonly format = "moc3" as const;

    canHandle(json: unknown): boolean {
        return detectModelSettingsFormat(json) === "moc3";
    }

    async createModel(
        settings: ModelSettings,
        options?: ModelBackendOptions,
    ): Promise<InternalModel> {
        let bytes = options?.mocBytes;
        if (!bytes) {
            if (!options?.resolver) {
                throw new Error(
                    "@doki-land/live2d-renderer: Moc3Backend.createModel requires resolver or mocBytes",
                );
            }
            bytes = await options.resolver.fetchBytes(settings.moc);
        }

        const isCpu =
            settings.moc.toLowerCase().endsWith(".program.json") ||
            isCpuProgramBytes(bytes);

        let doc: Moc3Document | null = null;
        let program: ModelProgram;
        if (isCpu) {
            program = parseCpuProgram(bytes);
        } else {
            doc = parseMoc3Document(bytes);
            program = moc3DocumentToProgram(doc);
        }

        const instance = createModelInstance(program);
        const model: InternalModel = {
            id: settings.name ?? settings.url,
            settings,
            format: "moc3",
        };
        stateByModel.set(model, {
            doc,
            instance,
            lastFrame: null,
            bakedFingerprint: paramFingerprint(instance.parameterValues),
            partOpacity: new Map(),
        });
        return model;
    }

    updateModel(model: InternalModel, deltaTimeSeconds: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        state.instance.timeSeconds += deltaTimeSeconds;
        bakePose(state);
        if (state.lastFrame) {
            state.lastFrame = {
                ...state.lastFrame,
                timeSeconds: state.instance.timeSeconds,
            };
        }
    }

    getDrawables(model: InternalModel): DrawableMesh[] {
        const state = stateByModel.get(model);
        if (!state) return [];
        bakePose(state);
        const frame = state.lastFrame ?? evaluateFrame(state.instance);
        state.lastFrame = frame;
        const tables = state.doc ? readMoc3PartTables(state.doc) : null;
        return frame.drawables.map((d) => {
            const mesh = toDrawableMesh(d);
            if (!tables || state.partOpacity.size === 0) return mesh;
            const mul = cascadedPartOpacity(
                tables,
                d.index,
                state.partOpacity,
            );
            return { ...mesh, opacity: mesh.opacity * mul };
        });
    }

    captureFrame(model: InternalModel): FrameSnapshot | null {
        const state = stateByModel.get(model);
        if (!state) return null;
        bakePose(state);
        const frame = state.lastFrame ?? evaluateFrame(state.instance);
        state.lastFrame = frame;
        const tables = state.doc ? readMoc3PartTables(state.doc) : null;
        if (!tables || state.partOpacity.size === 0) return frame;
        return {
            ...frame,
            drawables: frame.drawables.map((d) => ({
                ...d,
                opacity:
                    d.opacity *
                    cascadedPartOpacity(tables, d.index, state.partOpacity),
            })),
        };
    }

    setParameter(model: InternalModel, id: string, value: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        setParameterValue(state.instance, id, value);
        state.lastFrame = null;
        state.bakedFingerprint = "";
    }

    setPartOpacity(model: InternalModel, id: string, value: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        const v = Number.isFinite(value)
            ? Math.min(1, Math.max(0, value))
            : 1;
        state.partOpacity.set(id, v);
        // Opacity is applied in getDrawables; no need to rebake deform.
    }

    listParameters(model: InternalModel): readonly ParameterBinding[] {
        const state = stateByModel.get(model);
        if (!state) return [];
        return state.instance.program.parameters.map((p, i) => ({
            id: p.id,
            min: p.min,
            max: p.max,
            defaultValue: p.defaultValue,
            value: state.instance.parameterValues[i] ?? p.defaultValue,
        }));
    }

    hitTest(_model: InternalModel, _x: number, _y: number): string | null {
        return null;
    }

    destroyModel(model: InternalModel): void {
        stateByModel.delete(model);
    }
}

export function createMoc3Backend(): Moc3Backend {
    return new Moc3Backend();
}
