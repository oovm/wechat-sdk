import {
    createLive2d,
    type Live2dRuntime,
    type ModelSource,
    type PlayMotionOptions,
    type RendererKind,
} from "@doki-land/live2d";

export const LIVE2D_ELEMENT_TAG = "live-2d" as const;

export type Live2dElementRenderer = "auto" | "webgpu" | "webgl2" | "canvas2d";
export type Live2dElementTracking = "pointer" | "none";

export interface Live2dElementRenderOptions {
    prefer?: RendererKind[];
}

const OBSERVED = [
    "model",
    "renderer",
    "width",
    "height",
    "autoplay",
    "autosway",
    "interactive",
    "tracking",
] as const;

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

function sourceLabel(source: ModelSource): string {
    if (typeof source === "string") return source;
    if (source.kind === "url") return source.url;
    if (source.kind === "npm") {
        const path = source.path.replace(/^\/+/, "");
        return `npm:${source.package}/${path}`;
    }
    return source.baseUrl;
}

function swayAngleX(
    binding: {
        defaultValue: number;
        min: number;
        max: number;
    },
    normalized: number,
): number {
    return normalized >= 0
        ? binding.defaultValue +
              (binding.max - binding.defaultValue) * normalized
        : binding.defaultValue +
              (binding.defaultValue - binding.min) * normalized;
}

/**
 * Thin `<live-2d>` host: attribute → createLive2d → Stage RAF → live2d-* events.
 */
export class Live2dElement extends HTMLElement {
    static get observedAttributes(): string[] {
        return [...OBSERVED];
    }

    #runtime: Live2dRuntime | null = null;
    #canvas: HTMLCanvasElement | null = null;
    #mountGen = 0;
    #model = "";
    #sourceProperty: ModelSource | null = null;
    #renderOptions: Live2dElementRenderOptions | null = null;
    #renderer: Live2dElementRenderer = "auto";
    #width = 320;
    #height = 320;
    #autoplay = true;
    #autosway = false;
    #interactive = false;
    #tracking: Live2dElementTracking = "none";
    #connected = false;
    #boundPointer: ((event: PointerEvent) => void) | null = null;
    #unsubs: Array<() => void> = [];
    #unsubFrame: (() => void) | null = null;
    #swayPhase = 0;

    get model(): string {
        return this.#model;
    }
    set model(value: string) {
        const next = String(value ?? "");
        this.#sourceProperty = null;
        if (next) this.setAttribute("model", next);
        else this.removeAttribute("model");
    }

