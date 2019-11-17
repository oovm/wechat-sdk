/**
 * Model / MOC compatibility matrix (S4).
 * Rows mirror `catalog.json` local corpus + offline CI-required entries.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const LIVE2D_TS_ROOT = resolve(HERE, "../../..");
export const PUBLIC_MODELS = join(
    LIVE2D_TS_ROOT,
    "projects/homepage/public/models",
);

export type ModelMatrixFormat = "moc2" | "moc3" | "cpu-program";

export interface ModelMatrixRow {
    /** Stable matrix id (usually catalog id). */
    id: string;
    format: ModelMatrixFormat;
    /** MOC / cpu-program path relative to `public/models`. */
    mocRelative: string;
    /** Must decode + evaluate in CI (offline corpus). */
    ciRequired: boolean;
}

/** Authoritative matrix — keep in sync with `catalog.json` local entries. */
export const MODEL_MATRIX: readonly ModelMatrixRow[] = [
    {
        id: "cpu-quad",
        format: "cpu-program",
        mocRelative: "quad/quad.program.json",
        ciRequired: true,
    },
    {
        id: "npm-mirrored-hijiki",
        format: "moc2",
        mocRelative: "npm/npm-hijiki/assets/moc/hijiki.moc",
        ciRequired: true,
    },
    {
        id: "local-wanko",
        format: "moc3",
        mocRelative: "samples/moc3-wanko/Wanko.moc3",
        ciRequired: false,
    },
    {
        id: "local-haru",
        format: "moc3",
        mocRelative: "samples/moc3-haru/Haru.moc3",
        ciRequired: false,
    },
    {
        id: "local-mao",
        format: "moc3",
        mocRelative: "samples/moc3-mao/Mao.moc3",
        ciRequired: false,
    },
    {
        id: "local-hijiki",
        format: "moc2",
        mocRelative: "samples/moc2-hijiki/moc/hijiki.moc",
        ciRequired: false,
    },
    {
        id: "local-tororo",
        format: "moc2",
        mocRelative: "samples/moc2-tororo/moc/tororo.moc",
        ciRequired: false,
    },
] as const;

export function resolveMatrixMocPath(row: ModelMatrixRow): string {
    return join(PUBLIC_MODELS, row.mocRelative);
}

export function tryReadMatrixMoc(row: ModelMatrixRow): ArrayBuffer | null {
    const path = resolveMatrixMocPath(row);
    if (!existsSync(path)) return null;
    try {
        return Uint8Array.from(readFileSync(path)).buffer;
    } catch {
        return null;
    }
}

export function listMatrixRowsForCi(): {
    required: ModelMatrixRow[];
    optional: ModelMatrixRow[];
} {
    const required = MODEL_MATRIX.filter((r) => r.ciRequired);
    const optional = MODEL_MATRIX.filter((r) => !r.ciRequired);
    return { required, optional };
}
