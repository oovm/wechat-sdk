<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "../i18n";
import {
    type CatalogModel,
    collectTagIds,
    displayNameFor,
    type ModelsCatalog,
    previewUrlFor,
    tagLabelFor,
} from "../lib/catalog";
import { useGalleryFavorites } from "../lib/favorites";

type Scope = "all" | "favorites" | "local" | "remote";
type SortKey = "name" | "id";

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const { isFavorite, toggleFavorite, favoriteIds } = useGalleryFavorites();

const catalog = ref<ModelsCatalog | null>(null);
const models = ref<CatalogModel[]>([]);
const loaded = ref(false);
const broken = ref<Record<string, boolean>>({});

const query = ref("");
const scope = ref<Scope>("all");
const selectedTags = ref<string[]>([]);
const sortKey = ref<SortKey>("name");

const scopes = computed(() => [
    { id: "all" as const, label: t("gallery.scopeAll") },
    { id: "favorites" as const, label: t("gallery.scopeFavorites") },
    { id: "local" as const, label: t("gallery.scopeLocal") },
    { id: "remote" as const, label: t("gallery.scopeRemote") },
]);

const allTags = computed(() => collectTagIds(models.value));

const tagOptions = computed(() =>
    allTags.value.map((id) => ({
        id,
        label: catalog.value
            ? tagLabelFor(catalog.value, id, locale.value)
            : id,
    })),
);

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    const tags = selectedTags.value;
    let list = models.value.map((p) => ({
        ...p,
        displayLabel: displayNameFor(p, locale.value),
        previewUrl: previewUrlFor(p),
        favorite: isFavorite(p.id),
        tagLabels: (p.tags ?? []).map((id) =>
            catalog.value
                ? tagLabelFor(catalog.value, id, locale.value)
                : id,
        ),
    }));

    if (scope.value === "favorites") {
        list = list.filter((p) => p.favorite);
    } else if (scope.value === "local") {
        list = list.filter((p) => p.local);
    } else if (scope.value === "remote") {
        list = list.filter((p) => !p.local);
    }

    if (tags.length) {
        list = list.filter((p) =>
            tags.every((tag) => (p.tags ?? []).includes(tag)),
        );
    }

    if (q) {
        list = list.filter((p) => {
            const hay = [
                p.displayLabel,
                p.id,
                ...(p.tags ?? []),
                ...p.tagLabels,
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }

    list.sort((a, b) => {
        if (sortKey.value === "id") return a.id.localeCompare(b.id);
        return a.displayLabel.localeCompare(b.displayLabel, locale.value);
    });
    return list;
});

const resultCount = computed(() => filtered.value.length);

function onImgError(id: string) {
    broken.value = { ...broken.value, [id]: true };
}

function openInPlayground(id: string) {
    void router.push({ path: "/playground", query: { preset: id } });
}

function toggleTag(id: string) {
    const set = new Set(selectedTags.value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    selectedTags.value = [...set];
}

function clearFilters() {
    query.value = "";
    scope.value = "all";
    selectedTags.value = [];
    sortKey.value = "name";
}

function parseScope(raw: unknown): Scope {
    if (raw === "favorites" || raw === "local" || raw === "remote") return raw;
    return "all";
}

function parseSort(raw: unknown): SortKey {
    return raw === "id" ? "id" : "name";
}

function syncFromRoute() {
    query.value = typeof route.query.q === "string" ? route.query.q : "";
    scope.value = parseScope(route.query.scope);
    sortKey.value = parseSort(route.query.sort);
    const tagRaw = route.query.tag;
    if (Array.isArray(tagRaw)) {
        selectedTags.value = tagRaw.filter(
            (x): x is string => typeof x === "string" && !!x,
        );
    } else if (typeof tagRaw === "string" && tagRaw) {
        selectedTags.value = tagRaw.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
        selectedTags.value = [];
    }
}

function pushRouteQuery() {
    const next: Record<string, string> = {};
    if (query.value.trim()) next.q = query.value.trim();
    if (scope.value !== "all") next.scope = scope.value;
    if (selectedTags.value.length) next.tag = selectedTags.value.join(",");
    if (sortKey.value !== "name") next.sort = sortKey.value;
    void router.replace({ query: next });
}

watch([query, scope, selectedTags, sortKey], pushRouteQuery, { deep: true });

// Re-filter when favorites change while on favorites scope.
watch(favoriteIds, () => {
    /* filtered is computed off isFavorite */
});

onMounted(async () => {
    syncFromRoute();
    try {
        const res = await fetch("/models/catalog.json");
        if (res.ok) {
            const data = (await res.json()) as ModelsCatalog;
            catalog.value = data;
            models.value = data.models ?? [];
        }
    } catch {
        models.value = [];
    } finally {
        loaded.value = true;
    }
});
</script>

<template>
  <main class="gallery">
    <header class="hero">
      <p class="kicker">{{ t("gallery.kicker") }}</p>
      <h1>{{ t("gallery.title") }}</h1>
      <p class="lede">{{ t("gallery.lede") }}</p>
    </header>

    <section class="filters" :aria-label="t('gallery.filtersAria')">
      <label class="search">
        <span class="sr-only">{{ t("gallery.search") }}</span>
        <input
          v-model="query"
          type="search"
          :placeholder="t('gallery.searchPlaceholder')"
          autocomplete="off"
        />
      </label>

      <div class="row">
        <div class="scopes" role="tablist" :aria-label="t('gallery.scopeAria')">
          <button
            v-for="s in scopes"
            :key="s.id"
            type="button"
            role="tab"
            class="scope"
            :class="{ active: scope === s.id }"
            :aria-selected="scope === s.id"
            @click="scope = s.id"
          >
            {{ s.label }}
            <span v-if="s.id === 'favorites'" class="count">{{ favoriteIds.length }}</span>
          </button>
        </div>

        <label class="sort">
          <span>{{ t("gallery.sort") }}</span>
          <select v-model="sortKey">
            <option value="name">{{ t("gallery.sortName") }}</option>
            <option value="id">{{ t("gallery.sortId") }}</option>
          </select>
        </label>
      </div>

      <div v-if="tagOptions.length" class="tags" :aria-label="t('gallery.tagsAria')">
        <button
          v-for="tag in tagOptions"
          :key="tag.id"
          type="button"
          class="tag"
          :class="{ active: selectedTags.includes(tag.id) }"
          :aria-pressed="selectedTags.includes(tag.id)"
          @click="toggleTag(tag.id)"
        >
          {{ tag.label }}
        </button>
      </div>

      <div class="meta-row">
        <p class="count-line">{{ t("gallery.results", { count: resultCount }) }}</p>
        <button
          v-if="query || scope !== 'all' || selectedTags.length || sortKey !== 'name'"
          type="button"
          class="clear"
          @click="clearFilters"
        >
          {{ t("gallery.clearFilters") }}
        </button>
      </div>
    </section>

    <p v-if="!loaded" class="hint">{{ t("gallery.loading") }}</p>
    <p v-else-if="!models.length" class="hint">{{ t("gallery.empty") }}</p>
    <p v-else-if="!filtered.length" class="hint">{{ t("gallery.noMatches") }}</p>

    <ul v-else class="grid" role="list">
      <li v-for="item in filtered" :key="item.id" class="card">
        <div class="thumb-wrap">
          <button
            type="button"
            class="thumb"
            :aria-label="t('gallery.open', { name: item.displayLabel })"
            @click="openInPlayground(item.id)"
          >
            <img
              v-if="!broken[item.id]"
              :src="item.previewUrl"
              :alt="item.displayLabel"
              width="512"
              height="512"
              loading="lazy"
              @error="onImgError(item.id)"
            />
            <div v-else class="fallback" aria-hidden="true">
              <span>{{ item.displayLabel.slice(0, 1) }}</span>
            </div>
            <span v-if="!item.local" class="badge">CDN</span>
            <span v-else class="badge local">local</span>
          </button>
          <button
            type="button"
            class="fav"
            :class="{ on: item.favorite }"
            :aria-label="
              item.favorite
                ? t('gallery.unfavorite', { name: item.displayLabel })
                : t('gallery.favorite', { name: item.displayLabel })
            "
            :aria-pressed="item.favorite"
            @click.stop="toggleFavorite(item.id)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 17.3 6.2 20.5l1.5-6.4L2.9 9.7l6.5-.5L12 3.2l2.6 6 6.5.5-4.8 4.4 1.5 6.4Z"
                :fill="item.favorite ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
        <div class="meta">
          <h2>{{ item.displayLabel }}</h2>
          <p class="id">{{ item.id }}</p>
          <ul v-if="item.tagLabels.length" class="card-tags">
            <li v-for="(label, i) in item.tagLabels" :key="item.tags![i]!">
              <button type="button" @click="toggleTag(item.tags![i]!)">{{ label }}</button>
            </li>
          </ul>
          <div class="actions">
            <RouterLink
              class="link"
              :to="{ path: '/playground', query: { preset: item.id } }"
            >
              {{ t("gallery.tryPlayground") }}
            </RouterLink>
            <RouterLink
              class="link muted"
              :to="{ path: '/stage', query: { add: item.id, n: '1' } }"
            >
              {{ t("gallery.openStage") }}
            </RouterLink>
          </div>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.gallery {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3.5rem;
}

.hero {
  margin-bottom: 1.5rem;
  max-width: 36rem;
}

.kicker {
  margin: 0 0 0.55rem;
  color: #377ba8;
  font: 650 0.72rem/1 var(--font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.55rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.lede {
  margin: 0.75rem 0 0;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.55;
}

.filters {
  display: grid;
  gap: 0.85rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
}

.search input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: #fff;
  color: var(--ink);
  font: 500 0.95rem/1.3 var(--font-body);
}

.search input:focus {
  outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
  outline-offset: 1px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  justify-content: space-between;
}

.scopes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.85rem;
}

.scope {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0.2rem 0;
  color: var(--muted);
  font: 650 0.82rem/1.2 var(--font-display);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.scope.active {
  color: var(--ink);
  border-bottom-color: var(--accent);
}

.scope .count {
  margin-left: 0.25rem;
  color: #377ba8;
  font-weight: 600;
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--muted);
  font: 600 0.78rem/1 var(--font-display);
}

.sort select {
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: #fff;
  color: var(--ink);
  padding: 0.3rem 0.45rem;
  font: 500 0.82rem/1.2 var(--font-body);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: #fff;
  color: var(--muted);
  padding: 0.28rem 0.55rem;
  font: 600 0.72rem/1 var(--font-display);
  cursor: pointer;
}

.tag.active {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  color: var(--accent);
  background: color-mix(in srgb, var(--mist) 80%, #fff);
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.count-line {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.clear {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: 600 0.82rem/1 var(--font-display);
  cursor: pointer;
  padding: 0;
}

.hint {
  color: var(--muted);
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
  gap: 1.25rem;
}

.card {
  display: grid;
  gap: 0.7rem;
}

.thumb-wrap {
  position: relative;
}

.thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  background:
    radial-gradient(120% 80% at 20% 0%, #dff2ff 0%, transparent 55%),
    linear-gradient(165deg, #f4fbff, #e7f3ff);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 160ms ease, transform 180ms ease;
}

.thumb:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  transform: translateY(-2px);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #377ba8;
  font: 700 2.5rem/1 var(--font-display);
  background: linear-gradient(145deg, #eaf7ff, #d9ecff);
}

.badge {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  padding: 0.2rem 0.4rem;
  background: color-mix(in srgb, #17304a 82%, transparent);
  color: #eaf7ff;
  font: 650 0.65rem/1 var(--font-display);
  letter-spacing: 0.04em;
}

.badge.local {
  background: color-mix(in srgb, #247a69 88%, transparent);
}

.fav {
  position: absolute;
  left: 0.45rem;
  top: 0.45rem;
  z-index: 2;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: color-mix(in srgb, #fff 88%, transparent);
  color: #8a889c;
  cursor: pointer;
}

.fav.on {
  color: #d4a017;
}

.meta h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.id {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font: 500 0.72rem/1.3 ui-monospace, monospace;
}

.card-tags {
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.card-tags button {
  appearance: none;
  border: 0;
  background: transparent;
  color: #377ba8;
  font: 600 0.7rem/1 var(--font-display);
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.actions {
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
}

.link {
  color: var(--accent);
  font: 600 0.85rem/1 var(--font-display);
  text-decoration: none;
}

.link.muted {
  color: #377ba8;
}

.link:hover {
  text-decoration: underline;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
