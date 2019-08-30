/**
 * Minimal Cocos Creator 3.x ambient types for typechecking this adaptor
 * without vendoring the full engine. Creator projects use the real `cc`.
 */

declare module "cc" {
    export type Constructor<T = unknown> = new (...args: never[]) => T;

    export class Vec2 {
        x: number;
        y: number;
        constructor(x?: number, y?: number);
        set(x: number, y: number): this;
    }

    export class Vec3 {
        x: number;
        y: number;
        z: number;
        constructor(x?: number, y?: number, z?: number);
        set(x: number, y: number, z?: number): this;
    }

    export class Size {
        width: number;
        height: number;
        constructor(width?: number, height?: number);
    }

    export class Node {
        static EventType: {
            TOUCH_START: string;
            TOUCH_MOVE: string;
            TOUCH_END: string;
            TOUCH_CANCEL: string;
        };
        name: string;
        on(
            type: string,
            callback: (...args: never[]) => void,
            target?: unknown,
        ): void;
        off(
            type: string,
            callback: (...args: never[]) => void,
            target?: unknown,
        ): void;
        getComponent<T>(type: Constructor<T>): T | null;
        addComponent<T>(type: Constructor<T>): T;
    }

    export class Component {
        node: Node;
        enabled: boolean;
        getComponent<T>(type: Constructor<T>): T | null;
        addComponent<T>(type: Constructor<T>): T;
        scheduleOnce(callback: () => void, delay?: number): void;
    }

    export class UITransform extends Component {
        contentSize: Size;
        setContentSize(width: number, height: number): void;
        convertToNodeSpaceAR(worldPoint: Vec3, out?: Vec3): Vec3;
    }

    export class ImageAsset {
        constructor(data?: HTMLCanvasElement | HTMLImageElement | ImageBitmap);
        reset(data: HTMLCanvasElement | HTMLImageElement | ImageBitmap): void;
    }

    export enum PixelFormat {
        RGBA8888 = 35,
    }

    export class Texture2D {
        reset(info: {
            width: number;
            height: number;
            format?: PixelFormat;
        }): void;
        uploadData(
            source:
                | HTMLCanvasElement
                | HTMLImageElement
                | ArrayBufferView
                | ImageBitmap,
            level?: number,
            arrayIndex?: number,
        ): void;
        destroy(): void;
        image: ImageAsset | null;
    }

    export class SpriteFrame {
        texture: Texture2D | null;
        constructor();
    }

    export class Sprite extends Component {
        spriteFrame: SpriteFrame | null;
    }

    export class EventTouch {
        getUILocation(out?: Vec2): Vec2;
    }

    export const _decorator: {
        ccclass: (name?: string) => ClassDecorator;
        property: ((options?: Record<string, unknown>) => PropertyDecorator) &
            PropertyDecorator;
    };
}
