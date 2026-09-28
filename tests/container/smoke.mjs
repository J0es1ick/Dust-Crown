import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const image = process.env.CONTAINER_TEST_IMAGE ?? "dust-and-crown:test";
const volume = `dust-and-crown-test-${randomUUID()}`;

function docker(args) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 120000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.stdout || `Docker exited: ${result.status}`,
    );
  return result.stdout;
}

docker(["volume", "create", volume]);
try {
  const run = (source) =>
    docker([
      "run",
      "--rm",
      "--mount",
      `type=volume,source=${volume},target=/app/.game-save`,
      "--entrypoint",
      "node",
      image,
      "-e",
      source,
    ]);
  run(`
    const assert = require('node:assert/strict');
    require('./dist-console/utils/input/createGame.js');
    const { Game } = require('./dist-console/gameplay/core/Game.js');
    const tournament = new Game(8);
    tournament.startTournament();
    let turns = 0;
    while (tournament.state !== 'finished' && turns++ < 10000) tournament.doStep();
    assert.equal(tournament.state, 'finished');
    assert.ok(tournament.champion);
    const { WorldGame } = require('./dist-console/gameplay/core/WorldGame.js');
    const { ConsoleWorldSaveRepository } = require('./dist-console/utils/input/ConsoleWorldSaveRepository.js');
    const game = WorldGame.create('Проверка контейнера', 'Knight', 42);
    game.beginDuel();
    game.runPendingBattleAutomatically();
    assert.equal(game.save.worldDay, 2);
    new ConsoleWorldSaveRepository('/app/.game-save/world-save.json').save(game.save);
  `);
  run(`
    const assert = require('node:assert/strict');
    const { ConsoleWorldSaveRepository } = require('./dist-console/utils/input/ConsoleWorldSaveRepository.js');
    const loaded = new ConsoleWorldSaveRepository('/app/.game-save/world-save.json').load();
    assert.equal(loaded.save.hero.name, 'Проверка контейнера');
    assert.equal(loaded.save.worldDay, 2);
  `);
  console.log("Container runtime and save persistence passed.");
} finally {
  docker(["volume", "rm", volume]);
}
