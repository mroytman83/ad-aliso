import { getLootAnimLines, getLootAnimMeta } from './lootAnimations.js';

/** Minimum canvas width (matches map/battle feel). */
export const LOOT_MIN_COLS = 80;
export const LOOT_MAX_COLS = 120;
/** Max content rows before uniform downscale (padding + hint added separately). */
export const LOOT_MAX_CONTENT_ROWS = 52;
const LOOT_PAD_TOP_ROWS = 0;
const LOOT_GAP_BEFORE_HINT_ROWS = 1;
export const LOOT_ANIM_FRAME_COUNT = 16;

/** Only shimmer fill textures — keep # | [ ] intact for readable silhouettes. */
const SHIMMER_MAP = {
    '.': '·',
    '%': '*',
};

const SHIMMER_REVERSE = Object.fromEntries(
    Object.entries(SHIMMER_MAP).map(([k, v]) => [v, k]),
);

const PREPARED_CACHE_VER = 6;

/** @type {Map<string, { baseGrid: string[][], layout: { artTop: number, artRows: number, hintRow: number, cols: number, rows: number } }>} */
const preparedCache = new Map();

/**
 * @param {string[]} lines
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
 */
export function normalizeArtBounds(lines) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;

    lines.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
            if (line[x] !== ' ') {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    });

    if (maxX < 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1 };
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
    };
}

/**
 * @param {string[]} lines
 */
export function dropOrphanLines(lines) {
    const lefts = [];
    lines.forEach((line) => {
        let left = -1;
        for (let x = 0; x < line.length; x++) {
            if (line[x] !== ' ') {
                left = x;
                break;
            }
        }
        if (left >= 0) lefts.push(left);
    });

    if (lefts.length < 2) return lines;

    lefts.sort((a, b) => a - b);
    const bodyLeft = lefts[Math.floor(lefts.length * 0.2)];
    const margin = 8;

    return lines.filter((line) => {
        let left = -1;
        for (let x = 0; x < line.length; x++) {
            if (line[x] !== ' ') {
                left = x;
                break;
            }
        }
        if (left < 0) return false;
        return left >= bodyLeft - margin;
    });
}

/**
 * @param {string[]} lines
 * @param {{ skipOrphanDrop?: boolean }} [opts]
 */
export function extractArt(lines, opts = {}) {
    const trimmed = opts.skipOrphanDrop ? lines : dropOrphanLines(lines);
    const bounds = normalizeArtBounds(trimmed);
    const out = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        out.push(trimmed[y].slice(bounds.minX, bounds.maxX + 1));
    }
    return out;
}

/**
 * @param {string[]} art
 * @param {number} targetW
 * @param {number} targetH
 */
export function scaleArt(art, targetW, targetH) {
    const srcH = art.length;
    const srcW = srcH ? Math.max(...art.map((l) => l.length)) : 0;
    if (srcH === 0 || srcW === 0) return [];

    const outH = Math.max(1, targetH);
    const outW = Math.max(1, targetW);
    const scaled = [];

    for (let y = 0; y < outH; y++) {
        const sy = Math.min(srcH - 1, Math.floor((y * srcH) / outH));
        const srcLine = art[sy] ?? '';
        let line = '';
        for (let x = 0; x < outW; x++) {
            const sx = Math.min(srcW - 1, Math.floor((x * srcW) / outW));
            line += srcLine[sx] ?? ' ';
        }
        scaled.push(line);
    }

    return scaled;
}

/**
 * Prefer 1:1 art; only downscale when larger than max bounds.
 * @param {string[]} art
 * @param {number} maxW
 * @param {number} maxH
 */
export function fitArtToBounds(art, maxW, maxH) {
    const rawH = art.length;
    const rawW = rawH ? Math.max(...art.map((l) => l.length)) : 0;
    if (rawH === 0 || rawW === 0) return { art: [], scale: 1 };

    if (rawW <= maxW && rawH <= maxH) {
        return { art, scale: 1 };
    }

    const scale = Math.min(maxW / rawW, maxH / rawH);
    const targetW = Math.max(1, Math.floor(rawW * scale));
    const targetH = Math.max(1, Math.floor(rawH * scale));
    return { art: scaleArt(art, targetW, targetH), scale };
}

/**
 * @param {string[]} art
 */
function padArtRows(art) {
    const w = art.length ? Math.max(...art.map((l) => l.length)) : 0;
    return art.map((line) => (line.length >= w ? line : line + ' '.repeat(w - line.length)));
}

/**
 * Build a grid sized to the art (1:1 when possible). Never crops placed pixels.
 * @param {string[]} lines
 */
