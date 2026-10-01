import { campaignStage } from "../../../../gameplay/progression/CampaignProgression";
import type { GameSave } from "../../../../gameplay/core/WorldTypes";
import type { WorldFeatureId } from "../../../../gameplay/core/WorldTypes";

export const WORLD_PAGE_IDS = [
  "map",
  "hero",
  "career",
  "class-change",
  "arsenal",
  "skills",
  "forge",
  "legacy",
  "collections",
  "shop",
  "leaders",
  "elite",
  "chronicle",
  "fighters",
  "relics",
  "contracts",
  "history",
  "settings",
] as const;

export type WorldPageId = (typeof WORLD_PAGE_IDS)[number];

export const WORLD_NAV_GROUPS = [
  "map",
  "hero",
  "equipment",
  "shop",
  "ratings",
  "world",
  "settings",
] as const;
export type WorldNavGroup = (typeof WORLD_NAV_GROUPS)[number];

export const WORLD_PAGE_NAV_GROUP: Readonly<
  Record<WorldPageId, WorldNavGroup>
> = {
  map: "map",
  hero: "hero",
  career: "hero",
  "class-change": "hero",
  arsenal: "equipment",
  skills: "equipment",
  forge: "equipment",
  legacy: "equipment",
  collections: "equipment",
  shop: "shop",
  leaders: "ratings",
  elite: "ratings",
  chronicle: "world",
  fighters: "world",
  relics: "world",
  history: "world",
  contracts: "world",
  settings: "settings",
};

export const WORLD_PAGE_FEATURE: Readonly<
  Partial<Record<WorldPageId, WorldFeatureId>>
> = {
  contracts: "contracts",
  forge: "forge",
  legacy: "equipment-legacy",
  elite: "crown-league",
};

export function isWorldPageAvailable(
  page: WorldPageId,
  isFeatureUnlocked: (feature: WorldFeatureId) => boolean,
  save?: GameSave,
): boolean {
  if (save) {
    const stages: Partial<Record<WorldPageId, number>> = {
      arsenal: 1,
      shop: 1,
      skills: 1,
      forge: 1,
      legacy: 2,
      collections: 2,
      contracts: 2,
      chronicle: 2,
      career: 2,
      leaders: 3,
      fighters: 3,
      "class-change": 3,
      relics: 4,
      history: 2,
    };
    if (
      campaignStage(save) < (stages[page] ?? 0) &&
      !(page === "history" && save.legacy.cycle > 1)
    )
      return false;
  }
  const feature = WORLD_PAGE_FEATURE[page];
  return !feature || isFeatureUnlocked(feature);
}
