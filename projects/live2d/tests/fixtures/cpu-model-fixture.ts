import type { AssetResolver, ModelSource } from "@doki-land/live2d-core";
import type { ModelDrawPass, Renderer } from "@doki-land/live2d-renderer";
import {
    createMoc3Backend,
    createQuadProgram,
    serializeCpuProgram,
} from "@doki-land/live2d-renderer";
import { createLive2dStage } from "../../src/stage/stage.js";

/** No-op draw pass for load-path integration tests (no real GPU/Canvas2D). */
function createStubModelDrawPass(): ModelDrawPass {
    return {
        setTextures() {},
        draw() {},
        destroy() {},
    };
}

/** Stub renderer: initialize succeeds without Canvas2D/WebGL/WebGPU. */
export function createStubRenderer(): Renderer {
    return {
        kind: "canvas2d",
        async initialize() {},
        createModelDrawPass: createStubModelDrawPass,
        beginFrame() {},
        endFrame() {},
        resize() {},
        destroy() {},
    };
}

export const CPU_MODEL_JSON = {
    Version: 3,
    FileReferences: {
        Moc: "quad.program.json",
        Textures: [] as string[],
        Motions: {} as Record<string, unknown[]>,
    },
};

export function inlineCpuModelSource(
    json: unknown = CPU_MODEL_JSON,
): ModelSource {
    return {
        kind: "json",
        json,
        baseUrl: "https://fixture.test/model3.json",
    };
}

export function createCountingResolver(
    programBytes: ArrayBuffer,
): AssetResolver & { mocFetches: number; textureFetches: number } {
    let mocFetches = 0;
    let textureFetches = 0;
    return {
        baseUrl: "https://fixture.test/",
        resolve: (key) => `https://fixture.test/${key}`,
        fetchJson: async (key) => {
            if (key.endsWith("model3.json")) return CPU_MODEL_JSON;
            throw new Error(`unexpected json key: ${key}`);
        },
        fetchBytes: async (key) => {
            if (key === "quad.program.json") {
                mocFetches += 1;
                return programBytes.slice(0);
            }
            textureFetches += 1;
            return new ArrayBuffer(0);
        },
        get mocFetches() {
            return mocFetches;
        },
        get textureFetches() {
            return textureFetches;
        },
    };
}

export function cpuProgramBytes(): ArrayBuffer {
    return serializeCpuProgram(createQuadProgram());
}

/** Stage + stub renderer for integration tests (happy-dom has no Canvas2D). */
export async function createMountedCpuStage() {
    const stage = createLive2dStage({
        updateMode: "manual",
        renderer: createStubRenderer(),
        backends: [createMoc3Backend()],
    });
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    await stage.mount(canvas);
    return { stage, canvas };
}
