import type { AssetResolver, ModelSource, SessionState } from "./contracts.js";
import { EventEmitter } from "./events.js";
import type { FrameSnapshot } from "./frame.js";
import type { InternalModel } from "./model.js";

/** High-level runtime session for one mounted surface. */
export interface Live2DSession {
    readonly events: EventEmitter;
    readonly model: InternalModel | null;
    readonly state: SessionState;

    mount(canvas: HTMLCanvasElement): void;

    loadModel(
        source: ModelSource,
        resolver?: AssetResolver,
    ): Promise<InternalModel>;

    /** Latest CPU frame after update, or null if no model. */
    captureFrame(): FrameSnapshot | null;

    update(deltaTimeSeconds: number): void;

    hitTest(x: number, y: number): string | null;

    destroy(): void;
}

export function createSessionStub(): Live2DSession {
    let canvas: HTMLCanvasElement | null = null;
    let model: InternalModel | null = null;
    const events = new EventEmitter();
    let generation = 0;

    return {
        events,
        get model() {
            return model;
        },
        get state() {
            return {
                phase: model
                    ? ("live" as const)
                    : canvas
                      ? ("ready" as const)
                      : ("idle" as const),
                lastError: null,
                generation,
            };
        },
        mount(target) {
            canvas = target;
            generation += 1;
        },
        async loadModel(_source, _resolver) {
            void canvas;
            void _resolver;
            throw new Error(
                "@doki-land/live2d-core: loadModel is provided by @doki-land/live2d facade",
            );
        },
        captureFrame() {
            return null;
        },
        update(_deltaTimeSeconds) {
            if (!model) return;
        },
        hitTest(_x, _y) {
            return null;
        },
        destroy() {
            model = null;
            canvas = null;
            generation += 1;
            events.clear();
        },
    };
}
