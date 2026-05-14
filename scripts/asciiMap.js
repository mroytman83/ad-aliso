/**
 * Character-grid sprites + blitting; render to HTML canvas with monospace font.
 * Layout uses World.places[].mapPos (logic graph unchanged).
 */

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

function padSprite(lines) {
    const w = Math.max(...lines.map((s) => s.length));
    return lines.map((s) => s.padEnd(w, ' '));
}

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

/**
 * @param {typeof import('./world.js').default} World
 * @param {{ currentPlaceId?: string, cellW?: number, cellH?: number, margin?: number, ground?: string }} opts
 */
export function buildWorldAsciiGrid(World, opts = {}) {
    const {
        currentPlaceId,
        cellW: cellWOpt,
        cellH: cellHOpt,
        margin = 2,
        ground = '.',
    } = opts;

    const pine = SPRITE_PINE;
    const { w: pineW, h: pineH } = spriteSize(pine);
    const cellW = cellWOpt ?? Math.max(pineW + 4, 26);
    const cellH = cellHOpt ?? Math.max(pineH + 4, 14);

    const positions = collectMapPositions(World.places);
    const { minX, maxX, minY, maxY } = boundsFromPositions(positions);

    const colsX = maxX - minX + 1;
    const rowsY = maxY - minY + 1;
    const cols = margin * 2 + colsX * cellW;
    const rows = margin * 2 + rowsY * cellH;

    const grid = createGrid(cols, rows, ground);

    /** @type {Record<string, { gx: number, gy: number }>} */
    const anchors = {};

    for (const { id, x, y } of positions) {
        const gx = margin + (x - minX) * cellW;
        const gy = margin + (y - minY) * cellH;
        anchors[id] = { gx, gy };
        blit(grid, pine, gx, gy, ' ');
    }

    if (currentPlaceId && anchors[currentPlaceId]) {
        const { gx, gy } = anchors[currentPlaceId];
        const mx = gx + Math.floor(pineW / 2);
        const my = gy + pineH - 1;
        if (grid[my] && mx >= 0 && mx < grid[my].length) grid[my][mx] = '@';
    }

    return {
        grid,
        anchors,
        meta: { cols, rows, cellW, cellH, margin, minX, maxY, pineW, pineH },
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
 * @param {{ currentPlaceId?: string }} opts
 */
export function renderWorldMap(canvas, World, opts = {}) {
    const { grid } = buildWorldAsciiGrid(World, opts);
    drawGridOnCanvas(canvas, grid);
}
