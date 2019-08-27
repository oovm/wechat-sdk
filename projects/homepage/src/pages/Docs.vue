<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
    type DocLang,
    getDoc,
    isZhDocsAlias,
    listDocNav,
    sectionTitle,
} from "../docs/catalog";
import { docsHomePath, useI18n } from "../i18n";
import { renderMarkdown } from "../lib/markdown";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

/** Docs language follows header locale only — no local toggle. */
const lang = computed<DocLang>(() => locale.value);

const slug = computed(() => {
    const p0 = String(route.params.langOrAlias ?? "");
    if (isZhDocsAlias(p0) || route.path === "/d" || route.path === "/d/") {
        return "index";
    }
    if (p0 === "zh" || p0 === "en") {
        const rest = route.params.slug;
        if (Array.isArray(rest)) return rest.join("/") || "index";
        if (typeof rest === "string" && rest.length) return rest;
        return "index";
    }
    if (p0) {
        const rest = route.params.slug;
        const more = Array.isArray(rest)
            ? rest.join("/")
            : typeof rest === "string"
              ? rest
              : "";
        return more ? `${p0}/${more}` : p0;
    }
    return "index";
});

const nav = computed(() => listDocNav(lang.value));
const doc = computed(() => getDoc(lang.value, slug.value));
const html = ref("");
const rendering = ref(false);

const crumbs = computed(() => {
    const items: { label: string; to?: string }[] = [
        { label: t("nav.docs"), to: docsHomePath(lang.value) },
    ];
    const meta = doc.value?.meta;
    if (!meta) return items;
    const section = sectionTitle(lang.value, meta.section);
    if (section && meta.section) {
        items.push({ label: section });
    }
    if (meta.slug !== "index") {
        items.push({ label: meta.title });
    }
    return items;
});

function resolveDocHref(href: string, currentLang: DocLang): string {
    if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("/") ||
        href.startsWith("#")
    ) {
        return href;
    }
    const cleaned = href.replace(/^\.\//, "").replace(/\.md$/i, "");
    const baseDir =
        slug.value === "index"
            ? ""
            : slug.value.includes("/")
              ? slug.value.slice(0, slug.value.lastIndexOf("/") + 1)
              : "";
    let target = cleaned;
    if (cleaned.startsWith("../")) {
        const parts = (baseDir + cleaned).split("/");
        const out: string[] = [];
        for (const p of parts) {
            if (!p || p === ".") continue;
            if (p === "..") out.pop();
            else out.push(p);
        }
        target = out.join("/");
    } else if (!cleaned.includes("/") && baseDir) {
        target = baseDir + cleaned;
    }
    if (!target || target === "index") {
        return docsHomePath(currentLang);
    }
    return `/d/${currentLang}/${target}`;
}

let renderGeneration = 0;

watch(
    doc,
    (next) => {
        if (!next) {
            html.value = "";
            return;
        }
        const currentLang = lang.value;
        const gen = ++renderGeneration;
        rendering.value = true;
        void renderMarkdown(next.body, {
            resolveHref: (href) => resolveDocHref(href, currentLang),
        })
            .then((out) => {
                if (gen !== renderGeneration) return;
                html.value = out;
            })
            .finally(() => {
                if (gen === renderGeneration) rendering.value = false;
            });
    },
    { immediate: true },
);

function canonicalPath(forLang: DocLang, forSlug: string): string {
    return getDoc(forLang, forSlug)?.meta.path ?? docsHomePath(forLang);
}

watch(
    [lang, slug, () => route.path],
    ([forLang, forSlug, path]) => {
        if (!path.startsWith("/d")) return;
        const target = canonicalPath(forLang, forSlug);
        if (path !== target) {
            void router.replace(target);
        }
    },
    { immediate: true },
);

function onArticleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href?.startsWith("/d/")) return;
    event.preventDefault();
    void router.push(href);
}
</script>

<template>
  <div class="docs-shell">
    <div class="docs">
      <aside class="side">
        <p class="side-kicker">{{ t("nav.docs") }}</p>
        <nav class="side-nav" :aria-label="t('docs.navAria')">
          <template v-for="node in nav" :key="node.type === 'group' ? node.id : node.path">
            <RouterLink
              v-if="node.type === 'link'"
              :to="node.path"
              class="nav-link"
              :class="{ active: node.slug === slug }"
            >
              {{ node.title }}
            </RouterLink>
            <div v-else class="nav-group">
              <p class="nav-group-title">{{ node.title }}</p>
              <RouterLink
                v-for="child in node.children"
                :key="child.path"
                :to="child.path"
                class="nav-link nested"
                :class="{ active: child.slug === slug }"
              >
                {{ child.title }}
              </RouterLink>
            </div>
          </template>
        </nav>
      </aside>

      <div class="main">
        <nav v-if="doc" class="crumbs" aria-label="breadcrumb">
          <template v-for="(c, i) in crumbs" :key="c.label + i">
            <span v-if="i > 0" class="crumbs-sep" aria-hidden="true">/</span>
            <RouterLink v-if="c.to && i < crumbs.length - 1" :to="c.to">
              {{ c.label }}
            </RouterLink>
            <span v-else :class="{ current: i === crumbs.length - 1 }">
              {{ c.label }}
            </span>
          </template>
        </nav>

        <article
          v-if="doc"
          class="article prose"
          :class="{ rendering }"
          v-html="html"
          @click="onArticleClick"
        />
        <article v-else class="article missing">
          <h1>{{ t("docs.notFound") }}</h1>
          <p>
            <code>{{ lang }}/{{ slug }}</code>
            —
            <RouterLink :to="docsHomePath(lang)">
              {{ t("docs.backHome") }}
            </RouterLink>
          </p>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.docs-shell {
  flex: 1;
  background: radial-gradient(
    1200px 480px at 12% -10%,
    color-mix(in srgb, var(--accent) 10%, transparent),
    transparent 60%
  ),
  var(--paper);
  border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}

