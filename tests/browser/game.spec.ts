import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { WorldGame } from "../../src/gameplay/core/WorldGame";
import { exportWorldSave } from "../../src/gameplay/save/WorldSaveStorage";
import { ARENAS } from "../../src/catalogs/WorldCatalog";

async function accessible(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return (
            animation.playState === "running" &&
            effect?.getTiming().iterations !== Infinity &&
            effect?.target?.checkVisibility()
          );
        })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    })),
  ).toEqual([]);
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
}

async function createHero(page: Page, finishTutorial = false) {
  await page.goto("./");
  await page.getByRole("button", { name: /Живой мир/ }).click();
  await page
    .getByRole("textbox", { name: "Имя героя" })
    .fill("Проверка браузера");
  await page.getByRole("radio", { name: /Мечник/ }).click();
  await page.getByRole("button", { name: "Начать путь" }).click();
  if (finishTutorial) {
    await expect(page.locator("#tutorial-progress")).toHaveText("1 / 4");
    for (let step = 0; step < 3; step++) {
      await page.getByRole("button", { name: "Далее", exact: true }).click();
    }
    await page.getByRole("button", { name: "Начать игру", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Пропустить", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Карта окрестностей" }),
  ).toBeVisible();
}

async function filledRows(page: Page, selector: string) {
  const rows = await page.locator(selector).evaluate((element) => {
    const container = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = container.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    const right = container.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>(':scope > button')).map((button) => ({ left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right, top: button.offsetTop }));
    return [...new Set(buttons.map((button) => button.top))].map((top) => {
      const row = buttons.filter((button) => button.top === top);
      return { leftGap: Math.min(...row.map((button) => button.left)) - left,
        rightGap: right - Math.max(...row.map((button) => button.right)) };
    });
  });
  expect(rows.length).toBeGreaterThan(0);
  rows.forEach((row) => {
    expect(Math.abs(row.leftGap)).toBeLessThan(2);
    expect(Math.abs(row.rightGap)).toBeLessThan(2);
  });
}

