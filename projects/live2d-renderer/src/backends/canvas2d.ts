import { canvasCompositeForBlendMode } from "../render/blend.js";
import {
    fitClippingContexts,
    type MaskLayoutRect,
    partitionForClipping,
} from "../render/clipping.js";
import { modelXToCanvasPixelX, modelYUpToCanvasPixelY } from "../render/coords.js";
import { PREVIEW_FILL, PREVIEW_STROKE } from "../render/preview-style.js";
import type {
    DrawableMesh,
    ModelDrawPass,
    Renderer,
    TextureData,
} from "../types.js";

export interface Canvas2DRendererOptions {
    /** Fill color for deformed triangles (CSS). */
    fill?: string;
    stroke?: string;
}

const DEFAULT_FILL = "#5b8def";
const DEFAULT_STROKE = "#1b3a6b";

/** Map model/NDC AABB to canvas pixel rect (y-up NDC → y-down canvas). */
function ndcBoundsToPixels(
    b: MaskLayoutRect,
    w: number,
    h: number,
): { x: number; y: number; width: number; height: number } {
    const x0 = (b.x + 1) * 0.5 * w;
    const x1 = (b.x + b.width + 1) * 0.5 * w;
    const yTop = (1 - (b.y + b.height)) * 0.5 * h;
    const yBot = (1 - b.y) * 0.5 * h;
    return {
        x: x0,
        y: yTop,
        width: Math.max(1, x1 - x0),
        height: Math.max(1, yBot - yTop),
    };
}

/**
 * Draw one textured triangle via affine map from UV pixels → dest positions.
 * Classic canvas mesh approximation used by soft Live2D previews.
 *
 * Triangle clips are expanded slightly to hide anti-aliased seam gaps between
 * adjacent triangles. UV is sampled as authored (same as WebGL without FLIP_Y).
 */
function expandTriangle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    pixels: number,
): [number, number, number, number, number, number] {
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const push = (x: number, y: number): [number, number] => {
        const dx = x - cx;
        const dy = y - cy;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) return [x, y];
        const s = (len + pixels) / len;
        return [cx + dx * s, cy + dy * s];
    };
    const [ex0, ey0] = push(x0, y0);
    const [ex1, ey1] = push(x1, y1);
    const [ex2, ey2] = push(x2, y2);
    return [ex0, ey0, ex1, ey1, ex2, ey2];
}

function drawTexturedTriangle(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    imgW: number,
    imgH: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
): void {
    const sx0 = u0 * imgW;
    const sy0 = v0 * imgH;
    const sx1 = u1 * imgW;
    const sy1 = v1 * imgH;
    const sx2 = u2 * imgW;
    const sy2 = v2 * imgH;

    const [cx0, cy0, cx1, cy1, cx2, cy2] = expandTriangle(
        x0,
        y0,
        x1,
        y1,
        x2,
        y2,
        0.75,
    );

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx0, cy0);
    ctx.lineTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.closePath();
    ctx.clip();

    // Solve affine: [x y 1] = [u v 1] * M  (pixel UV → dest)
    // Use unexpanded verts so texture alignment stays accurate; expansion is
    // only for the clip to cover neighbour AA gaps.
    const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
    if (Math.abs(denom) < 1e-8) {
        ctx.restore();
        return;
    }
    const m11 =
        (x0 * (sy1 - sy2) + x1 * (sy2 - sy0) + x2 * (sy0 - sy1)) / denom;
    const m12 =
        (y0 * (sy1 - sy2) + y1 * (sy2 - sy0) + y2 * (sy0 - sy1)) / denom;
    const m21 =
        (x0 * (sx2 - sx1) + x1 * (sx0 - sx2) + x2 * (sx1 - sx0)) / denom;
    const m22 =
        (y0 * (sx2 - sx1) + y1 * (sx0 - sx2) + y2 * (sx1 - sx0)) / denom;
    const dx =
        (x0 * (sx1 * sy2 - sx2 * sy1) +
            x1 * (sx2 * sy0 - sx0 * sy2) +
            x2 * (sx0 * sy1 - sx1 * sy0)) /
        denom;
    const dy =
        (y0 * (sx1 * sy2 - sx2 * sy1) +
            y1 * (sx2 * sy0 - sx0 * sy2) +
            y2 * (sx0 * sy1 - sx1 * sy0)) /
        denom;

    ctx.setTransform(m11, m12, m21, m22, dx, dy);
    // Expand source slightly to reduce UV edge bleeding under the clip.
    ctx.drawImage(image, -1, -1, imgW + 2, imgH + 2);
    ctx.restore();
}

