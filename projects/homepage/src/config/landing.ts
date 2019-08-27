/**
 * Structural landing config (locale-neutral). Copy lives in src/i18n/messages.
 */

export interface LandingHero {
    readonly model: string;
    readonly width: number;
    readonly height: number;
}

export const landingBrand = "live2d.ts";

export const landingHero: LandingHero = {
    model: "/models/samples/moc3-wanko/Wanko.model3.json",
    width: 500,
    height: 560,
};

export const landingStackPackages = [
    { id: "facade" as const, name: "@doki-land/live2d" },
    { id: "renderer" as const, name: "@doki-land/live2d-renderer" },
    { id: "vue" as const, name: "vue-plugin-live2d" },
    { id: "hexo" as const, name: "hexo-plugin-live2d" },
];

export const landingGithub = "https://github.com/doki-land/live2d.ts";
export const landingIssues = "https://github.com/doki-land/live2d.ts/issues";
