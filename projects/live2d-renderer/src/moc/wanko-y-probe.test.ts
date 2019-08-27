import { describe, expect, it } from "vitest";
import { decodeMoc3 } from "./decode.js";
import { parseMoc3Document } from "./moc3-reader.js";
import { tryReadFixture, WANKO_MOC3_CANDIDATES } from "./test-fixtures.js";

const wankoBytes = tryReadFixture(...WANKO_MOC3_CANDIDATES);

describe.skipIf(!wankoBytes)("wanko canvas/y", () => {
    it("prints", async () => {
        const buf = wankoBytes!.slice(0);
        const doc = parseMoc3Document(buf);
        console.log("canvas", doc.canvas);
        const { program } = await decodeMoc3(buf.slice(0));
        let minY = 1e9,
            maxY = -1e9,
            minX = 1e9,
            maxX = -1e9;
        for (const d of program.drawables) {
            for (let i = 0; i < d.positions.length; i += 2) {
                minX = Math.min(minX, d.positions[i]!);
                maxX = Math.max(maxX, d.positions[i]!);
                minY = Math.min(minY, d.positions[i + 1]!);
                maxY = Math.max(maxY, d.positions[i + 1]!);
            }
        }
        console.log({ minX, maxX, minY, maxY, cy: (minY + maxY) / 2 });
        expect(doc.canvas.pixelsPerUnit).toBeGreaterThan(0);
    });
});
