import {
  campaignStage,
  campaignMapSectionAvailable,
} from "../../../../../../gameplay/progression/CampaignProgression";
import { CAMPAIGN_STAGES } from "../../../../../../catalogs/ChampionCatalog";
import { useEffect, useState } from "react";
import { ARENAS, DUNGEONS } from "../../../../../../catalogs/WorldCatalog";
import { useAppSelector, useGame } from "../../../../app/state/GameContext";
import { PageHeading } from "../../../../shared/ui/common";
import { ActivityCard } from "../../components/ActivityCard/ActivityCard";
import { DuelSection } from "../../components/DuelSection/DuelSection";
import {
  HeroSummaryCard,
  NextGoalCard,
} from "../../components/MapOverview/MapOverview";
import {
  isMapSectionId,
  MapShortcuts,
  type MapSectionId,
} from "../../components/MapShortcuts/MapShortcuts";
import { RouteSection } from "../../components/RouteSection/RouteSection";
import { Training } from "../../components/Training/Training";
import { useMapStickyOffsets } from "../../hooks/useMapStickyOffsets";
import { EndgameSection } from "../../components/EndgameSection/EndgameSection";
import { MapUtilities } from "../../components/MapUtilities/MapUtilities";
import "../../styles/components.css";

export function MapPage() {
  const { game } = useGame();
  const stage = campaignStage(game.save);
  const { page, shortcuts } = useMapStickyOffsets();
  const navigation = useAppSelector((state) => state.navigation);
  const requestedSection =
    navigation?.page === "map" && isMapSectionId(navigation.anchor)
      ? navigation.anchor
      : undefined;
  const [selectedSection, setSelectedSection] =
    useState<MapSectionId>("duels-section");
  const requested = requestedSection ?? selectedSection;
  const activeSection =
    (requested === "endgame-section" &&
      !game.isFeatureUnlocked("crown-league")) ||
    !campaignMapSectionAvailable(requested, game.save)
      ? "tournaments-section"
      : requested;

  useEffect(() => {
    if (requestedSection) setSelectedSection(requestedSection);
  }, [requestedSection]);

  const activity =
    activeSection === "duels-section" ? (
      <DuelSection view="duels" />
    ) : activeSection === "bosses-section" ? (
      <DuelSection view="bosses" />
    ) : activeSection === "tournaments-section" ? (
      <RouteSection
        id="tournaments-section"
        number="03"
        title="Календарь турниров"
        copy="Запишитесь заранее и займите место в сетке минимум из восьми бойцов."
      >
        <div className="activity-route arena-route" id="arena-route">
          {ARENAS.map(
            (arena, index) =>
              index <= stage && (
                <ActivityCard key={arena.id} activity={arena} index={index} />
              ),
          )}
        </div>
      </RouteSection>
    ) : activeSection === "dungeons-section" ? (
      <RouteSection
        id="dungeons-section"
        number="04"
        title="Данжи"
        copy="Открываются уровнем, днями мира и продвижением по аренам."
        className="dungeons-section"
      >
        <div className="activity-route dungeon-route" id="dungeon-route">
          {DUNGEONS.map(
            (dungeon, index) =>
              dungeon.requiredArena <= stage && (
                <ActivityCard
                  key={dungeon.id}
                  activity={dungeon}
                  index={index}
                />
              ),
          )}
        </div>
      </RouteSection>
    ) : (
      <RouteSection
        id="endgame-section"
        number="05"
        title="Борьба за Корону"
        copy="Высшая лига, легендарные соперники и переход к следующей эпохе."
        className="endgame-section"
      >
        <EndgameSection />
      </RouteSection>
    );

  return (
    <div className="react-map-page campaign-map" data-stage={stage} ref={page}>
      <PageHeading
        eyebrow={`АРЕНА ${stage + 1} ИЗ 6 · ${CAMPAIGN_STAGES[stage].title}`}
        title="Карта окрестностей"
      >
        <p>
          Дуэли готовят героя к турнирам. Чемпионства открывают следующую арену
          и новые возможности.
        </p>
      </PageHeading>
      <NextGoalCard />
      {stage < 5 && (
        <p className="campaign-unlock">
          Следующая арена:{" "}
          {CAMPAIGN_STAGES[stage].opens.toLocaleLowerCase("ru-RU")}.
        </p>
      )}
      {stage >= 2 && <MapUtilities />}
      <MapShortcuts navigationRef={shortcuts} activeId={activeSection} />
      <div className="map-layout">
        {stage >= 3 && <HeroSummaryCard />}
        <div
          id="map-activity-panel"
          className="route-board map-tab-panel"
          role="tabpanel"
          aria-label="Выбранное направление"
          key={activeSection}
        >
          {activity}
          <details className="campaign-training">
            <summary>Подготовка и ожидание турнира</summary>
            <Training />
          </details>
        </div>
      </div>
    </div>
  );
}
