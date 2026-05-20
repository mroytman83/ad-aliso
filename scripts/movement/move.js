import World from '../world.js';

const KEY_TO_DIR = {
    ArrowUp: 'north',
    ArrowDown: 'south',
    ArrowLeft: 'west',
    ArrowRight: 'east',
    Up: 'north',
    Down: 'south',
    Left: 'west',
    Right: 'east',
    w: 'north',
    W: 'north',
    s: 'south',
    S: 'south',
    a: 'west',
    A: 'west',
    d: 'east',
    D: 'east',
};

export function keyToDirection(key) {
    return KEY_TO_DIR[key] ?? null;
}

/** @returns {typeof state | null} new gameState if move succeeded */
export function move(state, direction) {
    const { locationId } = state.player;
    const edge = World.resolveExit(locationId, direction);
    if (!edge) return null;
    return {
        ...state,
        player: { ...state.player, locationId: edge.to },
    };
}
