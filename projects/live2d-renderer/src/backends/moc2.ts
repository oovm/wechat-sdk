import type {
    FrameDrawable,
    FrameSnapshot,
    InternalModel,
    ModelInstance,
    ModelSettings,
} from "@doki-land/live2d-core";
import { detectModelSettingsFormat } from "@doki-land/live2d-core";
import type {
    ModelBackend,
    ModelBackendOptions,
    ParameterBinding,
} from "../backend.js";
import {
    createModelInstance,
    evaluateFrame,
    setParameterValue,
} from "../cpu/evaluate.js";
import { type Moc2ModelImpl, Moc2Parser } from "../moc/moc2-objects.js";
import {
    moc2ModelToProgram,
    moc2ParamGetterFromValues,
} from "../moc/moc2-to-program.js";
import type { BlendMode, DrawableMesh } from "../types.js";

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

interface Moc2State {
    moc: Moc2ModelImpl;
    instance: ModelInstance;
    lastFrame: FrameSnapshot | null;
    bakedFingerprint: string;
}

const stateByModel = new WeakMap<InternalModel, Moc2State>();

/** Re-bake moc2 geometry for current parameter values. */
function bakePose(state: Moc2State): void {
    const values = Float32Array.from(state.instance.parameterValues);
    const timeSeconds = state.instance.timeSeconds;
    const fp = paramFingerprint(values);
    if (fp === state.bakedFingerprint && state.lastFrame) {
        return;
    }

    const program = moc2ModelToProgram(state.moc, {
        getParam: moc2ParamGetterFromValues(
            state.moc.paramDefSet.params,
            values,
        ),
    });
    const next = createModelInstance(program);
    next.parameterValues.set(values);
    next.timeSeconds = timeSeconds;
    state.instance = next;
    state.bakedFingerprint = fp;
    state.lastFrame = evaluateFrame(next);
}

/** moc2 (`.moc`) model backend — pure-TS decode → CPU evaluate. */
export class Moc2Backend implements ModelBackend {
    readonly format = "moc2" as const;

    canHandle(json: unknown): boolean {
        return detectModelSettingsFormat(json) === "moc2";
    }

    async createModel(
        settings: ModelSettings,
        options?: ModelBackendOptions,
    ): Promise<InternalModel> {
        let bytes = options?.mocBytes;
        if (!bytes) {
            if (!options?.resolver) {
                throw new Error(
                    "@doki-land/live2d-renderer: Moc2Backend.createModel requires resolver or mocBytes",
                );
            }
            bytes = await options.resolver.fetchBytes(settings.moc);
        }

        const moc = new Moc2Parser(bytes).parseModel();
        const program = moc2ModelToProgram(moc);
        const instance = createModelInstance(program);
        const model: InternalModel = {
            id: settings.name ?? settings.url,
            settings,
            format: "moc2",
        };
        stateByModel.set(model, {
            moc,
            instance,
            lastFrame: null,
            bakedFingerprint: paramFingerprint(instance.parameterValues),
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
        return frame.drawables.map(toDrawableMesh);
    }

    captureFrame(model: InternalModel): FrameSnapshot | null {
        const state = stateByModel.get(model);
        if (!state) return null;
        bakePose(state);
        const frame = state.lastFrame ?? evaluateFrame(state.instance);
        state.lastFrame = frame;
        return frame;
    }

    setParameter(model: InternalModel, id: string, value: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        setParameterValue(state.instance, id, value);
        state.lastFrame = null;
        state.bakedFingerprint = "";
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

export function createMoc2Backend(): Moc2Backend {
    return new Moc2Backend();
}
