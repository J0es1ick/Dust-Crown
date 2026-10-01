import { ARENAS } from "../../catalogs/WorldCatalog";
import {
  byLeaderboardPosition,
  enemyLeaderboardEntry,
  heroLeaderboardEntry,
} from "./WorldRanking";
import {
  ActivityAvailability,
  GameSave,
  WorldFeatureId,
  WorldFeatureUnlock,
} from "../core/WorldTypes";

export const CONTRACTS_UNLOCK_ARENA_INDEX = 0;
export const EQUIPMENT_LEGACY_UNLOCK_ARENA_INDEX = 1;

interface WorldFeatureDefinition {
  id: WorldFeatureId;
  title: string;
  description: string;
  tutorialId: WorldFeatureUnlock["tutorialId"];
  arenaIndex: number;
}

export const WORLD_FEATURE_DEFINITIONS: Readonly<
  Record<WorldFeatureId, WorldFeatureDefinition>
> = {
  contracts: {
    id: "contracts",
    title: "Открыта доска контрактов",
    description:
      "После первого чемпионства фракции готовы доверять герою поручения с особыми наградами и репутацией.",
    tutorialId: "contracts",
    arenaIndex: CONTRACTS_UNLOCK_ARENA_INDEX,
  },
  forge: {
    id: "forge",
    title: "Кузница открыта для чемпиона",
    description:
      "Первое чемпионство заслужило доверие кузнеца. Теперь можно закалять снаряжение и перековывать его свойства; унаследованные кузнечные традиции продолжают действовать.",
    tutorialId: "forge",
    arenaIndex: 0,
  },
  "equipment-legacy": {
    id: "equipment-legacy",
    title: "Открыто наследие снаряжения",
    description:
      "Легендарные и мифические вещи теперь запоминают значимые победы, растут вместе с героем и могут стать мировыми реликвиями высшей редкости.",
    tutorialId: "equipment-legacy",
    arenaIndex: EQUIPMENT_LEGACY_UNLOCK_ARENA_INDEX,
  },
  "crown-league": {
    id: "crown-league",
    title: "Приглашение без подписи",
    description:
      "Вы заняли первое место среди обычных бойцов. Вечером вам передали запечатанное письмо: «Победители знакомых арен — лишь начало. Приходите на турнир тех, кто уже носил корону». Открыта Лига короны.",
    tutorialId: "crown-league",
    arenaIndex: ARENAS.length - 1,
  },
};

export const WORLD_FEATURE_IDS = Object.keys(
  WORLD_FEATURE_DEFINITIONS,
) as WorldFeatureId[];

export function hasReachedWorldFeatureMilestone(
  save: GameSave,
  id: WorldFeatureId,
): boolean {
  if (id === "crown-league") {
    if (
      save.eliteLeagueMemberIds.includes("hero") ||
      save.hero.crownLeagueWins > 0 ||
      save.pendingBattle?.kind === "crown-league" ||
      save.tournamentRegistrations["crown-league"] !== undefined
    )
      return true;
    if (!save.hero.arenaWins.some((wins) => wins > 0)) return false;
    const elite = new Set(save.eliteLeagueMemberIds);
    const hero = heroLeaderboardEntry(save.hero, {
      crownLeagueWins: save.hero.crownLeagueWins,
    });
    return !save.enemies.some(
      (enemy) =>
        enemy.alive &&
        !elite.has(enemy.id) &&
        byLeaderboardPosition(enemyLeaderboardEntry(enemy), hero) < 0,
    );
  }
  const arenaIndex = WORLD_FEATURE_DEFINITIONS[id].arenaIndex;
  return save.hero.arenaWins.slice(arenaIndex).some((wins) => wins >= 1);
}

export function worldFeatureAvailability(
  save: GameSave,
  id: WorldFeatureId,
): ActivityAvailability {
  if (
    save.unlockedFeatureIds.includes(id) ||
    hasReachedWorldFeatureMilestone(save, id)
  ) {
    return {
      unlocked: true,
      reason: WORLD_FEATURE_DEFINITIONS[id].description,
    };
  }
  const arena = ARENAS[WORLD_FEATURE_DEFINITIONS[id].arenaIndex];
  if (id === "crown-league")
    return {
      unlocked: false,
      reason: "Займите первое место в обычном рейтинге.",
    };
  return {
    unlocked: false,
    reason:
      id === "forge"
        ? `Станьте чемпионом турнира «${arena.name}», чтобы открыть кузницу.`
        : id === "contracts"
          ? `Станьте чемпионом турнира «${arena.name}», чтобы фракции начали предлагать контракты.`
          : `Станьте чемпионом турнира «${arena.name}», чтобы легендарное снаряжение начало сохранять историю побед.`,
  };
}

export function createWorldFeatureUnlock(
  save: GameSave,
  id: WorldFeatureId,
): WorldFeatureUnlock {
  const definition = WORLD_FEATURE_DEFINITIONS[id];
  return {
    id,
    day: save.worldDay,
    title: definition.title,
    description: definition.description,
    tutorialId: definition.tutorialId,
  };
}
