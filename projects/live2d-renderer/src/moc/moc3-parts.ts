import type { Moc3Document } from "./moc3-reader.js";

export interface Moc3PartTables {
    readonly ids: readonly string[];
    readonly parentPartIndices: Int32Array;
    readonly artMeshParentPartIndices: Int32Array;
}

export function readMoc3PartTables(doc: Moc3Document): Moc3PartTables | null {
    const ids = doc.sections.get("part.ids");
    const parents = doc.sections.get("part.parent_part_indices");
    const meshParents = doc.sections.get("art_mesh.parent_part_indices");
    if (!Array.isArray(ids) || !(parents instanceof Int32Array)) return null;
    return {
        ids: ids as string[],
        parentPartIndices: parents,
        artMeshParentPartIndices:
            meshParents instanceof Int32Array ? meshParents : new Int32Array(0),
    };
}

/**
 * Cascaded part opacity for an art mesh (motion / pose overrides × parents).
 * Missing override → 1.
 */
export function cascadedPartOpacity(
    tables: Moc3PartTables,
    artMeshIndex: number,
    overrides: ReadonlyMap<string, number>,
): number {
    const root = tables.artMeshParentPartIndices[artMeshIndex] ?? -1;
    let partIndex = root;
    let opacity = 1;
    let guard = 0;
    while (partIndex >= 0 && guard < 64) {
        const id = tables.ids[partIndex];
        if (id !== undefined) {
            const o = overrides.get(id);
            if (o !== undefined) opacity *= o;
        }
        partIndex = tables.parentPartIndices[partIndex] ?? -1;
        guard += 1;
    }
    return opacity;
}
