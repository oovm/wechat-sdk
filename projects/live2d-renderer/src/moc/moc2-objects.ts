/**
 * moc2 object graph types + deserializer.
 * Type tags and field order match the public moc2 stream layout.
 */

import { MOC2_REF_TYPE, Moc2Reader } from "./moc2-reader.js";

export const Moc2Type = {
    Null: 0,
    String: 1,
    ObjectArray: 15,
    Int32Array: 16,
    RectInt: 21,
    PointInt: 22,
    Int32ArrayAlt: 25,
    Float64Array: 26,
    Float32Array: 27,
    DrawDataId: 50,
    BaseDataId: 51,
    ParamId: 60,
    MeshDeformer: 65,
    PivotManager: 66,
    Pivot: 67,
    AffineDeformer: 68,
    Affine: 69,
    DrawableMesh: 70,
    ParamDefFloat: 131,
    PartsData: 133,
    ModelImpl: 136,
    ParamDefSet: 137,
    AvatarParts: 142,
    PartsDataId: 134,
} as const;

export interface Moc2ParamDef {
    readonly kind: "paramDef";
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
    readonly id: string;
}

export interface Moc2ParamDefSet {
    readonly kind: "paramDefSet";
    readonly params: readonly Moc2ParamDef[];
}

export interface Moc2Pivot {
    readonly kind: "pivot";
    readonly paramId: string;
    readonly pivotCount: number;
    readonly pivotValues: Float32Array;
}

export interface Moc2PivotManager {
    readonly kind: "pivotManager";
    readonly pivots: readonly Moc2Pivot[];
}

export interface Moc2Affine {
    readonly kind: "affine";
    readonly originX: number;
    readonly originY: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly rotation: number;
    readonly reflectX: boolean;
    readonly reflectY: boolean;
}

export interface Moc2BaseDeformer {
    readonly kind: "meshDeformer" | "affineDeformer";
    readonly id: string;
    readonly targetBaseId: string | null;
    readonly pivotManager: Moc2PivotManager | null;
    /** Mesh deformer: rows/cols + keyform point arrays. */
    readonly rows?: number;
    readonly cols?: number;
    readonly keyforms?: readonly Float32Array[];
    /** Affine deformer: keyform affines. */
    readonly affines?: readonly Moc2Affine[];
    readonly opacities?: Float32Array | null;
}

export interface Moc2DrawableMesh {
    readonly kind: "drawableMesh";
    readonly id: string;
    readonly targetBaseId: string | null;
    readonly pivotManager: Moc2PivotManager | null;
    readonly averageDrawOrder: number;
    readonly drawOrders: Int32Array;
    readonly opacities: Float32Array;
    readonly clipId: string | null;
    readonly textureIndex: number;
    readonly numPoints: number;
    readonly numPolygons: number;
    readonly indices: Uint16Array;
    readonly keyforms: readonly Float32Array[];
    readonly uvs: Float32Array;
    readonly optionFlags: number;
    /**
     * moc2 color-composition enum when optionFlags bit0 set:
     * 0 normal, 1 additive, 2 multiplicative (Cubism 2).
     */
    readonly colorComposition: number;
}

export interface Moc2PartsData {
    readonly kind: "parts";
    readonly locked: boolean;
    readonly visible: boolean;
    readonly id: string;
    readonly baseData: readonly Moc2BaseDeformer[];
    readonly drawData: readonly Moc2DrawableMesh[];
}

export interface Moc2ModelImpl {
    readonly kind: "model";
    readonly paramDefSet: Moc2ParamDefSet;
    readonly parts: readonly Moc2PartsData[];
    readonly canvasWidth: number;
    readonly canvasHeight: number;
}

function asId(value: unknown): string {
    if (typeof value === "string") return value;
    if (value == null) return "";
    return String(value);
}

function asParamDefs(value: unknown): Moc2ParamDef[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is Moc2ParamDef =>
            !!v &&
            typeof v === "object" &&
            (v as Moc2ParamDef).kind === "paramDef",
    );
}

function asPivots(value: unknown): Moc2Pivot[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is Moc2Pivot =>
            !!v && typeof v === "object" && (v as Moc2Pivot).kind === "pivot",
    );
}

function asFloat32Arrays(value: unknown): Float32Array[] {
    if (!Array.isArray(value)) {
        if (value instanceof Float32Array) return [value];
        return [];
    }
    return value.filter((v): v is Float32Array => v instanceof Float32Array);
}

function asAffines(value: unknown): Moc2Affine[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is Moc2Affine =>
            !!v && typeof v === "object" && (v as Moc2Affine).kind === "affine",
    );
}

