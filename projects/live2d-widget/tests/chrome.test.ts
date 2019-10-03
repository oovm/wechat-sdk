import { describe, expect, it, vi } from "vitest";
import {
    createTipMessage,
    DEFAULT_WELCOME,
    ensureChromeStyles,
} from "../src/chrome/chrome.js";

describe("widget chrome message", () => {
    it("injects stylesheet once", () => {
        document.head.innerHTML = "";
        ensureChromeStyles();
        ensureChromeStyles();
        expect(
            document.querySelectorAll("#doki-live2d-widget-chrome-style")
                .length,
        ).toBe(1);
    });

    it("shows and clears tip text with priority", () => {
        vi.useFakeTimers();
        const root = document.createElement("div");
        document.body.appendChild(root);
        const tips = createTipMessage(root);
        tips.show("low", 1000, 1);
        expect(
            root.querySelector(".doki-live2d-chrome__tips")?.textContent,
        ).toBe("low");
        tips.show("high", 1000, 5);
        expect(
            root.querySelector(".doki-live2d-chrome__tips")?.textContent,
        ).toBe("high");
        tips.show("ignored", 1000, 2);
        expect(
            root.querySelector(".doki-live2d-chrome__tips")?.textContent,
        ).toBe("high");
        vi.advanceTimersByTime(1000);
        expect(
            root
                .querySelector(".doki-live2d-chrome__tips")
                ?.classList.contains("is-active"),
        ).toBe(false);
        tips.destroy();
        expect(DEFAULT_WELCOME.length).toBeGreaterThan(0);
        vi.useRealTimers();
    });
});
