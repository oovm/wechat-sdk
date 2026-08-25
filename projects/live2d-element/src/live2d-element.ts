import { createLive2D, type Live2DRuntime } from "@doki-land/live2d";

export const LIVE2D_ELEMENT_TAG = "live-2d" as const;

export type Live2dElementRenderer = "auto" | "webgpu" | "webgl2" | "canvas2d";

const OBSERVED = ["model", "renderer", "width", "height", "autoplay"] as const;

function preferFromRenderer(
    renderer: Live2dElementRenderer,
): Array<"webgpu" | "webgl2" | "canvas2d"> {
    if (renderer === "webgpu") return ["webgpu", "webgl2", "canvas2d"];
    if (renderer === "webgl2") return ["webgl2", "canvas2d", "webgpu"];
    if (renderer === "canvas2d") return ["canvas2d", "webgl2", "webgpu"];
    return ["webgpu", "webgl2", "canvas2d"];
}

function parseBoolAttr(
    el: HTMLElement,
    name: string,
    fallback: boolean,
): boolean {
    if (!el.hasAttribute(name)) return fallback;
    const v = el.getAttribute(name);
    if (v === null || v === "" || v === name) return true;
    if (v === "false" || v === "0") return false;
    return true;
}

/**
 * Thin `<live-2d>` host: attribute → createLive2D → Stage RAF → live2d-* events.
 */
export class Live2dElement extends HTMLElement {
    static get observedAttributes(): string[] {
        return [...OBSERVED];
    }

    #runtime: Live2DRuntime | null = null;
    #canvas: HTMLCanvasElement | null = null;
    #mountGen = 0;
    #model = "";
    #renderer: Live2dElementRenderer = "auto";
    #width = 320;
    #height = 320;
    #autoplay = true;
    #connected = false;

    get model(): string {
        return this.#model;
    }
    set model(value: string) {
        const next = String(value ?? "");
        if (next) this.setAttribute("model", next);
        else this.removeAttribute("model");
    }

    get renderer(): Live2dElementRenderer {
        return this.#renderer;
    }
    set renderer(value: Live2dElementRenderer) {
        this.setAttribute("renderer", (value || "auto") as string);
    }

    get width(): number {
        return this.#width;
    }
    set width(value: number) {
        this.setAttribute("width", String(Math.max(1, Number(value) || 320)));
    }

    get height(): number {
        return this.#height;
    }
    set height(value: number) {
        this.setAttribute("height", String(Math.max(1, Number(value) || 320)));
    }

    get autoplay(): boolean {
        return this.#autoplay;
    }
    set autoplay(value: boolean) {
        if (value) this.setAttribute("autoplay", "");
        else this.removeAttribute("autoplay");
    }

    get runtime(): Live2DRuntime | null {
        return this.#runtime;
    }

    /** Imperative reload (also used when `model` attribute changes). */
    async loadModel(source?: string): Promise<void> {
        if (source !== undefined) {
            this.model = String(source);
        }
        await this.#boot();
    }

    connectedCallback(): void {
        this.#connected = true;
        this.#ensureCanvas();
        this.#readAttributes();
        void this.#boot();
    }

    disconnectedCallback(): void {
        this.#connected = false;
        this.#mountGen += 1;
        this.#destroyRuntime();
    }

