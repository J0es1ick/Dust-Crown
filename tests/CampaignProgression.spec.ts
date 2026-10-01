import { ERA_LAWS, LEGACY_BOONS } from "../src/catalogs/NewGamePlusCatalog";
import { ARENAS } from "../src/catalogs/WorldCatalog";
import { HERO_BACKGROUNDS } from "../src/catalogs/ChampionCatalog";
import { WorldGame } from "../src/gameplay/core/WorldGame";
import { HERO_CLASSES } from "../src/gameplay/core/WorldGameConfig";
import { BattleSession } from "../src/gameplay/combat/AdvancedBattle";
import {
  championItem,
  claimChampionPrize,
  restoreChampionPrizes,
} from "../src/gameplay/equipment/ChampionEquipment";
import { createItem } from "../src/factories/ItemFactory";
import { SeededRandom } from "../src/gameplay/core/RandomSource";
import { validateWorldSave } from "../src/gameplay/save/WorldSaveValidation";
import { campaignStage } from "../src/gameplay/progression/CampaignProgression";
import {
  isWorldPageAvailable,
  type WorldPageId,
} from "../src/web/react/app/routing/WorldPageCatalog";

function restore(game: WorldGame): WorldGame {
  const save = JSON.parse(JSON.stringify(game.save));
  expect(validateWorldSave(save)).toEqual({ valid: true, issues: [] });
  return WorldGame.restore(save);
}
function championship(game: WorldGame, index: number): WorldGame {
  const arena = ARENAS[index];
  game.save.worldDay = game.registerTournament(arena.id);
  game.beginTournament(arena.id);
  while (game.save.pendingBattle) {
    game = restore(game);
    const pending = game.save.pendingBattle!;
    const session = new BattleSession(pending.session);
    session.forfeit(pending.enemyId);
    pending.session = session.snapshot();
    game.finalizePendingBattle();
  }
  return game;
}

