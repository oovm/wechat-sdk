/**
 * MOC3 section layout used by the decoder: a 64-byte header, a section-offset
 * table of 160 u32 entries, and the referenced body arrays. Deformer evaluation
 * is deferred; the initial pose uses each art mesh's first keyform.
 */

export const MOC3_MAGIC = "MOC3";
export const MOC3_HEADER_SIZE = 64;
export const MOC3_SOT_COUNT = 160;
export const MOC3_COUNT_MAX = 23;

export const Moc3Version = {
    V3_00: 1,
    V3_03: 2,
    V4_00: 3,
    V4_02: 4,
    V5_00: 5,
} as const;

export type Moc3Version = (typeof Moc3Version)[keyof typeof Moc3Version];

export const CountIdx = {
    PARTS: 0,
    DEFORMERS: 1,
    WARP_DEFORMERS: 2,
    ROTATION_DEFORMERS: 3,
    ART_MESHES: 4,
    PARAMETERS: 5,
    PART_KEYFORMS: 6,
    WARP_DEFORMER_KEYFORMS: 7,
    ROTATION_DEFORMER_KEYFORMS: 8,
    ART_MESH_KEYFORMS: 9,
    KEYFORM_POSITIONS: 10,
    KEYFORM_BINDING_INDICES: 11,
    KEYFORM_BINDING_BANDS: 12,
    KEYFORM_BINDINGS: 13,
    KEYS: 14,
    UVS: 15,
    POSITION_INDICES: 16,
    DRAWABLE_MASKS: 17,
    DRAW_ORDER_GROUPS: 18,
    DRAW_ORDER_GROUP_OBJECTS: 19,
    GLUES: 20,
    GLUE_INFOS: 21,
    GLUE_KEYFORMS: 22,
} as const;

export type ElemType =
    | "runtime"
    | "str64"
    | "i32"
    | "f32"
    | "i16"
    | "bool"
    | "u8";

export interface SectionEntry {
    readonly name: string;
    readonly elemType: ElemType;
    readonly countIdx: number;
}

