import {
  CHAMPION_NAMES,
  CAMPAIGN_STAGES,
} from "../../catalogs/ChampionCatalog";
import { ARENAS } from "../../catalogs/WorldCatalog";
import type {
  EquipmentItem,
  GameSave,
  HeroClass,
  Stats,
} from "../core/WorldTypes";

function championStage(save: GameSave): number {
  return Math.max(
    1,
    ...(save.hero.championArenaIds ?? []).map(
      (id) => ARENAS.findIndex((arena) => arena.id === id) + 1,
    ),
  );
}

export function restoreChampionPrizes(save: GameSave): EquipmentItem[] {
  if (save.pendingBattle) return [];
  const items: EquipmentItem[] = [];
  ARENAS.forEach((arena, index) => {
    if (!save.hero.arenaWins[index]) return;
    const existing = save.hero.inventory.find(
      (item) =>
        item.id ===
        `champion-${save.legacy.cycle}-${save.hero.classId}-${index}`,
    );
    if (existing) {
      const claimed = (save.hero.championArenaIds ??= []);
      if (!claimed.includes(arena.id)) claimed.push(arena.id);
      return;
    }
    const item = claimChampionPrize(save, index);
    if (!item) return;
    save.hero.inventory.push(item);
    if (!save.discoveredItems.includes(item.templateId))
      save.discoveredItems.push(item.templateId);
    items.push(item);
  });
  return items;
}

export function championItem(
  classId: HeroClass,
  arenaIndex: number,
  stage: number,
  cycle: number,
): EquipmentItem {
  const definition = CAMPAIGN_STAGES[arenaIndex];
  const level =
    CAMPAIGN_STAGES[
      Math.max(arenaIndex, Math.min(stage - 1, CAMPAIGN_STAGES.length - 1))
    ].level;
  const main: Record<string, keyof Stats> = {
    weapon: "attack",
    hands: "attack",
    feet: "speed",
    head: "defense",
    chest: "health",
    offhand: "defense",
  };
  const stat = main[definition.slot];
  const stats: Partial<Stats> = {
    [stat]: Math.round(
      stat === "health"
        ? 70 + level * 9
        : stat === "speed"
          ? 8 + level * 0.7
          : 12 + level * 2.3,
    ),
  };
  if (stat !== "health") stats.health = 16 + level * 2;
  const names = {
    weapon: "Оружие",
    hands: "Перчатки",
    feet: "Сапоги",
    head: "Венец",
    chest: "Доспех",
    offhand: "Талисман",
  };
  return {
    id: `champion-${cycle}-${classId}-${arenaIndex}`,
    templateId: `champion-${classId}-${arenaIndex}`,
    name: `${names[definition.slot]} · ${CHAMPION_NAMES[classId]}`,
    slot: definition.slot,
    rarity: "mythic",
    level,
    stats,
    allowedClasses: [classId],
    price: 0,
    setId: `champion-${classId}`,
    enhancement: 0,
    relicTier: 0,
    relicRenown: 0,
    relicFeats: [],
    relicProperties: [],
    relicHistory: [`Первая победа: ${ARENAS[arenaIndex].name}`],
  };
}
export function claimChampionPrize(
  save: GameSave,
  arenaIndex: number,
): EquipmentItem | undefined {
  const claimed = (save.hero.championArenaIds ??= []);
  const arenaId = ARENAS[arenaIndex].id;
  if (claimed.includes(arenaId)) return undefined;
  const previousStage = championStage(save);
  claimed.push(arenaId);
  const stage = championStage(save);
  for (const item of save.hero.inventory) {
    if (!item.id.startsWith(`champion-${save.legacy.cycle}-`)) continue;
    const index = CAMPAIGN_STAGES.findIndex(
      (_, i) => item.templateId === `champion-${save.hero.classId}-${i}`,
    );
    if (index < 0) continue;
    const upgraded = championItem(
      save.hero.classId,
      index,
      stage,
      save.legacy.cycle,
    );
    const previous = championItem(
      save.hero.classId,
      index,
      previousStage,
      save.legacy.cycle,
    );
    for (const key of Object.keys(upgraded.stats) as Array<keyof Stats>) {
      let oldValue = previous.stats[key] ?? 0;
      let newValue = upgraded.stats[key] ?? 0;
      for (let step = 0; step < (item.enhancement ?? 0); step++) {
        oldValue = Math.max(oldValue + 1, Math.ceil(oldValue * 1.08));
        newValue = Math.max(newValue + 1, Math.ceil(newValue * 1.08));
      }
      item.stats[key] = (item.stats[key] ?? 0) + newValue - oldValue;
    }
    item.level += upgraded.level - previous.level;
  }
  return championItem(save.hero.classId, arenaIndex, stage, save.legacy.cycle);
}
export function attuneChampionTrophies(save: GameSave): void {
  for (const item of save.hero.inventory) {
    if (!item.id.startsWith(`champion-${save.legacy.cycle}-`)) continue;
    const index = CAMPAIGN_STAGES.findIndex((_, i) =>
      item.templateId.endsWith(`-${i}`),
    );
    if (index < 0) continue;
    const updated = championItem(
      save.hero.classId,
      index,
      championStage(save),
      save.legacy.cycle,
    );
    item.templateId = updated.templateId;
    item.name = updated.name;
    item.allowedClasses = updated.allowedClasses;
    item.setId = updated.setId;
    if (!save.discoveredItems.includes(item.templateId))
      save.discoveredItems.push(item.templateId);
  }
}
