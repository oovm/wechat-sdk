/**
 * Shared reader for `projects/homepage/public/models/catalog.json`.
 *
 * Catalog is hand-edited (PRs welcome). Scripts must not regenerate the
 * `models` list. Preview PNGs are optional and produced locally via
 * `generate:previews` — never in CI.
 *
 * @typedef {{
 *   package: string,
 *   assets?: string,
 *   dest: string,
 * }} CatalogNpmSync
 *
 * @typedef {{
 *   id: string,
 *   name: Record<string, string>,
 *   source: string,
 *   local: boolean,
 *   tags?: string[],
 *   sample?: string,
 *   npm?: CatalogNpmSync,
 *   fixture?: string,
 *   preview?: string,
 * }} CatalogModel
 *
 * @typedef {{
 *   version: number,
 *   tags?: Record<string, Record<string, string>>,
 *   models: CatalogModel[],
 * }} ModelsCatalog
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const CATALOG_PATH = join(
    here,
    "..",
    "projects",
    "homepage",
    "public",
    "models",
    "catalog.json",
);

/** @returns {ModelsCatalog} */
export function loadModelsCatalog(path = CATALOG_PATH) {
    if (!existsSync(path)) {
        throw new Error(`missing models catalog: ${path}`);
    }
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!raw || !Array.isArray(raw.models)) {
        throw new Error(`invalid models catalog (expected models[]): ${path}`);
    }
    for (const m of raw.models) {
        if (!m?.id || !m?.source || typeof m.local !== "boolean") {
            throw new Error(
                `invalid catalog entry (need id, source, local): ${JSON.stringify(m)}`,
            );
        }
        if (
            !m.name ||
            typeof m.name !== "object" ||
            Array.isArray(m.name) ||
            !Object.values(m.name).some(
                (v) => typeof v === "string" && v.trim(),
            )
        ) {
            throw new Error(
                `invalid catalog entry (need name: { "en-us": "…" }): ${m.id}`,
            );
        }
        if (
            m.tags !== undefined &&
            (!Array.isArray(m.tags) ||
                m.tags.some((t) => typeof t !== "string" || !t.trim()))
        ) {
            throw new Error(`invalid catalog tags on ${m.id}`);
        }
    }
    if (raw.tags != null && (typeof raw.tags !== "object" || Array.isArray(raw.tags))) {
        throw new Error("invalid catalog tags map");
    }
    return raw;
}

/** Resolve display name; `locale` may be `zh` / `en` or `zh-cn` / `en-us`. */
export function displayNameFor(model, locale = "en") {
    const name = model?.name && typeof model.name === "object" ? model.name : {};
    const byNorm = new Map();
    for (const [k, v] of Object.entries(name)) {
        if (typeof v === "string" && v.trim()) {
            byNorm.set(String(k).trim().toLowerCase().replace(/_/g, "-"), v);
        }
    }
    const loc = String(locale).trim().toLowerCase().replace(/_/g, "-");
    const preferred =
        loc === "zh" || loc.startsWith("zh")
            ? ["zh-cn", "zh", "zh-hans", "en-us", "en"]
            : loc === "en" || loc.startsWith("en")
              ? ["en-us", "en", "zh-cn", "zh"]
              : [loc, "en-us", "en", "zh-cn", "zh"];
    for (const tag of preferred) {
        const hit = byNorm.get(tag);
        if (hit) return hit;
    }
    for (const v of byNorm.values()) return v;
    return model?.id ?? "";
}

/** CI / offline asset sync + regression corpus. */
export function listLocalModels(catalog = loadModelsCatalog()) {
    return catalog.models.filter((m) => m.local === true);
}

/** Gallery / Playground list (all entries). */
export function listGalleryModels(catalog = loadModelsCatalog()) {
    return catalog.models;
}

/** Default preview URL; file may be absent until local generate:previews. */
export function previewUrlFor(model) {
    if (model.preview) return model.preview;
    return `/models/previews/${model.id}.png`;
}

export function isPathSource(source) {
    return typeof source === "string" && source.startsWith("/");
}
