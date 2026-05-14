/**
 * Explicit location graph: nodes keyed by id, exits by compass direction.
 * Exit value: target id string, or { to: string, cost?: number } (default cost 1).
 * Optional mapPos on a node is layout-only (ASCII overlay / minimap), not used for connectivity.
 */

function normalizeExit(edge) {
    if (typeof edge === 'string') return { to: edge, cost: 1 };
    const to = edge.to;
    const cost = edge.cost != null ? edge.cost : 1;
    return { to, cost };
}

class World {
    static directions = ['north', 'south', 'east', 'west'];

    /** @type {Record<string, { id: string, title?: string, mapPos?: { x: number, y: number }, exits?: Record<string, string | { to: string, cost?: number }> }>} */
    static places = {
        teutoburg_fringe: {
            id: 'teutoburg_fringe',
            title: 'Forest fringe',
            mapPos: { x: 0, y: 0 },
            exits: {
                west: 'broken_milestone',
            },
        },
        broken_milestone: {
            id: 'broken_milestone',
            title: 'Broken milestone',
            mapPos: { x: -1, y: 0 },
            exits: {
                east: 'teutoburg_fringe',
                west: { to: 'river_ford', cost: 1 },
                north: 'ridge_trail',
            },
        },
        river_ford: {
            id: 'river_ford',
            title: 'River ford',
            mapPos: { x: -2, y: 0 },
            exits: {
                east: 'broken_milestone',
                north: { to: 'marshes_edge', cost: 2 },
            },
        },
        ridge_trail: {
            id: 'ridge_trail',
            title: 'Ridge trail',
            mapPos: { x: -1, y: -1 },
            exits: {
                south: 'broken_milestone',
                west: 'long_march_west',
            },
        },
        marshes_edge: {
            id: 'marshes_edge',
            title: "Marshes' edge",
            mapPos: { x: -2, y: -1 },
            exits: {
                south: { to: 'river_ford', cost: 2 },
                west: 'long_march_west',
            },
        },
        long_march_west: {
            id: 'long_march_west',
            title: 'Western road fragment',
            mapPos: { x: -3, y: -1 },
            exits: {
                east: 'ridge_trail',
                west: 'aliso_gate',
            },
        },
        aliso_gate: {
            id: 'aliso_gate',
            title: 'Aliso gate',
            mapPos: { x: -4, y: -1 },
            exits: {
                east: 'long_march_west',
            },
        },
    };

    static getPlace(id) {
        return World.places[id] ?? null;
    }

    /**
     * @param {string} placeId
     * @param {string} direction — one of World.directions
     * @returns {{ to: string, cost: number } | null}
     */
    static resolveExit(placeId, direction) {
        const place = World.getPlace(placeId);
        const raw = place?.exits?.[direction];
        if (raw == null) return null;
        return normalizeExit(raw);
    }

    /**
     * All exits from a node as { direction, to, cost }[] (only defined compass keys).
     * @param {string} placeId
     */
    static outgoing(placeId) {
        const place = World.getPlace(placeId);
        if (!place?.exits) return [];
        return World.directions
            .filter((dir) => place.exits[dir] != null)
            .map((direction) => {
                const { to, cost } = normalizeExit(place.exits[direction]);
                return { direction, to, cost };
            });
    }

    /** Optional layout hint for maps; omit on nodes that don't need coordinates. */
    static getMapPos(placeId) {
        return World.getPlace(placeId)?.mapPos ?? null;
    }
}

export default World;
