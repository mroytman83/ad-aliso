import { rollEncounterByEnemyId, spawnReinforcements, tryEnemyFlee } from './encounters.js';
import { getEnemy } from './enemies.js';
import { getAlliesAttackPower } from '../allies/allies.js';
import { mulberry32, stableHash32 } from '../util/random.js';

/**
 * @param {object} player
 * @param {import('./encounters.js').rollVultureImpEncounter extends Function ? ReturnType<typeof rollVultureImpEncounter> : object} encounter
 * @param {number} [seed]
 */
export function createBattle(player, encounter, seed = Date.now()) {
    const units = encounter.units.map((u) => ({ ...u }));
    const allies = (player.allies ?? []).map((a) => ({ ...a }));
    return {
        seed,
        enemyId: encounter.enemyId,
        displayName: encounter.displayName,
        units,
        allies,
        activeIndex: 0,
        player: {
            hp: player.hp ?? 24,
            maxHp: player.maxHp ?? 24,
            atk: player.atk ?? 6,
        },
        log: ['Wild ' + encounter.displayName + ' appeared!'],
        menuIndex: 0,
        phase: 'menu',
        outcome: null,
        animFrame: 0,
    };
}

export function startBattle(player, enemyId, seed) {
    const rng = mulberry32(seed ?? stableHash32('battle'));
    const encounter = rollEncounterByEnemyId(enemyId, rng);
    if (!encounter) return null;
    return createBattle(player, encounter, seed);
}

function rngFor(battle, salt) {
    return mulberry32(stableHash32(`${battle.seed}|${salt}|${battle.log.length}`));
}

function activeUnit(battle) {
    return battle.units[battle.activeIndex] ?? null;
}

function advanceActive(battle) {
    while (battle.activeIndex < battle.units.length) {
        const u = battle.units[battle.activeIndex];
        if (u && u.hp > 0) return;
        battle.activeIndex += 1;
    }
}

/**
 * @param {ReturnType<typeof createBattle>} battle
 */
export function playerFight(battle) {
    const imp = activeUnit(battle);
    if (!imp) {
        battle.outcome = 'victory';
        return battle;
    }
    const dmg = Math.max(1, battle.player.atk - imp.armor);
    imp.hp = Math.max(0, imp.hp - dmg);
    const armorNote = imp.armor > 0 ? ` (armor ${imp.armor})` : '';
    battle.log.push(`Marcus strikes for ${dmg} damage${armorNote}.`);
    if (imp.hp <= 0) {
        battle.log.push('One imp collapses into the mud.');
        battle.activeIndex += 1;
        advanceActive(battle);
    }
    if (battle.units.every((u) => u.hp <= 0)) {
        battle.outcome = 'victory';
        battle.log.push('The scavengers are routed.');
    } else {
        battle.phase = 'enemy';
    }
    return battle;
}

/** @param {ReturnType<typeof createBattle>} battle */
export function hasBattleAllies(battle) {
    return (battle.allies ?? []).some((a) => (a.hp ?? 0) > 0);
}

/** @param {ReturnType<typeof createBattle>} battle */
export function playerOrderAllies(battle) {
    const imp = activeUnit(battle);
    if (!imp) {
        battle.outcome = 'victory';
        return battle;
    }
    const allies = (battle.allies ?? []).filter((a) => (a.hp ?? 0) > 0);
    const totalAtk = getAlliesAttackPower(allies);
    const dmg = Math.max(1, totalAtk - imp.armor);
    imp.hp = Math.max(0, imp.hp - dmg);
    battle.log.push(`Marcus orders allies forward for ${dmg} damage.`);
    if (imp.hp <= 0) {
        battle.log.push('Enemy line buckles under the allied push.');
        battle.activeIndex += 1;
        advanceActive(battle);
    }
    if (battle.units.every((u) => u.hp <= 0)) {
        battle.outcome = 'victory';
        battle.log.push('The enemy breaks and scatters.');
    } else {
        battle.phase = 'enemy';
    }
    return battle;
}

/**
 * @param {ReturnType<typeof createBattle>} battle
 */
export function playerRun(battle) {
    const rng = rngFor(battle, 'run');
    if (rng() < 0.65) {
        battle.outcome = 'escaped';
        battle.log.push('Marcus breaks away into the smoke.');
    } else {
        battle.log.push('Blocked! The imps screech and press in.');
        battle.phase = 'enemy';
    }
    return battle;
}

/**
 * @param {ReturnType<typeof createBattle>} battle
 */
export function enemyTurn(battle) {
    if (battle.outcome) return battle;

    const imp = activeUnit(battle);
    if (!imp) {
        battle.outcome = 'victory';
        return battle;
    }

    const rng = rngFor(battle, 'enemy');
    const dmg = Math.max(1, imp.atk);
    battle.player.hp = Math.max(0, battle.player.hp - dmg);
    const enemyName = getEnemy(battle.enemyId)?.name ?? 'Enemy';
    if (battle.enemyId === 'anglii_framea_boat') {
        battle.log.push(`${enemyName} rams the hull line for ${dmg} damage.`);
    } else {
        battle.log.push(`${enemyName} claws for ${dmg} damage.`);
    }

    if (battle.player.hp <= 0) {
        battle.outcome = 'defeat';
        if (battle.enemyId === 'anglii_framea_boat') {
            battle.log.push('Marcus goes under. The river takes the rest.');
        } else {
            battle.log.push('Marcus falls. The imps strip what they can.');
        }
        battle.phase = 'end';
        return battle;
    }

    if (tryEnemyFlee(battle, rng)) {
        battle.outcome = 'fled';
        if (battle.enemyId === 'anglii_framea_boat') {
            battle.log.push('The dugout pulls away downstream.');
        } else {
            battle.log.push('The imps scatter with their loot.');
        }
        battle.phase = 'end';
        return battle;
    }

    if (
        battle.enemyId !== 'anglii_framea_boat' &&
        battle.units.length < 5 &&
        rng() < 0.28
    ) {
        const before = battle.units.length;
        battle.units = spawnReinforcements(battle.units, rng, 5, battle.enemyId);
        const added = battle.units.length - before;
        if (added > 0) {
            battle.log.push(`Reinforcements! ${added} more imp(s) join the fight.`);
        }
    }

    battle.phase = 'menu';
    return battle;
}

/**
 * @param {ReturnType<typeof createBattle>} battle
 */
export function isBattleOver(battle) {
    return battle.outcome != null;
}

/** @param {ReturnType<typeof createBattle>} battle */
export function getEnemyLabel(battle) {
    const alive = battle.units.filter((u) => u.hp > 0).length;
    const template = getEnemy(battle.enemyId);
    const name = template?.name ?? 'Enemy';
    return alive <= 1 ? name : `${name} x${alive}`;
}

/** @param {ReturnType<typeof createBattle>} battle */
export function getActiveEnemyHp(battle) {
    const imp = activeUnit(battle);
    if (!imp) return { current: 0, max: 1 };
    return { current: imp.hp, max: imp.maxHp };
}
