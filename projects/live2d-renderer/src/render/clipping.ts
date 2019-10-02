/**
 * Clipping-mask context grouping + mask atlas layout.
 *
 * Two packing modes:
 * - `uv-grid`: √N UV cells, alpha channel only (Canvas2D / simple path)
 * - `rgba`: Cubism-style channel × UV packing (≤4 → full UV on R/G/B/A)
 */

export interface ClippingDrawableRef {
    readonly index: number;
    readonly maskIndices: readonly number[];
    readonly invertedMask: boolean;
}

export interface ClippingContext {
    /** Stable key: invert flag + sorted mask drawable indices. */
    readonly key: string;
    readonly maskIndices: readonly number[];
    readonly clippedIndices: readonly number[];
    readonly invertedMask: boolean;
}

/** UV-space rectangle inside the shared mask atlas (0..1). */
export interface MaskLayoutRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** R/G/B/A write/sample selector (Cubism channelFlag). */
export type MaskChannelFlag = readonly [number, number, number, number];

export const MASK_CHANNEL_FLAGS: readonly MaskChannelFlag[] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
] as const;

export type MaskAtlasMode = "uv-grid" | "rgba";

export interface MaskAtlasOptions {
    /** Packing strategy. Default `rgba` (Cubism density). */
    readonly mode?: MaskAtlasMode;
    /** Cell inset for `uv-grid` only (reduces neighbour bleed). */
    readonly inset?: number;
    /** Render-texture count for `rgba` (default 1 → max 36). */
    readonly renderTextureCount?: number;
}

export interface LaidOutClippingContext extends ClippingContext {
    readonly layout: MaskLayoutRect;
    /** 0=R … 3=A. `uv-grid` always uses A (3). */
    readonly channelIndex: number;
    readonly channelFlag: MaskChannelFlag;
    /** Cubism multi-RT buffer index; currently always 0. */
    readonly bufferIndex: number;
    /**
     * Expanded AABB of clipped drawables in vertex/NDC space.
     * Mask write/sample map this rect into `layout` (Cubism bounds-fit).
     * Default before `fitClippingContexts`: full NDC (-1..1)².
     */
    readonly modelBounds: MaskLayoutRect;
}

/** Full clip-space quad used when no valid clipped bounds exist. */
export const FULL_NDC_BOUNDS: MaskLayoutRect = {
    x: -1,
    y: -1,
    width: 2,
    height: 2,
};

export interface ClippingPartition {
    readonly contexts: readonly LaidOutClippingContext[];
    /** Drawables that consume a mask (drawn after mask pass). */
    readonly clipped: ReadonlySet<number>;
    /** Drawables used as masks (mask buffer only, not color target). */
    readonly maskOnly: ReadonlySet<number>;
}

function maskKey(
    maskIndices: readonly number[],
    invertedMask: boolean,
): string {
    const sorted = [...maskIndices].sort((a, b) => a - b);
    return `${invertedMask ? "i" : "n"}:${sorted.join(",")}`;
}

/**
 * Group drawables that consume clipping masks into shared contexts.
 * Drawables with empty maskIndices are omitted.
 */
export function buildClippingContexts(
    drawables: readonly ClippingDrawableRef[],
): ClippingContext[] {
    const byKey = new Map<
        string,
        {
            maskIndices: number[];
            clippedIndices: number[];
            invertedMask: boolean;
        }
    >();

    for (const d of drawables) {
        if (!d.maskIndices.length) continue;
        const key = maskKey(d.maskIndices, d.invertedMask);
        let ctx = byKey.get(key);
        if (!ctx) {
            ctx = {
                maskIndices: [...d.maskIndices].sort((a, b) => a - b),
                clippedIndices: [],
                invertedMask: d.invertedMask,
            };
            byKey.set(key, ctx);
        }
        ctx.clippedIndices.push(d.index);
    }

    return [...byKey.entries()].map(([key, ctx]) => ({
        key,
        maskIndices: ctx.maskIndices,
        clippedIndices: ctx.clippedIndices,
        invertedMask: ctx.invertedMask,
    }));
}

function withAlphaChannel(
    ctx: ClippingContext,
    layout: MaskLayoutRect,
): LaidOutClippingContext {
    return {
        ...ctx,
        layout,
        channelIndex: 3,
        channelFlag: MASK_CHANNEL_FLAGS[3]!,
        bufferIndex: 0,
        modelBounds: FULL_NDC_BOUNDS,
    };
}

