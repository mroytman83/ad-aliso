/**
 * Character-grid sprites + blitting; render to HTML canvas with monospace font.
 * Layout uses World.places[].mapPos (logic graph unchanged).
 */

import { stableHash32, mulberry32 } from './util/random.js';
import { borderMask } from './regions/voronoi.js';
import { VIEWPORT_COLS, VIEWPORT_ROWS, extractViewport } from './viewport.js';

function padSprite(lines) {
    const w = Math.max(...lines.map((s) => s.length));
    return lines.map((s) => s.padEnd(w, ' '));
}

/** Pine tree — normalized fixed-width lines (spaces are transparent when blitting). */
export const SPRITE_PINE = padSprite([
    '        ==         ',
    '      .#@@#.       ',
    '     .@@@@@@.      ',
    '     .%@@@@%.      ',
    '    :#@@@@@@#:     ',
    '    =@@@@@@@@+.    ',
    '    -@@@@@@@@=.    ',
    '  .+%@@@@@@@@%+.   ',
    '  .*@@@@@@@@@@*.   ',
    ' ......%@@%......  ',
    '      .%@@%.       ',
]);

/**
 * Teutoburg forest is largely deciduous — beech-style canopy art.
 */
export const SPRITE_BEECH = padSprite([
    '        ..::-..       ',
    '      .:-+**++-:.     ',
    '     :-+*##%%#*+:.    ',
    '    :=*#%%@@%%#*+:    ',
    '   :-+*@@@@@@@@@%+.   ',
    '   :-*%@@@@@@@@@%*.   ',
    '    .-+#%%%%%%#+-.    ',
    '      .:-++++-:.      ',
    '       .:#%%#:.       ',
    '        .*@@*.        ',
    '        .=@@=.        ',
    '        .:%%:.        ',
    '        .-==-.        ',
]);

/** Alias — same art as {@link SPRITE_BEECH}. */
export const BEECH_SPRITE = SPRITE_BEECH;

export function spriteSize(spriteLines) {
    const h = spriteLines.length;
    const w = h ? Math.max(...spriteLines.map((s) => s.length)) : 0;
    return { w, h };
}

