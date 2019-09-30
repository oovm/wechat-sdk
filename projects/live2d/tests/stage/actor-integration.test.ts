// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
    cpuProgramBytes,
    createCountingResolver,
    createMountedCpuStage,
    inlineCpuModelSource,
} from "../fixtures/cpu-model-fixture.js";

describe("Live2dActor load integration", () => {
    it("loads cpu model and exposes parameters", async () => {
        const { stage } = await createMountedCpuStage();
        const actor = stage.createActor({ id: "solo" });
        const resolver = createCountingResolver(cpuProgramBytes());

        await actor.load(inlineCpuModelSource(), resolver);

        expect(actor.model).not.toBeNull();
        expect(resolver.mocFetches).toBe(1);
        const params = actor.listParameters();
        expect(params.some((p) => p.id === "PARAM_ANGLE_X")).toBe(true);

        actor.setParameter("PARAM_ANGLE_X", 0.75);
        const updated = actor
            .listParameters()
            .find((p) => p.id === "PARAM_ANGLE_X");
        expect(updated?.value).toBe(0.75);

        stage.destroy();
    });

    it("shares moc fetch when two actors load the same source", async () => {
        const { stage } = await createMountedCpuStage();
        const resolver = createCountingResolver(cpuProgramBytes());
        const source = inlineCpuModelSource();
        const a = stage.createActor({ id: "a" });
        const b = stage.createActor({ id: "b" });

        await a.load(source, resolver);
        await b.load(source, resolver);

        expect(resolver.mocFetches).toBe(1);
        expect(a.model).not.toBeNull();
        expect(b.model).not.toBeNull();
        expect(a.model).not.toBe(b.model);

        stage.destroy();
    });

    it("loadAsset reuses stage.assets cache", async () => {
        const { stage } = await createMountedCpuStage();
        const resolver = createCountingResolver(cpuProgramBytes());
        const source = inlineCpuModelSource();

        const asset = await stage.assets.load(source, resolver);
        const a = stage.createActor({ id: "a" });
        const b = stage.createActor({ id: "b" });
        await a.loadAsset(asset);
        await b.loadAsset(asset);

        expect(resolver.mocFetches).toBe(1);
        stage.destroy();
    });

    it("rejects ModelAsset from another stage", async () => {
        const resolver = createCountingResolver(cpuProgramBytes());
        const source = inlineCpuModelSource();
        const stageA = await createMountedCpuStage();
        const stageB = await createMountedCpuStage();
        const asset = await stageA.stage.assets.load(source, resolver);
        const actor = stageB.stage.createActor({ id: "x" });

        await expect(actor.loadAsset(asset)).rejects.toThrow(/does not belong/);

        stageA.stage.destroy();
        stageB.stage.destroy();
    });
});

describe("Live2dStage lifecycle", () => {
    it("exposes assets registry", async () => {
        const { stage } = await createMountedCpuStage();
        expect(stage.assets).toBeDefined();
        expect(typeof stage.assets.load).toBe("function");
        stage.destroy();
    });

    it("manual updateMode rejects start()", () => {
        const stage = createMountedCpuStage();
        return stage.then(({ stage: s }) => {
            expect(() => s.start()).toThrow(/manual/);
            s.destroy();
        });
    });

    it("resize is safe before mount", async () => {
        const { createLive2dStage } = await import("../../src/stage/stage.js");
        const stage = createLive2dStage({ updateMode: "manual" });
        expect(() => stage.resize(100, 100)).not.toThrow();
        stage.destroy();
    });
});
