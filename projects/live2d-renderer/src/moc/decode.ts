/**
 * moc binary decode: ArrayBuffer → CPU ModelProgram.
 */

import type { ModelProgram } from "@doki-land/live2d-core";
import { Moc2Parser } from "./moc2-objects.js";
import { moc2ModelToProgram } from "./moc2-to-program.js";
import { parseMoc3Document } from "./moc3-reader.js";
import { moc3DocumentToProgram } from "./moc3-to-program.js";

export interface DecodedMoc2 {
    readonly format: "moc2";
    readonly program: ModelProgram;
}

export interface DecodedMoc3 {
    readonly format: "moc3";
    readonly program: ModelProgram;
}

function readMagic(bytes: ArrayBuffer): string {
    if (bytes.byteLength < 4) return "";
    return String.fromCharCode(...new Uint8Array(bytes, 0, 4));
}

/** Decode official moc2 (`.moc`) bytes into a default-pose ModelProgram. */
export async function decodeMoc2(bytes: ArrayBuffer): Promise<DecodedMoc2> {
    if (bytes.byteLength < 4) {
        throw new Error("@doki-land/live2d-renderer: truncated moc2 header");
    }
    const magic3 = String.fromCharCode(...new Uint8Array(bytes, 0, 3));
    if (magic3 !== "moc") {
        throw new Error(
            `@doki-land/live2d-renderer: unrecognized moc2 bytes (magic=${JSON.stringify(magic3)})`,
        );
    }
    try {
        const model = new Moc2Parser(bytes).parseModel();
        const program = moc2ModelToProgram(model);
        return { format: "moc2", program };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("@doki-land/live2d-renderer:")) throw err;
        throw new Error(
            `@doki-land/live2d-renderer: moc2 decode failed: ${msg}`,
        );
    }
}

/**
 * Decode official moc3 bytes into a ModelProgram.
 * Applies keyform blending + warp/rotation deformer chains at the given pose
 * (defaults when called via decodeMoc3).
 */
export async function decodeMoc3(bytes: ArrayBuffer): Promise<DecodedMoc3> {
    const magic = readMagic(bytes);
    if (magic !== "MOC3") {
        throw new Error(
            `@doki-land/live2d-renderer: unrecognized moc3 bytes (magic=${JSON.stringify(magic)})`,
        );
    }
    try {
        const doc = parseMoc3Document(bytes);
        const program = moc3DocumentToProgram(doc);
        return { format: "moc3", program };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("@doki-land/live2d-renderer:")) throw err;
        throw new Error(
            `@doki-land/live2d-renderer: moc3 decode failed: ${msg}`,
        );
    }
}
