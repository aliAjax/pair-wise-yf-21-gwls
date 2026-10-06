import type { Db } from "../types";
import { updateColorBatch } from "../store";

interface Props {
  db: Db;
  onDb: (db: Db) => void;
  notify: (msg: string) => void;
}

export default function ColorCardPanel({ db, onDb, notify }: Props) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>材料色卡</p>
          <h2>色卡与批号（{db.colorCards.length}）</h2>
        </div>
      </div>
      <div className="cards">
        {db.colorCards.map((card) => (
          <article key={card.id} className="card-row">
            <span className="swatch lg" style={{ background: card.hex }} />
            <div className="card-info">
              <b>{card.name}</b>
              <small>{card.material}</small>
              <div>
                当前批号 <code>{card.batch}</code>
              </div>
              {card.history.length > 0 && (
                <div className="hist">历史批号：{card.history.slice(0, 3).map((h) => h.batch).join(" / ")}</div>
              )}
            </div>
            <button
              onClick={() => {
                const { db: next, recalculated, newBatch } = updateColorBatch(card.id);
                onDb(next);
                notify(
                  `色卡「${card.name}」批号更新为 ${newBatch}：已按新批号重算 ${recalculated} 条未完成工序，已入库记录仍展示当时色卡`,
                );
              }}
            >
              更新批号
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
