import { describe, expect, it } from "vitest";
import {
    detectMocBinaryFormat,
    detectModelSettingsFormat,
} from "../src/format/detect-format.js";

describe("detectModelSettingsFormat", () => {
    it("detects moc3 from FileReferences.Moc", () => {
        expect(
            detectModelSettingsFormat({
                FileReferences: { Moc: "Wanko.moc3", Textures: [] },
            }),
        ).toBe("moc3");
    });

    it("detects moc3 from FileReferences without extension", () => {
        expect(
            detectModelSettingsFormat({
                FileReferences: { Moc: "model", Textures: [] },
            }),
        ).toBe("moc3");
    });

    it("detects moc2 from model + textures", () => {
        expect(
            detectModelSettingsFormat({
                model: "hijiki.moc",
                textures: ["tex.png"],
            }),
        ).toBe("moc2");
    });

    it("returns null for unknown", () => {
        expect(detectModelSettingsFormat({})).toBeNull();
        expect(detectModelSettingsFormat(null)).toBeNull();
    });
});

describe("detectMocBinaryFormat", () => {
    it("peeks MOC3 magic", () => {
        const bytes = new Uint8Array([0x4d, 0x4f, 0x43, 0x33]).buffer;
        expect(detectMocBinaryFormat(bytes)).toBe("moc3");
    });

    it("peeks moc magic", () => {
        const bytes = new Uint8Array([0x6d, 0x6f, 0x63, 0x00]).buffer;
        expect(detectMocBinaryFormat(bytes)).toBe("moc2");
    });
});
