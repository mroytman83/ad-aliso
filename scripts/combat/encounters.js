import { getEnemy } from './enemies.js';

/** @typedef {{ hp: number, maxHp: number, atk: number, armor: number }} CombatUnit */

/**
 * @param {string} enemyId
 * @param {() => number} rng
 * @returns {{ enemyId: string, units: CombatUnit[], displayName: string } | null}
 */
export function rollEncounterByEnemyId(enemyId, rng) {
    if (enemyId === 'vulture_imp') return rollVultureImpEncounter(rng);
    if (enemyId === 'anglii_framea_boat') return rollAngliiFrameatiBoatEncounter(rng);
    return null;
}

/**
 * @param {() => number} rng
 * @returns {{ enemyId: string, units: CombatUnit[], displayName: string }}
 */
export function rollVultureImpEncounter(rng) {
    const template = getEnemy('vulture_imp');
    const count = rollVultureGroupSize(rng);
    const units = [];
    for (let i = 0; i < count; i++) {
        const armor = Math.floor(rng() * (template.maxArmor + 1));
        units.push({
            hp: template.baseHp,
            maxHp: template.baseHp,
            atk: template.baseAtk,
            armor,
        });
    }
    const displayName =
        count === 1 ? template.name : `${template.name} x${count}`;
    return { enemyId: 'vulture_imp', units, displayName };
}

/**
 * @param {() => number} rng
 * @returns {{ enemyId: string, units: CombatUnit[], displayName: string }}
 */
export function rollAngliiFrameatiBoatEncounter(rng) {
    const template = getEnemy('anglii_framea_boat');
    const armor = Math.floor(rng() * (template.maxArmor + 1));
    return {
        enemyId: 'anglii_framea_boat',
        units: [
            {
                hp: template.baseHp,
                maxHp: template.baseHp,
                atk: template.baseAtk,
                armor,
            },
        ],
        displayName: template.name,
    };
}

/**
 * @param {() => number} rng
 */
function rollVultureGroupSize(rng) {
    const r = rng();
    if (r < 0.5) return 1;
    if (r < 0.85) return 2;
    return 5;
}

/**
 * @param {CombatUnit[]} units
 * @param {() => number} rng
 * @param {number} maxTotal
 * @param {string} enemyId
 * @returns {CombatUnit[]}
 */
export function spawnReinforcements(units, rng, maxTotal = 5, enemyId = 'vulture_imp') {
    if (enemyId === 'anglii_framea_boat') return units;

    const template = getEnemy(enemyId);
    if (!template) return units;

    const room = maxTotal - units.length;
    if (room <= 0) return units;

    const add = rng() < 0.5 ? 1 : Math.min(2, room);
    const next = [...units];
    for (let i = 0; i < add; i++) {
        next.push({
            hp: template.baseHp,
            maxHp: template.baseHp,
            atk: template.baseAtk,
            armor: Math.floor(rng() * (template.maxArmor + 1)),
        });
    }
    return next;
}

/**
 * @param {{ units: CombatUnit[], activeIndex: number, enemyId?: string }} battle
 * @param {() => number} rng
 */
export function tryEnemyFlee(battle, rng) {
    const active = battle.units[battle.activeIndex];
    if (!active) return false;

    if (battle.enemyId === 'anglii_framea_boat') {
        const hpRatio = active.hp / active.maxHp;
        let chance = 0.12;
        if (hpRatio < 0.4) chance = 0.55;
        else if (hpRatio < 0.65) chance = 0.28;
        return rng() < chance;
    }

    const hpRatio = active.hp / active.maxHp;
    let chance = 0.08;
    if (hpRatio < 0.35) chance = 0.45;
    else if (hpRatio < 0.6) chance = 0.22;
    if (battle.units.length >= 4) chance += 0.1;
    return rng() < chance;
}
