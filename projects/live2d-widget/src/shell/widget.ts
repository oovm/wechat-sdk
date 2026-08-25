import {
    type CreateLive2DOptions,
    createLive2D,
    focusParameterUpdates,
    type Live2DRuntime,
    type RendererKind,
} from "@doki-land/live2d";
import {
    type ChromeSession,
    mountChrome,
    type WidgetChromeOptions,
} from "../chrome/chrome.js";

export type { WidgetChromeOptions, WidgetToolId } from "../chrome/chrome.js";

export interface WidgetOptions extends CreateLive2DOptions {
    /** CSS selector or element to host the canvas. */
    target: string | HTMLElement;
    /** Initial model URL (model.json / model3.json / npm:…). */
    model?: string;
    width?: number;
    height?: number;
    /** Drive PARAM_ANGLE_X with a sine while playing. Default true. */
    autoSway?: boolean;
    /** Start the RAF update loop after mount. Default true. */
    autoplay?: boolean;
    /**
     * Optional tips bubble + toolbar (hitokoto / photo / quit).
     * Pass `true` for defaults, or a config object.
     */
    chrome?: boolean | WidgetChromeOptions;
    /** Fired when canvas hit-test finds a drawable. */
    onHit?: (payload: { area: string; x: number; y: number }) => void;
}

/**
 * Page widget shell over `@doki-land/live2d`.
 * Renderer fallback is `createRenderer({ prefer })` (webgpu → webgl2 → canvas2d).
 */
export class Live2DWidget {
    #canvas: HTMLCanvasElement | null = null;
    #runtime: Live2DRuntime | null = null;
    #chrome: ChromeSession | null = null;
    #raf = 0;
    #lastTs = 0;
    #autoSway = true;
    #onHit: WidgetOptions["onHit"];

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

        const prefer = normalizePrefer(options.prefer);
        const runtime = createLive2D({
            backends: options.backends,
            renderer: options.renderer,
            prefer,
        });
        runtime.mount(canvas);

        this.#canvas = canvas;
        this.#runtime = runtime;
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

        if (options.model) {
            await runtime.loadModel(options.model);
        }

        if (options.autoplay !== false) {
            this.#startLoop();
        } else {
            runtime.update(0);
        }
    }

    destroy(): void {
        this.#stopLoop();
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
        this.#runtime?.destroy();
        this.#canvas?.remove();
        this.#runtime = null;
        this.#canvas = null;
        this.#onHit = undefined;
    }

    getRuntime(): Live2DRuntime | null {
        return this.#runtime;
    }

    /** Show a tips bubble when chrome tips are enabled. */
    showMessage(
        text: string | string[],
        timeoutMs?: number,
        priority?: number,
    ): void {
        this.#chrome?.tips?.show(text, timeoutMs, priority);
    }

    #parameterFromNormalized(id: string, normalized: number): number {
        const binding = this.#runtime?.parameterMap().get(id);
        if (!binding) return normalized;
        return normalized >= 0
            ? binding.defaultValue +
                  (binding.max - binding.defaultValue) * normalized
            : binding.defaultValue +
                  (binding.defaultValue - binding.min) * normalized;
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
        const runtime = this.#runtime;
        if (!p || !runtime) return;
        // Pointer tracking overrides auto-sway for ANGLE_X while moving.
        this.#autoSwayPausedByPointer = true;
        for (const { id, value } of focusParameterUpdates(
            runtime.parameterMap(),
            p.x,
            p.y,
        )) {
            runtime.setParameter(id, value);
        }
    };

    #onPointerDown = (event: PointerEvent): void => {
        const p = this.#modelPoint(event);
        const runtime = this.#runtime;
        if (!p || !runtime) return;
        const area = runtime.hitTest(p.x, p.y);
        if (area) {
            this.#onHit?.({ area, x: p.x, y: p.y });
            this.#chrome?.tips?.show("碰到我啦～", 2500, 4);
        }
    };

    #autoSwayPausedByPointer = false;

    #startLoop(): void {
        this.#stopLoop();
        const tick = (ts: number) => {
            const runtime = this.#runtime;
            if (!runtime) return;
            const dt = this.#lastTs ? (ts - this.#lastTs) / 1000 : 0;
            this.#lastTs = ts;
            if (this.#autoSway && !this.#autoSwayPausedByPointer) {
                runtime.setParameter(
                    "PARAM_ANGLE_X",
                    this.#parameterFromNormalized(
                        "PARAM_ANGLE_X",
                        Math.sin(ts / 1000) * 0.25,
                    ),
                );
            }
            // Resume sway shortly after the last pointer sample.
            if (this.#autoSwayPausedByPointer) {
                this.#autoSwayPausedByPointer = false;
            }
            runtime.update(dt);
            this.#raf = requestAnimationFrame(tick);
        };
        this.#raf = requestAnimationFrame(tick);
    }

    #stopLoop(): void {
        if (this.#raf) cancelAnimationFrame(this.#raf);
        this.#raf = 0;
        this.#lastTs = 0;
    }
}

function normalizePrefer(
    prefer: RendererKind[] | undefined,
): RendererKind[] | undefined {
    if (!prefer?.length) return undefined;
    const allowed = new Set<RendererKind>(["webgpu", "webgl2", "canvas2d"]);
    const out = prefer.filter((k): k is RendererKind => allowed.has(k));
    return out.length ? out : undefined;
}

export async function mountWidget(
    options: WidgetOptions,
): Promise<Live2DWidget> {
    const widget = new Live2DWidget();
    await widget.mount(options);
    return widget;
}
