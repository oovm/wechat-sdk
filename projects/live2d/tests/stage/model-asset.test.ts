import type { AssetResolver, ModelSource } from "@doki-land/live2d-core";
import { createMoc3Backend } from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { ModelAssetRegistry } from "../../src/stage/model-asset-registry.js";
import {
    cpuProgramBytes,
    createCountingResolver,
    inlineCpuModelSource,
} from "../fixtures/cpu-model-fixture.js";

function createRegistryResolver(): AssetResolver & { mocFetches: number } {
    return createCountingResolver(cpuProgramBytes());
}

describe("ModelAssetRegistry", () => {
    it("dedupes moc fetch for concurrent acquires of the same source", async () => {
        const resolver = createRegistryResolver();
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        const source = inlineCpuModelSource();

        const [leaseA, leaseB] = await Promise.all([
            registry.acquire(source, resolver),
            registry.acquire(source, resolver),
        ]);

        expect(resolver.mocFetches).toBe(1);
        expect(leaseA.asset.key).toBe(leaseB.asset.key);

        leaseA.release();
        leaseB.release();
        registry.destroy();
    });

    it("shares compile via stage.assets.load and acquireExisting", async () => {
        const resolver = createRegistryResolver();
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        const source = inlineCpuModelSource();

        const asset = await registry.load(source, resolver);
        const leaseA = registry.acquireExisting(asset);
        const leaseB = registry.acquireExisting(asset);

        expect(resolver.mocFetches).toBe(1);
        expect(leaseA.asset.settings.moc).toBe("quad.program.json");

        leaseA.release();
        leaseB.release();
        registry.destroy();
    });

    it("evicts cached entry when the last lease is released", async () => {
        const resolver = createRegistryResolver();
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        const source = inlineCpuModelSource();

        const leaseA = await registry.acquire(source, resolver);
        const leaseB = registry.acquireExisting(leaseA.asset);
        leaseA.release();
        leaseB.release();

        await registry.acquire(source, resolver);
        expect(resolver.mocFetches).toBe(2);

        registry.destroy();
    });

    it("load without acquire does not hold a lease refCount", async () => {
        const resolver = createRegistryResolver();
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        await registry.load(inlineCpuModelSource(), resolver);
        const lease = await registry.acquire(inlineCpuModelSource(), resolver);
        expect(resolver.mocFetches).toBe(1);
        lease.release();
        registry.destroy();
    });
});