/** V3.00 section list after countInfo + canvasInfo (SOT index = layoutIndex + 2). */
export const MOC3_SECTION_LAYOUT: readonly SectionEntry[] = [
    {
        name: "part.runtime_space",
        elemType: "runtime",
        countIdx: CountIdx.PARTS,
    },
    { name: "part.ids", elemType: "str64", countIdx: CountIdx.PARTS },
    {
        name: "part.keyform_binding_band_indices",
        elemType: "i32",
        countIdx: CountIdx.PARTS,
    },
    {
        name: "part.keyform_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.PARTS,
    },
    { name: "part.keyform_counts", elemType: "i32", countIdx: CountIdx.PARTS },
    { name: "part.visibles", elemType: "bool", countIdx: CountIdx.PARTS },
    { name: "part.enables", elemType: "bool", countIdx: CountIdx.PARTS },
    {
        name: "part.parent_part_indices",
        elemType: "i32",
        countIdx: CountIdx.PARTS,
    },

    {
        name: "deformer.runtime_space",
        elemType: "runtime",
        countIdx: CountIdx.DEFORMERS,
    },
    { name: "deformer.ids", elemType: "str64", countIdx: CountIdx.DEFORMERS },
    {
        name: "deformer.keyform_binding_band_indices",
        elemType: "i32",
        countIdx: CountIdx.DEFORMERS,
    },
    {
        name: "deformer.visibles",
        elemType: "bool",
        countIdx: CountIdx.DEFORMERS,
    },
    {
        name: "deformer.enables",
        elemType: "bool",
        countIdx: CountIdx.DEFORMERS,
    },
    {
        name: "deformer.parent_part_indices",
        elemType: "i32",
        countIdx: CountIdx.DEFORMERS,
    },
    {
        name: "deformer.parent_deformer_indices",
        elemType: "i32",
        countIdx: CountIdx.DEFORMERS,
    },
    { name: "deformer.types", elemType: "i32", countIdx: CountIdx.DEFORMERS },
    {
        name: "deformer.specific_indices",
        elemType: "i32",
        countIdx: CountIdx.DEFORMERS,
    },

    {
        name: "warp_deformer.keyform_binding_band_indices",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMERS,
    },
    {
        name: "warp_deformer.keyform_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMERS,
    },
    {
        name: "warp_deformer.keyform_counts",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMERS,
    },
    {
        name: "warp_deformer.vertex_counts",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMERS,
    },
    {
        name: "warp_deformer.rows",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMERS,
    },
    {
        name: "warp_deformer.cols",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMERS,
    },

    {
        name: "rotation_deformer.keyform_binding_band_indices",
        elemType: "i32",
        countIdx: CountIdx.ROTATION_DEFORMERS,
    },
    {
        name: "rotation_deformer.keyform_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.ROTATION_DEFORMERS,
    },
    {
        name: "rotation_deformer.keyform_counts",
        elemType: "i32",
        countIdx: CountIdx.ROTATION_DEFORMERS,
    },
    {
        name: "rotation_deformer.base_angles",
        elemType: "f32",
        countIdx: CountIdx.ROTATION_DEFORMERS,
    },

    {
        name: "art_mesh.runtime_space_0",
        elemType: "runtime",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.runtime_space_1",
        elemType: "runtime",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.runtime_space_2",
        elemType: "runtime",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.runtime_space_3",
        elemType: "runtime",
        countIdx: CountIdx.ART_MESHES,
    },
    { name: "art_mesh.ids", elemType: "str64", countIdx: CountIdx.ART_MESHES },
    {
        name: "art_mesh.keyform_binding_band_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.keyform_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.keyform_counts",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.visibles",
        elemType: "bool",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.enables",
        elemType: "bool",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.parent_part_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.parent_deformer_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.texture_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.drawable_flags",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    // NOTE: names match observed Wanko SOT payloads (vertex count then UV/index tables).
    {
        name: "art_mesh.vertex_counts",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.uv_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.position_index_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.position_index_counts",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.mask_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },
    {
        name: "art_mesh.mask_counts",
        elemType: "i32",
        countIdx: CountIdx.ART_MESHES,
    },

    {
        name: "parameter.runtime_space",
        elemType: "runtime",
        countIdx: CountIdx.PARAMETERS,
    },
    { name: "parameter.ids", elemType: "str64", countIdx: CountIdx.PARAMETERS },
    {
        name: "parameter.max_values",
        elemType: "f32",
        countIdx: CountIdx.PARAMETERS,
    },
    {
        name: "parameter.min_values",
        elemType: "f32",
        countIdx: CountIdx.PARAMETERS,
    },
    {
        name: "parameter.default_values",
        elemType: "f32",
        countIdx: CountIdx.PARAMETERS,
    },
    {
        name: "parameter.repeats",
        elemType: "bool",
        countIdx: CountIdx.PARAMETERS,
    },
    {
        name: "parameter.decimal_places",
        elemType: "i32",
        countIdx: CountIdx.PARAMETERS,
    },
    {
        name: "parameter.keyform_binding_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.PARAMETERS,
    },
    {
        name: "parameter.keyform_binding_counts",
        elemType: "i32",
        countIdx: CountIdx.PARAMETERS,
    },

    {
        name: "part_keyform.draw_orders",
        elemType: "f32",
        countIdx: CountIdx.PART_KEYFORMS,
    },

    {
        name: "warp_deformer_keyform.opacities",
        elemType: "f32",
        countIdx: CountIdx.WARP_DEFORMER_KEYFORMS,
    },
    {
        name: "warp_deformer_keyform.keyform_position_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.WARP_DEFORMER_KEYFORMS,
    },

    {
        name: "rotation_deformer_keyform.opacities",
        elemType: "f32",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },
    {
        name: "rotation_deformer_keyform.angles",
        elemType: "f32",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },
    {
        name: "rotation_deformer_keyform.origin_xs",
        elemType: "f32",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },
    {
        name: "rotation_deformer_keyform.origin_ys",
        elemType: "f32",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },
    {
        name: "rotation_deformer_keyform.scales",
        elemType: "f32",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },
    {
        name: "rotation_deformer_keyform.reflect_xs",
        elemType: "bool",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },
    {
        name: "rotation_deformer_keyform.reflect_ys",
        elemType: "bool",
        countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS,
    },

    {
        name: "art_mesh_keyform.opacities",
        elemType: "f32",
        countIdx: CountIdx.ART_MESH_KEYFORMS,
    },
    {
        name: "art_mesh_keyform.draw_orders",
        elemType: "f32",
        countIdx: CountIdx.ART_MESH_KEYFORMS,
    },
    {
        name: "art_mesh_keyform.keyform_position_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.ART_MESH_KEYFORMS,
    },

    {
        name: "keyform_position.xys",
        elemType: "f32",
        countIdx: CountIdx.KEYFORM_POSITIONS,
    },

    {
        name: "keyform_binding_index.indices",
        elemType: "i32",
        countIdx: CountIdx.KEYFORM_BINDING_INDICES,
    },

    {
        name: "keyform_binding_band.begin_indices",
        elemType: "i32",
        countIdx: CountIdx.KEYFORM_BINDING_BANDS,
    },
    {
        name: "keyform_binding_band.counts",
        elemType: "i32",
        countIdx: CountIdx.KEYFORM_BINDING_BANDS,
    },

    {
        name: "keyform_binding.keys_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.KEYFORM_BINDINGS,
    },
    {
        name: "keyform_binding.keys_counts",
        elemType: "i32",
        countIdx: CountIdx.KEYFORM_BINDINGS,
    },

    { name: "keys.values", elemType: "f32", countIdx: CountIdx.KEYS },

    { name: "uv.xys", elemType: "f32", countIdx: CountIdx.UVS },

    {
        name: "position_index.indices",
        elemType: "i16",
        countIdx: CountIdx.POSITION_INDICES,
    },

    {
        name: "drawable_mask.art_mesh_indices",
        elemType: "i32",
        countIdx: CountIdx.DRAWABLE_MASKS,
    },

    {
        name: "draw_order_group.object_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUPS,
    },
    {
        name: "draw_order_group.object_counts",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUPS,
    },
    {
        name: "draw_order_group.object_total_counts",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUPS,
    },
    {
        name: "draw_order_group.min_draw_orders",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUPS,
    },
    {
        name: "draw_order_group.max_draw_orders",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUPS,
    },

    {
        name: "draw_order_group_object.types",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUP_OBJECTS,
    },
    {
        name: "draw_order_group_object.indices",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUP_OBJECTS,
    },
    {
        name: "draw_order_group_object.group_indices",
        elemType: "i32",
        countIdx: CountIdx.DRAW_ORDER_GROUP_OBJECTS,
    },

    {
        name: "glue.runtime_space",
        elemType: "runtime",
        countIdx: CountIdx.GLUES,
    },
    { name: "glue.ids", elemType: "str64", countIdx: CountIdx.GLUES },
    {
        name: "glue.keyform_binding_band_indices",
        elemType: "i32",
        countIdx: CountIdx.GLUES,
    },
    {
        name: "glue.keyform_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.GLUES,
    },
    { name: "glue.keyform_counts", elemType: "i32", countIdx: CountIdx.GLUES },
    {
        name: "glue.art_mesh_index_as",
        elemType: "i32",
        countIdx: CountIdx.GLUES,
    },
    {
        name: "glue.art_mesh_index_bs",
        elemType: "i32",
        countIdx: CountIdx.GLUES,
    },
    {
        name: "glue.info_begin_indices",
        elemType: "i32",
        countIdx: CountIdx.GLUES,
    },
    { name: "glue.info_counts", elemType: "i32", countIdx: CountIdx.GLUES },

    {
        name: "glue_info.weights",
        elemType: "f32",
        countIdx: CountIdx.GLUE_INFOS,
    },
    {
        name: "glue_info.position_indices",
        elemType: "i16",
        countIdx: CountIdx.GLUE_INFOS,
    },

    {
        name: "glue_keyform.intensities",
        elemType: "f32",
        countIdx: CountIdx.GLUE_KEYFORMS,
    },
];
