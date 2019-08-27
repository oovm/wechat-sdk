/**
 * moc2 binary stream reader (7-bit varints, big-endian ints/floats).
 * Clean-room layout from observed `.moc` bytes + public format notes — no Core code.
 */

export const MOC2_REF_TYPE = 33;
export const MOC2_EOF_MARKER = -30584;

export class Moc2Reader {
    private readonly view: DataView;
    private offset = 0;
    /** Bit cursor within the current bit-pack byte (0 = aligned). */
    private bitPos = 0;
    private bitByte = 0;
    private formatVersion = 0;
    /** Object table for type-33 back-references (push order = identity). */
    readonly objects: unknown[] = [];

    constructor(bytes: ArrayBuffer) {
        this.view = new DataView(bytes);
    }

    get byteLength(): number {
        return this.view.byteLength;
    }

    getFormatVersion(): number {
        return this.formatVersion;
    }

    /** Read magic `"moc"` + version; set format version. */
    readHeader(): number {
        const m = this.readInt8();
        const o = this.readInt8();
        const c = this.readInt8();
        if (m !== 0x6d || o !== 0x6f || c !== 0x63) {
            throw new Error(
                `@doki-land/live2d-renderer: expected moc2 magic "moc", got ${JSON.stringify(
                    String.fromCharCode(m & 0xff, o & 0xff, c & 0xff),
                )}`,
            );
        }
        const version = this.readInt8() & 0xff;
        this.formatVersion = version;
        return version;
    }

    /** Version ≥ 8 ends with two int16 EOF markers. */
    readEofGuard(): void {
        if (this.formatVersion < 8) return;
        const a = this.readInt16();
        const b = this.readInt16();
        if (a !== MOC2_EOF_MARKER || b !== MOC2_EOF_MARKER) {
            throw new Error(
                `@doki-land/live2d-renderer: moc2 EOF marker mismatch (${a}, ${b})`,
            );
        }
    }

    alignBits(): void {
        this.bitPos = 0;
    }

    readVarint(): number {
        this.alignBits();
        const b0 = this.readInt8();
        if ((b0 & 0x80) === 0) return b0 & 0xff;
        const b1 = this.readInt8();
        if ((b1 & 0x80) === 0) {
            return ((b0 & 0x7f) << 7) | (b1 & 0x7f);
        }
        const b2 = this.readInt8();
        if ((b2 & 0x80) === 0) {
            return ((b0 & 0x7f) << 14) | ((b1 & 0x7f) << 7) | (b2 & 0xff);
        }
        const b3 = this.readInt8();
        if ((b3 & 0x80) === 0) {
            return (
                ((b0 & 0x7f) << 21) |
                ((b1 & 0x7f) << 14) |
                ((b2 & 0x7f) << 7) |
                (b3 & 0xff)
            );
        }
        throw new Error(
            "@doki-land/live2d-renderer: moc2 varint overflow (>28 bits)",
        );
    }

    readBit(): boolean {
        if (this.bitPos === 0 || this.bitPos === 8) {
            this.bitByte = this.readInt8() & 0xff;
            this.bitPos = 0;
        }
        const bit = ((this.bitByte >> (7 - this.bitPos)) & 1) === 1;
        this.bitPos++;
        return bit;
    }

    readInt8(): number {
        this.alignBits();
        if (this.offset >= this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (int8)",
            );
        }
        return this.view.getInt8(this.offset++);
    }

    readInt16(): number {
        this.alignBits();
        if (this.offset + 2 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (int16)",
            );
        }
        const v = this.view.getInt16(this.offset); // BE
        this.offset += 2;
        return v;
    }

    readInt32(): number {
        this.alignBits();
        if (this.offset + 4 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (int32)",
            );
        }
        const v = this.view.getInt32(this.offset); // BE
        this.offset += 4;
        return v;
    }

    readFloat32(): number {
        this.alignBits();
        if (this.offset + 4 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (float32)",
            );
        }
        const v = this.view.getFloat32(this.offset); // BE
        this.offset += 4;
        return v;
    }

    readFloat64(): number {
        this.alignBits();
        if (this.offset + 8 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (float64)",
            );
        }
        const v = this.view.getFloat64(this.offset); // BE
        this.offset += 8;
        return v;
    }

    readBool(): boolean {
        return this.readInt8() !== 0;
    }

    /** Latin-1 / byte string (moc2 IDs are ASCII). */
    readString(): string {
        const len = this.readVarint();
        if (this.offset + len > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (string)",
            );
        }
        const chars: number[] = [];
        for (let i = 0; i < len; i++) {
            chars.push(this.view.getUint8(this.offset++));
        }
        return String.fromCharCode(...chars);
    }

    readInt32Array(): Int32Array {
        this.alignBits();
        const len = this.readVarint();
        if (this.offset + len * 4 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (int32[])",
            );
        }
        const out = new Int32Array(len);
        for (let i = 0; i < len; i++) {
            out[i] = this.view.getInt32(this.offset); // BE
            this.offset += 4;
        }
        return out;
    }

    readFloat32Array(): Float32Array {
        this.alignBits();
        const len = this.readVarint();
        if (this.offset + len * 4 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (float32[])",
            );
        }
        const out = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            out[i] = this.view.getFloat32(this.offset); // BE
            this.offset += 4;
        }
        return out;
    }

    readFloat64Array(): Float64Array {
        this.alignBits();
        const len = this.readVarint();
        if (this.offset + len * 8 > this.view.byteLength) {
            throw new Error(
                "@doki-land/live2d-renderer: moc2 truncated (float64[])",
            );
        }
        const out = new Float64Array(len);
        for (let i = 0; i < len; i++) {
            out[i] = this.view.getFloat64(this.offset); // BE
            this.offset += 8;
        }
        return out;
    }
}
