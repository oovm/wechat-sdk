import { describe, expect, it } from "vitest";
import { COCOS_CREATOR_API as api2 } from "./creator2/api.js";
import { COCOS_CREATOR_API as api3 } from "./creator3/api.js";

describe("dual entry scaffold", () => {
    it("creator3 API discriminator is 3", () => {
        expect(api3).toBe(3);
    });

    it("creator2 API discriminator is 2", () => {
        expect(api2).toBe(2);
    });
});
