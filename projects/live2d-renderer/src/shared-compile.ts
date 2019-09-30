import type { ModelProgram, ModelSettings } from "@doki-land/live2d-core";
import { isCpuProgramBytes, parseCpuProgram } from "./cpu/cpu-program.js";
import { Moc2Parser } from "./moc/moc2-objects.js";
import { parseMoc3Document } from "./moc/moc3-reader.js";
import type { SharedModelCompile } from "./model-runtime.js";

/** One-time decode of moc bytes for stage-level {@link ModelAsset} sharing. */
export function compileSharedModelCompile(
    settings: ModelSettings,
    mocBytes: ArrayBuffer,
): SharedModelCompile {
    if (settings.format === "moc2") {
        return {
            mocBytes,
            moc2Model: new Moc2Parser(mocBytes).parseModel(),
        };
    }

    const isCpu =
        settings.moc.toLowerCase().endsWith(".program.json") ||
        isCpuProgramBytes(mocBytes);
    if (isCpu) {
        const cpuProgram: ModelProgram = parseCpuProgram(mocBytes);
        return { mocBytes, cpuProgram };
    }

    return { mocBytes, moc3Doc: parseMoc3Document(mocBytes) };
}
