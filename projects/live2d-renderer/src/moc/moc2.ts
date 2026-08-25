import type {
    FrameDrawable,
    FrameSnapshot,
    InternalModel,
    ModelInstance,
    ModelSettings,
} from "@doki-land/live2d-core";
import { detectModelSettingsFormat } from "@doki-land/live2d-core";
import {
    createModelInstance,
    setParameterValue,
} from "../cpu/evaluate.js";
import type {
    ModelBackend,
    ModelBackendOptions,
    ParameterBinding,
} from "../runtime/model-runtime.js";
import type { BlendMode, DrawableMesh } from "../types.js";
import { type Moc2ModelImpl, Moc2Parser } from "./moc2-objects.js";
import {
    evaluateMoc2PoseInto,
    moc2DrawableIdsInProgramOrder,
    moc2ModelToProgram,
    moc2ParamGetterFromValues,
} from "./moc2-to-program.js";

interface Moc2State {
    moc: Moc2ModelImpl;
    /** Stable program + instance (never replaced after load). */
    instance: ModelInstance;
    /** Resident meshes; objects and topology buffers stay identity-stable. */
    meshes: DrawableMesh[];
    /** Draw-order view (same mesh refs, re-sorted when pose changes). */
    drawView: DrawableMesh[];
    byId: Map<string, DrawableMesh>;
    poseDirty: boolean;
    bindings: ParameterBinding[];
    paramIndexById: Map<string, number>;
}

const stateByModel = new WeakMap<InternalModel, Moc2State>();

function allocateMeshesFromProgram(
    program: ReturnType<typeof moc2ModelToProgram>,
    drawableIds: readonly string[],
): { meshes: DrawableMesh[]; byId: Map<string, DrawableMesh> } {
    const meshes: DrawableMesh[] = [];
    const byId = new Map<string, DrawableMesh>();
    for (let i = 0; i < program.drawables.length; i++) {
        const d = program.drawables[i]!;
        const mesh: DrawableMesh = {
            index: d.index,
            textureIndex: d.textureIndex,
            vertexPositions: new Float32Array(d.positions),
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
        meshes.push(mesh);
        const id = drawableIds[i];
        if (id) byId.set(id, mesh);
    }
    return { meshes, byId };
}

function buildBindings(instance: ModelInstance): {
    bindings: ParameterBinding[];
    paramIndexById: Map<string, number>;
} {
    const bindings: ParameterBinding[] = [];
    const paramIndexById = new Map<string, number>();
    for (let i = 0; i < instance.program.parameters.length; i++) {
        const p = instance.program.parameters[i]!;
        const binding: ParameterBinding = {
            id: p.id,
            min: p.min,
            max: p.max,
            defaultValue: p.defaultValue,
            value: instance.parameterValues[i] ?? p.defaultValue,
        };
        bindings.push(binding);
        paramIndexById.set(p.id, i);
    }
    return { bindings, paramIndexById };
}

function syncBindingValues(state: Moc2State): void {
    for (let i = 0; i < state.bindings.length; i++) {
        const b = state.bindings[i]!;
        (b as { value: number }).value =
            state.instance.parameterValues[i] ?? b.defaultValue;
    }
}

function refreshDrawView(state: Moc2State): void {
    const view = state.drawView;
    view.length = 0;
    for (const m of state.meshes) view.push(m);
    view.sort(
        (a, b) => a.renderOrder - b.renderOrder || a.index - b.index,
    );
}

/** Re-bake moc2 geometry for current parameter values into resident meshes. */
function bakePose(state: Moc2State): void {
    if (!state.poseDirty) return;
    const getParam = moc2ParamGetterFromValues(
        state.instance.program.parameters,
        state.instance.parameterValues,
    );
    evaluateMoc2PoseInto(state.moc, getParam, state.byId);
    refreshDrawView(state);
    syncBindingValues(state);
    state.poseDirty = false;
}

function frameFromMeshes(
    meshes: readonly DrawableMesh[],
    timeSeconds: number,
): FrameSnapshot {
    const drawables: FrameDrawable[] = [];
    for (const m of meshes) {
        drawables.push({
            index: m.index,
            textureIndex: m.textureIndex,
            positions: m.vertexPositions,
            uvs: m.uvs,
            indices: m.indices,
            opacity: m.opacity,
            blendMode: m.blendMode,
            renderOrder: m.renderOrder,
            visible: m.visible,
            invertedMask: m.invertedMask,
            maskIndices: m.maskIndices,
        });
    }
    return { timeSeconds, drawables };
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
        const shared = options?.sharedCompile;
        let bytes = options?.mocBytes ?? shared?.mocBytes;
        if (!bytes) {
            if (!options?.resolver) {
                throw new Error(
                    "@doki-land/live2d-renderer: Moc2Backend.createModel requires resolver or mocBytes",
                );
            }
            bytes = await options.resolver.fetchBytes(settings.moc);
        }

        const moc =
            (shared?.moc2Model as Moc2ModelImpl | undefined) ??
            new Moc2Parser(bytes).parseModel();
        const program = moc2ModelToProgram(moc);
        const instance = createModelInstance(program);
        const drawableIds = moc2DrawableIdsInProgramOrder(moc);
        const { meshes, byId } = allocateMeshesFromProgram(program, drawableIds);
        const { bindings, paramIndexById } = buildBindings(instance);
        const drawView: DrawableMesh[] = [];
        const model: InternalModel = {
            id: settings.name ?? settings.url,
            settings,
            format: "moc2",
        };
        const state: Moc2State = {
            moc,
            instance,
            meshes,
            drawView,
            byId,
            poseDirty: true,
            bindings,
            paramIndexById,
        };
        bakePose(state);
        stateByModel.set(model, state);
        return model;
    }

    updateModel(model: InternalModel, deltaTimeSeconds: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        state.instance.timeSeconds += deltaTimeSeconds;
        bakePose(state);
    }

    getDrawables(model: InternalModel): DrawableMesh[] {
        const state = stateByModel.get(model);
        if (!state) return [];
        bakePose(state);
        return state.drawView;
    }

    captureFrame(model: InternalModel): FrameSnapshot | null {
        const state = stateByModel.get(model);
        if (!state) return null;
        bakePose(state);
        return frameFromMeshes(state.drawView, state.instance.timeSeconds);
    }

    setParameter(model: InternalModel, id: string, value: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        setParameterValue(state.instance, id, value);
        state.poseDirty = true;
    }

    resolveParameter(model: InternalModel, id: string): number | undefined {
        const state = stateByModel.get(model);
        if (!state) return undefined;
        return state.paramIndexById.get(id);
    }

    listParameters(model: InternalModel): readonly ParameterBinding[] {
        const state = stateByModel.get(model);
        if (!state) return [];
        bakePose(state);
        syncBindingValues(state);
        return state.bindings;
    }

    hitTest(_model: InternalModel, _x: number, _y: number): string | null {
        return null;
    }

    destroyModel(model: InternalModel): void {
        stateByModel.delete(model);
    }

    /** Test/harness: stable program + instance refs. */
    getResidentInstance(model: InternalModel): ModelInstance | null {
        return stateByModel.get(model)?.instance ?? null;
    }
}

export function createMoc2Backend(): Moc2Backend {
    return new Moc2Backend();
}
