import type {
    ActorHit,
    CreateActorOptions,
    CreateLive2dStageOptions,
    Live2dActor,
    Live2dStage,
    PointerTrackingPolicy,
    StagePointerEvent,
} from "@doki-land/live2d-core";
import type {
    ModelBackend,
    Renderer,
    RendererKind,
} from "@doki-land/live2d-renderer";
import {
    createMoc2Backend,
    createMoc3Backend,
    createRenderer,
} from "@doki-land/live2d-renderer";
import { allocateActorId, Live2dActorImpl } from "./actor.js";
import { ModelAssetRegistry } from "./model-asset-registry.js";
import {
    clientToStage,
    compareActorsForDraw,
    compareActorsForHit,
    transformDrawablesForStage,
} from "./transform.js";

export interface CreateLive2dStageFullOptions extends CreateLive2dStageOptions {
    backends?: ModelBackend[];
    renderer?: Renderer;
    prefer?: RendererKind[];
}

type PointerListener = (event: StagePointerEvent) => void;

export class Live2dStageImpl implements Live2dStage {
    readonly #backends: readonly ModelBackend[];
    readonly #renderer: Renderer;
    readonly #assets: ModelAssetRegistry;
    readonly #updateMode: "auto" | "manual";
    readonly #actors = new Map<string, Live2dActorImpl>();
    readonly #definedLayers: string[] = [
        "background",
        "characters-back",
        "characters",
        "characters-front",
        "effects",
    ];
    readonly #pointerListeners = new Map<
        "pointerdown" | "pointermove" | "pointerup",
        Set<PointerListener>
    >([
        ["pointerdown", new Set()],
        ["pointermove", new Set()],
        ["pointerup", new Set()],
    ]);

    #canvas: HTMLCanvasElement | null = null;
    #initPromise: Promise<void> | null = null;
    #rafId: number | null = null;
    #running = false;
    #paused = false;
    #lastFrameMs = 0;
    #creationCounter = 0;
    #focusedActorId: string | null = null;
    #lastPointer: { stageX: number; stageY: number } | null = null;
    #pointerTracking: PointerTrackingPolicy = { mode: "focused" };
    #boundPointerDown?: (e: PointerEvent) => void;
    #boundPointerMove?: (e: PointerEvent) => void;
    #boundPointerUp?: (e: PointerEvent) => void;
    #destroyed = false;

    constructor(options: CreateLive2dStageFullOptions = {}) {
        this.#backends = options.backends ?? [
            createMoc2Backend(),
            createMoc3Backend(),
        ];
        this.#renderer =
            options.renderer ?? createRenderer({ prefer: options.prefer });
        this.#assets = new ModelAssetRegistry({ backends: this.#backends });
        this.#updateMode = options.updateMode ?? "auto";
    }

    get assets(): ModelAssetRegistry {
        return this.#assets;
    }

    get actors(): readonly Live2dActor[] {
        return [...this.#actors.values()];
    }

    get pointerTracking(): PointerTrackingPolicy {
        return this.#pointerTracking;
    }

    set pointerTracking(policy: PointerTrackingPolicy) {
        this.#pointerTracking = policy;
    }

    get renderer(): Renderer {
        return this.#renderer;
    }

    async mount(canvas: HTMLCanvasElement): Promise<void> {
        if (this.#destroyed) {
            throw new Error("@doki-land/live2d: stage destroyed");
        }
        this.#canvas = canvas;
        this.#initPromise = this.#renderer.initialize(canvas);
        await this.#initPromise;
        this.#attachPointerListeners(canvas);
    }

    createActor(options?: CreateActorOptions): Live2dActor {
        if (this.#destroyed) {
            throw new Error("@doki-land/live2d: stage destroyed");
        }
        const id = options?.id ?? allocateActorId();
        if (this.#actors.has(id)) {
            throw new Error(`@doki-land/live2d: duplicate actor id "${id}"`);
        }
        const creationIndex = this.#creationCounter++;
        const actor = new Live2dActorImpl(options, {
            id,
            creationIndex,
            assets: this.#assets,
            renderer: this.#renderer,
        });
        this.#actors.set(id, actor);
        if (!this.#focusedActorId) {
            this.#focusedActorId = id;
        }
        return actor;
    }

    getActor(id: string): Live2dActor | null {
        return this.#actors.get(id) ?? null;
    }

    resize(width?: number, height?: number): void {
        if (!this.#canvas || this.#destroyed) return;
        const cssW = width ?? this.#canvas.clientWidth;
        const cssH = height ?? this.#canvas.clientHeight;
        if (cssW <= 0 || cssH <= 0) return;
        const dpr =
            typeof globalThis.devicePixelRatio === "number"
                ? globalThis.devicePixelRatio
                : 1;
        this.#canvas.width = Math.round(cssW * dpr);
        this.#canvas.height = Math.round(cssH * dpr);
        this.#renderer.resize(cssW, cssH);
    }

    removeActor(actorOrId: Live2dActor | string): void {
        const id = typeof actorOrId === "string" ? actorOrId : actorOrId.id;
        const actor = this.#actors.get(id);
        if (!actor) return;
        actor.destroy();
        this.#actors.delete(id);
        if (this.#focusedActorId === id) {
            this.#focusedActorId = this.#actors.keys().next().value ?? null;
        }
    }

    defineLayers(layers: readonly string[]): void {
        this.#definedLayers.length = 0;
        this.#definedLayers.push(...layers);
    }

    update(deltaTimeSeconds: number): void {
        if (this.#destroyed) return;
        for (const actor of this.#actors.values()) {
            actor.update(deltaTimeSeconds);
        }
        this.#applyPointerTracking();
    }

    render(): void {
        if (this.#destroyed || !this.#canvas) return;
        const sorted = [...this.#actors.values()].sort((a, b) =>
            compareActorsForDraw(a, b, this.#definedLayers),
        );

        this.#renderer.beginFrame();
        for (const actor of sorted) {
            if (!actor.visible || actor.opacity <= 0) continue;
            const drawables = actor.lastDrawables;
            const pass = actor.slot.drawPass;
            if (!drawables || !pass) continue;
            const placed = transformDrawablesForStage(
                drawables,
                actor.getTransform(),
                actor.opacity,
            );
            pass.draw(placed, new Float32Array(16));
        }
        this.#renderer.endFrame();
    }

    start(): void {
        if (this.#updateMode === "manual") {
            throw new Error(
                "@doki-land/live2d: start() is not available when updateMode is manual",
            );
        }
        if (this.#running) return;
        this.#running = true;
        this.#paused = false;
        this.#lastFrameMs = nowMs();
        const tick = () => {
            if (!this.#running) return;
            if (!this.#paused) {
                const t = nowMs();
                const dt = Math.min(0.1, (t - this.#lastFrameMs) / 1000);
                this.#lastFrameMs = t;
                this.update(dt);
                this.render();
            }
            this.#rafId = requestAnimationFrame(tick);
        };
        this.#rafId = requestAnimationFrame(tick);
    }

    pause(): void {
        this.#paused = true;
    }

    resume(): void {
        this.#paused = false;
        this.#lastFrameMs = nowMs();
    }

    stop(): void {
        this.#running = false;
        this.#paused = false;
        if (this.#rafId !== null) {
            cancelAnimationFrame(this.#rafId);
            this.#rafId = null;
        }
    }

    hitTest(stageX: number, stageY: number): ActorHit | null {
        const hits = this.hitTestAll(stageX, stageY);
        return hits[0] ?? null;
    }

    hitTestAll(stageX: number, stageY: number): readonly ActorHit[] {
        const sorted = [...this.#actors.values()].sort((a, b) =>
            compareActorsForHit(a, b, this.#definedLayers),
        );
        const hits: ActorHit[] = [];
        for (const actor of sorted) {
            const partial = actor.hitTestStage(stageX, stageY);
            if (!partial) continue;
            hits.push({ ...partial, actor });
        }
        return hits;
    }

    addEventListener(
        type: "pointerdown" | "pointermove" | "pointerup",
        listener: PointerListener,
    ): void {
        this.#pointerListeners.get(type)?.add(listener);
    }

    removeEventListener(
        type: "pointerdown" | "pointermove" | "pointerup",
        listener: PointerListener,
    ): void {
        this.#pointerListeners.get(type)?.delete(listener);
    }

    destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.stop();
        this.#detachPointerListeners();
        for (const actor of this.#actors.values()) {
            actor.destroy();
        }
        this.#actors.clear();
        this.#assets.destroy();
        this.#renderer.destroy();
        this.#canvas = null;
        this.#initPromise = null;
        for (const set of this.#pointerListeners.values()) {
            set.clear();
        }
    }

    #attachPointerListeners(canvas: HTMLCanvasElement): void {
        this.#detachPointerListeners();
        this.#boundPointerDown = (e) => this.#onPointer("pointerdown", e);
        this.#boundPointerMove = (e) => this.#onPointer("pointermove", e);
        this.#boundPointerUp = (e) => this.#onPointer("pointerup", e);
        canvas.addEventListener("pointerdown", this.#boundPointerDown);
        canvas.addEventListener("pointermove", this.#boundPointerMove);
        canvas.addEventListener("pointerup", this.#boundPointerUp);
    }

    #detachPointerListeners(): void {
        if (!this.#canvas) return;
        if (this.#boundPointerDown) {
            this.#canvas.removeEventListener(
                "pointerdown",
                this.#boundPointerDown,
            );
        }
        if (this.#boundPointerMove) {
            this.#canvas.removeEventListener(
                "pointermove",
                this.#boundPointerMove,
            );
        }
        if (this.#boundPointerUp) {
            this.#canvas.removeEventListener("pointerup", this.#boundPointerUp);
        }
        this.#boundPointerDown = undefined;
        this.#boundPointerMove = undefined;
        this.#boundPointerUp = undefined;
    }

    #onPointer(
        type: "pointerdown" | "pointermove" | "pointerup",
        event: PointerEvent,
    ): void {
        if (!this.#canvas) return;
        const { stageX, stageY } = clientToStage(
            event.clientX,
            event.clientY,
            this.#canvas,
        );
        this.#lastPointer = { stageX, stageY };
        const hit = this.hitTest(stageX, stageY);
        if (type === "pointerdown" && hit) {
            this.#focusedActorId = hit.actorId;
        }
        const payload: StagePointerEvent = {
            actor: hit?.actor ?? null,
            actorId: hit?.actorId ?? null,
            area: hit?.area ?? null,
            stageX,
            stageY,
            clientX: event.clientX,
            clientY: event.clientY,
            hit,
        };
        for (const listener of this.#pointerListeners.get(type) ?? []) {
            listener(payload);
        }
    }

    #applyPointerTracking(): void {
        if (!this.#canvas || !this.#lastPointer) return;
        const { stageX, stageY } = this.#lastPointer;
        const mode = this.#pointerTracking.mode;
        if (mode === "none") return;

        if (mode === "all") {
            for (const actor of this.#actors.values()) {
                actor.lookAt(stageX, stageY);
            }
            return;
        }

        if (mode === "custom" && this.#pointerTracking.targetActorId) {
            const actor = this.#actors.get(this.#pointerTracking.targetActorId);
            actor?.lookAt(stageX, stageY);
            return;
        }

        if (mode === "hovered") {
            for (const actor of this.#actors.values()) {
                if (actor.hitTestStage(stageX, stageY)) {
                    actor.lookAt(stageX, stageY);
                }
            }
            return;
        }

        if (mode === "nearest") {
            let best: Live2dActorImpl | null = null;
            let bestDist = Number.POSITIVE_INFINITY;
            for (const actor of this.#actors.values()) {
                const t = actor.getTransform();
                const dx = t.x - stageX;
                const dy = t.y - stageY;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = actor;
                }
            }
            best?.lookAt(stageX, stageY);
            return;
        }

        if (mode === "focused" && this.#focusedActorId) {
            this.#actors.get(this.#focusedActorId)?.lookAt(stageX, stageY);
        }
    }
}

function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function createLive2dStage(
    options?: CreateLive2dStageFullOptions,
): Live2dStage {
    return new Live2dStageImpl(options);
}
