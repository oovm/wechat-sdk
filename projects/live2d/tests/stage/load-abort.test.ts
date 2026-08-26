// @vitest-environment happy-dom

import { createMoc3Backend } from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { createLive2d } from "../../src/facade/create-live2d.js";
import {
    cpuProgramBytes,
    createCountingResolver,
    createStubRenderer,
    inlineCpuModelSource,
} from "../fixtures/cpu-model-fixture.js";

describe("AbortSignal load cancellation", () => {
    it("rejects when signal is already aborted", async () => {
        const live2d = createLive2d({
            renderer: createStubRenderer(),
            backends: [createMoc3Backend()],
            updateMode: "manual",
        });
        const canvas = document.createElement("canvas");
        await live2d.stage.mount(canvas);

        const controller = new AbortController();
        controller.abort();

        await expect(
            live2d.loadModel(
                inlineCpuModelSource(),
                createCountingResolver(cpuProgramBytes()),
                { signal: controller.signal },
            ),
        ).rejects.toThrow(/cancel/i);

        live2d.destroy();
    });

    it("rejects in-flight load after abort", async () => {
        const live2d = createLive2d({
            renderer: createStubRenderer(),
            backends: [createMoc3Backend()],
            updateMode: "manual",
        });
        const canvas = document.createElement("canvas");
        await live2d.stage.mount(canvas);

        const controller = new AbortController();
        const pending = live2d.loadModel(
            inlineCpuModelSource(),
            createCountingResolver(cpuProgramBytes()),
            { signal: controller.signal },
        );
        controller.abort();

        await expect(pending).rejects.toThrow(/cancel/i);
        live2d.destroy();
    });
});
