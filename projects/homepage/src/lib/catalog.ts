/** Hand-edited `public/models/catalog.json` entry. */

export type CatalogLocaleTag = string;

export type CatalogLocalizedName = Readonly<Record<CatalogLocaleTag, string>>;

export interface CatalogModel {
    id: string;
    name: CatalogLocalizedName;
    source: string;
    local: boolean;
    tags?: readonly string[];
    sample?: string;
    preview?: string | null;
}

export interface ModelsCatalog {
    version: number;
    tags?: Readonly<Record<string, CatalogLocalizedName>>;
    models: CatalogModel[];
}

const LOCALE_TAG_PREFERENCE: Record<string, readonly string[]> = {
    "zh-hans": ["zh-cn", "zh", "zh-hans", "en-us", "en"],
    "en-us": ["en-us", "en", "zh-cn", "zh"],
    zh: ["zh-cn", "zh", "zh-hans", "en-us", "en"],
    en: ["en-us", "en", "zh-cn", "zh"],
};

function normalizeTag(tag: string): string {
    return tag.trim().toLowerCase().replace(/_/g, "-");
}

export function previewUrlFor(model: CatalogModel): string {
    return model.preview || `/models/previews/${model.id}.png`;
}

export function displayNameFor(
    model: Pick<CatalogModel, "id" | "name">,
    locale: string,
): string {
    return localizedText(model.name, locale) || model.id;
}

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
    const preferred = LOCALE_TAG_PREFERENCE[normalizeTag(locale)] ?? [
        normalizeTag(locale),
        "en-us",
        "en",
        "zh-cn",
        "zh",
    ];
    for (const tag of preferred) {
        const hit = byNorm.get(normalizeTag(tag));
        if (hit) return hit;
    }
    return byNorm.values().next().value ?? "";
}

export async function fetchCatalog(): Promise<ModelsCatalog> {
    const res = await fetch("/models/catalog.json");
    if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
    return (await res.json()) as ModelsCatalog;
}
