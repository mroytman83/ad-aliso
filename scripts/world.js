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
        river_ford: {
            id: 'river_ford',
            title: 'River ford',
            mapPos: { x: 6, y: 0 },
            exits: {
                west: 'marshes_edge',
            },
        },
        marshes_edge: {
            id: 'marshes_edge',
            title: "Marshes' edge",
            mapPos: { x: 3, y: 0 },
            exits: {
                east: 'river_ford',
                west: 'teutoburg_fringe',
            },
        },
        teutoburg_fringe: {
            id: 'teutoburg_fringe',
            title: 'Forest fringe',
            mapPos: { x: 0, y: 0 },
            exits: {
                east: 'marshes_edge',
                west: 'corduroy_road',
                north: 'ridge_trail',
                south: 'alpine_forest_and_ravines',
            },
        },
        corduroy_road: {
            id: 'corduroy_road',
            title: 'Corduroy road',
            mapPos: { x: -3, y: 0 },
            exits: {
                east: 'teutoburg_fringe',
                west: 'lippe_valley',
            },
        },
        lippe_valley: {
            id: 'lippe_valley',
            title: 'Lippe valley',
            mapPos: { x: -6, y: 0 },
            exits: {
                east: 'corduroy_road',
                west: 'scorched_land',
            },
        },
        scorched_land: {
            id: 'scorched_land',
            title: 'Scorched land',
            mapPos: { x: -9, y: 0 },
            exits: {
                east: 'lippe_valley',
                west: 'aliso_gate',
            },
        },
        aliso_gate: {
            id: 'aliso_gate',
            title: 'Aliso gate',
            mapPos: { x: -12, y: 0 },
            exits: {
                east: 'scorched_land',
            },
        },
        ridge_trail: {
            id: 'ridge_trail',
            title: 'Ridge trail',
            mapPos: { x: 0, y: -2 },
            exits: {
                south: 'teutoburg_fringe',
                north: 'peat_bog_wetlands',
            },
        },
        peat_bog_wetlands: {
            id: 'peat_bog_wetlands',
            title: 'Peat bog wetlands',
            mapPos: { x: 0, y: -4 },
            exits: {
                south: 'ridge_trail',
                west: 'ems_riverbank',
                east: 'bog_turlough',
                north: 'ampsivarii_outpost',
            },
        },
        ems_riverbank: {
            id: 'ems_riverbank',
            title: 'Ems riverbank',
            mapPos: { x: -3, y: -4 },
            exits: {
                east: 'peat_bog_wetlands',
            },
        },
        bog_turlough: {
            id: 'bog_turlough',
            title: 'Bog turlough',
            mapPos: { x: 3, y: -4 },
            exits: {
                west: 'peat_bog_wetlands',
            },
        },
        ampsivarii_outpost: {
            id: 'ampsivarii_outpost',
            title: 'Ampsivarii outpost',
            mapPos: { x: 0, y: -6 },
            exits: {
                south: 'peat_bog_wetlands',
            },
        },
        alpine_forest_and_ravines: {
            id: 'alpine_forest_and_ravines',
            title: 'Alpine forest and ravines',
            mapPos: { x: 0, y: 4 },
            exits: {
                north: 'teutoburg_fringe',
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
