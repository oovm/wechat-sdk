import {
    createLive2d,
    focusParameterUpdates,
    type Live2dActor,
    type Live2dRuntime,
    type Live2dStage,
    type RendererKind,
} from "@doki-land/live2d";
import {
    type ChromeSession,
    mountChrome,
    type WidgetChromeOptions,
} from "../chrome/chrome.js";

export type { WidgetChromeOptions, WidgetToolId } from "../chrome/chrome.js";

/** Composed widget over an existing Stage + Actor (no second RAF). */
export interface ComposedWidgetOptions {
    target: string | HTMLElement;
    stage: Live2dStage;
    actor: Live2dActor;
    width?: number;
    height?: number;
    /** Drive PARAM_ANGLE_X with a sine while the stage loop runs. Default true. */
    autoSway?: boolean;
    /** Start Stage-owned RAF after mount. Default true. */
    autoplay?: boolean;
    chrome?: boolean | WidgetChromeOptions;
    onHit?: (payload: { area: string; x: number; y: number }) => void;
}

/**
 * Bootstrap widget that creates its own Stage + Actor via `createLive2d`.
 * Prefer `createLive2dWidget({ stage, actor, ... })` when you already own the stage.
 */
export interface LegacyWidgetOptions {
    target: string | HTMLElement;
    model?: string;
    width?: number;
    height?: number;
    prefer?: RendererKind[];
    autoSway?: boolean;
    autoplay?: boolean;
    chrome?: boolean | WidgetChromeOptions;
    onHit?: (payload: { area: string; x: number; y: number }) => void;
}

export type WidgetOptions = ComposedWidgetOptions | LegacyWidgetOptions;

function isLegacyOptions(
    options: WidgetOptions,
): options is LegacyWidgetOptions {
    return !("stage" in options && "actor" in options);
}

/**
 * Page widget shell — product chrome over Stage + Actor.
 * Does not own renderer selection or a private RAF loop.
 */
export class Live2dWidget {
    #canvas: HTMLCanvasElement | null = null;
    #stage: Live2dStage | null = null;
    #actor: Live2dActor | null = null;
    #runtime: Live2dRuntime | null = null;
    #chrome: ChromeSession | null = null;
    #unsubFrame: (() => void) | null = null;
    #autoSway = true;
    #swayPhase = 0;
    #onHit: ComposedWidgetOptions["onHit"];

    async mount(options: WidgetOptions): Promise<void> {
        const host =
            typeof options.target === "string"
                ? document.querySelector<HTMLElement>(options.target)
                : options.target;
        if (!host) {
            throw new Error(
                `@doki-land/live2d-widget: target not found: ${String(options.target)}`,
            );
        }

        this.destroy();

        const width = options.width ?? 280;
        const height = options.height ?? 400;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText =
            "display:block;width:100%;height:auto;pointer-events:auto;touch-action:none;background:transparent;cursor:grab;";
        canvas.addEventListener("pointermove", this.#onPointerMove);
        canvas.addEventListener("pointerdown", this.#onPointerDown);

        let stage: Live2dStage;
        let actor: Live2dActor;
        if (isLegacyOptions(options)) {
            const prefer = normalizePrefer(options.prefer);
            const runtime = createLive2d({
                prefer,
                updateMode: "auto",
            });
            await runtime.mount(canvas);
            if (options.model) {
                await runtime.loadModel(options.model);
            }
            this.#runtime = runtime;
            stage = runtime.stage;
            actor = runtime.actor;
        } else {
            stage = options.stage;
            actor = options.actor;
            await stage.mount(canvas);
        }

        this.#canvas = canvas;
        this.#stage = stage;
        this.#actor = actor;
        this.#autoSway = options.autoSway !== false;
        this.#onHit = options.onHit;
        this.#chrome = mountChrome({
            host,
            canvas,
            chrome: options.chrome ?? false,
            getCanvas: () => this.#canvas,
        });
        if (!this.#chrome) {
            host.replaceChildren(canvas);
        }

        if (this.#autoSway) {
            this.#unsubFrame = stage.onFrame((dt) => {
                this.#swayPhase += dt;
                const binding = actor.parameterMap().get("PARAM_ANGLE_X");
                if (!binding) return;
                const normalized = Math.sin(this.#swayPhase) * 0.25;
                const value =
                    normalized >= 0
                        ? binding.defaultValue +
                          (binding.max - binding.defaultValue) * normalized
                        : binding.defaultValue +
                          (binding.defaultValue - binding.min) * normalized;
                actor.setParameter("PARAM_ANGLE_X", value);
            });
        }

        if (options.autoplay !== false) {
            stage.start();
        } else {
            stage.update(0);
            stage.render();
        }
    }

    destroy(): void {
        this.#unsubFrame?.();
        this.#unsubFrame = null;
        if (this.#canvas) {
            this.#canvas.removeEventListener(
                "pointermove",
                this.#onPointerMove,
            );
            this.#canvas.removeEventListener(
                "pointerdown",
                this.#onPointerDown,
            );
        }
        this.#chrome?.destroy();
        this.#chrome = null;
        if (this.#runtime) {
            this.#runtime.destroy();
        } else {
            this.#stage?.stop();
        }
        this.#canvas?.remove();
        this.#canvas = null;
        this.#stage = null;
        this.#actor = null;
        this.#runtime = null;
        this.#onHit = undefined;
    }

    get stage(): Live2dStage | null {
        return this.#stage;
    }

    get actor(): Live2dActor | null {
        return this.#actor;
    }

    /** Legacy accessor when mounted via `createLive2d`. */
    getRuntime(): Live2dRuntime | null {
        return this.#runtime;
    }

    showMessage(
        text: string | string[],
        timeoutMs?: number,
        priority?: number,
    ): void {
        this.#chrome?.tips?.show(text, timeoutMs, priority);
    }

    #modelPoint(event: PointerEvent): { x: number; y: number } | null {
        const canvas = this.#canvas;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: 1 - ((event.clientY - rect.top) / rect.height) * 2,
        };
    }

    #onPointerMove = (event: PointerEvent): void => {
        const p = this.#modelPoint(event);
        const actor = this.#actor;
        if (!p || !actor) return;
        for (const { id, value } of focusParameterUpdates(
            actor.parameterMap(),
            p.x,
            p.y,
        )) {
            actor.setParameter(id, value);
        }
    };

    #onPointerDown = (event: PointerEvent): void => {
        const p = this.#modelPoint(event);
        const stage = this.#stage;
        const actor = this.#actor;
        if (!p || !stage || !actor) return;
        const stageX = (p.x + 1) / 2;
        const stageY = (1 - p.y) / 2;
        const hit = stage.hitTest(stageX, stageY);
        if (!hit || hit.actorId !== actor.id) return;
        this.#onHit?.({ area: hit.area, x: p.x, y: p.y });
        this.#chrome?.tips?.show("碰到我啦～", 2500, 4);
    };
}

function normalizePrefer(
    prefer: RendererKind[] | undefined,
): RendererKind[] | undefined {
    if (!prefer?.length) return undefined;
    const allowed = new Set<RendererKind>(["webgpu", "webgl2", "canvas2d"]);
    const out = prefer.filter((k): k is RendererKind => allowed.has(k));
    return out.length ? out : undefined;
}

export async function createLive2dWidget(
    options: ComposedWidgetOptions,
): Promise<Live2dWidget> {
    const widget = new Live2dWidget();
    await widget.mount(options);
    return widget;
}

export async function mountWidget(
    options: WidgetOptions,
): Promise<Live2dWidget> {
    const widget = new Live2dWidget();
    await widget.mount(options);
    return widget;
}
