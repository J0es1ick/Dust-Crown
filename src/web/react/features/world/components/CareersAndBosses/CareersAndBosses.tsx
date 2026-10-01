import { useMemo } from "react";
import { CLASS_DEFINITIONS } from "../../../../../../catalogs/WorldCatalog";
import { useGame } from "../../../../app/state/GameContext";
import { useBeginBattle } from "../../../../app/state/useBeginBattle";
import { PagedList, css } from "../../../../shared/ui/common";
import { factionFor } from "../../utils/chronicle";

export function CareersPanel() {
  const { game, revision } = useGame();
  const mentors = useMemo(() => game.livingMentors(), [game, revision]);
  const dynasties = useMemo(() => game.npcDynasties(), [game, revision]);
  return (
    <section className="living-world-section world-careers paper-panel">
      <p className="eyebrow">КАРЬЕРЫ И НАСЛЕДИЕ</p>
      <h2 data-term="fighterSchool" tabIndex={0}>
        Школы и династии
      </h2>
      <p className="world-section-intro">
        Ученики ежедневно получают опыт школы и выступают под её именем в
        мировом рейтинге. Наставники с соревновательным характером продолжают
        участвовать в турнирах, остальные влияют на мир через учеников, фракции
        и лавку.
      </p>
      <div className="world-career-columns">
        <section className="living-world-subsection">
          <h3 data-term="mentor" tabIndex={0}>
            Наставники · {mentors.length}
          </h3>
          <PagedList
            items={mentors}
            getKey={(mentor) => mentor.id}
            className="living-world-list mentor-list"
            empty="Никто из известных бойцов пока не завершил карьеру наставником."
            render={(mentor) => (
              <article
                style={css({
                  "--faction-accent":
                    factionFor(mentor.factionId)?.accent ?? "#776e5f",
                })}
              >
                <div>
                  <strong>{mentor.name}</strong>
                  <small>
                    {CLASS_DEFINITIONS[mentor.classId].name} ·{" "}
                    {mentor.role === "shop-owner"
                      ? "владелец лавки"
                      : mentor.role === "faction-founder"
                        ? "основатель школы-фракции"
                        : "наставник"}{" "}
                    · учеников: {mentor.studentIds.length}
                  </small>
                  <small>
                    {mentor.schoolName ?? "Школа без закреплённого имени"} ·{" "}
                    {mentor.competes
                      ? "продолжает выступать"
                      : "сосредоточен на наставничестве"}
                  </small>
                </div>
                <span>{mentor.legacy}</span>
              </article>
            )}
          />
        </section>
        <section className="living-world-subsection">
          <h3>Школы и династии · {dynasties.length}</h3>
          <PagedList
            items={dynasties}
            getKey={(dynasty) => dynasty.id}
            className="world-dynasty-list"
            empty="Первая династия появится, когда ветеран соберёт учеников."
            render={(dynasty) => (
              <article
                style={css({
                  "--faction-accent":
                    factionFor(dynasty.factionId)?.accent ?? "#776e5f",
                })}
              >
                <strong>{dynasty.name}</strong>
                <span>Основатель: {dynasty.founderName}</span>
                <small>
                  {factionFor(dynasty.factionId)?.name ?? "Независимые"} ·
                  учеников за историю: {dynasty.historicalStudents} · живых
                  учеников: {dynasty.activeStudents}
                </small>
                <details className="school-prestige">
                  <summary>Престиж школы: {dynasty.prestige}</summary>
                  <p>
                    Заслуги основателя: {dynasty.founderPrestige}. Заслуги
                    учеников: +{dynasty.studentPrestige}.
                  </p>
                  <p>
                    Чемпионства учеников за карьеру: {dynasty.championships} ×
                    4. Победы в высшей лиге: {dynasty.crowns} × 15.
                  </p>
                  <p>
                    Численность не даёт очков. Достижения умерших и завершивших
                    карьеру учеников сохраняются. Престиж показывает славу школы
                    и не добавляет скрытых боевых бонусов.
                  </p>
                </details>
              </article>
            )}
          />
        </section>
      </div>
    </section>
  );
}

export function FactionHunterPanel() {
  const { game } = useGame();
  const begin = useBeginBattle();
  const hunter = game.factionHunter();
  if (!hunter) return null;
  const availability = game.factionHunterAvailability();
  return (
    <section className="living-world-section faction-hunter paper-panel">
      <p className="eyebrow">ОХОТНИК ВРАЖДЕБНОЙ ФРАКЦИИ</p>
      <h2>{hunter.name}</h2>
      <p>{availability.reason}</p>
      <button
        className="plain-button"
        disabled={!availability.unlocked}
        onClick={() => begin((current) => current.beginFactionHunterFight())}
      >
        Принять бой
      </button>
    </section>
  );
}
