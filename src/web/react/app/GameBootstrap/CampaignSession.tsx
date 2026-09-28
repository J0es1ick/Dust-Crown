import { useEffect, useState, type ReactNode } from "react";
import { SAVE_KEY } from "../state/StorageKeys";

export function CampaignSession({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"waiting" | "ready" | "error">(
    "waiting",
  );

  useEffect(() => {
    if (!navigator.locks) {
      setStatus("error");
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    void navigator.locks
      .request(SAVE_KEY, { signal: controller.signal }, async () => {
        if (disposed) return;
        setStatus("ready");
        await held;
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      controller.abort();
      release();
    };
  }, []);

  if (status === "ready") return children;
  return (
    <main className="save-recovery-screen">
      <section className="save-recovery-card" aria-live="polite">
        <h1>
          {status === "waiting"
            ? "Ожидаем доступ к игре"
            : "Не удалось защитить сохранение"}
        </h1>
        <p>
          {status === "waiting"
            ? "Играть можно в одной вкладке одновременно. Если игра уже открыта, закройте ту вкладку: здесь автоматически загрузится последняя летопись."
            : "Откройте игру в обновлённом браузере по HTTPS или через localhost. Сохранение не изменено."}
        </p>
        {status === "error" && (
          <button className="button primary" onClick={() => location.reload()}>
            Попробовать снова
          </button>
        )}
      </section>
    </main>
  );
}
