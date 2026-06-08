import { getActiveEnemyHp, getEnemyLabel, hasBattleAllies, isBattleOver } from './battle.js';

const COLS = 80;
const ROWS = 24;

/** Frames for future animation: [frameIndex][line][char] */
export const ENEMY_SPRITE_FRAMES_BY_ID = {
    vulture_imp: [
        [
            '    ,,,    ',
            '   /v v\\   ',
            '  (  >  )  ',
            '  /|===|\\ ',
            '   |   |   ',
            '  _/   \\_ ',
        ],
    ],
    anglii_framea_boat: [
        [
            '  ~====~  ',
            ' /|###|\\ ',
            '|_|   |_|',
            '  \\___/  ',
        ],
    ],
};

/** @param {string} [enemyId] */
export function getEnemySpriteFrames(enemyId) {
    return ENEMY_SPRITE_FRAMES_BY_ID[enemyId] ?? ENEMY_SPRITE_FRAMES_BY_ID.vulture_imp;
}

export const PLAYER_SPRITE_FRAMES = [
    [
        '   |M|   ',
        '  /|||\\  ',
        '   |@|   ',
        '  / | \\  ',
        '   / \\   ',
    ],
];

const MENU_ITEMS = [
    ['FIGHT', 'ALLY'],
    ['ITEM', 'RUN'],
];

function hpBar(current, max, width) {
    const filled = Math.round((current / max) * width);
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled));
}

function padRight(s, w) {
    return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}

function placeSprite(grid, lines, top, left) {
    lines.forEach((line, dy) => {
        const row = grid[top + dy];
        if (!row) return;
        [...line].forEach((ch, dx) => {
            const x = left + dx;
            if (x >= 0 && x < row.length && ch !== ' ') row[x] = ch;
        });
    });
}

/**
 * @param {import('./battle.js').createBattle extends Function ? ReturnType<import('./battle.js').createBattle> : object} battle
 */
export function buildBattleGrid(battle) {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));

    const enemyHp = getActiveEnemyHp(battle);
    const enemyLabel = getEnemyLabel(battle).toUpperCase();
    const playerHp = battle.player;

    const lines = [
        '┌─' + '─'.repeat(34) + '┐',
        '│ ' + padRight(enemyLabel, 18) + ' HP ' + hpBar(enemyHp.current, enemyHp.max, 10) + ' │',
        '└─' + '─'.repeat(34) + '┘',
    ];
    lines.forEach((line, i) => {
        [...line].forEach((ch, x) => {
            if (x < COLS) grid[i][x] = ch;
        });
    });

    const enemySprites = getEnemySpriteFrames(battle.enemyId);
    const enemyFrame = enemySprites[battle.animFrame % enemySprites.length];
    placeSprite(grid, enemyFrame, 2, 52);

    const playerFrame = PLAYER_SPRITE_FRAMES[battle.animFrame % PLAYER_SPRITE_FRAMES.length];
    placeSprite(grid, playerFrame, 11, 8);

    const pBoxTop = 14;
    const pLines = [
        '┌─' + '─'.repeat(34) + '┐',
        '│ ' +
            padRight('MARCUS', 10) +
            ' HP ' +
            hpBar(playerHp.hp, playerHp.maxHp, 10) +
            ' ' +
            padRight(`${playerHp.hp}/${playerHp.maxHp}`, 8) +
            ' │',
        '└─' + '─'.repeat(34) + '┘',
    ];
    pLines.forEach((line, i) => {
        [...line].forEach((ch, x) => {
            if (x < COLS) grid[pBoxTop + i][x] = ch;
        });
    });

    const menuTop = 18;
    grid[menuTop][0] = '┌';
    grid[menuTop + 3][0] = '└';
    for (let r = menuTop; r <= menuTop + 3; r++) {
        grid[r][38] = '│';
        grid[r][39] = '─';
    }
    const prompt = ' What will Marcus do? ';
    [...('┌' + prompt + '─'.repeat(Math.max(0, 38 - prompt.length)) + '┐')].forEach((ch, x) => {
        if (x < COLS) grid[menuTop][x] = ch;
    });

    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            let label = MENU_ITEMS[r][c];
            if (label === 'ALLY' && !hasBattleAllies(battle)) {
                label = '----';
            }
            const sel = battle.menuIndex === r * 2 + c;
            const text = (sel ? '>' : ' ') + padRight(label, 8);
            const x = 2 + c * 18;
            const y = menuTop + 1 + r;
            [...text].forEach((ch, dx) => {
                if (x + dx < COLS) grid[y][x + dx] = ch;
            });
        }
    }

    const logTop = 22;
    const logLines = battle.log.slice(-2);
    grid[logTop][0] = '┌';
    [...(' Battle log ' + '─'.repeat(64))].forEach((ch, x) => {
        if (x < COLS) grid[logTop][x] = ch;
    });
    logLines.forEach((msg, i) => {
        const row = logTop + 1 + i;
        if (!grid[row]) return;
        const text = ' ' + padRight(msg, 76);
        [...text].forEach((ch, x) => {
            if (x < COLS) grid[row][x] = ch;
        });
    });

    return grid;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string[][]} grid
 */
