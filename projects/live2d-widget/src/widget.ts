import {
    type CreateLive2DOptions,
    createLive2D,
    type Live2DRuntime,
    type RendererKind,
} from "@doki-land/live2d";

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
}

/**
 * Page widget shell over `@doki-land/live2d`.
 * Renderer fallback is `createRenderer({ prefer })` (webgpu → webgl2 → canvas2d).
 */
export class Live2DWidget {
    #host: HTMLElement | null = null;
    #canvas: HTMLCanvasElement | null = null;
    #runtime: Live2DRuntime | null = null;
    #raf = 0;
    #lastTs = 0;
    #autoSway = true;

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
            "display:block;width:100%;height:auto;pointer-events:auto;background:transparent;";
        host.replaceChildren(canvas);

        const prefer = normalizePrefer(options.prefer);
        const runtime = createLive2D({
            backends: options.backends,
            renderer: options.renderer,
            prefer,
        });
        runtime.mount(canvas);

        this.#host = host;
        this.#canvas = canvas;
        this.#runtime = runtime;
        this.#autoSway = options.autoSway !== false;

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
        this.#runtime?.destroy();
        this.#canvas?.remove();
        this.#runtime = null;
        this.#canvas = null;
        this.#host = null;
    }

    getRuntime(): Live2DRuntime | null {
        return this.#runtime;
    }

    #startLoop(): void {
        this.#stopLoop();
        const tick = (ts: number) => {
            const runtime = this.#runtime;
            if (!runtime) return;
            const dt = this.#lastTs ? (ts - this.#lastTs) / 1000 : 0;
            this.#lastTs = ts;
            if (this.#autoSway) {
                runtime.setParameter(
                    "PARAM_ANGLE_X",
                    Math.sin(ts / 1000) * 0.8,
                );
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
