import type { HitAreaDefinition } from "@doki-land/live2d-core";

export interface ResolveHitAreaInput {
    readonly hitAreas: readonly HitAreaDefinition[];
    readonly drawableIndex: number;
    /** Art-mesh / drawable id from MOC when available. */
    readonly artMeshId?: string | null;
}

/**
 * Resolve a triangle hit to a named HitArea when settings id matches the drawable.
 * Falls back to `drawable:N` when no mapping exists.
 */
export function resolveHitAreaName(input: ResolveHitAreaInput): string {
    const { hitAreas, drawableIndex, artMeshId } = input;
    const candidates = new Set<string>();
    if (artMeshId) candidates.add(artMeshId);
    candidates.add(`D_${drawableIndex}`);
    candidates.add(`${drawableIndex}`);
    for (const area of hitAreas) {
        if (candidates.has(area.id)) return area.name;
    }
    return `drawable:${drawableIndex}`;
}
