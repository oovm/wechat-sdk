import { type ComputedRef, computed, ref } from "vue";
import { type Locale, type MessageTree, messages } from "./messages";

const STORAGE_KEY = "live2d.ts.locale";

function detectLocale(): Locale {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "zh" || saved === "en") return saved;
    } catch {
        // ignore
    }
    if (typeof navigator !== "undefined") {
        const lang = navigator.language.toLowerCase();
        if (lang.startsWith("zh")) return "zh";
    }
    return "en";
}

export const locale = ref<Locale>(detectLocale());

export const LOCALES: readonly Locale[] = ["zh", "en"];

export function setLocale(next: Locale): void {
    locale.value = next;
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // ignore
    }
    if (typeof document !== "undefined") {
        document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    }
}

export function docsHomePath(lang: Locale = locale.value): string {
    return lang === "zh" ? "/d/文档" : `/d/${lang}`;
}

type Params = Record<string, string | number>;

function format(template: string, params?: Params): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) =>
        params[key] != null ? String(params[key]) : `{${key}}`,
    );
}

function readPath(tree: MessageTree, path: string): string | undefined {
    const parts = path.split(".");
    let cur: unknown = tree;
    for (const part of parts) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : undefined;
}

/** Translate a dotted key, e.g. `nav.home`. */
export function t(key: string, params?: Params): string {
    const hit =
        readPath(messages[locale.value], key) ??
        readPath(messages.en, key) ??
        key;
    return format(hit, params);
}

export function useI18n(): {
    locale: typeof locale;
    t: typeof t;
    setLocale: typeof setLocale;
    docsHomePath: typeof docsHomePath;
    messages: ComputedRef<MessageTree>;
} {
    return {
        locale,
        t,
        setLocale,
        docsHomePath,
        messages: computed(() => messages[locale.value]),
    };
}

// Apply <html lang> on first load.
setLocale(locale.value);

export type { Locale, MessageTree };