function rgbaCss(c: { r: number; g: number; b: number; a: number }): string {
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
}

class Canvas2DModelDrawPass implements ModelDrawPass {
    readonly #ctx: CanvasRenderingContext2D;
    readonly #options: Canvas2DRendererOptions;
    #textures: (TextureData | null)[] = [];

    constructor(
        ctx: CanvasRenderingContext2D,
        options: Canvas2DRendererOptions,
    ) {
        this.#ctx = ctx;
        this.#options = options;
    }

    setTextures(textures: TextureData[]): void {
        let maxIndex = -1;
        for (const t of textures) maxIndex = Math.max(maxIndex, t.index);
        this.#textures = new Array(Math.max(0, maxIndex + 1)).fill(null);
        for (const t of textures) this.#textures[t.index] = t;
    }

    draw(drawables: DrawableMesh[], _modelMatrix: Float32Array): void {
        const ctx = this.#ctx;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const byIndex = new Map<number, DrawableMesh>();
        for (const d of drawables) byIndex.set(d.index, d);
        // UV-grid only: Canvas2D cannot isolate R/G/B/A channels.
        const partitioned = partitionForClipping(drawables, {
            mode: "uv-grid",
        });
        const contexts = fitClippingContexts(partitioned.contexts, byIndex);
        const { maskOnly } = partitioned;

        if (contexts.length === 0) {
            for (const d of drawables) {
                if (maskOnly.has(d.index)) continue;
                this.#drawOne(ctx, d, w, h);
            }
            return;
        }

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = w;
        maskCanvas.height = h;
        const maskCtx = maskCanvas.getContext("2d");
        const scratchCanvas = document.createElement("canvas");
        scratchCanvas.width = w;
        scratchCanvas.height = h;
        const scratchCtx = scratchCanvas.getContext("2d");
        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = w;
        layerCanvas.height = h;
        const layerCtx = layerCanvas.getContext("2d");
        const fullMaskCanvas = document.createElement("canvas");
        fullMaskCanvas.width = w;
        fullMaskCanvas.height = h;
        const fullMaskCtx = fullMaskCanvas.getContext("2d");
        if (!maskCtx || !scratchCtx || !layerCtx || !fullMaskCtx) return;

        maskCtx.setTransform(1, 0, 0, 1, 0, 0);
        maskCtx.clearRect(0, 0, w, h);
        for (const c of contexts) {
            scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
            scratchCtx.clearRect(0, 0, w, h);
            for (const mi of c.maskIndices) {
                const maskMesh = byIndex.get(mi);
                if (maskMesh) this.#drawOne(scratchCtx, maskMesh, w, h);
            }
            const src = ndcBoundsToPixels(c.modelBounds, w, h);
            const L = c.layout;
            maskCtx.drawImage(
                scratchCanvas,
                src.x,
                src.y,
                src.width,
                src.height,
                L.x * w,
                L.y * h,
                L.width * w,
                L.height * h,
            );
        }

        const layoutByClippedIndex = new Map<
            number,
            {
                layout: MaskLayoutRect;
                modelBounds: MaskLayoutRect;
                invertedMask: boolean;
            }
        >();
        for (const c of contexts) {
            for (const ci of c.clippedIndices) {
                layoutByClippedIndex.set(ci, {
                    layout: c.layout,
                    modelBounds: c.modelBounds,
                    invertedMask: c.invertedMask,
                });
            }
        }

        for (const d of drawables) {
            if (maskOnly.has(d.index)) continue;
            const clip = layoutByClippedIndex.get(d.index);
            if (!clip) {
                this.#drawOne(ctx, d, w, h);
                continue;
            }
            layerCtx.setTransform(1, 0, 0, 1, 0, 0);
            layerCtx.globalCompositeOperation = "source-over";
            layerCtx.clearRect(0, 0, w, h);
            this.#drawOne(layerCtx, d, w, h);

            // Expand atlas cell into the modelBounds region on a full mask.
            fullMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
            fullMaskCtx.clearRect(0, 0, w, h);
            const L = clip.layout;
            const dst = ndcBoundsToPixels(clip.modelBounds, w, h);
            fullMaskCtx.drawImage(
                maskCanvas,
                L.x * w,
                L.y * h,
                L.width * w,
                L.height * h,
                dst.x,
                dst.y,
                dst.width,
                dst.height,
            );

            layerCtx.globalCompositeOperation = clip.invertedMask
                ? "destination-out"
                : "destination-in";
            layerCtx.drawImage(fullMaskCanvas, 0, 0);
            layerCtx.globalCompositeOperation = "source-over";
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.restore();
        }
    }

