import { COCOS_CREATOR_API } from "./api.js";

/**
 * Creator 2.4 entry — scaffold only.
 *
 * Same package / property surface as creator3 so you can verify both hosts
 * resolve `cocos-plugin-live2d/creator2`. Runtime bridge lands later.
 */

export { COCOS_CREATOR_API };

const { ccclass, property } = cc._decorator;

@ccclass("Live2D")
export class Live2D extends cc.Component {
    @property
    model = "";

    @property
    width = 320;

    @property
    height = 320;

    /** Comma-separated prefer list in the editor; parsed at runtime later. */
    @property
    prefer = "canvas2d,webgl2,webgpu";

    @property
    autoplay = true;

    @property
    autoSway = true;

    onLoad(): void {
        if (!this.getComponent(cc.Sprite)) {
            this.addComponent(cc.Sprite);
        }
        this.node.setContentSize(this.width, this.height);
    }

    start(): void {
        console.warn(
            "[cocos-plugin-live2d/creator2] scaffold only — Live2D runtime not wired yet. API=",
            COCOS_CREATOR_API,
        );
    }

    update(_dt: number): void {
        // runtime later
    }

    onDestroy(): void {
        // runtime later
    }
}