.docs {
  width: min(72rem, calc(100% - 2rem));
  margin: 0 auto;
  padding: 1.75rem 0 4rem;
  display: grid;
  gap: 1.5rem;
  box-sizing: border-box;
  align-content: start;
}

@media (min-width: 900px) {
  .docs {
    grid-template-columns: 15.5rem minmax(0, 1fr);
    gap: 0;
    padding-top: 0;
  }
}

.side {
  display: grid;
  gap: 0.85rem;
  align-content: start;
  padding: 0.25rem 0.25rem 0;
}

@media (min-width: 900px) {
  .side {
    position: sticky;
    top: 3.6rem;
    align-self: start;
    max-height: calc(100vh - 3.6rem);
    overflow: auto;
    padding: 1.75rem 1.25rem 2.5rem 0.15rem;
    border-right: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    margin-right: 2rem;
  }
}

.side-kicker {
  margin: 0 0 0.15rem;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ink);
}

.side-nav {
  display: grid;
  gap: 0.08rem;
}

.nav-group {
  display: grid;
  gap: 0.06rem;
  margin-top: 1.35rem;
  padding-top: 0.85rem;
  border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}

.nav-group-title {
  margin: 0 0 0.4rem;
  padding: 0 0.55rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.nav-link {
  display: block;
  padding: 0.5rem 0.6rem;
  border-radius: 0.4rem;
  border-left: 2px solid transparent;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.35;
  font-weight: 550;
  transition: color 140ms ease,
  background 140ms ease,
  border-color 140ms ease;
}

.nav-link.nested {
  margin-left: 0.35rem;
  padding-left: 0.75rem;
  font-weight: 450;
  font-size: 0.88rem;
}

.nav-link:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.nav-link.active {
  color: var(--ink);
  background: color-mix(in srgb, var(--accent) 14%, #fff);
  border-left-color: var(--accent);
  font-weight: 650;
}

.main {
  min-width: 0;
  padding: 0.15rem 0 0;
}

@media (min-width: 900px) {
  .main {
    padding: 1.75rem 0.5rem 0 0;
  }
}

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 1rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.crumbs a {
  color: var(--muted);
  transition: color 140ms ease;
}

.crumbs a:hover {
  color: var(--accent);
}

.crumbs-sep {
  opacity: 0.45;
}

.crumbs .current {
  color: var(--ink);
  font-weight: 600;
}

.article {
  min-width: 0;
  width: 100%;
  max-width: 46rem;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--ink) 9%, transparent);
  border-radius: 0.55rem;
  padding: 1.65rem clamp(1.2rem, 2.4vw, 2.1rem) 2.5rem;
  box-shadow: 0 18px 40px -34px color-mix(in srgb, var(--ink) 55%, transparent);
}

.article.missing {
  max-width: 36rem;
}

.article.rendering {
  opacity: 0.72;
  transition: opacity 120ms ease;
}

.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3) {
  font-family: var(--font-display);
  line-height: 1.25;
  color: var(--ink);
}

.prose :deep(h1) {
  margin: 0 0 0.85rem;
  font-size: clamp(1.6rem, 2.3vw, 2rem);
  letter-spacing: -0.02em;
}

.prose :deep(h2) {
  margin: 1.85rem 0 0.65rem;
  font-size: 1.2rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}

.prose :deep(h3) {
  margin: 1.25rem 0 0.45rem;
  font-size: 1.02rem;
}

.prose :deep(p),
.prose :deep(li) {
  color: var(--muted);
  line-height: 1.7;
}

.prose :deep(p) {
  margin: 0.7rem 0;
}

.prose :deep(ul),
.prose :deep(ol) {
  margin: 0.55rem 0 0.95rem;
  padding-left: 1.2rem;
}

.prose :deep(li + li) {
  margin-top: 0.32rem;
}

.prose :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose :deep(:not(pre) > code) {
  font-size: 0.86em;
  background: color-mix(in srgb, var(--mist) 72%, #fff);
  padding: 0.12em 0.38em;
  border-radius: 0.25rem;
}

.prose :deep(.shiki) {
  overflow-x: auto;
  margin: 1.05rem 0;
  padding: 1rem 1.1rem;
  border-radius: 0.45rem;
  border: 1px solid color-mix(in srgb, #fff 8%, transparent);
  font-size: 0.86rem;
  line-height: 1.6;
}

.prose :deep(.shiki code) {
  background: transparent;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin: 1rem 0;
}

.prose :deep(th),
.prose :deep(td) {
  border: 1px solid color-mix(in srgb, var(--ink) 11%, transparent);
  padding: 0.5rem 0.65rem;
  text-align: left;
}

.prose :deep(th) {
  background: color-mix(in srgb, var(--mist) 50%, #fff);
  color: var(--ink);
  font-weight: 650;
}

.prose :deep(hr) {
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  margin: 1.75rem 0;
}

.prose :deep(strong) {
  color: var(--ink);
  font-weight: 650;
}
</style>
