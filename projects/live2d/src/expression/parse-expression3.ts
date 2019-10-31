import type { Expression3Clip, ExpressionBlendMode } from "./types.js";

const BLENDS = new Set<ExpressionBlendMode>(["Add", "Multiply", "Override"]);

function parseBlend(raw: unknown): ExpressionBlendMode {
    if (typeof raw !== "string") return "Add";
    // Cubism official spelling is `Overwrite`; keep `Override` as an alias.
    if (raw === "Overwrite" || raw === "Override") return "Override";
    if (BLENDS.has(raw as ExpressionBlendMode)) {
        return raw as ExpressionBlendMode;
    }
    return "Add";
}

/** Parse Cubism `exp3.json` (FileFormats/exp3.json.md subset). */
export function parseExpression3(json: unknown): Expression3Clip {
    if (!json || typeof json !== "object") {
        throw new Error("@doki-land/live2d: exp3.json root must be an object");
    }
    const root = json as Record<string, unknown>;
    const version = Number(root.Version ?? 3);
    const paramsRaw = root.Parameters;
    if (!Array.isArray(paramsRaw)) {
        throw new Error("@doki-land/live2d: exp3.json missing Parameters");
    }
    const parameters = paramsRaw.map((item, index) => {
        if (!item || typeof item !== "object") {
            throw new Error(`@doki-land/live2d: Parameters[${index}] invalid`);
        }
        const p = item as Record<string, unknown>;
        const id = p.Id;
        const value = p.Value;
        if (typeof id !== "string" || typeof value !== "number") {
            throw new Error(
                `@doki-land/live2d: Parameters[${index}] needs Id/Value`,
            );
        }
        return {
            id,
            value,
            blend: parseBlend(p.Blend),
        };
    });
    return { version, parameters };
}