/**
 * Pack clipping contexts into a square-ish UV grid on one atlas (alpha only).
 */
export function layoutMaskAtlasUvGrid(
    contexts: readonly ClippingContext[],
    options: { inset?: number } = {},
): LaidOutClippingContext[] {
    const n = contexts.length;
    if (n === 0) return [];

    const inset = options.inset ?? 0.02;
    if (n === 1) {
        const pad = inset * 0.5;
        return [
            withAlphaChannel(contexts[0]!, {
                x: pad,
                y: pad,
                width: 1 - inset,
                height: 1 - inset,
            }),
        ];
    }

    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = 1 / cols;
    const cellH = 1 / rows;

    return contexts.map((ctx, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const padX = cellW * inset * 0.5;
        const padY = cellH * inset * 0.5;
        return withAlphaChannel(ctx, {
            x: col * cellW + padX,
            y: row * cellH + padY,
            width: cellW * (1 - inset),
            height: cellH * (1 - inset),
        });
    });
}

const COLOR_CHANNEL_COUNT = 4;
const CLIPPING_MASK_MAX_DEFAULT = 36;
const CLIPPING_MASK_MAX_MULTI = 32;

function cubismCellBounds(
    layoutCount: number,
    i: number,
    layoutCountMax: number,
): MaskLayoutRect {
    if (layoutCount === 1) {
        return { x: 0, y: 0, width: 1, height: 1 };
    }
    if (layoutCount === 2) {
        const xpos = i % 2;
        return { x: xpos * 0.5, y: 0, width: 0.5, height: 1 };
    }
    if (layoutCount <= 4) {
        const xpos = i % 2;
        const ypos = Math.floor(i / 2);
        return { x: xpos * 0.5, y: ypos * 0.5, width: 0.5, height: 0.5 };
    }
    if (layoutCount <= layoutCountMax) {
        const xpos = i % 3;
        const ypos = Math.floor(i / 3);
        return {
            x: xpos / 3,
            y: ypos / 3,
            width: 1 / 3,
            height: 1 / 3,
        };
    }
    return { x: 0, y: 0, width: 1, height: 1 };
}

/**
 * Cubism `setupLayoutBounds`: pack across R/G/B/A then UV cells.
 * Single RT → max 36 (4×9); multi-RT → 32 per sheet.
 */
export function layoutMaskAtlasRgba(
    contexts: readonly ClippingContext[],
    options: { renderTextureCount?: number } = {},
): LaidOutClippingContext[] {
    const n = contexts.length;
    if (n === 0) return [];

    const renderTextureCount = Math.max(1, options.renderTextureCount ?? 1);
    const maxCount =
        renderTextureCount <= 1
            ? CLIPPING_MASK_MAX_DEFAULT
            : CLIPPING_MASK_MAX_MULTI * renderTextureCount;
    const layoutCountMax = renderTextureCount <= 1 ? 9 : 8;

    if (n > maxCount) {
        // Over cap: every context reuses full-quad channel 0 (Cubism fallback).
        return contexts.map((ctx) => ({
            ...ctx,
            layout: { x: 0, y: 0, width: 1, height: 1 },
            channelIndex: 0,
            channelFlag: MASK_CHANNEL_FLAGS[0]!,
            bufferIndex: 0,
            modelBounds: FULL_NDC_BOUNDS,
        }));
    }

    const countPerSheetDiv = Math.ceil(n / renderTextureCount);
    const reduceLayoutTextureCount = n % renderTextureCount;
    const divCount = Math.floor(countPerSheetDiv / COLOR_CHANNEL_COUNT);
    const modCount = countPerSheetDiv % COLOR_CHANNEL_COUNT;

    const out: LaidOutClippingContext[] = [];
    let cur = 0;

    for (let rt = 0; rt < renderTextureCount; rt++) {
        for (
            let channelIndex = 0;
            channelIndex < COLOR_CHANNEL_COUNT;
            channelIndex++
        ) {
            let layoutCount = divCount + (channelIndex < modCount ? 1 : 0);
            const checkChannelIndex = modCount + (divCount < 1 ? -1 : 0);
            if (
                channelIndex === checkChannelIndex &&
                reduceLayoutTextureCount > 0
            ) {
                layoutCount -= rt < reduceLayoutTextureCount ? 0 : 1;
            }
            if (layoutCount <= 0) continue;

            for (let i = 0; i < layoutCount; i++) {
                const ctx = contexts[cur++];
                if (!ctx) return out;
                out.push({
                    ...ctx,
                    layout: cubismCellBounds(layoutCount, i, layoutCountMax),
                    channelIndex,
                    channelFlag: MASK_CHANNEL_FLAGS[channelIndex]!,
                    bufferIndex: rt,
                    modelBounds: FULL_NDC_BOUNDS,
                });
            }
        }
    }
    return out;
}

