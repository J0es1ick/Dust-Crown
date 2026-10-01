import { WorldGame } from "../src/gameplay/core/WorldGame";
import { ARENAS } from "../src/catalogs/WorldCatalog";
import { ERA_LAWS } from "../src/catalogs/NewGamePlusCatalog";
import { worldFeatureAvailability } from "../src/gameplay/world/WorldFeatureProgression";

describe("world discovery", () => {
  test("workshops reject early actions without spending resources or changing RNG", () => {
    const game = WorldGame.create("Кузнец", "Knight", 9137);
    game.save.hero.temperingMarks = 10;
    game.save.hero.gold = 100_000;
    const item = game.save.hero.inventory[0];
    const before = JSON.stringify(game.save);
    expect(() => game.upgradeItem(item.id)).toThrow("чемпионом");
    expect(() => game.reforgeItem(item.id, { sourceStat: "attack" })).toThrow(
      "чемпионом",
    );
    expect(() => game.setLootTarget({ slot: "weapon" })).toThrow("чемпионом");
    expect(JSON.stringify(game.save)).toBe(before);
    game.save.hero.arenaWins[0] = 1;
    expect(game.isFeatureUnlocked("forge")).toBe(true);
    expect(game.isFeatureUnlocked("equipment-legacy")).toBe(false);
    game.upgradeItem(item.id);
    game.save.hero.arenaWins[1] = 1;
    game.setLootTarget({ slot: "weapon" });
    expect(game.save.lootTarget?.slot).toBe("weapon");
  });

  test("first place grants one persistent invitation, second place does not", () => {
    const game = WorldGame.create("Чемпион", "Knight", 9138);
    game.save.hero.highestArena = ARENAS.length - 1;
    game.save.hero.arenaWins[ARENAS.length - 1] = 1;
    game.save.hero.rating = 10_000;
    const rival = game.save.enemies.find(
      (enemy) =>
        enemy.alive && !game.save.eliteLeagueMemberIds.includes(enemy.id),
    )!;
    rival.rating = 10_001;
    expect(game.heroRank()).toBe(2);
    expect(game.isFeatureUnlocked("crown-league")).toBe(false);
    const before = JSON.stringify(game.save);
    expect(() => game.registerCrownLeague()).toThrow("первое место");
    expect(JSON.stringify(game.save)).toBe(before);
    rival.rating = 9_999;
    expect(game.heroRank()).toBe(1);
    const unlocks = game
      .consumeFeatureUnlocks()
      .filter((entry) => entry.id === "crown-league");
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0].title).toBe("Приглашение без подписи");
    game.save.hero.rating = 1;
    expect(game.crownLeagueRegistrationAvailability().unlocked).toBe(true);
    const restored = WorldGame.restore(JSON.parse(JSON.stringify(game.save)));
    expect(restored.isFeatureUnlocked("crown-league")).toBe(true);
    expect(
      restored
        .consumeFeatureUnlocks()
        .some((entry) => entry.id === "crown-league"),
    ).toBe(false);
  });

  test("existing league participants retain access when migrating", () => {
    const game = WorldGame.create("Ветеран", "Knight", 9139);
    game.save.hero.crownLeagueWins = 1;
    expect(worldFeatureAvailability(game.save, "crown-league").unlocked).toBe(
      true,
    );
    const restored = WorldGame.restore(JSON.parse(JSON.stringify(game.save)));
    expect(restored.save.unlockedFeatureIds).toContain("crown-league");
  });

  test("new era retains the forge boon but requires championships again", () => {
    const game = WorldGame.create("Мастер", "Knight", 9140);
    game.save.hero.highestArena = ARENAS.length - 1;
    game.save.hero.arenaWins[ARENAS.length - 1] = 1;
    game.save.hero.crownLeagueWins = 1;
    game.save.hero.legendDefenses = 1;
    game.save.eliteLeagueMemberIds = [
      "hero",
      ...game.save.eliteLeagueMemberIds,
    ].slice(0, 30);
    game.save.eliteRatings.hero = 100_000;
    game.save.legacy.seals = 100;
    const status = game.newGamePlusStatus();
    const next = game.beginNewChronicle(
      {
        name: "Ученик",
        classId: "Knight",
        boonId: "forge-tradition",
        lawIds: ERA_LAWS.slice(0, status.lawLimit).map((law) => law.id),
      },
      9141,
    );
    expect(next.save.legacy.activeBoonId).toBe("forge-tradition");
    expect(next.isFeatureUnlocked("forge")).toBe(false);
    expect(next.isFeatureUnlocked("equipment-legacy")).toBe(false);
    expect(next.isFeatureUnlocked("crown-league")).toBe(false);
    const item = next.save.hero.inventory[0];
    expect(() => next.upgradeItem(item.id)).toThrow("чемпионом");
    next.save.hero.arenaWins[0] = 1;
    next.upgradeItem(item.id);
    expect(next.save.hero.temperingMarks).toBe(0);
  });
});

describe("school prestige", () => {
  test("counts student achievements once and preserves the contribution of the deceased", () => {
    const game = WorldGame.create("Историк", "Knight", 9142);
    const [founder, student, novice] = game.save.enemies;
    founder.tournamentWins = 100;
    student.tournamentWins = 3;
    novice.tournamentWins = 0;
    game.save.eliteCrownWins[student.id] = 2;
    game.save.npcLife!.dynasties = [
      {
        id: "school",
        name: "Школа",
        founderId: founder.id,
        founderName: founder.name,
        factionId: "wardens",
        foundedDay: 1,
        memberIds: [founder.id, student.id, student.id, novice.id],
        prestige: 40,
      },
    ];
    expect(game.npcDynasties()[0]).toMatchObject({
      founderPrestige: 40,
      studentPrestige: 42,
      prestige: 82,
      historicalStudents: 2,
      activeStudents: 2,
    });
    student.tournamentWins += 1;
    student.alive = false;
    const before = JSON.stringify(game.save);
    expect(game.npcDynasties()[0]).toMatchObject({
      prestige: 86,
      activeStudents: 1,
    });
    expect(JSON.stringify(game.save)).toBe(before);
    const restored = WorldGame.restore(JSON.parse(JSON.stringify(game.save)));
    expect(restored.npcDynasties()[0].prestige).toBe(86);
  });
});
