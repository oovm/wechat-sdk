import type { RendererKind } from "@doki-land/live2d";

const ALLOWED = new Set<RendererKind>(["webgpu", "webgl2", "canvas2d"]);

/** Default prefer order for Cocos Web: Canvas2D first so pixels can be read back. */
export const DEFAULT_COCOS_PREFER: readonly RendererKind[] = [
    "canvas2d",
    "webgl2",
    "webgpu",
];

/**
 * Keep only known renderer kinds. Empty / invalid input → default Cocos order.
 */
export function normalizePrefer(
    prefer: readonly string[] | undefined | null,
): RendererKind[] {
    if (!prefer?.length) return [...DEFAULT_COCOS_PREFER];
    const out = prefer.filter((k): k is RendererKind =>
        ALLOWED.has(k as RendererKind),
    );
    return out.length ? out : [...DEFAULT_COCOS_PREFER];
}
