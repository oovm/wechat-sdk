// Multilingual docs: projects/homepage/documents/<folder>/<slug...>.md
// Nested folders become sidebar groups (guide / runtime / adaptors).

export type DocLang = "zh" | "en";

export interface DocMeta {
    readonly lang: DocLang;
    readonly slug: string;
    readonly title: string;
    readonly order: number;
    readonly section: string | null;
    readonly path: string;
}

export interface ParsedDoc {
    readonly meta: DocMeta;
    readonly body: string;
}

export interface DocNavLink {
    readonly type: "link";
    readonly title: string;
    readonly slug: string;
    readonly path: string;
    readonly order: number;
}

export interface DocNavGroup {
    readonly type: "group";
    readonly id: string;
    readonly title: string;
    readonly order: number;
    readonly children: readonly DocNavLink[];
}

export type DocNavNode = DocNavLink | DocNavGroup;

const RAW_DOCS = import.meta.glob("../../documents/**/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const FOLDER_TO_LANG: Readonly<Record<string, DocLang>> = {
    zh: "zh",
    "zh-hans": "zh",
    "zh-cn": "zh",
    en: "en",
    "en-us": "en",
    "en-gb": "en",
};

/** Section folder → display order + titles. */
const SECTION_META: Readonly<
    Record<string, { order: number; title: Record<DocLang, string> }>
> = {
    guide: { order: 1, title: { zh: "指南", en: "Guide" } },
    runtime: { order: 2, title: { zh: "运行时", en: "Runtime" } },
    adaptors: { order: 3, title: { zh: "适配器", en: "Adaptors" } },
};

function parseFrontmatter(raw: string): {
    title?: string;
    order?: number;
    body: string;
} {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { body: raw };
    const yaml = match[1] ?? "";
    const body = match[2] ?? "";
    let title: string | undefined;
    let order: number | undefined;
    for (const line of yaml.split(/\r?\n/)) {
        const t = line.match(/^title:\s*(.+)\s*$/);
        if (t) title = t[1]?.replace(/^["']|["']$/g, "");
        const o = line.match(/^order:\s*(-?\d+)\s*$/);
        if (o) order = Number(o[1]);
    }
    return { title, order, body };
}

function fileToMeta(filePath: string, raw: string): DocMeta | null {
    const norm = filePath.replace(/\\/g, "/");
    const hit = norm.match(/\/documents\/([^/]+)\/(.+)\.md$/);
    if (!hit) return null;
    const folder = hit[1]!;
    const lang = FOLDER_TO_LANG[folder];
    if (!lang) return null;
    const rel = hit[2]!;
    const slug = rel === "index" ? "index" : rel.replace(/\/index$/, "");
    const slash = slug.indexOf("/");
    const section = slash >= 0 ? slug.slice(0, slash) : null;
    const parsed = parseFrontmatter(raw);
    const path =
        slug === "index"
            ? lang === "zh"
                ? "/d/文档"
                : `/d/${lang}`
            : `/d/${lang}/${slug}`;
    return {
        lang,
        slug,
        title: parsed.title ?? slug.split("/").pop() ?? slug,
        order: parsed.order ?? 100,
        section,
        path,
    };
}

const PARSED: ParsedDoc[] = Object.entries(RAW_DOCS)
    .map(([filePath, raw]) => {
        const meta = fileToMeta(filePath, raw);
        if (!meta) return null;
        const { body } = parseFrontmatter(raw);
        return { meta, body } satisfies ParsedDoc;
    })
    .filter((x): x is ParsedDoc => x !== null)
    .sort((a, b) => {
        if (a.meta.lang !== b.meta.lang) {
            return a.meta.lang.localeCompare(b.meta.lang);
        }
        const sa = a.meta.section ?? "";
        const sb = b.meta.section ?? "";
        if (sa !== sb) return sa.localeCompare(sb);
        return (
            a.meta.order - b.meta.order ||
            a.meta.slug.localeCompare(b.meta.slug)
        );
    });

export const DOC_LANGS: readonly DocLang[] = ["zh", "en"];

export const DEFAULT_DOC_LANG: DocLang = "zh";

export function listDocs(lang: DocLang): readonly DocMeta[] {
    return PARSED.filter((d) => d.meta.lang === lang).map((d) => d.meta);
}

/** Hierarchical sidebar: overview link + section groups. */
export function listDocNav(lang: DocLang): readonly DocNavNode[] {
    const docs = listDocs(lang);
    const roots: DocNavLink[] = [];
    const groups = new Map<string, DocNavLink[]>();

    for (const d of docs) {
        const link: DocNavLink = {
            type: "link",
            title: d.title,
            slug: d.slug,
            path: d.path,
            order: d.order,
        };
        if (!d.section) {
            roots.push(link);
            continue;
        }
        const list = groups.get(d.section) ?? [];
        list.push(link);
        groups.set(d.section, list);
    }

    roots.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

    const nodes: DocNavNode[] = [...roots];
    const sectionIds = [...groups.keys()].sort((a, b) => {
        const oa = SECTION_META[a]?.order ?? 50;
        const ob = SECTION_META[b]?.order ?? 50;
        return oa - ob || a.localeCompare(b);
    });

    for (const id of sectionIds) {
        const children = (groups.get(id) ?? []).sort(
            (a, b) => a.order - b.order || a.slug.localeCompare(b.slug),
        );
        const meta = SECTION_META[id];
        nodes.push({
            type: "group",
            id,
            title: meta?.title[lang] ?? id,
            order: meta?.order ?? 50,
            children,
        });
    }

    return nodes;
}

export function getDoc(lang: DocLang, slug: string): ParsedDoc | null {
    const key = slug === "" || slug === "文档" ? "index" : slug;
    return (
        PARSED.find((d) => d.meta.lang === lang && d.meta.slug === key) ?? null
    );
}

export function sectionTitle(
    lang: DocLang,
    section: string | null,
): string | null {
    if (!section) return null;
    return SECTION_META[section]?.title[lang] ?? section;
}

export function resolveDocLang(input: string | undefined): DocLang {
    if (!input) return DEFAULT_DOC_LANG;
    return FOLDER_TO_LANG[input] ?? DEFAULT_DOC_LANG;
}

export function isZhDocsAlias(segment: string | undefined): boolean {
    return segment === "文档";
}
