import { describe, expect, it, vi } from "vitest";
import { readCanvasRgba } from "../../src/creator3/canvas-bridge.js";

function mockCanvas2d(
    width: number,
    height: number,
    rgba: [number, number, number, number],
): HTMLCanvasElement {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = rgba[0]!;
        data[i + 1] = rgba[1]!;
        data[i + 2] = rgba[2]!;
        data[i + 3] = rgba[3]!;
    }
    return {
        width,
        height,
        getContext: vi.fn((type: string) => {
            if (type !== "2d") return null;
            return {
                getImageData: () => ({ data, width, height }),
                clearRect: vi.fn(),
                drawImage: vi.fn(),
            };
        }),
    } as unknown as HTMLCanvasElement;
}

describe("readCanvasRgba", () => {
    it("returns null for empty size", () => {
        const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(),
        } as unknown as HTMLCanvasElement;
        expect(readCanvasRgba(canvas)).toBeNull();
    });

    it("reads pixels from a 2d canvas", () => {
        const canvas = mockCanvas2d(2, 2, [255, 0, 0, 255]);
        const pixels = readCanvasRgba(canvas);
        expect(pixels).not.toBeNull();
        expect(pixels!.width).toBe(2);
        expect(pixels!.height).toBe(2);
        expect(pixels!.data.length).toBe(2 * 2 * 4);
        expect(pixels!.data[0]).toBe(255);
        expect(pixels!.data[1]).toBe(0);
        expect(pixels!.data[2]).toBe(0);
    });

    it("blits through scratch when source 2d getImageData fails", () => {
        const scratchData = new Uint8ClampedArray(2 * 1 * 4);
        scratchData[1] = 255;
        scratchData[3] = 255;
        scratchData[5] = 255;
        scratchData[7] = 255;

        const source = {
            width: 2,
            height: 1,
            getContext: vi.fn(() => null),
        } as unknown as HTMLCanvasElement;

        const scratch = {
            width: 0,
            height: 0,
            getContext: vi.fn((type: string) => {
                if (type !== "2d") return null;
                return {
                    clearRect: vi.fn(),
                    drawImage: vi.fn(),
                    getImageData: () => ({
                        data: scratchData,
                        width: 2,
                        height: 1,
                    }),
                };
            }),
        } as unknown as HTMLCanvasElement;

        const pixels = readCanvasRgba(source, scratch);
        expect(pixels).not.toBeNull();
        expect(scratch.width).toBe(2);
        expect(scratch.height).toBe(1);
        expect(pixels!.data[1]).toBe(255);
    });
});
