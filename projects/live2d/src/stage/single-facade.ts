import type {
    FrameSnapshot,
    Live2DSession,
    LoadProgress,
    ModelSource,
    SessionPhase,
    SessionState,
} from "@doki-land/live2d-core";
import { EventEmitter } from "@doki-land/live2d-core";
import type {
    ModelBackend,
    ParameterBinding,
    Renderer,
    RendererKind,
} from "@doki-land/live2d-renderer";
import type { PlayMotionOptions } from "../motion/index.js";
import { MotionPriority } from "../motion/index.js";
import type { Live2dActorImpl } from "./actor.js";
import type { Live2dStageImpl } from "./stage.js";

export interface CreateLive2DOptions {
    backends?: ModelBackend[];
    renderer?: Renderer;
    prefer?: RendererKind[];
    updateMode?: "auto" | "manual";
}

export interface Live2DRuntime extends Live2DSession {
    readonly renderer: Renderer;
    readonly backends: readonly ModelBackend[];
    readonly stage: Live2dStageImpl;
    readonly actor: Live2dActorImpl;

    setParameter(id: string, value: number): void;
    listParameters(): readonly ParameterBinding[];
    /** Stable load-time parameter map for focus / hosts (no per-frame rebuild). */
    parameterMap(): ReadonlyMap<string, ParameterBinding>;
    resolveParameter(id: string): number | undefined;
    hitTest(x: number, y: number): string | null;
    listMotionGroups(): Record<
        string,
        readonly import("@doki-land/live2d-core").MotionDefinition[]
    >;
    playMotion(
        group: string,
        index?: number,
        options?: PlayMotionOptions,
    ): Promise<boolean>;
    stopMotion(opts?: { fade?: boolean; slot?: string }): void;
    listPlayingMotions(): ReadonlyArray<{
        slot: string;
        group: string;
        index: number;
        time: number;
        priority: number;
    }>;
    capturePng(opts?: {
        mimeType?: "image/png";
        quality?: number;
    }): Promise<Blob>;
}

function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Single-actor facade over a default stage + actor (backward compatible API). */
export function createSingleActorFacade(
    stage: Live2dStageImpl,
    actor: Live2dActorImpl,
    backends: readonly ModelBackend[],
): Live2DRuntime {
    const events = new EventEmitter();
    let canvas: HTMLCanvasElement | null = null;
    let phase: SessionPhase = "idle";
    let lastError: unknown | null = null;
    let generation = 0;
    let fpsSmooth = 0;

    const setPhase = (next: SessionPhase) => {
        phase = next;
        events.emit("phase", { phase, generation });
    };

    const state = (): SessionState => ({
        phase,
        lastError,
        generation,
    });

    const runtime: Live2DRuntime = {
        events,
        backends,
        renderer: stage.renderer,
        stage,
        actor,
        get model() {
            return actor.model;
        },
        get state() {
            return state();
        },
        mount(target) {
            generation += 1;
            canvas = target;
            setPhase("mounting");
            void stage.mount(target).then(
                () => setPhase(actor.model ? "live" : "ready"),
                (err) => {
                    lastError = err;
                    setPhase("error");
                    events.emit("error", { error: err });
                },
            );
        },
        async loadModel(source: ModelSource, resolver) {
            setPhase("loading");
            try {
                const model = await actor.load(source, resolver);
                lastError = null;
                setPhase("live");
                events.emit("ready", { modelId: model.id });
                return model;
            } catch (err) {
                lastError = err;
                setPhase("error");
                events.emit("error", { error: err });
                throw err;
            }
        },
        captureFrame(): FrameSnapshot | null {
            return null;
        },
        setParameter(id, value) {
            actor.setParameter(id, value);
        },
        hitTest(x, y) {
            const stageX = (x + 1) / 2;
            const stageY = (1 - y) / 2;
            const hit = stage.hitTest(stageX, stageY);
            if (!hit || hit.actorId !== actor.id) return null;
            return hit.area;
        },
        listParameters() {
            return actor.listParameters();
        },
        parameterMap() {
            return actor.parameterMap();
        },
        resolveParameter(id) {
            return actor.resolveParameter(id);
        },
        listMotionGroups() {
            return actor.listMotionGroups();
        },
        playMotion(group, index, options) {
            return actor.playMotion(group, index, options);
        },
        stopMotion(opts) {
            actor.stopMotion(opts);
        },
        listPlayingMotions() {
            return actor.listPlayingMotions();
        },
        async capturePng(opts = {}) {
            if (!canvas) {
                throw new Error(
                    "@doki-land/live2d: mount(canvas) before capturePng",
                );
            }
            if (phase === "live") {
                runtime.update(0);
            }
            const mime = opts.mimeType ?? "image/png";
            return await new Promise<Blob>((resolve, reject) => {
                canvas!.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else
                            reject(
                                new Error(
                                    "@doki-land/live2d: canvas.toBlob returned null",
                                ),
                            );
                    },
                    mime,
                    opts.quality,
                );
            });
        },
        update(deltaTimeSeconds) {
            if (phase !== "live" && phase !== "ready") return;
            const t0 = nowMs();
            stage.update(deltaTimeSeconds);
            stage.render();
            const t1 = nowMs();
            const drawables = actor.lastDrawables ?? [];
            let vertexCount = 0;
            let indexCount = 0;
            for (const d of drawables) {
                vertexCount += d.vertexPositions.length / 2;
                indexCount += d.indices.length;
            }
            const frameMs = t1 - t0;
            const fps = deltaTimeSeconds > 0 ? 1 / deltaTimeSeconds : 0;
            fpsSmooth = fpsSmooth <= 0 ? fps : fpsSmooth * 0.85 + fps * 0.15;
            events.emit("profile", {
                fps,
                fpsSmooth,
                frameMs,
                evaluateMs: frameMs,
                drawMs: 0,
                drawableCount: drawables.length,
                vertexCount,
                indexCount,
            });
        },
        destroy() {
            generation += 1;
            stage.destroy();
            canvas = null;
            setPhase("destroyed");
            events.clear();
        },
    };

    return runtime;
}

export { MotionPriority, type PlayMotionOptions };
