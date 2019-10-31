import type { Pose3Clip } from "./types.js";

/** Parse Cubism pose file (`pose3.json` or legacy `pose.json`). */
export function parsePose3(json: unknown): Pose3Clip {
    if (!json || typeof json !== "object") {
        throw new Error("@doki-land/live2d: pose json root must be an object");
    }
    const root = json as Record<string, unknown>;
    const groupsRaw = root.Groups;
    if (!Array.isArray(groupsRaw)) {
        throw new Error("@doki-land/live2d: pose json missing Groups");
    }
    const groups = groupsRaw.map((group, gi) => {
        if (!Array.isArray(group)) {
            throw new Error(`@doki-land/live2d: Groups[${gi}] must be array`);
        }
        return group.map((entry, ei) => {
            if (!entry || typeof entry !== "object") {
                throw new Error(
                    `@doki-land/live2d: Groups[${gi}][${ei}] invalid`,
                );
            }
            const id = (entry as Record<string, unknown>).Id;
            if (typeof id !== "string" || !id) {
                throw new Error(
                    `@doki-land/live2d: Groups[${gi}][${ei}] missing Id`,
                );
            }
            return id;
        });
    });
    return { groups };
}
