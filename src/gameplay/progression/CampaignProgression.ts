import { ARENAS } from "../../catalogs/WorldCatalog";
import type { GameSave } from "../core/WorldTypes";

export function campaignStage(save: GameSave): number {
  return Math.min(ARENAS.length - 1, Math.max(0, save.hero.highestArena));
}

export function campaignMapSectionAvailable(
  section: string,
  save: GameSave,
): boolean {
  const stage = campaignStage(save);
  if (section === "bosses-section") return stage >= 4;
  if (section === "dungeons-section")
    return stage >= 1 || Boolean(save.activeExpedition);
  return true;
}
