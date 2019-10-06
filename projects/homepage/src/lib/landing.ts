/**
 * Structural landing config (locale-neutral).
 */
export const landingBrand = "live2d.ts";

export const landingHero = {
    model: "/models/samples/moc3-wanko/Wanko.model3.json",
    width: 500,
    height: 560,
} as const;

export const landingGithub = "https://github.com/doki-land/live2d.ts";

export function docsHomePath(localeId = "zh-hans"): string {
    return localeId === "en-us" ? "/d/en-us/" : "/d/zh-hans/";
}