    #drawOne(
        ctx: CanvasRenderingContext2D,
        d: DrawableMesh,
        w: number,
        h: number,
    ): void {
        if (!d.visible || d.opacity <= 0) return;
        const sx = w / 2;
        const sy = h / 2;
        const tex = this.#textures[d.textureIndex] ?? null;
        const pos = d.vertexPositions;
        const uvs = d.uvs;
        const idx = d.indices;

        if (tex) {
            ctx.save();
            ctx.globalAlpha = d.opacity;
            ctx.globalCompositeOperation = canvasCompositeForBlendMode(
                d.blendMode,
            );
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            for (let i = 0; i + 2 < idx.length; i += 3) {
                const a = idx[i]!;
                const b = idx[i + 1]!;
                const c = idx[i + 2]!;
                // Geometry: single Y-up → Y-down map. UV stays as authored.
                const ax = modelXToCanvasPixelX(pos[a * 2]!, w);
                const ay = modelYUpToCanvasPixelY(pos[a * 2 + 1]!, h);
                const bx = modelXToCanvasPixelX(pos[b * 2]!, w);
                const by = modelYUpToCanvasPixelY(pos[b * 2 + 1]!, h);
                const cx = modelXToCanvasPixelX(pos[c * 2]!, w);
                const cy = modelYUpToCanvasPixelY(pos[c * 2 + 1]!, h);
                drawTexturedTriangle(
                    ctx,
                    tex.image,
                    tex.width,
                    tex.height,
                    ax,
                    ay,
                    bx,
                    by,
                    cx,
                    cy,
                    uvs[a * 2] ?? 0,
                    uvs[a * 2 + 1] ?? 0,
                    uvs[b * 2] ?? 0,
                    uvs[b * 2 + 1] ?? 0,
                    uvs[c * 2] ?? 0,
                    uvs[c * 2 + 1] ?? 0,
                );
            }
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(sx, -sy);
        ctx.globalAlpha = d.opacity;
        ctx.globalCompositeOperation = canvasCompositeForBlendMode(d.blendMode);
        ctx.fillStyle =
            this.#options.fill ?? DEFAULT_FILL ?? rgbaCss(PREVIEW_FILL);
        ctx.strokeStyle =
            this.#options.stroke ?? DEFAULT_STROKE ?? rgbaCss(PREVIEW_STROKE);
        ctx.lineWidth = 2 / sx;

        for (let i = 0; i + 2 < idx.length; i += 3) {
            const i0 = idx[i]! * 2;
            const i1 = idx[i + 1]! * 2;
            const i2 = idx[i + 2]! * 2;
            ctx.beginPath();
            ctx.moveTo(pos[i0]!, pos[i0 + 1]!);
            ctx.lineTo(pos[i1]!, pos[i1 + 1]!);
            ctx.lineTo(pos[i2]!, pos[i2 + 1]!);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    destroy(): void {
        this.#textures = [];
    }
}

/** Canvas2D soft renderer — CPU FrameSnapshot preview without WebGPU/WebGL. */
export class Canvas2DRendererImpl implements Renderer {
    readonly kind = "canvas2d" as const;

    #canvas: HTMLCanvasElement | null = null;
    #ctx: CanvasRenderingContext2D | null = null;
    readonly #options: Canvas2DRendererOptions;

    constructor(options: Canvas2DRendererOptions = {}) {
        this.#options = options;
    }

    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error(
                "@doki-land/live2d-renderer: Canvas2D is not available",
            );
        }
        this.#canvas = canvas;
        this.#ctx = ctx;
    }

    createModelDrawPass(): ModelDrawPass {
        if (!this.#ctx) {
            throw new Error(
                "@doki-land/live2d-renderer: Canvas2D renderer not initialized",
            );
        }
        return new Canvas2DModelDrawPass(this.#ctx, this.#options);
    }

    beginFrame(): void {
        const ctx = this.#ctx;
        const canvas = this.#canvas;
        if (!ctx || !canvas) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    endFrame(): void {}

    resize(width: number, height: number): void {
        if (!this.#canvas) return;
        this.#canvas.width = width;
        this.#canvas.height = height;
    }

    destroy(): void {
        this.#ctx = null;
        this.#canvas = null;
    }
}

export function createCanvas2DRenderer(
    options?: Canvas2DRendererOptions,
): Renderer {
    return new Canvas2DRendererImpl(options);
}

export function isCanvas2DAvailable(): boolean {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("2d");
}
