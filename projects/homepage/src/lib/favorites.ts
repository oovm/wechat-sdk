import { computed, ref, watch } from "vue";

const STORAGE_KEY = "live2d.ts.gallery.favorites";

function readIds(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x): x is string => typeof x === "string" && !!x);
    } catch {
        return [];
    }
}

function writeIds(ids: readonly string[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
        // private mode / quota
    }
}

const favoriteIds = ref<string[]>(readIds());

watch(
    favoriteIds,
    (ids) => {
        writeIds(ids);
    },
    { deep: true },
);

export function useGalleryFavorites() {
    const set = computed(() => new Set(favoriteIds.value));

    function isFavorite(id: string): boolean {
        return set.value.has(id);
    }

    function toggleFavorite(id: string): void {
        if (!id) return;
        const next = new Set(favoriteIds.value);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        favoriteIds.value = [...next];
    }

    function clearFavorites(): void {
        favoriteIds.value = [];
    }

    return {
        favoriteIds,
        isFavorite,
        toggleFavorite,
        clearFavorites,
    };
}
