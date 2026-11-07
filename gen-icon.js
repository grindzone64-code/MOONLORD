// gen-icon.js — generates build/icon.ico (+ icon.png) with zero external deps.
// Draws the SHRAVAN roundel + M-stripe on a dark rounded tile, encodes PNG via
// Node's built-in zlib, and packs a multi-resolution Windows ICO.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MASTER = 1024;              // hi-res master, downscaled for anti-aliasing
const SIZES = [256, 128, 64, 32, 16]; // all divide 1024 cleanly

// ---- CRC32 (for PNG chunks) ----
const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---- minimal PNG encoder (RGBA, filter 0) ----
function pngChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(rgba, w, h) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    let p = 0;
    for (let y = 0; y < h; y++) { raw[p++] = 0; rgba.copy(raw, p, y * w * 4, (y + 1) * w * 4); p += w * 4; }
    const idat = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---- ICO container ----
function buildICO(images) {
    const count = images.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
    const entries = Buffer.alloc(16 * count);
    let offset = 6 + 16 * count;
    images.forEach((img, i) => {
        const e = i * 16;
        entries[e] = img.size >= 256 ? 0 : img.size;
        entries[e + 1] = img.size >= 256 ? 0 : img.size;
        entries.writeUInt16LE(1, e + 4);   // planes
        entries.writeUInt16LE(32, e + 6);  // bpp
        entries.writeUInt32LE(img.png.length, e + 8);
        entries.writeUInt32LE(offset, e + 12);
        offset += img.png.length;
    });
    return Buffer.concat([header, entries, ...images.map(i => i.png)]);
}

// ---- the artwork (normalized 256 space) ----
function sample(nx, ny) {
    const R = 54, W = 256, H = 256;
    const dxr = Math.max(R - nx, nx - (W - R), 0);
    const dyr = Math.max(R - ny, ny - (H - R), 0);
    if (dxr * dxr + dyr * dyr > R * R) return [0, 0, 0, 0]; // rounded-corner cutout

    // dark vertical gradient background
    const t = ny / H;
    let r = Math.round(18 + (7 - 18) * t);
    let g = Math.round(21 + (8 - 21) * t);
    let b = Math.round(26 + (10 - 26) * t);

    // roundel emblem
    const cx = 128, cy = 110, rr = 66;
    const d = Math.hypot(nx - cx, ny - cy);
    if (d <= rr) {
        const blueQuad = ((nx >= cx) !== (ny >= cy));
        if (d > rr - 6) { r = 222; g = 228; b = 234; }         // white ring
        else if (d < 15) { r = 64; g = 150; b = 224; }          // hub
        else if (blueQuad) { r = 46; g = 143; b = 224; }        // blue quarters
        else { r = 13; g = 21; b = 36; }                        // dark quarters
    }

    // M-stripe bar under the roundel
    const sy0 = 196, sy1 = 210, sx0 = 74, sx1 = 182;
    if (ny >= sy0 && ny <= sy1 && nx >= sx0 && nx <= sx1) {
        const seg = (nx - sx0) / ((sx1 - sx0) / 3);
        if (seg < 1) { r = 60; g = 155; b = 224; }
        else if (seg < 2) { r = 27; g = 79; b = 160; }
        else { r = 231; g = 34; b = 46; }
    }

    return [r, g, b, 255];
}

// render master
const master = Buffer.alloc(MASTER * MASTER * 4);
const f = MASTER / 256;
for (let my = 0; my < MASTER; my++) {
    for (let mx = 0; mx < MASTER; mx++) {
        const [r, g, b, a] = sample((mx + 0.5) / f, (my + 0.5) / f);
        const i = (my * MASTER + mx) * 4;
        master[i] = r; master[i + 1] = g; master[i + 2] = b; master[i + 3] = a;
    }
}

// premultiplied area downscale
function downscale(T) {
    const block = MASTER / T;
    const out = Buffer.alloc(T * T * 4);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let R = 0, G = 0, B = 0, A = 0, n = 0;
        for (let by = 0; by < block; by++) for (let bx = 0; bx < block; bx++) {
            const idx = ((y * block + by) * MASTER + (x * block + bx)) * 4;
            const a = master[idx + 3];
            R += master[idx] * a; G += master[idx + 1] * a; B += master[idx + 2] * a; A += a; n++;
        }
        const o = (y * T + x) * 4;
        if (A === 0) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; }
        else { out[o] = Math.round(R / A); out[o + 1] = Math.round(G / A); out[o + 2] = Math.round(B / A); out[o + 3] = Math.round(A / n); }
    }
    return out;
}

const buildDir = path.join(__dirname, 'build');
fs.mkdirSync(buildDir, { recursive: true });

const images = SIZES.map(size => ({ size, png: encodePNG(downscale(size), size, size) }));
fs.writeFileSync(path.join(buildDir, 'icon.ico'), buildICO(images));
fs.writeFileSync(path.join(buildDir, 'icon.png'), images[0].png); // 256 for mac/linux/dev window

console.log('Wrote build/icon.ico (' + SIZES.join(', ') + ') and build/icon.png');
