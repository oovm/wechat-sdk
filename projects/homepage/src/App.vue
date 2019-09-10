<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, type Ref, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import SiteFooter from "./components/SiteFooter.vue";
import { landingBrand } from "./config/landing";
import { getDoc } from "./docs/catalog";
import { docsHomePath, LOCALES, type Locale, setLocale, useI18n } from "./i18n";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const onHome = computed(() => route.path === "/");
const hideChrome = computed(() => Boolean(route.meta.hideChrome));

const langOpen = ref(false);
const langRoot: Ref<HTMLElement | null> = ref(null);

function onLocaleClick(next: Locale) {
    langOpen.value = false;
    setLocale(next);
    if (!route.path.startsWith("/d")) return;
    const p0 = String(route.params.langOrAlias ?? "");
    let slug = "index";
    if (p0 === "zh" || p0 === "en") {
        const rest = route.params.slug;
        slug = Array.isArray(rest)
            ? rest.join("/") || "index"
            : typeof rest === "string" && rest
              ? rest
              : "index";
    }
    const hit = getDoc(next, slug);
    void router.push(hit?.meta.path ?? docsHomePath(next));
}

function onDocPointerDown(ev: PointerEvent) {
    const root = langRoot.value;
    if (!root || !langOpen.value) return;
    if (ev.target instanceof Node && !root.contains(ev.target)) {
        langOpen.value = false;
    }
}

function onDocKeydown(ev: KeyboardEvent) {
    if (ev.key === "Escape") langOpen.value = false;
}

onMounted(() => {
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeydown);
});

onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.removeEventListener("keydown", onDocKeydown);
});
</script>

<style>
@import "@fontsource-variable/inter-tight";
@import "@fontsource-variable/noto-sans-sc";
</style>

<template>
  <div class="shell" :class="{ home: onHome, bare: hideChrome }">
    <header v-if="!hideChrome" class="top">
      <RouterLink class="brand" to="/"><span class="brand-mark">✦</span>{{ landingBrand }}</RouterLink>
      <div class="top-right">
        <nav>
          <RouterLink to="/">{{ t("nav.home") }}</RouterLink>
          <RouterLink to="/gallery">{{ t("nav.gallery") }}</RouterLink>
          <RouterLink to="/stage">{{ t("nav.stage") }}</RouterLink>
          <RouterLink :to="docsHomePath()">{{ t("nav.docs") }}</RouterLink>
        </nav>
        <div ref="langRoot" class="lang">
          <button
            type="button"
            class="lang-toggle"
            :aria-label="t('lang.switch')"
            :aria-expanded="langOpen"
            aria-haspopup="listbox"
            @click="langOpen = !langOpen"
          >
            <svg
              class="lang-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
              <path
                d="M3.5 12h17M12 3c2.8 2.4 4.2 5.4 4.2 9s-1.4 6.6-4.2 9c-2.8-2.4-4.2-5.4-4.2-9S9.2 5.4 12 3Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              />
            </svg>
          </button>
          <ul
            v-show="langOpen"
            class="lang-menu"
            role="listbox"
            :aria-label="t('lang.switch')"
          >
            <li v-for="l in LOCALES" :key="l" role="option" :aria-selected="locale === l">
              <button
                type="button"
                class="lang-option"
                :class="{ active: locale === l }"
                @click="onLocaleClick(l)"
              >
                {{ t(`lang.${l}`) }}
              </button>
            </li>
          </ul>
        </div>
        <RouterLink class="header-play" to="/playground">{{ t("nav.playground") }} <span aria-hidden="true">↗</span>
        </RouterLink>
      </div>
    </header>
    <RouterView/>
    <SiteFooter v-if="!hideChrome"/>
  </div>
</template>

<style>
:root {
  color-scheme: light;
  --font-display: "Inter Tight", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-body: "Noto Sans SC", "Inter Tight", "Microsoft YaHei", sans-serif;
  --ink: #24233a;
  --muted: #65647b;
  --paper: #fbfdff;
  --mist: #eaf4ff;
  --accent: #1677c8;
  font-family: var(--font-body);
  background: var(--paper);
  color: var(--ink);
}

body {
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.shell.bare {
  min-height: 100vh;
}


.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem max(1.35rem, calc((100% - 82rem) / 2));
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid #cfe3f1;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
}

.shell.home .top {
  position: absolute;
  inset: 0 0 auto;
  border-bottom-color: color-mix(in srgb, #24233a 12%, transparent);
  background: rgba(255, 255, 255, 0.96);
  color: var(--ink);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0;
}

.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  background: #55d6be;
  color: #17304a;
  font-size: 0.85rem;
  transform: rotate(-4deg);
}

.top-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem 1.25rem;
}

.top nav {
  display: flex;
  gap: 1.1rem;
}

.top nav a {
  position: relative;
  padding: 0.45rem 0.1rem;
  color: var(--muted);
  font-size: 0.92rem;
  transition: color 160ms ease;
}

.shell.home .top nav a {
  color: var(--muted);
}

.top nav a:hover,
.top nav a.router-link-active {
  color: var(--accent);
}

.shell.home .top nav a:hover,
.shell.home .top nav a.router-link-active {
  color: var(--accent);
}

.lang {
  position: relative;
}

.lang-toggle {
  appearance: none;
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease;
}

.lang-toggle:hover,
.lang-toggle[aria-expanded="true"] {
  color: var(--accent);
  border-color: var(--accent);
}

.lang-icon {
  display: block;
}

.lang-menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 30;
  margin: 0;
  padding: 0.25rem;
  min-width: 7.5rem;
  list-style: none;
  border: 1px solid #cfe3f1;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(37, 92, 128, 0.12);
}

.lang-option {
  appearance: none;
  display: block;
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.84rem;
  text-align: left;
  cursor: pointer;
}

.lang-option:hover {
  color: var(--ink);
  background: #eef6fc;
}

.lang-option.active {
  color: var(--accent);
  font-weight: 600;
}

.header-play {
  padding: 0.55rem 0.8rem;
  background: #1677c8;
  color: #ffffff;
  border: 1px solid #1677c8;
  box-shadow: 3px 3px 0 #b8b5f4;
  font-size: 0.82rem;
  font-weight: 600;
}

.header-play span {
  margin-left: 0.25rem;
}

.top nav a.router-link-active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: #b8b5f4;
}

code {
  font-family: ui-monospace, Consolas, monospace;
}

@media (max-width: 720px) {
  .top nav {
    display: none;
  }

  .header-play {
    display: none;
  }
}
</style>
