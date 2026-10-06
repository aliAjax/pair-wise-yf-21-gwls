import { useStore } from "../lib/store";

export default function CardsTab() {
  const { state, updateColorCardBatch } = useStore();

  const affectedCount = (cardId: string) =>
    state.consumption.filter(
      (c) =>
        c.colorCardId === cardId &&
        state.patterns
          .find((p) => p.id === c.patternId)
          ?.steps.find((s) => s.id === c.stepId)?.status !== "warehoused"
    ).length;

  const frozenCount = (cardId: string) =>
    state.consumption.filter(
      (c) =>
        c.colorCardId === cardId &&
        state.patterns
          .find((p) => p.id === c.patternId)
          ?.steps.find((s) => s.id === c.stepId)?.status === "warehoused"
    ).length;

  return (
    <div className="cards-tab">
      <div className="panel">
        <div className="heading">
          <div>
            <p>材料色卡</p>
            <h2>色卡批号管理</h2>
          </div>
          <p className="hint">
            更新批号后：未完成工序按新批号重算，已入库记录仍展示当时色卡（历史快照不变）。
          </p>
        </div>
        <div className="card-grid">
          {state.colorCards.map((c) => {
            const affected = affectedCount(c.id);
            const frozen = frozenCount(c.id);
            return (
              <article key={c.id} className="color-card">
                <div className="color-swatch" style={{ background: c.hex }} />
                <div className="color-info">
                  <strong>
                    {c.code} {c.name}
                  </strong>
                  <span className="batch-no">当前批号 {c.batchNo}</span>
                  <span className="batch-stats">
                    {affected > 0 ? (
                      <em className="live">{affected} 项未完成将重算</em>
                    ) : (
                      <em className="muted">无未完成消耗</em>
                    )}
                    {frozen > 0 && <em className="frozen">{frozen} 项已入库冻结</em>}
                  </span>
                  <button onClick={() => updateColorCardBatch(c.id)}>更新批号</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="heading">
          <div>
            <p>批号规则</p>
            <h2>重算与冻结说明</h2>
          </div>
        </div>
        <ul className="rules">
          <li>
            <em className="live">未完成工序</em>
            ：色卡批号更新后，材料消耗按新批号重算，工序页展示当前色卡与新批号。
          </li>
          <li>
            <em className="frozen">已入库记录</em>
            ：入库时冻结当时色卡快照（色号、色名、批号），批号更新不影响历史展示。
          </li>
          <li>
            <em className="muted">旧数据升级</em>
            ：缺少批号的历史数据，升级时按默认色卡回填，历史修复批次照样能打开。
          </li>
        </ul>
      </div>
    </div>
  );
}
