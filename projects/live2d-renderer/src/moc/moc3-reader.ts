/**
 * Parse binary MOC3 input into typed section tables (no deform evaluation).
 */

import {
    MOC3_COUNT_MAX,
    MOC3_HEADER_SIZE,
    MOC3_MAGIC,
    MOC3_SECTION_LAYOUT,
    MOC3_SOT_COUNT,
    type SectionEntry,
} from "./moc3-layout.js";

export interface Moc3CanvasInfo {
    readonly pixelsPerUnit: number;
    readonly originX: number;
    readonly originY: number;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly flags: number;
}

export interface Moc3Document {
    readonly version: number;
    readonly littleEndian: boolean;
    readonly counts: Int32Array;
    readonly canvas: Moc3CanvasInfo;
    readonly sections: ReadonlyMap<string, unknown>;
}

function readMagic(bytes: ArrayBuffer): string {
    if (bytes.byteLength < 4) return "";
    return String.fromCharCode(...new Uint8Array(bytes, 0, 4));
}

function sectionCount(counts: Int32Array, entry: SectionEntry): number {
    if (entry.countIdx < 0 || entry.countIdx >= counts.length) return 0;
    return Math.max(0, counts[entry.countIdx]!);
}

function readI32Array(
    view: DataView,
    offset: number,
    count: number,
    le: boolean,
): Int32Array {
    const out = new Int32Array(count);
    for (let i = 0; i < count; i++) {
        out[i] = view.getInt32(offset + i * 4, le);
    }
    return out;
}

function readF32Array(
    view: DataView,
    offset: number,
    count: number,
    le: boolean,
): Float32Array {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        out[i] = view.getFloat32(offset + i * 4, le);
    }
    return out;
}

function readI16Array(
    view: DataView,
    offset: number,
    count: number,
    le: boolean,
): Int16Array {
    const out = new Int16Array(count);
    for (let i = 0; i < count; i++) {
        out[i] = view.getInt16(offset + i * 2, le);
    }
    return out;
}

function readStr64Array(
    bytes: Uint8Array,
    offset: number,
    count: number,
): string[] {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const start = offset + i * 64;
        const slice = bytes.subarray(start, start + 64);
        let end = slice.indexOf(0);
        if (end < 0) end = 64;
        out.push(String.fromCharCode(...slice.subarray(0, end)));
    }
    return out;
}

function readSection(
    bytes: Uint8Array,
    view: DataView,
    offset: number,
    entry: SectionEntry,
    count: number,
    le: boolean,
): unknown {
    if (count <= 0 || offset <= 0 || offset >= bytes.byteLength) {
        return entry.elemType === "str64" ? [] : new Int32Array(0);
    }
    switch (entry.elemType) {
        case "runtime":
            return bytes.subarray(offset, offset + count * 8);
        case "str64":
            return readStr64Array(bytes, offset, count);
        case "i32":
        case "bool":
            return readI32Array(view, offset, count, le);
        case "f32":
            return readF32Array(view, offset, count, le);
        case "i16":
            return readI16Array(view, offset, count, le);
        case "u8":
            return bytes.subarray(offset, offset + count);
        default:
            return new Int32Array(0);
    }
}

/** Parse MOC3 binary into section tables. */
export function parseMoc3Document(buffer: ArrayBuffer): Moc3Document {
    if (buffer.byteLength < MOC3_HEADER_SIZE + MOC3_SOT_COUNT * 4) {
        throw new Error("@doki-land/live2d-renderer: truncated MOC3 header");
    }
    const magic = readMagic(buffer);
    if (magic !== MOC3_MAGIC) {
        throw new Error(
            `@doki-land/live2d-renderer: unrecognized moc3 bytes (magic=${JSON.stringify(magic)})`,
        );
    }

    const bytes = new Uint8Array(buffer);
    const version = bytes[4]!;
    const littleEndian = bytes[5] === 0;
    const view = new DataView(buffer);

    const sot = new Int32Array(MOC3_SOT_COUNT);
    for (let i = 0; i < MOC3_SOT_COUNT; i++) {
        sot[i] = view.getInt32(MOC3_HEADER_SIZE + i * 4, littleEndian);
    }

    const countInfoOff = sot[0]!;
    if (
        countInfoOff <= 0 ||
        countInfoOff + MOC3_COUNT_MAX * 4 > buffer.byteLength
    ) {
        throw new Error(
            "@doki-land/live2d-renderer: invalid MOC3 count info offset",
        );
    }
    const counts = readI32Array(
        view,
        countInfoOff,
        MOC3_COUNT_MAX,
        littleEndian,
    );

    const canvasOff = sot[1]!;
    if (canvasOff <= 0 || canvasOff + 24 > buffer.byteLength) {
        throw new Error(
            "@doki-land/live2d-renderer: invalid MOC3 canvas info offset",
        );
    }
    const canvas: Moc3CanvasInfo = {
        pixelsPerUnit: view.getFloat32(canvasOff, littleEndian),
        originX: view.getFloat32(canvasOff + 4, littleEndian),
        originY: view.getFloat32(canvasOff + 8, littleEndian),
        canvasWidth: view.getFloat32(canvasOff + 12, littleEndian),
        canvasHeight: view.getFloat32(canvasOff + 16, littleEndian),
        flags: bytes[canvasOff + 20]!,
    };

    const sections = new Map<string, unknown>();
    for (let i = 0; i < MOC3_SECTION_LAYOUT.length; i++) {
        const entry = MOC3_SECTION_LAYOUT[i]!;
        const sotIdx = i + 2;
        const offset = sotIdx < sot.length ? sot[sotIdx]! : 0;
        const count = sectionCount(counts, entry);
        sections.set(
            entry.name,
            readSection(bytes, view, offset, entry, count, littleEndian),
        );
    }

    return { version, littleEndian, counts, canvas, sections };
}

export function moc3SectionI32(doc: Moc3Document, name: string): Int32Array {
    const v = doc.sections.get(name);
    return v instanceof Int32Array ? v : new Int32Array(0);
}

export function moc3SectionF32(doc: Moc3Document, name: string): Float32Array {
    const v = doc.sections.get(name);
    return v instanceof Float32Array ? v : new Float32Array(0);
}

export function moc3SectionI16(doc: Moc3Document, name: string): Int16Array {
    const v = doc.sections.get(name);
    return v instanceof Int16Array ? v : new Int16Array(0);
}

export function moc3SectionStrings(
    doc: Moc3Document,
    name: string,
): readonly string[] {
    const v = doc.sections.get(name);
    return Array.isArray(v) ? (v as string[]) : [];
}
