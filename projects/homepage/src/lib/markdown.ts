import { Marked, Renderer } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

const LANGS = [
    "typescript",
    "ts",
    "javascript",
    "js",
    "bash",
    "shell",
    "json",
    "vue",
    "html",
    "css",
    "text",
    "plaintext",
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: ["github-dark"],
            langs: [...LANGS],
        });
    }
    return highlighterPromise;
}

export interface RenderMarkdownOptions {
    /** Rewrite relative / in-doc hrefs for SPA routing. */
    resolveHref?: (href: string) => string;
}

/** Render Markdown with Shiki fenced-code highlighting. */
export async function renderMarkdown(
    source: string,
    options: RenderMarkdownOptions = {},
): Promise<string> {
    const resolveHref = options.resolveHref ?? ((href: string) => href);
    const marked = new Marked();
    const renderer = new Renderer();

    renderer.link = ({ href, title, text }) => {
        const resolved = resolveHref(href ?? "");
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        return `<a href="${escapeAttr(resolved)}"${titleAttr}>${text}</a>`;
    };

    marked.use({
        gfm: true,
        async: true,
        renderer,
        async walkTokens(token) {
            if (token.type !== "code") return;

            const highlighter = await getHighlighter();
            const requested = token.lang?.trim() || "text";
            const loaded = highlighter.getLoadedLanguages();
            const lang = loaded.includes(requested as never)
                ? requested
                : "text";

            const html = highlighter.codeToHtml(token.text, {
                lang,
                theme: "github-dark",
            });

            Object.assign(token, {
                type: "html",
                block: true,
                text: html,
            });
        },
    });

    return (await marked.parse(source)) as string;
}

function escapeAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