test("discovery layouts fill available space and world cards align in both themes", async ({ page }, testInfo) => {
  await createHero(page);
  const navigation = page.getByRole("navigation", { name: "Разделы игры" });
  await filledRows(page, ".map-shortcuts");
  await filledRows(page, ".map-quick-actions");
  await expect(page.getByRole("button", { name: /Лига короны/ })).toHaveCount(0);
  await navigation.getByRole("button", { name: "Снаряжение", exact: true }).click();
  await expect(navigation.getByRole("button", { name: "Кузница", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Наследие", exact: true })).toHaveCount(0);

  const game = WorldGame.create("Длинное имя чемпиона", "Knight", Date.now());
  game.save.hero.level = 30;
  game.save.hero.highestArena = ARENAS.length - 1;
  game.save.hero.arenaWins = ARENAS.map(() => 1);
  game.save.hero.rating = 100_000;
  game.save.hero.factionReputation = { wardens: 23, "free-company": 17, "red-book": 10 };
  game.save.tutorialCompleted = true;
  game.save.seenContextualTutorialIds = ["forge", "equipment-legacy", "contracts", "crown-league", "world", "adaptation"];
  game.consumeFeatureUnlocks();
  game.save.enemies.filter((enemy) => enemy.alive).forEach((enemy, index) => {
    enemy.lastActivity = { day: 1, activity: "training", description: index % 2 ? "Готовится к турниру." : "Ищет встречу с давним соперником, чтобы продолжить личное соперничество и вернуть потерянное место в рейтинге." };
    const profile = game.save.npcLife!.profiles[enemy.id];
    if (profile) profile.nickname = index % 2 ? "Стойкий" : "Хранитель мифического шлема церемониймейстера · Воля королей";
  });
  await navigation.getByRole("button", { name: "Настройки", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("region", { name: "Летопись", exact: true }).locator('input[type="file"]').setInputFiles({ name: "campaign.json", mimeType: "application/json", buffer: Buffer.from(exportWorldSave(game.save)) });
  await expect(page.locator(".hero-summary strong")).toHaveText(game.save.hero.name);
  for (const theme of ["light", "dark"]) {
    await navigation.getByRole("button", { name: "Настройки", exact: true }).click();
    await page.getByRole("combobox", { name: "Тема", exact: true }).selectOption(theme);
    await page.getByRole("checkbox", { name: "Меньше анимаций" }).check();
    await navigation.getByRole("button", { name: "Карта", exact: true }).click();
    await filledRows(page, ".map-shortcuts");
    await filledRows(page, ".map-quick-actions");
    await noOverflow(page);
    await navigation.getByRole("button", { name: "Мир", exact: true }).click();
    await navigation.getByRole("button", { name: "Контракты", exact: true }).click();
    await expect(page.locator(".faction-card")).toHaveCount(3);
    if (testInfo.project.name === "desktop") {
      for (const selector of ["h3", "blockquote", ".faction-control-summary", ".stat-row", ".faction-perk-list > strong", ".faction-perk:nth-child(2)", ".faction-perk:nth-child(3)", ".faction-perk:nth-child(4)", ".faction-campaign h4", ".faction-campaign button"]) {
        const tops = await page.locator(`.faction-card ${selector}`).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
        expect(Math.max(...tops) - Math.min(...tops), selector).toBeLessThan(2);
      }
    }
    await noOverflow(page);
    await accessible(page);
    await page.locator(".faction-grid").screenshot({ path: testInfo.outputPath(`factions-${theme}.png`) });
    await navigation.getByRole("button", { name: "Бойцы и школы", exact: true }).click();
    const heights = await page.locator(".world-activities .paged-list-item > article").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
    await noOverflow(page);
    await accessible(page);
    await page.locator(".world-activities").screenshot({ path: testInfo.outputPath(`fighters-${theme}.png`) });
  }
});

async function changeEquipmentFromHero(page: Page) {
  const slot = page.getByRole("button", {
    name: "Выбрать предмет: Оружие",
    exact: true,
  });
  const equippedName = await slot.locator("strong").innerText();
  await page
    .getByRole("button", { name: "Снять: Оружие", exact: true })
    .click();
  await expect(slot).toContainText("Ничего не надето");
  await expect(slot).toBeFocused();
  await slot.click();
  const picker = page.getByRole("dialog", {
    name: "Выберите: оружие",
    exact: true,
  });
  const item = picker
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: equippedName, exact: true }),
    });
  await item.getByRole("button", { name: "Надеть", exact: true }).click();
  await expect(picker.locator(".picker-current")).toContainText(equippedName);
  await noOverflow(page);
  await accessible(page);
  await picker.getByRole("button", { name: "Закрыть окно" }).click();
  await expect(slot).toContainText(equippedName);
  await expect(page).toHaveURL(/#\/hero$/);
}

test("a second tab waits and resumes the latest campaign after the first closes", async ({ page, context }) => {
  await createHero(page);
  const other = await context.newPage();
  await other.goto("./");
  await expect(other.getByRole("heading", { name: "Ожидаем доступ к игре" })).toBeVisible();
  await expect(other.getByRole("button", { name: "Начать дуэль", exact: true })).toHaveCount(0);
  await accessible(other);
  await noOverflow(other);
  await page.getByRole("button", { name: "Начать дуэль", exact: true }).first().click();
  await page.getByRole("button", { name: "Пропустить бой", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить игру", exact: true }).click();
  await page.close();
  await expect(other.getByRole("heading", { name: "Карта окрестностей" })).toBeVisible();
  await expect(other.getByText("День мира", { exact: true }).locator("..").getByRole("definition")).toHaveText("2");
  await other.reload();
  await expect(other.getByRole("heading", { name: "Карта окрестностей" })).toBeVisible();
  await expect(other.getByText("День мира", { exact: true }).locator("..").getByRole("definition")).toHaveText("2");
});

test("the short introduction leads directly to the first fight and then tournament progress", async ({ page }) => {
  await createHero(page, true);
  const firstFight = page.getByRole("button", { name: "Первая дуэль", exact: true });
  await expect(firstFight).toBeInViewport();
  await noOverflow(page);
  await accessible(page);
  await firstFight.click();
  const battle = page.getByRole("dialog");
  await expect(battle.getByRole("heading", { name: "Оцените соперника" })).toBeVisible();
  await battle.getByRole("button", { name: "Пропустить бой", exact: true }).click();
  await battle.getByRole("button", { name: "Продолжить игру", exact: true }).click();
  await expect(firstFight).toHaveCount(0);
  await expect(page.locator("#next-goal")).toContainText("Чемпионства на этой арене");
});

test("settings persist, dark screens remain readable and autostart can be paused", async ({
  page,
}) => {
  await createHero(page);
  const navigation = page.getByRole("navigation", { name: "Разделы игры" });
  await navigation
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Тема", exact: true })
    .selectOption("dark");
  await page.getByRole("checkbox", { name: "Меньше анимаций" }).check();
  await page
    .getByRole("checkbox", { name: "Начинать бой автоматически" })
    .check();
  await page
    .getByRole("combobox", { name: "Скорость боя", exact: true })
    .selectOption("900");
  await noOverflow(page);
  await accessible(page);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Тема", exact: true }),
  ).toHaveValue("dark");
  await expect(
    page.getByRole("checkbox", { name: "Начинать бой автоматически" }),
  ).toBeChecked();
  await page.locator(".header-save-menu > summary").click();
  const saveMenu = page.locator(".header-save-popover");
  await expect(
    saveMenu.getByRole("button", { name: "Скачать сохранение" }),
  ).toBeVisible();
  await expect(
    saveMenu.getByRole("button", { name: "Загрузить из файла" }),
  ).toBeVisible();
  await noOverflow(page);
  await accessible(page);
  await page.locator(".header-save-menu > summary").click();
  for (const name of [
    "Герой",
    "Снаряжение",
    "Навыки",
    "Коллекции",
    "Лавка",
    "Рейтинги",
    "Мир",
    "Реликвии",
    "Карта",
  ]) {
    await navigation
      .getByRole("button", { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) })
      .click();
    if (name === "Мир") {
      await expect(page.locator("#tutorial-progress")).toHaveText("1 / 6");
      await page.getByRole("button", { name: "Пропустить", exact: true }).click();
    }
    if (name === "Герой") await changeEquipmentFromHero(page);
    await noOverflow(page);
    await accessible(page);
  }
  await page
    .getByRole("button", { name: "Начать дуэль", exact: true })
    .first()
    .click();
  const battle = page.getByRole("dialog");
  await battle.getByRole("button", { name: "Пауза", exact: true }).click();
  await battle
    .getByRole("combobox", { name: "Скорость боя" })
    .selectOption("160");
  await expect(
    battle.getByText("Бой на паузе").or(battle.getByText("Готовы к бою?")),
  ).toBeVisible();
  await noOverflow(page);
  await accessible(page);
  await battle.getByRole("button", { name: "Настройки боя" }).click();
  const settings = page.getByRole("dialog", { name: "Настройки", exact: true });
  await expect(
    settings.getByRole("combobox", { name: "Скорость боя" }),
  ).toHaveValue("160");
  await settings
    .getByRole("combobox", { name: "Скорость боя" })
    .selectOption("900");
  await settings
    .getByRole("checkbox", { name: "Начинать бой автоматически" })
    .uncheck();
  await accessible(page);
  await settings.getByRole("button", { name: "Вернуться к бою" }).click();
  await expect(
    battle.getByRole("combobox", { name: "Скорость боя" }),
  ).toHaveValue("900");
  await battle.getByRole("button", { name: "Пропустить бой" }).click();
  await expect(battle.locator(".battle-result")).toBeVisible();
  await accessible(page);
  await battle.getByRole("button", { name: "Продолжить игру" }).click();
  await navigation
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page.getByRole("button", { name: "Повторить обучение" }).click();
  await accessible(page);
});

test("mode chooser is lightweight and class selection works with the keyboard", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".js")) scripts.push(response.url());
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Выберите режим" }),
  ).toBeVisible();
  expect(
    scripts.some((url) =>
      /GameApplication|WorldGame|WorldSaveWorker/.test(url),
    ),
  ).toBe(false);
  await noOverflow(page);
  await accessible(page);
  await page.getByRole("button", { name: /Живой мир/ }).click();
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(6);
  await radios.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowLeft");
  await expect(radios.last()).toBeFocused();
  await expect(page.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "К выбору режима" }),
  ).toBeFocused();
  await noOverflow(page);
  await accessible(page);
});

