import { useGame } from "../../../../app/state/GameContext";
import { css } from "../../../../shared/ui/common";
import { NewChronicleStatus } from "../NewChronicleStatus/NewChronicleStatus";

export function MapUtilities() {
  const { game, navigate } = useGame();
  const contracts = game.featureAvailability("contracts");
  const activeContract = game.save.activeContract;

  return (
    <section className="map-utilities" aria-label="Быстрые переходы">
      <div
        className="map-quick-actions"
        style={css({
          "--quick-action-count": game.isFeatureUnlocked("forge") ? 4 : 3,
        })}
      >
        <div>
          <p className="eyebrow">БЫСТРЫЕ ПЕРЕХОДЫ</p>
          <strong>Подготовка героя</strong>
        </div>
        <button type="button" onClick={() => navigate("arsenal")}>
          <span aria-hidden="true">◈</span>
          <b>Инвентарь</b>
          <small>{game.save.hero.inventory.length} предметов</small>
        </button>
        <button type="button" onClick={() => navigate("skills")}>
          <span aria-hidden="true">✦</span>
          <b>Навыки</b>
          <small>Сборка и тактика</small>
        </button>
        {game.isFeatureUnlocked("forge") && (
          <button type="button" onClick={() => navigate("forge")}>
            <span aria-hidden="true">⚒</span>
            <b>Кузница</b>
            <small>{game.save.hero.temperingMarks ?? 0} печатей</small>
          </button>
        )}
        <button
          type="button"
          disabled={!contracts.unlocked}
          title={contracts.unlocked ? undefined : contracts.reason}
          onClick={() => navigate("contracts")}
        >
          <span aria-hidden="true">§</span>
          <b>Контракты</b>
          <small>
            {contracts.unlocked
              ? activeContract
                ? `${activeContract.progress} из ${activeContract.target}`
                : "Свободное поручение"
              : "После первого чемпионства"}
          </small>
        </button>
      </div>
      <NewChronicleStatus />
    </section>
  );
}