    /** Structured model source (property-only; not reflected to attributes). */
    get source(): ModelSource | null {
        return this.#sourceProperty;
    }
    set source(value: ModelSource | null) {
        this.#sourceProperty = value;
        if (this.#connected) void this.#boot();
    }

    get renderOptions(): Live2dElementRenderOptions | null {
        return this.#renderOptions;
    }
    set renderOptions(value: Live2dElementRenderOptions | null) {
        this.#renderOptions = value;
        if (this.#connected && this.#resolveLoadSource()) void this.#boot();
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

    get autosway(): boolean {
        return this.#autosway;
    }
    set autosway(value: boolean) {
        if (value) this.setAttribute("autosway", "");
        else this.removeAttribute("autosway");
    }

    get interactive(): boolean {
        return this.#interactive;
    }
    set interactive(value: boolean) {
        if (value) this.setAttribute("interactive", "");
        else this.removeAttribute("interactive");
    }

    get tracking(): Live2dElementTracking {
        return this.#tracking;
    }
    set tracking(value: Live2dElementTracking) {
        this.setAttribute("tracking", value === "pointer" ? "pointer" : "none");
    }

    get runtime(): Live2dRuntime | null {
        return this.#runtime;
    }

    /** Imperative reload (also used when `model` / `source` changes). */
    async loadModel(
        source?: ModelSource | string,
        opts?: { signal?: AbortSignal },
    ): Promise<void> {
        if (source !== undefined) {
            if (typeof source === "string") {
                this.model = source;
            } else {
                this.#sourceProperty = source;
            }
        }
        await this.#boot(opts?.signal);
    }

    playMotion(
        group: string,
        index?: number,
        options?: PlayMotionOptions,
    ): Promise<boolean> {
        return (
            this.#runtime?.playMotion(group, index, options) ??
            Promise.resolve(false)
        );
    }

    setExpression(name: string | null): Promise<boolean> {
        return this.#runtime?.setExpression(name) ?? Promise.resolve(false);
    }

    /** Stage-normalized look-at in [-1, 1] client-mapped coords (x right, y up). */
    lookAt(x: number, y: number): void {
        const stageX = (Number(x) + 1) / 2;
        const stageY = (1 - Number(y)) / 2;
        this.#runtime?.actor.lookAt(stageX, stageY);
    }

    pause(): void {
        this.#runtime?.stage.pause();
    }

    resume(): void {
        this.#runtime?.stage.resume();
        if (this.#autoplay) {
            try {
                this.#runtime?.stage.start();
            } catch {
                /* already running */
            }
        }
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
            this.#sourceProperty = null;
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
            return;
        }
        if (name === "autosway") {
            this.#autosway = parseBoolAttr(this, "autosway", false);
            this.#syncAutosway(this.#runtime, this.#mountGen);
            return;
        }
        if (name === "interactive") {
            this.#interactive = parseBoolAttr(this, "interactive", false);
            this.#syncPointer();
            return;
        }
        if (name === "tracking") {
            this.#tracking = value === "pointer" ? "pointer" : "none";
            this.#syncPointer();
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
        this.#autosway = parseBoolAttr(this, "autosway", false);
        this.#interactive = parseBoolAttr(this, "interactive", false);
        this.#tracking =
            this.getAttribute("tracking") === "pointer" ? "pointer" : "none";
    }

    #resolveLoadSource(): ModelSource | null {
        if (this.#sourceProperty != null) return this.#sourceProperty;
        const model = this.#model.trim();
        return model ? model : null;
    }

    #resolvePrefer(): RendererKind[] {
        const prefer = this.#renderOptions?.prefer;
        if (prefer?.length) return [...prefer];
        return preferFromRenderer(this.#renderer);
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

    #clearUnsubs(): void {
        for (const off of this.#unsubs) {
            try {
                off();
            } catch {
                /* ignore */
            }
        }
        this.#unsubs = [];
    }

    #detachPointer(): void {
        if (this.#canvas && this.#boundPointer) {
            this.#canvas.removeEventListener("pointerdown", this.#boundPointer);
            this.#canvas.removeEventListener("pointermove", this.#boundPointer);
        }
        this.#boundPointer = null;
    }

    #syncAutosway(runtime: Live2dRuntime | null, gen: number): void {
        this.#unsubFrame?.();
        this.#unsubFrame = null;
        if (!runtime || !this.#autosway) return;
        this.#swayPhase = 0;
        this.#unsubFrame = runtime.stage.onFrame((dt) => {
            if (gen !== this.#mountGen) return;
            this.#swayPhase += dt;
            const binding = runtime.actor.parameterMap().get("PARAM_ANGLE_X");
            if (!binding) return;
            const normalized = Math.sin(this.#swayPhase) * 0.25;
            runtime.setParameter(
                "PARAM_ANGLE_X",
                swayAngleX(binding, normalized),
            );
        });
    }

    #syncPointer(): void {
        this.#detachPointer();
        const canvas = this.#canvas;
        const runtime = this.#runtime;
        if (!canvas || !runtime) return;
        if (!this.#interactive && this.#tracking !== "pointer") return;

        this.#boundPointer = (event: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
            if (this.#tracking === "pointer" || event.type === "pointermove") {
                this.lookAt(nx, ny);
            }
            if (this.#interactive && event.type === "pointerdown") {
                const area = runtime.hitTest(nx, ny);
                this.dispatchEvent(
                    new CustomEvent("live2d-hit", {
                        bubbles: true,
                        composed: true,
                        detail: {
                            area,
                            modelX: nx,
                            modelY: ny,
                            originalEvent: event,
                        },
                    }),
                );
            }
        };
        if (this.#interactive) {
            canvas.addEventListener("pointerdown", this.#boundPointer);
        }
        if (this.#tracking === "pointer") {
            canvas.addEventListener("pointermove", this.#boundPointer);
        }
    }

    #destroyRuntime(): void {
        this.#clearUnsubs();
        this.#unsubFrame?.();
        this.#unsubFrame = null;
        this.#detachPointer();
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

    async #boot(signal?: AbortSignal): Promise<void> {
        if (!this.#connected) return;
        const source = this.#resolveLoadSource();
        if (!source) return;

        const gen = ++this.#mountGen;
        this.#destroyRuntime();

        if (signal?.aborted) {
            this.#emitError(signal.reason ?? new Error("aborted"));
            return;
        }

        const onAbort = () => {
            this.#mountGen += 1;
            this.#destroyRuntime();
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        const canvas = this.#ensureCanvas();
        const sourceLabelText = sourceLabel(source);
        this.setAttribute("data-phase", "loading");
        this.setAttribute("aria-busy", "true");

        try {
            const runtime = createLive2d({
                prefer: this.#resolvePrefer(),
                updateMode: "auto",
            });
            if (gen !== this.#mountGen) {
                runtime.destroy();
                return;
            }

            this.#unsubs.push(
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
                    this.#syncAutosway(runtime, gen);
                    this.#syncPointer();
                    this.dispatchEvent(
                        new CustomEvent("live2d-ready", {
                            bubbles: true,
                            composed: true,
                            detail: { model: sourceLabelText },
                        }),
                    );
                }),
            );

            this.#unsubs.push(
                runtime.events.on("error", (payload) => {
                    if (gen !== this.#mountGen) return;
                    this.#emitError(payload?.error ?? "load error");
                }),
            );

            this.#unsubs.push(
                runtime.events.on("progress", (payload) => {
                    if (gen !== this.#mountGen) return;
                    this.dispatchEvent(
                        new CustomEvent("live2d-progress", {
                            bubbles: true,
                            composed: true,
                            detail: payload,
                        }),
                    );
                }),
            );

            this.#unsubs.push(
                runtime.events.on("profile", (payload) => {
                    if (gen !== this.#mountGen) return;
                    this.dispatchEvent(
                        new CustomEvent("live2d-profile", {
                            bubbles: true,
                            composed: true,
                            detail: payload,
                        }),
                    );
                }),
            );

            this.#unsubs.push(
                runtime.events.on("motion:start", (payload) => {
                    if (gen !== this.#mountGen) return;
                    this.dispatchEvent(
                        new CustomEvent("live2d-motion-start", {
                            bubbles: true,
                            composed: true,
                            detail: payload,
                        }),
                    );
                }),
            );

            this.#unsubs.push(
                runtime.events.on("motion:finish", (payload) => {
                    if (gen !== this.#mountGen) return;
                    this.dispatchEvent(
                        new CustomEvent("live2d-motion-finish", {
                            bubbles: true,
                            composed: true,
                            detail: payload,
                        }),
                    );
                }),
            );

            runtime.mount(canvas);
            await runtime.loadModel(source, undefined, { signal });
            if (gen !== this.#mountGen) {
                runtime.destroy();
                return;
            }
            this.#runtime = runtime;
            this.#syncAutosway(runtime, gen);
            this.#syncPointer();
        } catch (err) {
            if (gen !== this.#mountGen) return;
            this.#emitError(err);
        } finally {
            signal?.removeEventListener("abort", onAbort);
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
