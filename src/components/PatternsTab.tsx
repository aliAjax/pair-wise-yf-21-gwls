import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Pattern, ProcessStep, StepStatus } from "../lib/types";

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "待开始",
  "in-progress": "进行中",
  done: "已完成",
  warehoused: "已入库",
};

const STATUS_FLOW: StepStatus[] = ["pending", "in-progress", "done", "warehoused"];

function RugMarkers({ pattern }: { pattern: Pattern }) {
  return (
    <svg viewBox="0 0 100 70" className="rug-map" role="img" aria-label="纹样局部标记图">
      <rect x="1" y="1" width="98" height="68" rx="4" fill="#fbfdff" stroke="#d9e2ef" />
      <rect x="6" y="6" width="88" height="58" rx="3" fill="none" stroke="#b45309" strokeWidth="0.6" strokeDasharray="2 2" />
      {pattern.markers.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r="3.2" fill="#7c2d12" stroke="#fff" strokeWidth="0.8" />
          <text x={m.x} cy={m.y - 4.5} fontSize="3.4" fill="#7c2d12" textAnchor="middle">
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function StepRow({ pattern, step }: { pattern: Pattern; step: ProcessStep }) {
  const { state, saveStep, warehouseStep, simulateColleagueSave } = useStore();
  const [status, setStatus] = useState<StepStatus>(step.status);
  const [assignee, setAssignee] = useState(step.assignee ?? "");
  const [colorCardId, setColorCardId] = useState(step.colorCardId ?? state.colorCards[0]?.id);

  const card = state.colorCards.find((c) => c.id === (step.colorCardId ?? colorCardId));
  const snapshot = step.colorCardSnapshot;
  const isWarehoused = step.status === "warehoused";

  const handleSave = () => {
    saveStep(pattern.id, step.id, pattern.version, {
      status,
      assignee: assignee || undefined,
      colorCardId,
    });
  };

  return (
    <div className={"step-row" + (isWarehoused ? " warehoused" : "")}>
      <div className="step-head">
        <strong>{step.name}</strong>
        <span className={"badge status-" + step.status}>{STATUS_LABEL[step.status]}</span>
        <span className="version">v{step.version}</span>
      </div>

      <div className="step-meta">
        {isWarehoused && snapshot ? (
          <span className="snapshot-chip" title="入库时冻结的色卡快照，批号更新不影响历史记录">
            当时色卡
            <i style={{ background: snapshot.hex }} />
            {snapshot.code} {snapshot.name} · 批号 {snapshot.batchNo}
          </span>
        ) : (
          <span className="live-chip" title="未完成工序：色卡批号更新后按新批号重算">
            当前色卡
            <i style={{ background: card?.hex }} />
            {card?.code} {card?.name} · 批号 {card?.batchNo}
          </span>
        )}
        {step.assignee && <span className="assignee">修复师：{step.assignee}</span>}
        {step.warehousedAt && (
          <span className="warehouse-at">入库于 {new Date(step.warehousedAt).toLocaleString("zh-CN")}</span>
        )}
      </div>

      {!isWarehoused && (
        <div className="step-controls">
          <label>
            <span>工序状态</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StepStatus)}>
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>负责人</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">未指定</option>
              {state.restorers.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>使用色卡</span>
            <select value={colorCardId} onChange={(e) => setColorCardId(e.target.value)}>
              {state.colorCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="step-actions">
            <button className="primary" onClick={handleSave}>
              保存工序
            </button>
            <button onClick={() => simulateColleagueSave(pattern.id)} title="模拟另一名修复师先保存了本纹样">
              模拟同事先保存
            </button>
            {step.status === "done" && (
              <button className="accent" onClick={() => warehouseStep(pattern.id, step.id)}>
                入库（冻结色卡）
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatternsTab() {
  const { state } = useStore();
  const [origin, setOrigin] = useState<string>("全部");
  const [openId, setOpenId] = useState<string | null>(state.patterns[0]?.id ?? null);

  const origins = useMemo(
    () => ["全部", ...Array.from(new Set(state.patterns.map((p) => p.origin)))],
    [state.patterns]
  );
  const filtered = origin === "全部" ? state.patterns : state.patterns.filter((p) => p.origin === origin);

  const progress = (p: Pattern) => {
    const done = p.steps.filter((s) => s.status === "done" || s.status === "warehoused").length;
    return p.steps.length ? Math.round((done / p.steps.length) * 100) : 0;
  };

  return (
    <div>
      <div className="chips">
        {origins.map((o) => (
          <button key={o} className={o === origin ? "active" : ""} onClick={() => setOrigin(o)}>
            {o}
          </button>
        ))}
      </div>

      <div className="pattern-list">
        {filtered.map((p) => {
          const open = openId === p.id;
          const pct = progress(p);
          return (
            <article key={p.id} className="pattern-card">
              <button className="pattern-head" onClick={() => setOpenId(open ? null : p.id)}>
                <div>
                  <h3>
                    {p.code}
                    <span className="origin-tag">{p.origin}</span>
                  </h3>
                  <p>
                    {p.era} · {p.material} · {p.dyeType} · {p.knotDensity}
                  </p>
                  <div className="damage-tags">
                    {p.damageAreas.map((d) => (
                      <span key={d} className="damage-tag">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="progress-wrap">
                  <div className="progress">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span>完工 {pct}%</span>
                </div>
              </button>

              {open && (
                <div className="pattern-detail">
                  <div className="detail-grid">
                    <div>
                      <h4>纹样局部标记图</h4>
                      <RugMarkers pattern={p} />
                    </div>
                    <div>
                      <h4>修复工序</h4>
                      <div className="steps">
                        {p.steps.map((s) => (
                          <StepRow key={s.id} pattern={p} step={s} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <h4>
                        外勤证据 <small>（只补充，不覆盖）</small>
                      </h4>
                      {p.evidence.length === 0 ? (
                        <p className="empty">暂无外勤证据</p>
                      ) : (
                        <ul className="timeline">
                          {p.evidence.map((e) => (
                            <li key={e.id}>
                              <span className={"badge ev-" + e.kind}>{e.kind === "note" ? "记录" : "照片"}</span>
                              {e.content}
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.damageLog.length > 0 && (
                        <>
                          <h4>破损描述追加</h4>
                          <ul className="timeline">
                            {p.damageLog.map((d) => (
                              <li key={d.id}>
                                <span className="badge ev-note">破损</span>
                                {d.note}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    <div>
                      <h4>材料消耗</h4>
                      {state.consumption.filter((c) => c.patternId === p.id).length === 0 ? (
                        <p className="empty">暂无材料消耗</p>
                      ) : (
                        <ul className="consume-list">
                          {state.consumption
                            .filter((c) => c.patternId === p.id)
                            .map((c) => {
                              const card = state.colorCards.find((cc) => cc.id === c.colorCardId);
                              const step = p.steps.find((s) => s.id === c.stepId);
                              const frozen = step?.status === "warehoused";
                              return (
                                <li key={c.id}>
                                  <i style={{ background: card?.hex }} />
                                  <span>
                                    {card?.code} {card?.name} × {c.amount}
                                  </span>
                                  <em className={frozen ? "frozen" : "live"}>
                                    {frozen ? "当时批号" : "生效批号"} {c.batchNo}
                                  </em>
                                </li>
                              );
                            })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
