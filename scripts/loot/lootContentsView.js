import { drawGridOnCanvas } from '../asciiMap.js';
import { LOOT_MIN_COLS as VIEW_COLS } from './lootArt.js';

const VIEW_ROWS = 24;

const MENU_ITEMS = [
    ['TAKE ALL', 'TAKE SELECTED'],
    ['LEAVE', ''],
];

function padRight(s, w) {
    return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}

/**
 * @param {object} lootState
 */
export function buildLootContentsGrid(lootState) {
    const grid = Array.from({ length: VIEW_ROWS }, () => Array(VIEW_COLS).fill(' '));
    const label = lootState.label.toUpperCase();
    const items = lootState.remainingItems ?? [];

    const boxW = 38;
    const lines = [
        '┌─' + padRight(' ' + label, boxW - 2) + '┐',
    ];

    const maxItems = 6;
    if (items.length === 0) {
        lines.push('│ ' + padRight('(empty)', boxW - 2) + '│');
    } else {
        for (let i = 0; i < Math.min(items.length, maxItems); i++) {
            const prefix = lootState.selectMode && lootState.itemIndex === i ? '>' : ' ';
            const text = `${prefix}- ${items[i].name}`;
            lines.push('│ ' + padRight(text, boxW - 2) + '│');
        }
        if (items.length > maxItems) {
            lines.push('│ ' + padRight(`  ... +${items.length - maxItems} more`, boxW - 2) + '│');
        }
    }
    lines.push('└─' + '─'.repeat(boxW - 2) + '┘');

    lines.forEach((line, i) => {
        [...line].forEach((ch, x) => {
            if (x < VIEW_COLS) grid[i][x] = ch;
        });
    });

    const menuTop = 10;
    const menuLines = [
        '┌─ Take from bag? ' + '─'.repeat(18) + '┐',
        '│ ' +
            (lootState.menuIndex === 0 ? '>' : ' ') +
            ' TAKE ALL    ' +
            (lootState.menuIndex === 1 ? '>' : ' ') +
            ' TAKE SELECTED' +
            ' │',
        '│ ' +
            (lootState.menuIndex === 2 ? '>' : ' ') +
            ' LEAVE' +
            ' '.repeat(24) +
            '│',
        '└─' + '─'.repeat(34) + '┘',
    ];

    menuLines.forEach((line, i) => {
        [...line].forEach((ch, x) => {
            if (x < VIEW_COLS) grid[menuTop + i][x] = ch;
        });
    });

    if (lootState.selectMode && items.length > 0) {
        const hint = 'Arrows: pick item  Enter: take  Esc: back';
        const hx = Math.max(0, Math.floor((VIEW_COLS - hint.length) / 2));
        for (let i = 0; i < hint.length && hx + i < VIEW_COLS; i++) {
            grid[VIEW_ROWS - 2][hx + i] = hint[i];
        }
    } else {
        const hint = 'Arrows + Enter — TAKE ALL / TAKE SELECTED / LEAVE';
        const hx = Math.max(0, Math.floor((VIEW_COLS - hint.length) / 2));
        for (let i = 0; i < hint.length && hx + i < VIEW_COLS; i++) {
            grid[VIEW_ROWS - 1][hx + i] = hint[i];
        }
    }

    return grid;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} lootState
 */
export function renderLootContents(canvas, lootState) {
    const grid = buildLootContentsGrid(lootState);
    drawGridOnCanvas(canvas, grid, {
        fontSize: 14,
        background: '#0d0d0d',
        foreground: '#c8c8b8',
    });
}

/**
 * @param {object} lootState
 * @param {KeyboardEvent} e
 * @returns {'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | null}
 */
export function mapLootKey(lootState, e) {
    if (lootState.selectMode) {
        if (e.key === 'ArrowUp') return 'up';
        if (e.key === 'ArrowDown') return 'down';
        if (e.key === 'Enter') return 'confirm';
        if (e.key === 'Escape') return 'back';
        return null;
    }

    if (e.key === 'ArrowUp') return 'up';
    if (e.key === 'ArrowDown') return 'down';
    if (e.key === 'ArrowLeft') return 'left';
    if (e.key === 'ArrowRight') return 'right';
    if (e.key === 'Enter') return 'confirm';
    return null;
}

/**
 * @param {object} lootState
 * @param {'up' | 'down' | 'left' | 'right'} dir
 */
export function moveLootMenuCursor(lootState, dir) {
    if (lootState.selectMode) {
        const n = lootState.remainingItems.length;
        if (n === 0) return lootState;
        if (dir === 'up') lootState.itemIndex = (lootState.itemIndex - 1 + n) % n;
        if (dir === 'down') lootState.itemIndex = (lootState.itemIndex + 1) % n;
        return lootState;
    }

    const row = lootState.menuIndex < 2 ? 0 : 1;
    const col = lootState.menuIndex % 2;
    let nr = row;
    let nc = col;

    if (dir === 'up') nr = 0;
    if (dir === 'down') nr = 1;
    if (dir === 'left') nc = 0;
    if (dir === 'right') nc = 1;

    if (nr === 1 && nc === 1) {
        lootState.menuIndex = 2;
    } else {
        lootState.menuIndex = nr * 2 + nc;
    }
    return lootState;
}

/**
 * @param {object} lootState
 * @returns {'take_all' | 'take_one' | 'enter_select' | 'leave' | 'take_selected_item' | 'back'}
 */
export function menuAction(lootState) {
    if (lootState.selectMode) {
        return 'take_selected_item';
    }
    if (lootState.menuIndex === 0) return 'take_all';
    if (lootState.menuIndex === 1) return 'enter_select';
    return 'leave';
}

export { MENU_ITEMS };
