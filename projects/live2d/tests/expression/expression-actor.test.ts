// @vitest-environment happy-dom

import type { AssetResolver, ModelSource } from "@doki-land/live2d-core";
import { createMoc3Backend } from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { createLive2dStage } from "../../src/stage/stage.js";
import {
    cpuProgramBytes,
    createMountedCpuStage,
    createStubRenderer,
} from "../fixtures/cpu-model-fixture.js";

const SMILE_EXPR = {
    Type: "Live2D Expression",
    Parameters: [{ Id: "PARAM_ANGLE_X", Value: 0.5, Blend: "Add" }],
};

const MODEL_WITH_EXPR = {
    Version: 3,
    FileReferences: {
        Moc: "quad.program.json",
        Textures: [] as string[],
        Expressions: [{ Name: "smile", File: "expressions/smile.exp3.json" }],
        Motions: {} as Record<string, unknown[]>,
    },
};

function createExprResolver(programBytes: ArrayBuffer): AssetResolver {
    return {
        baseUrl: "https://fixture.test/",
        resolve: (key) => `https://fixture.test/${key}`,
        fetchJson: async (key) => {
            if (key.endsWith("smile.exp3.json")) return SMILE_EXPR;
            throw new Error(`unexpected json key: ${key}`);
        },
        fetchBytes: async (key) => {
            if (key === "quad.program.json") return programBytes.slice(0);
            return new ArrayBuffer(0);
        },
    };
}

describe("Actor setExpression", () => {
    it("returns false when expression name is missing", async () => {
        const { stage } = await createMountedCpuStage();
        const actor = stage.createActor({ id: "expr" });
        const resolver = createExprResolver(cpuProgramBytes());
        await actor.load(
            {
                kind: "json",
                json: MODEL_WITH_EXPR,
                baseUrl: "https://fixture.test/model3.json",
            } satisfies ModelSource,
            resolver,
        );
        await expect(actor.setExpression("missing")).resolves.toBe(false);
        stage.destroy();
    });

    it("loads expression and mixes onto parameters after update", async () => {
        const stage = createLive2dStage({
            updateMode: "manual",
            renderer: createStubRenderer(),
            backends: [createMoc3Backend()],
        });
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        await stage.mount(canvas);
        const actor = stage.createActor({ id: "expr" });
        await actor.load(
            {
                kind: "json",
                json: MODEL_WITH_EXPR,
                baseUrl: "https://fixture.test/model3.json",
            },
            createExprResolver(cpuProgramBytes()),
        );
        expect(actor.listExpressions().map((e) => e.name)).toEqual(["smile"]);
        await expect(actor.setExpression("smile")).resolves.toBe(true);
        actor.setParameter("PARAM_ANGLE_X", 0);
        stage.update(1);
        // Add blend within param max: 0 + 0.5 = 0.5
        expect(actor.parameterMap().get("PARAM_ANGLE_X")?.value).toBe(0.5);
        await expect(actor.setExpression(null)).resolves.toBe(true);
        stage.destroy();
    });
});