export function fitArtToViewport(lines, meta = {}) {
    const raw = padArtRows(extractArt(lines, { skipOrphanDrop: meta.skipOrphanDrop }));
    const rawH = raw.length;
    const rawW = rawH ? Math.max(...raw.map((l) => l.length)) : 0;

    const maxContentW = LOOT_MAX_COLS - 4;
    const maxContentH = LOOT_MAX_CONTENT_ROWS;
    const { art } = fitArtToBounds(raw, maxContentW, maxContentH);

    const artH = art.length;
    const artW = artH ? Math.max(...art.map((l) => l.length)) : 0;

    const cols = Math.min(LOOT_MAX_COLS, Math.max(LOOT_MIN_COLS, artW + 4));
    const artTop = LOOT_PAD_TOP_ROWS;
    const hintRow = artTop + artH + LOOT_GAP_BEFORE_HINT_ROWS;
    const rows = hintRow + 1;

    const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
    const offsetX = Math.max(0, Math.floor((cols - artW) / 2));

    for (let y = 0; y < artH; y++) {
        const destY = artTop + y;
        const line = art[y];
        for (let x = 0; x < line.length; x++) {
            const destX = offsetX + x;
            if (destX >= 0 && destX < cols) {
                grid[destY][destX] = line[x];
            }
        }
    }

    const hint = 'Enter: inspect   Esc: return to map';
    const hintX = Math.max(0, Math.floor((cols - hint.length) / 2));
    for (let i = 0; i < hint.length && hintX + i < cols; i++) {
        grid[hintRow][hintX + i] = hint[i];
    }

    return { grid, artTop, artRows: artH, hintRow, cols, rows };
}

/**
 * @param {string} animId
 */
export function prepareLootAnim(animId) {
    const id = animId || 'abandoned_bag';
    const cacheKey = `${id}|${PREPARED_CACHE_VER}`;
    if (preparedCache.has(cacheKey)) return preparedCache.get(cacheKey);

    const animMeta = getLootAnimMeta(id);
    const fitted = fitArtToViewport(animMeta.lines, animMeta);
    const prepared = {
        baseGrid: fitted.grid,
        layout: {
            artTop: fitted.artTop,
            artRows: fitted.artRows,
            hintRow: fitted.hintRow,
            cols: fitted.cols,
            rows: fitted.rows,
        },
        noShimmer: animMeta.noShimmer === true,
    };
    preparedCache.set(cacheKey, prepared);
    return prepared;
}

/**
 * Pick font size so tall 1:1 art still fits reasonably on screen.
 * @param {number} rows
 */
export function lootFontSizeForRows(rows) {
    if (rows <= 20) return 13;
    if (rows <= 30) return 12;
    if (rows <= 42) return 11;
    return 10;
}

/**
 * @param {string} ch
 * @param {number} frameIndex
 * @param {boolean} [disabled]
 */
function shimmerChar(ch, frameIndex, disabled) {
    if (disabled || ch === ' ') return ch;
    if (frameIndex % 2 === 0) {
        return SHIMMER_MAP[ch] ?? ch;
    }
    return SHIMMER_REVERSE[ch] ?? ch;
}

/**
 * Loot canvas draw with top pixel padding so glyphs are not clipped.
 * @param {HTMLCanvasElement} canvas
 * @param {string[][]} grid
 * @param {{ fontSize?: number, fontFamily?: string, background?: string, foreground?: string }} style
 */
export function drawLootGridOnCanvas(canvas, grid, style = {}) {
    const fontSize = style.fontSize ?? 13;
    const fontFamily = style.fontFamily ?? 'ui-monospace, Menlo, Consolas, monospace';
    const background = style.background ?? '#0d0d0d';
    const foreground = style.foreground ?? '#c8c8b8';
    const padTopPx = 4;

    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;
    const charW = ctx.measureText('M').width;
    const lineH = Math.ceil(fontSize * 1.2);

    const rows = grid.length;
    const cols = rows ? grid[0].length : 0;

    canvas.width = Math.ceil(cols * charW);
    canvas.height = padTopPx + Math.ceil(rows * lineH) + 4;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = foreground;
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
        const y = padTopPx + r * lineH;
        for (let c = 0; c < cols; c++) {
            ctx.fillText(grid[r][c], c * charW, y);
        }
    }
}

/**
 * @param {string[][]} baseGrid
 * @param {{ artTop: number, artRows: number, hintRow: number }} layout
 * @param {number} frameIndex
 */
export function buildLootAnimFrame(baseGrid, layout, frameIndex, opts = {}) {
    const { artTop, artRows, hintRow } = layout;
    const rows = baseGrid.length;
    const cols = baseGrid[0]?.length ?? 0;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
    const noShimmer = opts.noShimmer === true;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === hintRow) {
                grid[r][c] = baseGrid[r][c];
                continue;
            }

            const localY = r - artTop;
            if (localY < 0 || localY >= artRows) {
                grid[r][c] = ' ';
                continue;
            }

            const ch = baseGrid[artTop + localY][c];
            grid[r][c] = shimmerChar(ch, frameIndex, noShimmer);
        }
    }

    return grid;
}

/** @deprecated use layout from prepareLootAnim */
export const VIEW_COLS = LOOT_MIN_COLS;
export const VIEW_ROWS = 24;