export function drawBattleGrid(canvas, grid) {
    const fontSize = 14;
    const fontFamily = 'monospace';
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;
    const charW = ctx.measureText('M').width;
    const lineH = fontSize * 1.25;

    canvas.width = Math.ceil(COLS * charW);
    canvas.height = Math.ceil(ROWS * lineH);

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#c8c8b8';
    ctx.textBaseline = 'top';

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            ctx.fillText(grid[r][c], c * charW, r * lineH);
        }
    }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./battle.js').createBattle extends Function ? ReturnType<import('./battle.js').createBattle> : object} battle
 */
export function renderBattle(canvas, battle) {
    const grid = buildBattleGrid(battle);
    drawBattleGrid(canvas, grid);
}

/**
 * @param {import('./battle.js').createBattle extends Function ? ReturnType<import('./battle.js').createBattle> : object} battle
 * @param {KeyboardEvent} e
 * @returns {'fight' | 'run' | 'ally' | 'stub' | 'up' | 'down' | 'left' | 'right' | 'confirm' | null}
 */
export function mapBattleKey(battle, e) {
    if (isBattleOver(battle)) {
        if (e.key === 'Enter' || e.key === ' ') return 'confirm';
        return null;
    }

    if (e.key === 'ArrowUp') return 'up';
    if (e.key === 'ArrowDown') return 'down';
    if (e.key === 'ArrowLeft') return 'left';
    if (e.key === 'ArrowRight') return 'right';
    if (e.key === 'Enter') return 'confirm';

    if (e.key === 'f' || e.key === 'F') return 'fight';
    if (e.key === 'r' || e.key === 'R') return 'run';
    if ((e.key === 'a' || e.key === 'A') && hasBattleAllies(battle)) return 'ally';

    return null;
}

/**
 * @param {import('./battle.js').createBattle extends Function ? ReturnType<import('./battle.js').createBattle> : object} battle
 * @param {'up' | 'down' | 'left' | 'right'} dir
 */
export function moveMenuCursor(battle, dir) {
    const row = Math.floor(battle.menuIndex / 2);
    const col = battle.menuIndex % 2;
    let nr = row;
    let nc = col;
    if (dir === 'up') nr = 0;
    if (dir === 'down') nr = 1;
    if (dir === 'left') nc = 0;
    if (dir === 'right') nc = 1;
    battle.menuIndex = nr * 2 + nc;
    return battle;
}

/**
 * @param {import('./battle.js').createBattle extends Function ? ReturnType<import('./battle.js').createBattle> : object} battle
 * @returns {'fight' | 'run' | 'ally' | 'stub'}
 */
export function menuAction(battle) {
    if (battle.menuIndex === 0) return 'fight';
    if (battle.menuIndex === 1) return hasBattleAllies(battle) ? 'ally' : 'stub';
    if (battle.menuIndex === 2) return 'stub';
    return 'run';
}
