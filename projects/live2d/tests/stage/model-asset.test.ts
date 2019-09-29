import type { AssetResolver, ModelSource } from "@doki-land/live2d-core";
import {
    createMoc3Backend,
    createQuadProgram,
    serializeCpuProgram,
} from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { ModelAssetRegistry } from "../../src/stage/model-asset-registry.js";

const MODEL_JSON = {
    Version: 3,
    FileReferences: {
        Moc: "quad.program.json",
        Textures: [],
        Motions: {},
    },
};

function createCountingResolver(
    programBytes: ArrayBuffer,
): AssetResolver & { mocFetches: number } {
    let mocFetches = 0;
    return {
        baseUrl: "https://fixture.test/",
        resolve: (key) => `https://fixture.test/${key}`,
        fetchJson: async (key) => {
            if (key.endsWith("model3.json")) return MODEL_JSON;
            throw new Error(`unexpected json key: ${key}`);
        },
        fetchBytes: async (key) => {
            if (key === "quad.program.json") {
                mocFetches += 1;
                return programBytes.slice(0);
            }
            throw new Error(`unexpected bytes key: ${key}`);
        },
        get mocFetches() {
            return mocFetches;
        },
    };
}

function inlineSource(): ModelSource {
    return {
        kind: "json",
        json: MODEL_JSON,
        baseUrl: "https://fixture.test/model3.json",
    };
}

describe("ModelAssetRegistry", () => {
    it("dedupes moc fetch for concurrent acquires of the same source", async () => {
        const programBytes = serializeCpuProgram(createQuadProgram());
        const resolver = createCountingResolver(programBytes);
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        const source = inlineSource();

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
        const programBytes = serializeCpuProgram(createQuadProgram());
        const resolver = createCountingResolver(programBytes);
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        const source = inlineSource();

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
        const programBytes = serializeCpuProgram(createQuadProgram());
        const resolver = createCountingResolver(programBytes);
        const registry = new ModelAssetRegistry({
            backends: [createMoc3Backend()],
        });
        const source = inlineSource();

        const leaseA = await registry.acquire(source, resolver);
        const leaseB = registry.acquireExisting(leaseA.asset);
        leaseA.release();
        leaseB.release();

        await registry.acquire(source, resolver);
        expect(resolver.mocFetches).toBe(2);

        registry.destroy();
    });
});

describe("resolveModelAssetKey", () => {
    it("stabilizes inline json keys", async () => {
        const { resolveModelAssetKey } = await import(
            "../../src/stage/model-asset-key.js"
        );
        const a = resolveModelAssetKey(inlineSource());
        const b = resolveModelAssetKey(inlineSource());
        expect(a).toBe(b);
    });
});
