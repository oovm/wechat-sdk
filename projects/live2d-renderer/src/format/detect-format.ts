/**
 * moc binary format peek. Settings JSON detection lives in live2d-core
 * (`detectModelSettingsFormat`) so loader and renderer share one helper.
 */

import type { ModelFormat } from "@doki-land/live2d-core";

export { detectModelSettingsFormat } from "@doki-land/live2d-core";

/** Peek moc2 vs moc3 from magic bytes. */
export function detectMocBinaryFormat(bytes: ArrayBuffer): ModelFormat | null {
    if (bytes.byteLength < 4) return null;
    const u8 = new Uint8Array(bytes, 0, 4);
    const magic4 = String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!);
    if (magic4 === "MOC3") return "moc3";
    const magic3 = String.fromCharCode(u8[0]!, u8[1]!, u8[2]!);
    if (magic3 === "moc") return "moc2";
    return null;
}
