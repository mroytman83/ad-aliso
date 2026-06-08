/** @typedef {{ id: string, name: string, baseHp: number, baseAtk: number, maxArmor: number }} EnemyTemplate */

/** @type {Record<string, EnemyTemplate>} */
export const ENEMIES = {
    vulture_imp: {
        id: 'vulture_imp',
        name: 'Vulture Imp',
        baseHp: 6,
        baseAtk: 3,
        maxArmor: 2,
    },
    anglii_framea_boat: {
        id: 'anglii_framea_boat',
        name: 'Anglii Frameati Boat',
        baseHp: 14,
        baseAtk: 4,
        maxArmor: 1,
    },
};

/** Enemies that may only appear in river terrain. */
export const RIVER_ONLY_ENEMY_IDS = ['anglii_framea_boat'];

/** Enemies that must not appear in river terrain. */
export const LAND_ENEMY_IDS = ['vulture_imp'];

export function getEnemy(id) {
    return ENEMIES[id] ?? null;
}

/**
 * @param {string} terrain
 * @param {string} enemyId
 */
export function canSpawnEnemyOnTerrain(terrain, enemyId) {
    if (terrain === 'river') {
        return RIVER_ONLY_ENEMY_IDS.includes(enemyId);
    }
    return LAND_ENEMY_IDS.includes(enemyId);
}
