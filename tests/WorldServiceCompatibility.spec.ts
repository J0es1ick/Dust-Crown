import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { WorldGame } from "../src/gameplay/core/WorldGame";
import { ARENAS, DUNGEONS } from "../src/catalogs/WorldCatalog";
import { ERA_LAWS, LEGACY_BOONS } from "../src/catalogs/NewGamePlusCatalog";

describe("world service determinism", () => {
  afterEach(() => jest.restoreAllMocks());

  test("preserves complete save and RNG checkpoints under the current combat rules", () => {
    const now = 1750000000000;
    jest.spyOn(Date, "now").mockReturnValue(now);
    const game = WorldGame.create("Аудит", "Knight", now);
    const hash = () =>
      createHash("sha256").update(JSON.stringify(game.save)).digest("hex");
    expect(hash()).toBe(
      "698e333e86b0fb731e6f09f238cd1c3bfdf238ba8bf49074b09c1bc73e857d76",
    );
    game.save.hero.temperingMarks = 10;
    game.save.hero.arenaWins[1] = 1;
    game.upgradeItem(game.save.hero.inventory[0].id);
    game.equipBest("set");
    game.setLootTarget({ slot: "weapon" });
    expect(hash()).toBe(
      "ed7b1402cdb7db5a0fe2a9f8bc8f8ddf1e9f3cbf348534f8cfd065ffd75939ba",
    );
    game.duel();
    expect(hash()).toBe(
      "7b9e9c669a30b951e8fd743bea18271cccb0bd6d970a425ad76610916ae609a3",
    );
    game.save.hero.level = 8;
    game.save.hero.highestArena = 1;
    game.startExpedition(DUNGEONS[0].id);
    game.advanceExpeditionNode(game.reachableExpeditionNodes()[0].id);
    if (game.save.activeExpedition) game.retreatExpedition();
    expect(hash()).toBe(
      "66fd1813ec550671c4f49c51ab13d42b5819f766d0b80afd9329e9ad5204d018",
    );
    game.save.lastSimulatedAt = now - 14 * 600000;
    game.simulateElapsed(now);
    expect(hash()).toBe(
      "f550cc8b5757b198a770d3228032c88bdf8b2982df7812296beb07f68e33eada",
    );
    game.save.worldDay = game.save.worldSeason!.endsDay;
    game.save.lastSimulatedAt = now - 600000;
    game.simulateElapsed(now);
    expect(hash()).toBe(
      "c57469538e188db4f50376bf33d19dc73e1e85467f775f3afae715518c4b9fbf",
    );
    game.save.hero.highestArena = ARENAS.length - 1;
    game.save.hero.arenaWins[ARENAS.length - 1] = 1;
    game.save.hero.crownLeagueWins = 1;
    game.save.hero.legendDefenses = 1;
    game.save.eliteLeagueMemberIds = [
      "hero",
      ...game.save.eliteLeagueMemberIds.filter((id) => id !== "hero"),
    ].slice(0, 30);
    game.save.eliteRatings.hero = 4000;
    const status = game.newGamePlusStatus();
    const next = game.beginNewChronicle(
      {
        name: "Наследник",
        classId: "Knight",
        boonId: LEGACY_BOONS.find(
          (boon) => boon.sealCost <= status.availableSeals,
        )!.id,
        lawIds: ERA_LAWS.slice(0, status.lawLimit).map((law) => law.id),
        heirloomItemId: game.heirloomCandidates()[0]?.id,
      },
      now + 1,
    );
    expect(
      createHash("sha256").update(JSON.stringify(next.save)).digest("hex"),
    ).toBe("88efb531293c9daf02b1cfbbb0f626976252e458414a5df1ba71a9b060b1d892");
  });

  test.each([
    "equipment/HeroEquipmentService",
    "equipment/ShopService",
    "world/ContractService",
    "world/WorldPopulationService",
    "world/SeasonService",
    "progression/ChronicleTransition",
    "dungeons/ExpeditionService",
    "combat/BattleFinalizationService",
    "tournaments/TournamentService",
    "world/NpcSimulationService",
  ])("%s does not depend on the WorldGame facade", (module) => {
    const source = readFileSync(`src/gameplay/${module}.ts`, "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*\/WorldGame["']/);
    expect(source).not.toMatch(/(?:from\s*|import\s*\()["'][A-Za-z]:[/\\]/);
  });
});
