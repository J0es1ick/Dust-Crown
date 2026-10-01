import type {
  EquipmentSetDefinition,
  EquipmentSlot,
  HeroClass,
  ItemTemplate,
} from "../gameplay/core/WorldTypes";

export const HERO_BACKGROUNDS = [
  {
    id: "exile",
    name: "Изгнанник",
    description:
      "Вы отказались подчиниться приказу. Бывший соратник считает это предательством.",
  },
  {
    id: "debtor",
    name: "Должник",
    description:
      "Вы выкупили чужую свободу. Победы на арене помогут расплатиться и начать жизнь заново.",
  },
  {
    id: "heir",
    name: "Наследник",
    description:
      "Вы унаследовали имя погибшей школы. На арене вы намерены вернуть ему славу.",
  },
] as const;
export type HeroBackground = (typeof HERO_BACKGROUNDS)[number]["id"];
export const CAMPAIGN_STAGES = [
  {
    title: "Нижний город",
    level: 4,
    opens: "Лавка, кузница и первые экспедиции",
    slot: "weapon",
  },
  {
    title: "Каменная дорога",
    level: 8,
    opens: "Фракции, контракты и наследие снаряжения",
    slot: "hands",
  },
  {
    title: "Медный берег",
    level: 12,
    opens: "Рейтинги и школы",
    slot: "feet",
  },
  {
    title: "Красный зал",
    level: 17,
    opens: "Мировые реликвии и особые противники",
    slot: "head",
  },
  {
    title: "Стеклянный город",
    level: 24,
    opens: "Королевское испытание и древнее хранилище",
    slot: "chest",
  },
  {
    title: "Перед Короной",
    level: 32,
    opens: "Полный алый комплект для борьбы за вершину элиты",
    slot: "offhand",
  },
] as const satisfies ReadonlyArray<{
  title: string;
  level: number;
  opens: string;
  slot: EquipmentSlot;
}>;
export const CHAMPION_NAMES: Record<HeroClass, string> = {
  Knight: "Алая присяга",
  Archer: "Алый прицел",
  Wizard: "Алая печать",
  Monk: "Алый поток",
  Gunsmith: "Алый порох",
  Swordsman: "Алая клятва",
};
export const CHAMPION_EFFECTS: Record<HeroClass, string> = {
  Knight:
    "Первый смертельный удар оставляет 1 HP. При 4 частях каждый удар лечит на 8% нанесённого урона.",
  Archer:
    "Каждая третья атака гарантированно критическая. При 4 частях атаки наносят на 12% больше урона.",
  Wizard:
    "Навыки возвращаются на ход быстрее. При 4 частях навык восстанавливает ещё 3% здоровья.",
  Monk: "Каждое третье действие восстанавливает 6% здоровья. При 4 частях атаки наносят на 12% больше урона.",
  Gunsmith:
    "Каждая третья атака гарантированно критическая. При 4 частях критические попадания лечат на 10% урона.",
  Swordsman:
    "Каждый удар лечит на 8% нанесённого урона. При 4 частях атаки наносят на 12% больше урона.",
};
export const CHAMPION_SETS: EquipmentSetDefinition[] = (
  Object.keys(CHAMPION_NAMES) as HeroClass[]
).map((classId) => ({
  id: `champion-${classId}`,
  name: CHAMPION_NAMES[classId],
  classes: [classId],
  description:
    "Шесть первых чемпионств — шесть неповторимых трофеев. Их сила растёт после каждого нового испытания.",
  purpose: CHAMPION_EFFECTS[classId],
  pieces: CAMPAIGN_STAGES.map((_, index) => `champion-${classId}-${index}`),
  bonuses: [
    {
      pieces: 2,
      description: "+10% к критическому шансу",
      stats: { crit: 10 },
    },
    { pieces: 4, description: "Усиление классового дара" },
    {
      pieces: 6,
      description: "+90 HP, +18 атаки и защиты; полный комплект чемпиона",
      stats: { health: 90, attack: 18, defense: 18 },
    },
  ],
}));

export const CHAMPION_TEMPLATES: ItemTemplate[] = (
  Object.keys(CHAMPION_NAMES) as HeroClass[]
).flatMap((classId) =>
  CAMPAIGN_STAGES.map((stage, index) => ({
    id: `champion-${classId}-${index}`,
    name: `${CHAMPION_NAMES[classId]} · ${index + 1}`,
    slot: stage.slot,
    allowedClasses: [classId],
    primaryStat:
      stage.slot === "chest"
        ? "health"
        : stage.slot === "feet"
          ? "speed"
          : stage.slot === "weapon" || stage.slot === "hands"
            ? "attack"
            : "defense",
    setId: `champion-${classId}`,
    exclusiveToBoss: "arena-championship",
  })),
);