export function createGrid(cols, rows, fill = ' ') {
    return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

/**
 * Stamp sprite onto grid at top-left (gx, gy). Characters equal to `transparent` skip destination.
 */
export function blit(grid, spriteLines, gx, gy, transparent = ' ') {
    spriteLines.forEach((line, dy) => {
        const row = grid[gy + dy];
        if (!row) return;
        [...line].forEach((ch, dx) => {
            if (ch === transparent) return;
            const x = gx + dx;
            if (x >= 0 && x < row.length) row[x] = ch;
        });
    });
}

/** Mark non-transparent sprite pixels as blocked for walkability. */
export function markSpriteBlocked(blocked, spriteLines, gx, gy, transparent = ' ') {
    spriteLines.forEach((line, dy) => {
        const row = blocked[gy + dy];
        if (!row) return;
        [...line].forEach((ch, dx) => {
            if (ch === transparent) return;
            const x = gx + dx;
            if (x >= 0 && x < row.length) row[x] = true;
        });
    });
}

/** Block only the trunk/base of a tree so canopy stays walkable. */
export function markTrunkBlocked(blocked, spriteLines, gx, gy) {
    const h = spriteLines.length;
    const w = Math.max(...spriteLines.map((s) => s.length));
    const trunkRows = Math.min(4, h);
    const trunkStartY = gy + h - trunkRows;
    const centerX = gx + Math.floor(w / 2);
    const trunkHalfW = 1;

    for (let dy = 0; dy < trunkRows; dy++) {
        const row = blocked[trunkStartY + dy];
        if (!row) continue;
        for (let dx = -trunkHalfW; dx <= trunkHalfW; dx++) {
            const x = centerX + dx;
            if (x >= 0 && x < row.length) row[x] = true;
        }
    }
}

export function gridToString(grid) {
    return grid.map((row) => row.join('')).join('\n');
}

function collectMapPositions(places) {
    const list = [];
    for (const place of Object.values(places)) {
        if (place.mapPos) list.push({ id: place.id, ...place.mapPos });
    }
    return list;
}

function boundsFromPositions(positions) {
    if (!positions.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let minX = positions[0].x;
    let maxX = positions[0].x;
    let minY = positions[0].y;
    let maxY = positions[0].y;
    for (const p of positions) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY };
}

export { stableHash32, mulberry32 };

/**
 * @param {typeof import('./world.js').default} World
 * @param {{ cellW?: number, cellH?: number, margin?: number, spriteChoices?: string[][] }} opts
 */
export function computeGridMeta(World, opts = {}) {
    const positions = collectMapPositions(World.places);
    const { minX, maxX, minY, maxY } = boundsFromPositions(positions);
    const spriteChoices = opts.spriteChoices ?? [SPRITE_PINE, SPRITE_BEECH];

    let maxSpriteW = 0;
    let maxSpriteH = 0;
    for (const spr of spriteChoices) {
        const { w, h } = spriteSize(spr);
        maxSpriteW = Math.max(maxSpriteW, w);
        maxSpriteH = Math.max(maxSpriteH, h);
    }

    const margin = opts.margin ?? 2;
    const cellW = opts.cellW ?? Math.max(maxSpriteW + 4, 26);
    const cellH = opts.cellH ?? Math.max(maxSpriteH + 4, 14);
    const colsX = maxX - minX + 1;
    const rowsY = maxY - minY + 1;

    return {
        cols: margin * 2 + colsX * cellW,
        rows: margin * 2 + rowsY * cellH,
        cellW,
        cellH,
        margin,
        minX,
        minY,
        maxX,
        maxY,
        positions,
        maxSpriteW,
        maxSpriteH,
    };
}

/**
 * @param {typeof import('./world.js').default} World
 * @param {{
 *   currentPlaceId?: string,
 *   worldMap?: import('./regions/worldMap.js').buildWorldMap extends Function ? ReturnType<import('./regions/worldMap.js').buildWorldMap> : object,
 *   cellW?: number,
 *   cellH?: number,
 *   margin?: number,
 *   ground?: string,
 *   spriteForPlace?: (placeId: string) => string[],
 *   spriteChoices?: string[][],
 *   decorJitter?: boolean,
 *   decorSeedSalt?: string,
 *   decorSpriteOrder?: 'alternate' | 'random',
 *   regionBorders?: boolean,
 *   playerPos?: { gx: number, gy: number },
 * }} opts
 */
export function buildWorldAsciiGrid(World, opts = {}) {
    const {
        currentPlaceId,
        playerPos,
        worldMap,
        cellW: cellWOpt,
        cellH: cellHOpt,
        margin = 2,
        ground = '.',
        spriteForPlace: spriteForPlaceOpt,
        spriteChoices = [SPRITE_PINE, SPRITE_BEECH],
        decorJitter = true,
        decorSeedSalt = '',
        decorSpriteOrder = 'alternate',
        regionBorders = true,
    } = opts;

    const positions = collectMapPositions(World.places);

    /** @type {Map<string, string[]>} */
    const alternateSpriteById = new Map();
    if (!spriteForPlaceOpt && decorSpriteOrder === 'alternate') {
        const sorted = [...positions].sort(
            (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
        );
        sorted.forEach((p, i) => {
            alternateSpriteById.set(
                p.id,
                spriteChoices[i % spriteChoices.length] ?? spriteChoices[0],
            );
        });
    }

    let maxSpriteW = 0;
    let maxSpriteH = 0;
    for (const spr of spriteChoices) {
        const { w, h } = spriteSize(spr);
        maxSpriteW = Math.max(maxSpriteW, w);
        maxSpriteH = Math.max(maxSpriteH, h);
    }
    if (spriteForPlaceOpt) {
        for (const { id } of positions) {
            const { w, h } = spriteSize(spriteForPlaceOpt(id));
            maxSpriteW = Math.max(maxSpriteW, w);
            maxSpriteH = Math.max(maxSpriteH, h);
        }
    }

    const cellW = cellWOpt ?? Math.max(maxSpriteW + 4, 26);
    const cellH = cellHOpt ?? Math.max(maxSpriteH + 4, 14);

    const { minX, maxX, minY, maxY } = boundsFromPositions(positions);

    const colsX = maxX - minX + 1;
    const rowsY = maxY - minY + 1;
    const cols = margin * 2 + colsX * cellW;
    const rows = margin * 2 + rowsY * cellH;

    const grid = createGrid(cols, rows, ground);
    const blocked = Array.from({ length: rows }, () => Array(cols).fill(false));

    if (worldMap) {
        const borders = regionBorders
            ? borderMask(worldMap.regionIndex, cols, rows)
            : null;

        for (let gy = 0; gy < rows; gy++) {
            for (let gx = 0; gx < cols; gx++) {
                const si = worldMap.regionIndex[gy][gx];
                const seed = worldMap.seeds[si];
                const region = seed ? worldMap.regions[seed.id] : null;
                if (!region) continue;
                grid[gy][gx] = borders?.[gy][gx] ? ':' : region.groundChar;
            }
        }
    }

    /** @type {Record<string, { gx: number, gy: number, sprite: string[] }>} */
    const anchors = {};

    function resolveSprite(placeId) {
        if (spriteForPlaceOpt) return spriteForPlaceOpt(placeId);
        if (decorSpriteOrder === 'alternate') {
            return alternateSpriteById.get(placeId) ?? spriteChoices[0];
        }
        const seed = stableHash32(`${decorSeedSalt}|decor|${placeId}`);
        const rnd = mulberry32(seed);
        const idx = Math.floor(rnd() * spriteChoices.length);
        return spriteChoices[idx] ?? spriteChoices[0];
    }

    for (const { id, x, y } of positions) {
        const cellGx = margin + (x - minX) * cellW;
        const cellGy = margin + (y - minY) * cellH;
        const sprite = resolveSprite(id);
        const { w: sw, h: sh } = spriteSize(sprite);

        let jx = 0;
        let jy = 0;
        if (decorJitter) {
            const seed2 = stableHash32(`${decorSeedSalt}|jitter|${id}`);
            const rnd = mulberry32(seed2 ^ 0x9e3779b9);
            const maxJx = Math.max(0, cellW - sw);
            const maxJy = Math.max(0, cellH - sh);
            jx = Math.floor(rnd() * (maxJx + 1));
            jy = Math.floor(rnd() * (maxJy + 1));
        }

        const gx = cellGx + jx;
        const gy = cellGy + jy;
        anchors[id] = { gx, gy, sprite };
        blit(grid, sprite, gx, gy, ' ');
        markTrunkBlocked(blocked, sprite, gx, gy);
    }

    if (worldMap) {
        const decorRndBase = mulberry32(stableHash32(`${decorSeedSalt}|props|${worldMap.worldSeed}`));
        for (const region of Object.values(worldMap.regions)) {
            if (!region.bbox || region.propDensity <= 0) continue;
            if (region.propStyle === 'none') continue;
            let sprite;
            if (region.propStyle === 'pine') {
                sprite = SPRITE_PINE;
            } else {
                sprite = decorRndBase() < region.propBeechBias ? SPRITE_BEECH : SPRITE_PINE;
            }
            const { w: sw, h: sh } = spriteSize(sprite);
            const rnd = mulberry32(stableHash32(`${worldMap.worldSeed}|scatter|${region.id}`));

            for (let gy = region.bbox.minGy; gy <= region.bbox.maxGy; gy++) {
                for (let gx = region.bbox.minGx; gx <= region.bbox.maxGx; gx++) {
                    if (worldMap.regionIndex[gy][gx] !== region.seedIndex) continue;
                    if (region.placeId && anchors[region.placeId]) {
                        const a = anchors[region.placeId];
                        if (Math.abs(gx - a.gx) < sw && Math.abs(gy - a.gy) < sh) continue;
                    }
                    if (rnd() > region.propDensity) continue;
                    const jx = Math.floor(rnd() * Math.max(1, 3));
                    const jy = Math.floor(rnd() * Math.max(1, 3));
                    const px = gx + jx;
                    const py = gy + jy;
                    blit(grid, sprite, px, py, ' ');
                    // Scattered trees are visual only — ground beneath stays walkable.
                }
            }
        }
    }

    const walkable = Array.from({ length: rows }, (_, gy) =>
        Array.from({ length: cols }, (_, gx) => {
            if (blocked[gy][gx]) return false;
            if (worldMap) return worldMap.regionIndex[gy][gx] != null;
            return true;
        }),
    );

    const pos = playerPos ?? (currentPlaceId && anchors[currentPlaceId]
        ? (() => {
              const { gx, gy, sprite } = anchors[currentPlaceId];
              const { w: sw, h: sh } = spriteSize(sprite);
              return { gx: gx + Math.floor(sw / 2), gy: gy + sh - 1 };
          })()
        : null);

    if (pos && grid[pos.gy] && pos.gx >= 0 && pos.gx < grid[pos.gy].length) {
        grid[pos.gy][pos.gx] = '@';
    }

    return {
        grid,
        anchors,
        walkable,
        meta: {
            cols,
            rows,
            cellW,
            cellH,
            margin,
            minX,
            maxY,
            maxSpriteW,
            maxSpriteH,
        },
    };
}

/**
 * Draw character grid on canvas (monospace).
 * @param {HTMLCanvasElement} canvas
 * @param {string[][]} grid
 * @param {{ fontSize?: number, fontFamily?: string, background?: string, foreground?: string }} style
 */
export function drawGridOnCanvas(canvas, grid, style = {}) {
    const fontSize = style.fontSize ?? 14;
    const fontFamily = style.fontFamily ?? 'monospace';
    const background = style.background ?? '#0d0d0d';
    const foreground = style.foreground ?? '#c8c8b8';

    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText('M');
    const charW = metrics.width;
    const lineH = fontSize * 1.25;

    const rows = grid.length;
    const cols = rows ? grid[0].length : 0;

    canvas.width = Math.ceil(cols * charW);
    canvas.height = Math.ceil(rows * lineH);

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = foreground;
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
        const y = r * lineH;
        for (let c = 0; c < cols; c++) {
            const ch = grid[r][c];
            const x = c * charW;
            ctx.fillText(ch, x, y);
        }
    }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {typeof import('./world.js').default} World
 * @param {Parameters<typeof buildWorldAsciiGrid>[1]} opts
 */
export function renderWorldMap(canvas, World, opts = {}) {
    const { grid } = buildWorldAsciiGrid(World, opts);
    drawGridOnCanvas(canvas, grid);
}

/**
 * Draw a fixed-size window into a full world grid.
 * @param {HTMLCanvasElement} canvas
 * @param {string[][]} fullGrid
 * @param {{ ox: number, oy: number, cols?: number, rows?: number }} camera
 * @param {Parameters<typeof drawGridOnCanvas>[2]} [style]
 */
export function renderViewport(canvas, fullGrid, camera, style = {}) {
    const viewCols = camera.cols ?? VIEWPORT_COLS;
    const viewRows = camera.rows ?? VIEWPORT_ROWS;
    const slice = extractViewport(fullGrid, camera.ox, camera.oy, viewCols, viewRows);
    drawGridOnCanvas(canvas, slice, style);
}