/** Pack clipping contexts (default: Cubism RGBA density). */
export function layoutMaskAtlas(
    contexts: readonly ClippingContext[],
    options: MaskAtlasOptions = {},
): LaidOutClippingContext[] {
    const mode = options.mode ?? "rgba";
    if (mode === "uv-grid") {
        return layoutMaskAtlasUvGrid(contexts, { inset: options.inset });
    }
    return layoutMaskAtlasRgba(contexts, {
        renderTextureCount: options.renderTextureCount,
    });
}

/** Partition drawables and assign atlas layouts. */
export function partitionForClipping(
    drawables: readonly ClippingDrawableRef[],
    options: MaskAtlasOptions = {},
): ClippingPartition {
    const contexts = layoutMaskAtlas(buildClippingContexts(drawables), options);
    const clipped = new Set<number>();
    const maskOnly = new Set<number>();
    for (const ctx of contexts) {
        for (const i of ctx.clippedIndices) clipped.add(i);
        for (const m of ctx.maskIndices) maskOnly.add(m);
    }
    return { contexts, clipped, maskOnly };
}

/** Axis-aligned bounds of interleaved xy vertex positions. */
export function calcVertexBounds(
    positions: Float32Array,
): MaskLayoutRect | null {
    if (positions.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < positions.length; i += 2) {
        const x = positions[i]!;
        const y = positions[i + 1]!;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    const width = maxX - minX;
    const height = maxY - minY;
    if (width <= 0 || height <= 0) return null;
    return { x: minX, y: minY, width, height };
}

/** Expand bounds by a relative margin on each axis (Cubism uses 0.05). */
export function expandBounds(
    bounds: MaskLayoutRect,
    margin = 0.05,
): MaskLayoutRect {
    const dx = bounds.width * margin;
    const dy = bounds.height * margin;
    return {
        x: bounds.x - dx,
        y: bounds.y - dy,
        width: bounds.width + dx * 2,
        height: bounds.height + dy * 2,
    };
}

export interface MaskBoundsMeshRef {
    readonly index: number;
    readonly vertexPositions: Float32Array;
}

/**
 * Union AABB of clipped drawables, expanded by margin (Cubism
 * `calcClippedDrawableTotalBounds` + 0.05 expand).
 */
export function calcClippedDrawableBounds(
    clippedIndices: readonly number[],
    byIndex: ReadonlyMap<number, MaskBoundsMeshRef>,
    margin = 0.05,
): MaskLayoutRect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;
    for (const id of clippedIndices) {
        const mesh = byIndex.get(id);
        if (!mesh) continue;
        const b = calcVertexBounds(mesh.vertexPositions);
        if (!b) continue;
        any = true;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    if (!any) return FULL_NDC_BOUNDS;
    return expandBounds(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        margin,
    );
}

/**
 * Attach per-context `modelBounds` so mask write/sample fit the clipped
 * drawable AABB into the atlas cell (higher mask texel density).
 */
export function fitClippingContexts(
    contexts: readonly LaidOutClippingContext[],
    byIndex: ReadonlyMap<number, MaskBoundsMeshRef>,
    margin = 0.05,
): LaidOutClippingContext[] {
    return contexts.map((ctx) => ({
        ...ctx,
        modelBounds: calcClippedDrawableBounds(
            ctx.clippedIndices,
            byIndex,
            margin,
        ),
    }));
}

/** Flatten layout to `[x, y, w, h]` for GPU uniforms. */
export function maskLayoutVec4(layout: MaskLayoutRect): Float32Array {
    return new Float32Array([layout.x, layout.y, layout.width, layout.height]);
}

/** Flatten channel flag to `[r, g, b, a]` for GPU uniforms. */
export function maskChannelVec4(flag: MaskChannelFlag): Float32Array {
    return new Float32Array([flag[0], flag[1], flag[2], flag[3]]);
}
