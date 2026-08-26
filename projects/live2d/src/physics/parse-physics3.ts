import type { Physics3Clip, Physics3Output, Physics3Setting } from "./types.js";

/**
 * Parse Cubism `physics3.json` enough to expose PhysicsSettings output parameter ids.
 * Tolerates minimal fixtures (missing / empty PhysicsSettings → empty clip).
 */
export function parsePhysics3(json: unknown): Physics3Clip {
    if (!json || typeof json !== "object") {
        throw new Error(
            "@doki-land/live2d: physics3 json root must be an object",
        );
    }
    const root = json as Record<string, unknown>;
    const settingsRaw = root.PhysicsSettings;
    if (settingsRaw === undefined || settingsRaw === null) {
        return { settings: [], outputParameterIds: [] };
    }
    if (!Array.isArray(settingsRaw)) {
        throw new Error("@doki-land/live2d: PhysicsSettings must be an array");
    }

    const settings: Physics3Setting[] = [];
    const outputParameterIds: string[] = [];

    for (let si = 0; si < settingsRaw.length; si++) {
        const entry = settingsRaw[si];
        if (!entry || typeof entry !== "object") {
            throw new Error(
                `@doki-land/live2d: PhysicsSettings[${si}] must be an object`,
            );
        }
        const rec = entry as Record<string, unknown>;
        const id = typeof rec.Id === "string" ? rec.Id : `PhysicsSetting${si}`;
        const outputsRaw = rec.Output;
        const outputs: Physics3Output[] = [];
        if (Array.isArray(outputsRaw)) {
            for (let oi = 0; oi < outputsRaw.length; oi++) {
                const out = outputsRaw[oi];
                if (!out || typeof out !== "object") continue;
                const dest = (out as Record<string, unknown>).Destination;
                if (!dest || typeof dest !== "object") continue;
                const destId = (dest as Record<string, unknown>).Id;
                if (typeof destId !== "string" || !destId) continue;
                outputs.push({ destinationId: destId });
                outputParameterIds.push(destId);
            }
        }
        settings.push({ id, outputs });
    }

    return { settings, outputParameterIds };
}
