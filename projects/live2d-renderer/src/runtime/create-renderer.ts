import {
    type Canvas2DRendererOptions,
    createCanvas2DRenderer,
} from "../backends/canvas2d.js";
import {
    createWebGl2Renderer,
    type WebGl2RendererOptions,
} from "../backends/webgl2.js";
import {
    createWebGpuRenderer,
    type WebGpuRendererOptions,
} from "../backends/webgpu.js";
import type { Renderer, RendererKind } from "../types.js";

export interface CreateRendererOptions {
    /**
     * Backend try order at initialize time.
     * Default: `["webgpu", "webgl2", "canvas2d"]`.
     */
    prefer?: RendererKind[];
    webgpu?: WebGpuRendererOptions;
    webgl2?: WebGl2RendererOptions;
    canvas2d?: Canvas2DRendererOptions;
}

const DEFAULT_PREFER: RendererKind[] = ["webgpu", "webgl2", "canvas2d"];

/** Avoid indefinite hangs on `requestAdapter` / `requestDevice`. */
const INIT_TIMEOUT_MS: Record<RendererKind, number> = {
    webgpu: 2500,
    webgl2: 1500,
    canvas2d: 1000,
};

function instantiate(
    kind: RendererKind,
    options: CreateRendererOptions,
): Renderer {
    if (kind === "webgpu") return createWebGpuRenderer(options.webgpu);
    if (kind === "webgl2") return createWebGl2Renderer(options.webgl2);
    return createCanvas2DRenderer(options.canvas2d);
}

async function initializeWithTimeout(
    kind: RendererKind,
    candidate: Renderer,
    canvas: HTMLCanvasElement,
): Promise<void> {
    const ms = INIT_TIMEOUT_MS[kind];
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            candidate.initialize(canvas),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    reject(
                        new Error(
                            `@doki-land/live2d-renderer: ${kind} initialize timed out after ${ms}ms`,
                        ),
                    );
                }, ms);
            }),
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

/**
 * Renderer that picks the first backend whose `initialize` succeeds.
 * Availability is decided at initialize time, not via sync navigator checks.
 */
class FallbackRenderer implements Renderer {
    #inner: Renderer | null = null;
    #kind: RendererKind = "webgpu";
    readonly #prefer: RendererKind[];
    readonly #options: CreateRendererOptions;

    constructor(prefer: RendererKind[], options: CreateRendererOptions) {
        this.#prefer = prefer;
        this.#options = options;
    }

    get kind(): RendererKind {
        return this.#inner?.kind ?? this.#kind;
    }

    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        const errors: string[] = [];
        for (const kind of this.#prefer) {
            const candidate = instantiate(kind, this.#options);
            try {
                await initializeWithTimeout(kind, candidate, canvas);
                this.#inner = candidate;
                this.#kind = candidate.kind;
                return;
            } catch (err) {
                candidate.destroy();
                errors.push(
                    `${kind}: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        }
        throw new Error(
            `@doki-land/live2d-renderer: no renderer initialized (${errors.join("; ")})`,
        );
    }

    createModelDrawPass() {
        if (!this.#inner) {
            throw new Error(
                "@doki-land/live2d-renderer: renderer not initialized",
            );
        }
        return this.#inner.createModelDrawPass();
    }

    beginFrame(): void {
        this.#inner?.beginFrame();
    }

    endFrame(): void {
        this.#inner?.endFrame();
    }

    resize(width: number, height: number): void {
        this.#inner?.resize(width, height);
    }

    destroy(): void {
        this.#inner?.destroy();
        this.#inner = null;
    }
}

/**
 * Create a renderer provider. Actual backend is chosen on `initialize`
 * (WebGPU → WebGL2 → Canvas2D by default).
 */
export function createRenderer(options: CreateRendererOptions = {}): Renderer {
    const prefer = options.prefer?.length ? options.prefer : DEFAULT_PREFER;
    return new FallbackRenderer(prefer, options);
}
