import type { ModelSource } from "@doki-land/live2d-core";
import { modelSourceUrl } from "@doki-land/live2d-core";

function stableJsonKey(value: unknown): string {
    let h = 5381;
    const text = JSON.stringify(value);
    for (let i = 0; i < text.length; i += 1) {
        h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

/** Stable cache key for stage-level {@link ModelAsset} sharing. */
export function resolveModelAssetKey(source: ModelSource): string {
    if (typeof source === "object" && source.kind === "json") {
        return `json:${source.baseUrl}#${stableJsonKey(source.json)}`;
    }
    return modelSourceUrl(source);
}