test("hero, battle, saved reload and touch-readable tournament rules", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createHero(page);
  await noOverflow(page);
  await accessible(page);
  await page
    .getByRole("button", { name: "Начать дуэль", exact: true })
    .first()
    .click();
  const battle = page.getByRole("dialog");
  await expect(battle).toBeVisible();
  await battle
    .getByRole("button", { name: "Пропустить бой", exact: true })
    .click();
  await battle
    .getByRole("button", { name: /Завершить|Продолжить|Закрыть/, exact: false })
    .last()
    .click();
  await expect(battle).toBeHidden();
  const worldDay = page
    .getByText("День мира", { exact: true })
    .locator("..")
    .getByRole("definition");
  await expect(worldDay).toHaveText("2");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Карта окрестностей" }),
  ).toBeVisible();
  await expect(
    page.getByText("Проверка браузера", { exact: true }).first(),
  ).toBeVisible();
  await expect(worldDay).toHaveText("2");
  const directions = page.getByRole("navigation", {
    name: "Быстрый доступ к активностям",
  });
  await directions.getByRole("button", { name: /^Турниры/ }).click();
  const rules = page.getByRole("button", {
    name: "Условия турнира «Кубок Нижнего города»",
  });
  await rules.click();
  const dialog = page.getByRole("dialog", {
    name: "Условия: Кубок Нижнего города",
  });
  await expect(
    dialog.getByRole("heading", { name: /Ареной управляет/ }),
  ).toBeVisible();
  await noOverflow(page);
  await accessible(page);
  await dialog.getByRole("button", { name: "Понятно" }).click();
  await expect(rules).toBeFocused();
  const navigation = page.getByRole("navigation", { name: "Разделы игры" });
  for (const [name, heading] of [
    ["Герой", "Ваш герой"],
    ["Снаряжение", "Инвентарь"],
    ["Лавка", "Лавка Ионы"],
    ["Рейтинги", "Сотня лучших бойцов"],
    ["Мир", "Обзор мира"],
  ]) {
    await navigation
      .getByRole("button", { name: new RegExp(`^${name}(?: \\d+)?$`) })
      .click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    if (name === "Мир") {
      await expect(page.locator("#tutorial-progress")).toHaveText("1 / 6");
      await page.getByRole("button", { name: "Пропустить", exact: true }).click();
    }
    if (name === "Герой") await changeEquipmentFromHero(page);
    await noOverflow(page);
    await accessible(page);
  }
  expect(errors).toEqual([]);
});

