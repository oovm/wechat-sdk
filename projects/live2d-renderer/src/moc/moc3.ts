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
    evaluateFrameInto,
    setParameterValue,
} from "../cpu/evaluate.js";
import type {
    ModelBackend,
    ModelBackendOptions,
    ParameterBinding,
} from "../runtime/model-runtime.js";
import type { BlendMode, DrawableMesh } from "../types.js";
import { cascadedPartOpacity, readMoc3PartTables } from "./moc3-parts.js";
import { type Moc3Document, parseMoc3Document } from "./moc3-reader.js";
import {
    evaluateMoc3PoseInto,
    moc3ArtMeshIndicesInProgramOrder,
    moc3DocumentToProgram,
} from "./moc3-to-program.js";

interface Moc3State {
    /** Present for binary MOC3 input; null for cpu-program fixtures. */
    doc: Moc3Document | null;
    instance: ModelInstance;
    meshes: DrawableMesh[];
    drawView: DrawableMesh[];
    /** art-mesh index → mesh (binary path); empty for cpu-program. */
    byArtMesh: Map<number, DrawableMesh>;
    poseOpacity: Float32Array;
    poseDirty: boolean;
    partOpacity: Map<string, number>;
    bindings: ParameterBinding[];
    paramIndexById: Map<string, number>;
}

const stateByModel = new WeakMap<InternalModel, Moc3State>();

function allocateMeshesFromProgram(program: ModelProgram): DrawableMesh[] {
    return program.drawables.map((d) => ({
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
    }));
}

function buildBindings(instance: ModelInstance): {
    bindings: ParameterBinding[];
    paramIndexById: Map<string, number>;
} {
    const bindings: ParameterBinding[] = [];
    const paramIndexById = new Map<string, number>();
    for (let i = 0; i < instance.program.parameters.length; i++) {
        const p = instance.program.parameters[i]!;
        bindings.push({
            id: p.id,
            min: p.min,
            max: p.max,
            defaultValue: p.defaultValue,
            value: instance.parameterValues[i] ?? p.defaultValue,
        });
        paramIndexById.set(p.id, i);
    }
    return { bindings, paramIndexById };
}

function syncBindingValues(state: Moc3State): void {
    for (let i = 0; i < state.bindings.length; i++) {
        const b = state.bindings[i]!;
        (b as { value: number }).value =
            state.instance.parameterValues[i] ?? b.defaultValue;
    }
}

function refreshDrawView(state: Moc3State): void {
    const view = state.drawView;
    view.length = 0;
    for (const m of state.meshes) view.push(m);
    view.sort((a, b) => a.renderOrder - b.renderOrder || a.index - b.index);
}

function applyPartOpacity(state: Moc3State): void {
    const tables = state.doc ? readMoc3PartTables(state.doc) : null;
    for (const mesh of state.meshes) {
        const base = state.poseOpacity[mesh.index] ?? mesh.opacity;
        if (!tables || state.partOpacity.size === 0) {
            mesh.opacity = base;
            continue;
        }
        mesh.opacity =
            base * cascadedPartOpacity(tables, mesh.index, state.partOpacity);
    }
}

function bakePose(state: Moc3State): void {
    if (!state.poseDirty) return;
    if (state.doc) {
        const values = state.instance.parameterValues;
        evaluateMoc3PoseInto(
            state.doc,
            (i) => values[i] ?? 0,
            state.byArtMesh,
            state.poseOpacity,
        );
    } else {
        evaluateFrameInto(state.instance, state.meshes, state.poseOpacity);
    }
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

/** moc3 model backend for binary `.moc3` input or CPU `.program.json` fixtures. */
export class Moc3Backend implements ModelBackend {
    readonly format = "moc3" as const;

    canHandle(json: unknown): boolean {
        return detectModelSettingsFormat(json) === "moc3";
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
            program = shared?.cpuProgram ?? parseCpuProgram(bytes);
        } else {
            doc =
                (shared?.moc3Doc as Moc3Document | undefined) ??
                parseMoc3Document(bytes);
            program = moc3DocumentToProgram(doc);
        }

        const instance = createModelInstance(program);
        const meshes = allocateMeshesFromProgram(program);
        const byArtMesh = new Map<number, DrawableMesh>();
        if (doc) {
            const artOrder = moc3ArtMeshIndicesInProgramOrder(doc);
            for (let i = 0; i < artOrder.length; i++) {
                const art = artOrder[i]!;
                const mesh = meshes[i];
                if (mesh) byArtMesh.set(art, mesh);
            }
        }
        const poseOpacity = new Float32Array(meshes.length);
        for (const m of meshes) poseOpacity[m.index] = m.opacity;
        const { bindings, paramIndexById } = buildBindings(instance);
        const model: InternalModel = {
            id: settings.name ?? settings.url,
            settings,
            format: "moc3",
        };
        const state: Moc3State = {
            doc,
            instance,
            meshes,
            drawView: [],
            byArtMesh,
            poseOpacity,
            poseDirty: true,
            partOpacity: new Map(),
            bindings,
            paramIndexById,
        };
        bakePose(state);
        applyPartOpacity(state);
        stateByModel.set(model, state);
        return model;
    }

    updateModel(model: InternalModel, deltaTimeSeconds: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        state.instance.timeSeconds += deltaTimeSeconds;
        bakePose(state);
        applyPartOpacity(state);
    }

    getDrawables(model: InternalModel): DrawableMesh[] {
        const state = stateByModel.get(model);
        if (!state) return [];
        bakePose(state);
        applyPartOpacity(state);
        return state.drawView;
    }

    captureFrame(model: InternalModel): FrameSnapshot | null {
        const state = stateByModel.get(model);
        if (!state) return null;
        bakePose(state);
        applyPartOpacity(state);
        return frameFromMeshes(state.drawView, state.instance.timeSeconds);
    }

    setParameter(model: InternalModel, id: string, value: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        setParameterValue(state.instance, id, value);
        const index = state.paramIndexById.get(id);
        if (index !== undefined) {
            const binding = state.bindings[index];
            if (binding) {
                (binding as { value: number }).value =
                    state.instance.parameterValues[index] ??
                    binding.defaultValue;
            }
        }
        state.poseDirty = true;
    }

    setPartOpacity(model: InternalModel, id: string, value: number): void {
        const state = stateByModel.get(model);
        if (!state) return;
        const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
        state.partOpacity.set(id, v);
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

    getResidentInstance(model: InternalModel): ModelInstance | null {
        return stateByModel.get(model)?.instance ?? null;
    }
}

export function createMoc3Backend(): Moc3Backend {
    return new Moc3Backend();
}