    attributeChangedCallback(
        name: string,
        _old: string | null,
        value: string | null,
    ): void {
        if (name === "model") {
            this.#model = value ?? "";
            if (this.#connected) void this.#boot();
            return;
        }
        if (name === "renderer") {
            this.#renderer = (value || "auto") as Live2dElementRenderer;
            if (this.#connected) void this.#boot();
            return;
        }
        if (name === "width") {
            this.#width = Math.max(1, Number(value) || 320);
            this.#syncCanvasSize();
            return;
        }
        if (name === "height") {
            this.#height = Math.max(1, Number(value) || 320);
            this.#syncCanvasSize();
            return;
        }
        if (name === "autoplay") {
            this.#autoplay = parseBoolAttr(this, "autoplay", true);
            if (this.#runtime) {
                if (this.#autoplay) this.#runtime.stage.start();
                else this.#runtime.stage.pause();
            }
        }
    }

    #readAttributes(): void {
        if (this.hasAttribute("model")) {
            this.#model = this.getAttribute("model") ?? "";
        }
        if (this.hasAttribute("renderer")) {
            this.#renderer = (this.getAttribute("renderer") ||
                "auto") as Live2dElementRenderer;
        }
        if (this.hasAttribute("width")) {
            this.#width = Math.max(
                1,
                Number(this.getAttribute("width")) || 320,
            );
        }
        if (this.hasAttribute("height")) {
            this.#height = Math.max(
                1,
                Number(this.getAttribute("height")) || 320,
            );
        }
        this.#autoplay = parseBoolAttr(this, "autoplay", true);
    }

    #ensureCanvas(): HTMLCanvasElement {
        if (this.#canvas?.isConnected) return this.#canvas;
        this.replaceChildren();
        const canvas = document.createElement("canvas");
        canvas.setAttribute("part", "canvas");
        this.appendChild(canvas);
        this.#canvas = canvas;
        this.#syncCanvasSize();
        return canvas;
    }

    #syncCanvasSize(): void {
        const canvas = this.#canvas;
        if (!canvas) return;
        const dpr =
            typeof globalThis.devicePixelRatio === "number"
                ? Math.min(globalThis.devicePixelRatio, 2)
                : 1;
        canvas.width = Math.max(1, Math.round(this.#width * dpr));
        canvas.height = Math.max(1, Math.round(this.#height * dpr));
        canvas.style.width = `${this.#width}px`;
        canvas.style.height = `${this.#height}px`;
        this.style.display = this.style.display || "inline-block";
        this.#runtime?.stage.resize?.(this.#width, this.#height);
    }

    #destroyRuntime(): void {
        try {
            this.#runtime?.stage.stop?.();
        } catch {
            /* manual / already stopped */
        }
        this.#runtime?.destroy?.();
        this.#runtime = null;
        this.removeAttribute("data-phase");
        this.removeAttribute("aria-busy");
    }

    async #boot(): Promise<void> {
        if (!this.#connected) return;
        const model = this.#model.trim();
        if (!model) return;

        const gen = ++this.#mountGen;
        this.#destroyRuntime();

        const canvas = this.#ensureCanvas();
        this.setAttribute("data-phase", "loading");
        this.setAttribute("aria-busy", "true");

        try {
            const runtime = createLive2D({
                prefer: preferFromRenderer(this.#renderer),
                updateMode: "auto",
            });
            if (gen !== this.#mountGen) {
                runtime.destroy();
                return;
            }

            runtime.events.on("ready", () => {
                if (gen !== this.#mountGen) return;
                this.setAttribute("data-phase", "live");
                this.setAttribute("aria-busy", "false");
                if (this.#autoplay) {
                    try {
                        runtime.stage.start();
                    } catch {
                        /* already running */
                    }
                }
                this.dispatchEvent(
                    new CustomEvent("live2d-ready", {
                        bubbles: true,
                        composed: true,
                        detail: { model },
                    }),
                );
            });

            runtime.events.on("error", (payload) => {
                if (gen !== this.#mountGen) return;
                this.#emitError(payload?.error ?? "load error");
            });

            runtime.mount(canvas);
            await runtime.loadModel(model);
            if (gen !== this.#mountGen) {
                runtime.destroy();
                return;
            }
            this.#runtime = runtime;
        } catch (err) {
            if (gen !== this.#mountGen) return;
            this.#emitError(err);
        }
    }

    #emitError(error: unknown): void {
        this.setAttribute("data-phase", "error");
        this.setAttribute("aria-busy", "false");
        this.dispatchEvent(
            new CustomEvent("live2d-error", {
                bubbles: true,
                composed: true,
                detail: {
                    error:
                        error instanceof Error ? error.message : String(error),
                    cause: error,
                },
            }),
        );
    }
}