function asBaseList(value: unknown): Moc2BaseDeformer[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is Moc2BaseDeformer =>
            !!v &&
            typeof v === "object" &&
            ((v as Moc2BaseDeformer).kind === "meshDeformer" ||
                (v as Moc2BaseDeformer).kind === "affineDeformer"),
    );
}

function asDrawList(value: unknown): Moc2DrawableMesh[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is Moc2DrawableMesh =>
            !!v &&
            typeof v === "object" &&
            (v as Moc2DrawableMesh).kind === "drawableMesh",
    );
}

function asPartsList(value: unknown): Moc2PartsData[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is Moc2PartsData =>
            !!v &&
            typeof v === "object" &&
            (v as Moc2PartsData).kind === "parts",
    );
}

function readPivotManager(r: Moc2Parser): Moc2PivotManager {
    return {
        kind: "pivotManager",
        pivots: asPivots(r.readObject()),
    };
}

function readV2Opacity(r: Moc2Reader): Float32Array | null {
    if (r.getFormatVersion() >= 10) {
        return r.readFloat32Array();
    }
    return null;
}

/** Parse one typed object body (caller owns object-table registration). */
export function readMoc2ObjectBody(r: Moc2Parser, type: number): unknown {
    switch (type) {
        case Moc2Type.Null:
            return null;
        case Moc2Type.String:
            return r.readString();
        case Moc2Type.DrawDataId:
        case Moc2Type.BaseDataId:
        case Moc2Type.ParamId:
        case Moc2Type.PartsDataId:
            return r.readString();
        case Moc2Type.ObjectArray: {
            const n = r.readVarint();
            const arr: unknown[] = new Array(n);
            for (let i = 0; i < n; i++) arr[i] = r.readObject();
            return arr;
        }
        case Moc2Type.Int32Array:
        case Moc2Type.Int32ArrayAlt:
            return r.readInt32Array();
        case Moc2Type.Float32Array:
            return r.readFloat32Array();
        case Moc2Type.Float64Array:
            return r.readFloat64Array();
        case Moc2Type.RectInt:
            return {
                kind: "rectInt",
                a: r.readInt32(),
                b: r.readInt32(),
                c: r.readInt32(),
                d: r.readInt32(),
            };
        case Moc2Type.PointInt:
            return { kind: "pointInt", x: r.readInt32(), y: r.readInt32() };
        case Moc2Type.ParamDefFloat: {
            const def: Moc2ParamDef = {
                kind: "paramDef",
                min: r.readFloat32(),
                max: r.readFloat32(),
                defaultValue: r.readFloat32(),
                id: asId(r.readObject()),
            };
            return def;
        }
        case Moc2Type.ParamDefSet: {
            const set: Moc2ParamDefSet = {
                kind: "paramDefSet",
                params: asParamDefs(r.readObject()),
            };
            return set;
        }
        case Moc2Type.ModelImpl: {
            const paramDefSet = r.readObject() as Moc2ParamDefSet;
            const parts = asPartsList(r.readObject());
            const model: Moc2ModelImpl = {
                kind: "model",
                paramDefSet,
                parts,
                canvasWidth: r.readInt32(),
                canvasHeight: r.readInt32(),
            };
            return model;
        }
        case Moc2Type.PartsData: {
            const locked = r.readBit();
            const visible = r.readBit();
            const parts: Moc2PartsData = {
                kind: "parts",
                locked,
                visible,
                id: asId(r.readObject()),
                baseData: asBaseList(r.readObject()),
                drawData: asDrawList(r.readObject()),
            };
            return parts;
        }
        case Moc2Type.AvatarParts: {
            // Same payload shape as parts lists without lock/visible bits.
            return {
                kind: "avatarParts",
                id: asId(r.readObject()),
                drawData: r.readObject(),
                baseData: r.readObject(),
            };
        }
        case Moc2Type.PivotManager:
            return readPivotManager(r);
        case Moc2Type.Pivot: {
            const pivot: Moc2Pivot = {
                kind: "pivot",
                paramId: asId(r.readObject()),
                pivotCount: r.readInt32(),
                pivotValues: (() => {
                    const v = r.readObject();
                    return v instanceof Float32Array ? v : new Float32Array();
                })(),
            };
            return pivot;
        }
        case Moc2Type.Affine: {
            const affine: Moc2Affine = {
                kind: "affine",
                originX: r.readFloat32(),
                originY: r.readFloat32(),
                scaleX: r.readFloat32(),
                scaleY: r.readFloat32(),
                rotation: r.readFloat32(),
                reflectX: r.getFormatVersion() >= 10 ? r.readBool() : false,
                reflectY: r.getFormatVersion() >= 10 ? r.readBool() : false,
            };
            return affine;
        }
        case Moc2Type.MeshDeformer: {
            const id = asId(r.readObject());
            const targetBaseId = asId(r.readObject()) || null;
            const cols = r.readInt32();
            const rows = r.readInt32();
            const pivotManager = r.readObject() as Moc2PivotManager | null;
            const keyforms = asFloat32Arrays(r.readObject());
            const opacities = readV2Opacity(r);
            const def: Moc2BaseDeformer = {
                kind: "meshDeformer",
                id,
                targetBaseId,
                pivotManager,
                cols,
                rows,
                keyforms,
                opacities,
            };
            return def;
        }
        case Moc2Type.AffineDeformer: {
            const id = asId(r.readObject());
            const targetBaseId = asId(r.readObject()) || null;
            const pivotManager = r.readObject() as Moc2PivotManager | null;
            const affines = asAffines(r.readObject());
            const opacities = readV2Opacity(r);
            const def: Moc2BaseDeformer = {
                kind: "affineDeformer",
                id,
                targetBaseId,
                pivotManager,
                affines,
                opacities,
            };
            return def;
        }
        case Moc2Type.DrawableMesh: {
            const id = asId(r.readObject());
            const targetBaseId = asId(r.readObject()) || null;
            const pivotManager = r.readObject() as Moc2PivotManager | null;
            const averageDrawOrder = r.readInt32();
            const drawOrders = r.readInt32Array();
            const opacities = r.readFloat32Array();
            let clipId: string | null = null;
            if (r.getFormatVersion() >= 11) {
                clipId = asId(r.readObject()) || null;
            }
            const textureIndex = r.readInt32();
            const numPoints = r.readInt32();
            const numPolygons = r.readInt32();
            const indexSrc = r.readObject();
            const indexArr =
                indexSrc instanceof Int32Array ? indexSrc : new Int32Array(0);
            const indices = new Uint16Array(numPolygons * 3);
            for (let i = 0; i < indices.length; i++) {
                indices[i] = indexArr[i] ?? 0;
            }
            const keyforms = asFloat32Arrays(r.readObject());
            const uvsRaw = r.readObject();
            const uvs =
                uvsRaw instanceof Float32Array
                    ? uvsRaw
                    : new Float32Array(numPoints * 2);
            let optionFlags = 0;
            let colorComposition = 0;
            if (r.getFormatVersion() >= 8) {
                optionFlags = r.readInt32();
                if (optionFlags !== 0) {
                    if ((optionFlags & 1) !== 0) {
                        // Cubism 2 color composition: 0 normal, 1 add, 2 multiply.
                        colorComposition = r.readInt32();
                    }
                    // Remaining bits: blend hints / culling (bit 5 = 32).
                }
            }
            const mesh: Moc2DrawableMesh = {
                kind: "drawableMesh",
                id,
                targetBaseId,
                pivotManager,
                averageDrawOrder,
                drawOrders,
                opacities,
                clipId,
                textureIndex,
                numPoints,
                numPolygons,
                indices,
                keyforms,
                uvs,
                optionFlags,
                colorComposition,
            };
            return mesh;
        }
        default:
            throw new Error(
                `@doki-land/live2d-renderer: unsupported moc2 type tag ${type}`,
            );
    }
}

/** Parser that owns the object table on top of {@link Moc2Reader}. */
export class Moc2Parser extends Moc2Reader {
    readObject(typeHint = -1): unknown {
        this.alignBits();
        const type = typeHint < 0 ? this.readVarint() : typeHint;
        if (type === MOC2_REF_TYPE) {
            const index = this.readInt32();
            if (index < 0 || index >= this.objects.length) {
                throw new Error(
                    `@doki-land/live2d-renderer: moc2 bad back-ref ${index}`,
                );
            }
            return this.objects[index];
        }
        const value = readMoc2ObjectBody(this, type);
        this.objects.push(value);
        return value;
    }

    parseModel(): Moc2ModelImpl {
        const version = this.readHeader();
        if (version > 11) {
            throw new Error(
                `@doki-land/live2d-renderer: moc2 version ${version} newer than supported (11)`,
            );
        }
        const root = this.readObject();
        this.readEofGuard();
        if (
            !root ||
            typeof root !== "object" ||
            (root as Moc2ModelImpl).kind !== "model"
        ) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 root is not ModelImpl",
            );
        }
        return root as Moc2ModelImpl;
    }
}
