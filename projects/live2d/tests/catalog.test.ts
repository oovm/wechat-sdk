import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const catalogPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../homepage/public/models/catalog.json",
);

describe("models catalog", () => {
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
        version: number;
        models: Array<{
            id: string;
            name: Record<string, string>;
            source: string;
            local: boolean;
            fixture?: string;
            sample?: string;
            npm?: unknown;
            tags?: string[];
        }>;
    };

    it("has unique ids and required fields", () => {
        expect(catalog.version).toBe(1);
        expect(catalog.models.length).toBeGreaterThan(0);
        const ids = new Set<string>();
        for (const m of catalog.models) {
            expect(m.id).toBeTruthy();
            expect(m.name && typeof m.name === "object").toBe(true);
            expect(m.name["en-us"] || m.name["zh-cn"]).toBeTruthy();
            expect(m.source).toBeTruthy();
            expect(typeof m.local).toBe("boolean");
            expect(ids.has(m.id)).toBe(false);
            ids.add(m.id);
        }
    });

    it("declares tags with localized labels", () => {
        const full = JSON.parse(readFileSync(catalogPath, "utf8")) as {
            tags?: Record<string, Record<string, string>>;
            models: Array<{
                id: string;
                tags?: string[];
                local: boolean;
                source: string;
            }>;
        };
        expect(full.tags?.moc3?.["en-us"]).toBeTruthy();
        for (const m of full.models) {
            if (!m.tags) continue;
            for (const tag of m.tags) {
                expect(full.tags?.[tag]).toBeTruthy();
            }
        }
    });

    it("keeps cpu-quad in the local CI corpus", () => {
        const local = catalog.models.filter((m) => m.local);
        expect(local.some((m) => m.id === "cpu-quad")).toBe(true);
        expect(
            catalog.models
                .filter((m) => !m.local)
                .every((m) => !m.source.startsWith("/models/quad")),
        ).toBe(true);
    });

    it("covers local sample/npm/fixture ids in the model matrix", async () => {
        const { MODEL_MATRIX } = await import(
            "../../live2d-renderer/tests/model-matrix.js"
        );
        const matrixIds = new Set(MODEL_MATRIX.map((r) => r.id));
        for (const m of catalog.models.filter((m) => m.local)) {
            if (m.fixture === "cpu-quad" || m.sample || m.npm) {
                expect(matrixIds.has(m.id), `matrix missing ${m.id}`).toBe(
                    true,
                );
            }
        }
    });
});
