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

function createTestLive2D() {
    return createLive2d({
        renderer: createStubRenderer(),
        backends: [createMoc3Backend()],
        updateMode: "manual",
    });
}

describe("createLive2d facade", () => {
    it("loadModel transitions to live and emits ready", async () => {
        const live2d = createTestLive2D();
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 200;
        await live2d.stage.mount(canvas);

        const phases: string[] = [];
        live2d.events.on("phase", ({ phase }) => phases.push(phase));

        let readyId = "";
        live2d.events.on("ready", ({ modelId }) => {
            readyId = modelId;
        });

        const resolver = createCountingResolver(cpuProgramBytes());
        await live2d.loadModel(inlineCpuModelSource(), resolver);

        expect(live2d.state.phase).toBe("live");
        expect(live2d.model).not.toBeNull();
        expect(phases).toContain("loading");
        expect(readyId.length).toBeGreaterThan(0);
        expect(live2d.listParameters().length).toBeGreaterThan(0);

        live2d.destroy();
    });

    it("delegates setParameter and motion helpers to default actor", async () => {
        const live2d = createTestLive2D();
        const canvas = document.createElement("canvas");
        await live2d.stage.mount(canvas);
        await live2d.loadModel(
            inlineCpuModelSource(),
            createCountingResolver(cpuProgramBytes()),
        );

        live2d.setParameter("PARAM_ANGLE_X", 0.25);
        const p = live2d.listParameters().find((x) => x.id === "PARAM_ANGLE_X");
        expect(p?.value).toBe(0.25);
        expect(await live2d.playMotion("Missing")).toBe(false);

        live2d.destroy();
    });

    it("exposes stage and default actor", () => {
        const live2d = createTestLive2D();
        expect(live2d.stage).toBeDefined();
        expect(live2d.actor).toBeDefined();
        expect(live2d.stage.actors).toHaveLength(1);
        expect(live2d.stage.getActor(live2d.actor.id)).toBe(live2d.actor);
        live2d.destroy();
    });
});
