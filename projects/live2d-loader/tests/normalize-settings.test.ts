import { describe, expect, it } from "vitest";
import { normalizeModelSettings } from "../src/pipeline.js";

describe("normalizeModelSettings", () => {
    it("normalizes moc3 model3.json", () => {
        const json = {
            Version: 3,
            Name: "Wanko",
            FileReferences: {
                Moc: "Wanko.moc3",
                Textures: ["tex_00.png"],
                Motions: {
                    Idle: [
                        { File: "motions/idle.motion3.json", FadeInTime: 0.5 },
                    ],
                },
                Expressions: [{ Name: "smile", File: "exp/smile.exp3.json" }],
            },
            HitAreas: [{ Name: "Body", Id: "HitArea" }],
        };
        const settings = normalizeModelSettings(
            json,
            "https://ex.test/Wanko.model3.json",
        );
        expect(settings.format).toBe("moc3");
        expect(settings.moc).toBe("Wanko.moc3");
        expect(settings.textures).toEqual(["tex_00.png"]);
        expect(settings.name).toBe("Wanko");
        expect(settings.motionGroups.Idle?.[0]?.file).toBe(
            "motions/idle.motion3.json",
        );
        expect(settings.motionGroups.Idle?.[0]?.fadeInTime).toBe(0.5);
        expect(settings.expressions[0]?.name).toBe("smile");
        expect(settings.hitAreas[0]?.name).toBe("Body");
    });

    it("normalizes moc2 model.json", () => {
        const json = {
            model: "hijiki.moc",
            textures: ["hijiki.2048/texture_00.png"],
        };
        const settings = normalizeModelSettings(
            json,
            "https://ex.test/hijiki.model.json",
        );
        expect(settings.format).toBe("moc2");
        expect(settings.moc).toBe("hijiki.moc");
        expect(settings.textures).toEqual(["hijiki.2048/texture_00.png"]);
        expect(settings.motionGroups).toEqual({});
    });
});