describe("Classic campaign discovery and champion trophies", () => {
  test.each(HERO_BACKGROUNDS)(
    "preserves $id without adding a nemesis or changing the opening balance",
    ({ id }) => {
      const game = WorldGame.create("Путник", "Monk", 88201, id);
      expect(restore(game).save.hero.background).toBe(id);
      expect(game.save).not.toHaveProperty("journey");
      const plain = WorldGame.create("Путник", "Monk", 88201);
      const { background, ...hero } = game.save.hero;
      expect(hero).toEqual(plain.save.hero);
      expect(game.nextTournamentDay(ARENAS[0].id)).toBe(
        plain.nextTournamentDay(ARENAS[0].id),
      );
    },
  );

  test("keeps the classic championship requirement and awards once across round reloads", () => {
    let game = WorldGame.create("Путник", "Knight", 88202);
    game.save.hero.level = 40;
    game = championship(game, 0);
    expect(game.save.hero.highestArena).toBe(0);
    const trophy = game.save.hero.inventory.find(
      (item) => item.templateId === "champion-Knight-0",
    )!;
    expect(trophy).toBeDefined();
    game.save.hero.gold = 100000;
    game.save.hero.temperingMarks = 50;
    game.upgradeItem(trophy.id);
    const attack = game.save.hero.inventory.find(
      (item) => item.id === trophy.id,
    )!.stats.attack;
    for (let win = 1; win < ARENAS[0].winsToAdvance; win++)
      game = championship(game, 0);
    expect(game.save.hero.highestArena).toBe(1);
    expect(
      game.save.hero.inventory.filter(
        (item) => item.templateId === trophy.templateId,
      ),
    ).toHaveLength(1);
    expect(
      game.save.hero.inventory.find((item) => item.id === trophy.id)!.stats
        .attack,
    ).toBe(attack);
    game = championship(game, 1);
    const grown = game.save.hero.inventory.find(
      (item) => item.id === trophy.id,
    )!;
    expect(grown.enhancement).toBe(1);
    expect(grown.stats.attack).toBe(
      Math.ceil(championItem("Knight", 0, 2, 1).stats.attack! * 1.08),
    );
    const finished = JSON.stringify(game.save);
    expect(() => game.finalizePendingBattle()).toThrow();
    expect(JSON.stringify(game.save)).toBe(finished);
  });

  test("restores already earned trophies once without equipping them or consuming RNG", () => {
    let game = WorldGame.create("Ветеран", "Archer", 88203);
    game.save.hero.arenaWins = ARENAS.map(() => 3);
    game.save.hero.highestArena = 5;
    const equipped = structuredClone(game.save.hero.equipped);
    const random = structuredClone(game.save.randomSnapshots);
    restoreChampionPrizes(game.save);
    const trophies = game.save.hero.inventory.filter((item) =>
      item.templateId.startsWith("champion-"),
    );
    expect(trophies).toHaveLength(6);
    expect(new Set(trophies.map((item) => item.level))).toEqual(new Set([32]));
    expect(game.save.hero.equipped).toEqual(equipped);
    expect(game.save.randomSnapshots).toEqual(random);
    game = restore(game);
    expect(restore(game).save.hero.inventory).toEqual(game.save.hero.inventory);
    expect(game.newGamePlusStatus().unlocked).toBe(false);
  });

  test("class changes retain trophy identity and tempering, and protect them from sale and salvage", () => {
    let game = WorldGame.create("Чемпион", "Knight", 88204);
    game.save.hero.arenaWins = ARENAS.map(() => 1);
    game.save.hero.highestArena = 5;
    game = restore(game);
    game.save.hero.gold = 100000;
    game.save.hero.temperingMarks = 100;
    const trophy = game.save.hero.inventory.find(
      (item) => item.templateId === "champion-Knight-0",
    )!;
    game.upgradeItem(trophy.id);
    const stats = structuredClone(trophy.stats);
    game.changeHeroClass("Wizard");
    expect(trophy.templateId).toBe("champion-Wizard-0");
    expect(trophy.stats).toEqual(stats);
    expect(trophy.enhancement).toBe(1);
    game.unequip(trophy.slot);
    expect(() => game.sell(trophy.id)).toThrow("Трофеи чемпиона");
    expect(() => game.salvageItem(trophy.id)).toThrow("Трофеи чемпиона");
    expect(claimChampionPrize(game.save, 0)).toBeUndefined();
    expect(
      restore(game).save.hero.inventory.filter((item) =>
        item.templateId.startsWith("champion-"),
      ),
    ).toHaveLength(6);
  });

  test("opens each group at its arena and rejects invalid saves", () => {
    const game = WorldGame.create("Путник", "Monk", 88205);
    const available = (page: WorldPageId) =>
      isWorldPageAvailable(page, (id) => game.isFeatureUnlocked(id), game.save);
    expect(available("hero")).toBe(true);
    expect(available("settings")).toBe(true);
    for (const page of [
      "shop",
      "arsenal",
      "skills",
      "chronicle",
      "leaders",
    ] as const)
      expect(available(page)).toBe(false);
    for (const [stage, pages] of [
      [1, ["shop", "arsenal", "skills", "forge"]],
      [2, ["chronicle", "contracts", "legacy", "collections"]],
      [3, ["leaders", "fighters"]],
      [4, ["relics"]],
    ] as const) {
      game.save.hero.highestArena = stage;
      game.save.hero.arenaWins = ARENAS.map((_, index) =>
        index < stage ? 4 : 0,
      );
      expect(campaignStage(game.save)).toBe(stage);
      for (const page of pages) expect(available(page)).toBe(true);
      expect(available("elite")).toBe(false);
    }
    expect(validateWorldSave({ ...game.save, journey: {} }).valid).toBe(false);
    expect(
      validateWorldSave({
        ...game.save,
        hero: { ...game.save.hero, background: "unknown" },
      }).valid,
    ).toBe(false);
    expect(
      validateWorldSave({
        ...game.save,
        hero: {
          ...game.save.hero,
          championArenaIds: [ARENAS[0].id, ARENAS[0].id],
        },
      }).valid,
    ).toBe(false);
  });

  test("defers old championship rewards until the saved battle is resolved", () => {
    let game = WorldGame.create("Ветеран", "Monk", 88206);
    game.save.hero.arenaWins[0] = 1;
    game.beginDuel();
    const before = structuredClone(game.save.pendingBattle!.session);
    game = restore(game);
    expect(
      game.save.hero.inventory.some((item) =>
        item.templateId.startsWith("champion-"),
      ),
    ).toBe(false);
    expect(game.save.pendingBattle!.session.hero.attack).toBe(
      before.hero.attack,
    );
    game.stepPendingBattle();
    game.abortPendingBattle();
    expect(
      game.save.hero.inventory.filter((item) =>
        item.templateId.startsWith("champion-"),
      ),
    ).toHaveLength(1);
    expect(
      restore(game).save.hero.inventory.filter((item) =>
        item.templateId.startsWith("champion-"),
      ),
    ).toHaveLength(1);
  });

  test("a successor starts a new set after the classic elite ending", () => {
    let game = WorldGame.create("Основатель", "Knight", 88207, "debtor");
    game.save.hero.highestArena = 5;
    game.save.hero.arenaWins = ARENAS.map(() => 1);
    game = restore(game);
    expect(game.newGamePlusStatus().unlocked).toBe(false);
    game.save.hero.crownLeagueWins = 1;
    game.save.hero.legendDefenses = 1;
    game.save.eliteLeagueMemberIds = [
      "hero",
      ...game.save.eliteLeagueMemberIds.filter((id) => id !== "hero"),
    ].slice(0, 30);
    game.save.eliteRatings.hero = 4000;
    const status = game.newGamePlusStatus();
    expect(status.unlocked).toBe(true);
    const next = restore(
      game.beginNewChronicle(
        {
          name: "Наследник",
          classId: "Knight",
          boonId: LEGACY_BOONS.find(
            (boon) => boon.sealCost <= status.availableSeals,
          )!.id,
          lawIds: ERA_LAWS.slice(0, status.lawLimit).map((law) => law.id),
        },
        88208,
      ),
    );
    expect(next.save.legacy.cycle).toBe(2);
    expect(next.save.hero.background).toBe("heir");
    expect(campaignStage(next.save)).toBe(0);
    expect(next.save.hero.championArenaIds ?? []).toHaveLength(0);
    const item = claimChampionPrize(next.save, 0)!;
    expect(item.id).toBe("champion-2-Knight-0");
    expect(
      game.save.hero.inventory.some((previous) => previous.id === item.id),
    ).toBe(false);
  });

  test("random loot never grants championship trophies, even with an empty template selection", () => {
    for (const classId of HERO_CLASSES)
      for (let seed = 0; seed < 20; seed++) {
        expect(
          createItem(15, {
            classId,
            slot: "offhand",
            templateId: "missing",
            randomSource: new SeededRandom(seed),
          }).templateId.startsWith("champion-"),
        ).toBe(false);
      }
  });
});
