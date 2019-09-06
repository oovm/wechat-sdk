/** Hand-edited `public/models/catalog.json` entry. */

/** Locale tags in catalog `name` maps, e.g. `en-us` / `zh-cn`. */
export type CatalogLocaleTag = string;

export type CatalogLocalizedName = Readonly<Record<CatalogLocaleTag, string>>;

export interface CatalogModel {
    id: string;
    /** Display names by locale tag (`en-us`, `zh-cn`, …). */
    name: CatalogLocalizedName;
    source: string;
    /** CI / offline sync + regression corpus. Gallery still lists all. */
    local: boolean;
    /** Free-form category ids; resolved via catalog `tags` labels when present. */
    tags?: readonly string[];
    sample?: string;
    preview?: string | null;
    npm?: {
        package: string;
        assets?: string;
        dest: string;
    };
    fixture?: string;
}

export interface ModelsCatalog {
    version: number;
    /** Optional localized labels for tag ids used on models. */
    tags?: Readonly<Record<string, CatalogLocalizedName>>;
    models: CatalogModel[];
}

/** Map site locale (`zh` / `en`) → catalog tag, then fall back. */
const LOCALE_TAG_PREFERENCE: Record<string, readonly string[]> = {
    zh: ["zh-cn", "zh", "zh-hans", "en-us", "en"],
    en: ["en-us", "en", "zh-cn", "zh"],
};

function normalizeTag(tag: string): string {
    return tag.trim().toLowerCase().replace(/_/g, "-");
}

export function previewUrlFor(model: CatalogModel): string {
    return model.preview || `/models/previews/${model.id}.png`;
}

/**
 * Resolve a catalog display name for the current UI locale.
 * Accepts either site locale (`zh`/`en`) or a full tag (`zh-cn`).
 */
export function displayNameFor(
    model: Pick<CatalogModel, "id" | "name">,
    locale: string,
): string {
    return localizedText(model.name, locale) || model.id;
}

/** Resolve a localized map (`name` / tag label) for the UI locale. */
export function localizedText(
    map: CatalogLocalizedName | undefined,
    locale: string,
): string {
    if (!map) return "";
    const byNorm = new Map<string, string>();
    for (const [k, v] of Object.entries(map)) {
        if (typeof v === "string" && v.trim()) {
            byNorm.set(normalizeTag(k), v);
        }
    }
    const preferred =
        LOCALE_TAG_PREFERENCE[normalizeTag(locale)] ??
        [normalizeTag(locale), "en-us", "en", "zh-cn", "zh"];
    for (const tag of preferred) {
        const hit = byNorm.get(normalizeTag(tag));
        if (hit) return hit;
    }
    return byNorm.values().next().value ?? "";
}

export function tagLabelFor(
    catalog: ModelsCatalog,
    tagId: string,
    locale: string,
): string {
    const map = catalog.tags?.[tagId];
    return localizedText(map, locale) || tagId;
}

export function collectTagIds(models: readonly CatalogModel[]): string[] {
    const set = new Set<string>();
    for (const m of models) {
        for (const t of m.tags ?? []) {
            const id = t.trim();
            if (id) set.add(id);
        }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}
