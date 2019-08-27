/** Load pipeline stage for progress UI. */
export type LoadProgressStage =
    | "mounting"
    | "resolve"
    | "settings"
    | "moc"
    | "textures"
    | "decode"
    | "ready";

export interface LoadProgress {
    readonly stage: LoadProgressStage;
    /** Overall 0..1 */
    readonly progress: number;
    readonly detail?: string;
    readonly bytesLoaded?: number;
    readonly bytesTotal?: number | null;
}

/** Per-frame timing / mesh cost for Status / profiler UIs. */
export interface FrameProfile {
    /** Instantaneous FPS from wall dt (0 if first frame). */
    readonly fps: number;
    /** EMA-smoothed FPS for readable UI. */
    readonly fpsSmooth: number;
    /** Whole `update()` wall time in ms. */
    readonly frameMs: number;
    /** `updateModel` + `getDrawables` in ms. */
    readonly evaluateMs: number;
    /** `beginFrame` + `draw` + `endFrame` in ms. */
    readonly drawMs: number;
    readonly drawableCount: number;
    /** Sum of drawable vertex counts (xy pairs). */
    readonly vertexCount: number;
    /** Sum of drawable index counts. */
    readonly indexCount: number;
}

/** Minimal event bus used by sessions and loaders. */
export type Live2DEventMap = {
    ready: { modelId: string };
    error: { error: unknown };
    progress: LoadProgress;
    /** Fired after each successful `update()` while live. */
    profile: FrameProfile;
    hit: { area: string; x: number; y: number };
    "motion:start": { group: string; index: number };
    "motion:finish": { group: string; index: number };
    phase: { phase: string; generation: number };
};

export type Live2DEventName = keyof Live2DEventMap;

export type Live2DListener<K extends Live2DEventName> = (
    payload: Live2DEventMap[K],
) => void;

export class EventEmitter {
    #listeners = new Map<string, Set<(payload: unknown) => void>>();

    on<K extends Live2DEventName>(
        event: K,
        listener: Live2DListener<K>,
    ): () => void {
        const set = this.#listeners.get(event) ?? new Set();
        set.add(listener as (payload: unknown) => void);
        this.#listeners.set(event, set);
        return () => this.off(event, listener);
    }

    off<K extends Live2DEventName>(
        event: K,
        listener: Live2DListener<K>,
    ): void {
        this.#listeners
            .get(event)
            ?.delete(listener as (payload: unknown) => void);
    }

    emit<K extends Live2DEventName>(
        event: K,
        payload: Live2DEventMap[K],
    ): void {
        for (const listener of this.#listeners.get(event) ?? []) {
            listener(payload);
        }
    }

    clear(): void {
        this.#listeners.clear();
    }
}
