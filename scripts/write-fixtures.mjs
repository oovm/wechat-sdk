/**
 * Writes the CPU program fixture used by homepage acceptance.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(
    workspaceRoot,
    "projects",
    "homepage",
    "public",
    "models",
    "quad",
);
mkdirSync(outDir, { recursive: true });

const file = {
    kind: "cpu-program",
    version: 1,
    program: {
        format: "moc3",
        parameters: [
            {
                id: "PARAM_ANGLE_X",
                min: -1,
                max: 1,
                defaultValue: 0,
            },
        ],
        drawables: [
            {
                index: 0,
                textureIndex: 0,
                positions: [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
                uvs: [0, 1, 1, 1, 1, 0, 0, 0],
                indices: [0, 1, 2, 0, 2, 3],
                opacity: 1,
                renderOrder: 0,
                deformParamIndex: 0,
                deformDeltas: [0, 0, 0, 0, 0.25, 0.1, 0, 0],
            },
        ],
    },
};

writeFileSync(
    join(outDir, "quad.program.json"),
    `${JSON.stringify(file, null, 2)}\n`,
);
writeFileSync(
    join(outDir, "quad.model3.json"),
    `${JSON.stringify(
        {
            Version: 3,
            Name: "quad-cpu-program",
            FileReferences: {
                Moc: "quad.program.json",
                Textures: [],
            },
            HitAreas: [],
        },
        null,
        2,
    )}\n`,
);
console.log("wrote", join(outDir, "quad.program.json"));