test("battle preparation, pause and reload preserve the fight until the player continues", async ({
  page,
}) => {
  await createHero(page);
  await page
    .getByRole("button", { name: "Начать дуэль", exact: true })
    .first()
    .click();
  const battle = page.getByRole("dialog");
  await expect(
    battle.getByRole("heading", { name: "Оцените соперника" }),
  ).toBeVisible();
  await expect(
    battle.getByRole("table", { name: "Характеристики участников" }),
  ).toBeVisible();
  await expect(battle.getByText("ХОД 0", { exact: true })).toBeVisible();
  await noOverflow(page);
  await accessible(page);
  await expect(battle.getByText("ХОД 0", { exact: true })).toBeVisible();
  const frame = page.locator(".react-battle-dialog .react-modal-paper");
  const before = await frame.boundingBox();
  const combatants = await battle.locator(".combatant").evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height));
  expect(combatants[0]).toBe(combatants[1]);
  await battle.getByRole("button", { name: "Настройки боя" }).click();
  const settings = page.getByRole("dialog", { name: "Настройки", exact: true });
  await settings
    .getByRole("combobox", { name: "Скорость боя" })
    .selectOption("900");
  await settings.getByRole("button", { name: "Вернуться к бою" }).click();
  await battle.getByRole("button", { name: "Начать бой", exact: true }).click();
  await expect(battle.getByText("ХОД 1", { exact: true })).toBeVisible();
  await battle.getByRole("button", { name: "Пауза", exact: true }).click();
  const progress = await battle.locator(".battle-action > span").innerText();
  const readMeters = () =>
    battle
      .getByRole("progressbar")
      .evaluateAll((elements) =>
        elements.map((element) => [
          element.getAttribute("aria-label"),
          element.getAttribute("aria-valuenow"),
        ]),
      );
  const health = await readMeters();
  await page.reload();
  await expect(
    battle.getByRole("button", { name: "Продолжить бой", exact: true }),
  ).toBeVisible();
  await expect(battle.locator(".battle-action > span")).toHaveText(progress);
  expect(await readMeters()).toEqual(health);
  await battle
    .getByRole("button", { name: "Пропустить бой", exact: true })
    .click();
  await expect(battle.locator(".battle-reward-strip")).toBeVisible();
  await noOverflow(page);
  await accessible(page);
  const after = await frame.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width, 0);
  expect(after!.height).toBeCloseTo(before!.height, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  await battle
    .getByRole("button", { name: "Продолжить игру", exact: true })
    .click();
  await expect(battle).toBeHidden();
  const day = page
    .getByText("День мира", { exact: true })
    .locator("..")
    .getByRole("definition");
  await expect(day).toHaveText("2");
  await page.reload();
  await expect(day).toHaveText("2");
});
