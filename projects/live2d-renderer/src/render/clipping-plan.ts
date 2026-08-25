/**
 * Resident clipping / mask atlas plan.
 *
 * Topology (maskIndices / invert / packing options) is compiled once; per frame
 * only `modelBounds` is refreshed from current vertex positions.
 */

import type { DrawableMesh } from "../types.js";
import {
    type ClippingDrawableRef,
    type ClippingPartition,
    calcClippedDrawableBounds,
    type LaidOutClippingContext,
    type MaskAtlasOptions,
    type MaskBoundsMeshRef,
    type MaskLayoutRect,
    partitionForClipping,
} from "./clipping.js";

/** Stable key for mask topology (ignores vertex positions / opacity). */
export function clippingTopologyKey(
    drawables: readonly ClippingDrawableRef[],
): string {
    let key = `n:${drawables.length}`;
    for (let i = 0; i < drawables.length; i++) {
        const d = drawables[i]!;
        key += `|${d.index}:${d.invertedMask ? 1 : 0}:`;
        const masks = d.maskIndices;
        for (let j = 0; j < masks.length; j++) {
            key += `${masks[j]!},`;
        }
    }
    return key;
}

function atlasOptionsKey(options: MaskAtlasOptions): string {
    return `${options.mode ?? "rgba"}:${options.inset ?? ""}:${options.renderTextureCount ?? ""}`;
}

type ResidentContext = {
    -readonly [K in keyof LaidOutClippingContext]: LaidOutClippingContext[K];
} & { modelBounds: MaskLayoutRect };

/**
 * Update `modelBounds` on resident contexts without reallocating the plan.
 */
export function fitClippingContextsInPlace(
    contexts: readonly ResidentContext[],
    byIndex: ReadonlyMap<number, MaskBoundsMeshRef>,
    margin = 0.05,
): void {
    for (let i = 0; i < contexts.length; i++) {
        const ctx = contexts[i]!;
        ctx.modelBounds = calcClippedDrawableBounds(
            ctx.clippedIndices,
            byIndex,
            margin,
        );
    }
}

/**
 * Caches atlas layout + mask/clipped sets while drawable mask topology is
 * unchanged. Call {@link resolve} each frame; call {@link clear} on destroy.
 */
export class ResidentClippingPlan {
    #cacheKey = "";
    #contexts: ResidentContext[] = [];
    #clipped: Set<number> = new Set();
    #maskOnly: Set<number> = new Set();
    readonly #byIndex = new Map<number, MaskBoundsMeshRef>();

    /**
     * Returns a partition whose `contexts` array identity is stable across
     * frames with the same topology. `modelBounds` are refreshed in place.
     */
    resolve(
        drawables: readonly ClippingDrawableRef[],
        options: MaskAtlasOptions = {},
    ): ClippingPartition {
        const nextKey = `${clippingTopologyKey(drawables)}|${atlasOptionsKey(options)}`;
        if (nextKey !== this.#cacheKey) {
            const partitioned = partitionForClipping(drawables, options);
            this.#contexts = partitioned.contexts.map((ctx) => ({
                key: ctx.key,
                maskIndices: ctx.maskIndices,
                clippedIndices: ctx.clippedIndices,
                invertedMask: ctx.invertedMask,
                layout: ctx.layout,
                channelIndex: ctx.channelIndex,
                channelFlag: ctx.channelFlag,
                bufferIndex: ctx.bufferIndex,
                modelBounds: { ...ctx.modelBounds },
            }));
            this.#clipped = new Set(partitioned.clipped);
            this.#maskOnly = new Set(partitioned.maskOnly);
            this.#cacheKey = nextKey;
        }

        this.#byIndex.clear();
        for (let i = 0; i < drawables.length; i++) {
            const d = drawables[i]!;
            if ("vertexPositions" in d) {
                this.#byIndex.set(d.index, d as MaskBoundsMeshRef);
            }
        }
        fitClippingContextsInPlace(this.#contexts, this.#byIndex);
        return {
            contexts: this.#contexts,
            clipped: this.#clipped,
            maskOnly: this.#maskOnly,
        };
    }

    /** Convenience for full drawable meshes (GPU backends). */
    resolveMeshes(
        drawables: readonly DrawableMesh[],
        options: MaskAtlasOptions = {},
    ): ClippingPartition {
        return this.resolve(drawables, options);
    }

    /** True when the last {@link resolve} reused the cached atlas layout. */
    get hasPlan(): boolean {
        return this.#cacheKey.length > 0;
    }

    /** Exposed for tests — context array identity while topology holds. */
    get residentContexts(): readonly LaidOutClippingContext[] {
        return this.#contexts;
    }

    clear(): void {
        this.#cacheKey = "";
        this.#contexts = [];
        this.#clipped = new Set();
        this.#maskOnly = new Set();
        this.#byIndex.clear();
    }
}
