import { useState } from "react";
import { useStore } from "../lib/store";

export default function FieldTab() {
  const { state, online, createFieldRecord, mergeRecord, resumeRecord } = useStore();
  const [patternId, setPatternId] = useState(state.patterns[0]?.id ?? "");
  const [damageNote, setDamageNote] = useState("");
  const [threadColorCardIds, setThreadColorCardIds] = useState<string[]>([]);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const toggleCard = (id: string) => {
    setThreadColorCardIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSaveOffline = () => {
    if (!patternId) return;
    const fr = createFieldRecord({ patternId, damageNote, threadColorCardIds, evidenceNote });
    setSavedId(fr.id);
    setDamageNote("");
    setThreadColorCardIds([]);
    setEvidenceNote("");
    window.setTimeout(() => setSavedId(null), 2500);
  };

  const drafts = state.fieldRecords.filter((f) => !f.synced);
  const synced = state.fieldRecords.filter((f) => f.synced);

  return (
    <div className="field-tab">
      <div className={"online-banner " + (online ? "on" : "off")}>
        {online ? "● 在线：外勤记录回网后可合并进工坊工序" : "○ 离线：记录仅保存在本机草稿，回网后自动可合并"}
      </div>

      <div className="panel">
        <div className="heading">
          <div>
            <p>外勤离线登记</p>
            <h2>新增破损 / 补线记录</h2>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>对应纹样档案</span>
            <select value={patternId} onChange={(e) => setPatternId(e.target.value)}>
              {state.patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.origin}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>补线色号（可多选）</span>
            <div className="card-picker">
              {state.colorCards.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={"card-chip " + (threadColorCardIds.includes(c.id) ? "selected" : "")}
                  onClick={() => toggleCard(c.id)}
                >
                  <i style={{ background: c.hex }} />
                  {c.code} {c.name}
                </button>
              ))}
            </div>
          </label>
          <label className="full">
            <span>破损描述</span>
            <textarea
              rows={3}
              placeholder="记录破损位置、范围、现状……"
              value={damageNote}
              onChange={(e) => setDamageNote(e.target.value)}
            />
          </label>
          <label className="full">
            <span>外勤证据（照片/文字，仅补充不覆盖）</span>
            <textarea
              rows={2}
              placeholder="现场照片说明或证据备注"
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={handleSaveOffline} disabled={!patternId}>
            保存为离线草稿
          </button>
          {savedId && <span className="saved-hint">已存为本地草稿，回网后可合并</span>}
        </div>
      </div>

      <div className="panel">
        <div className="heading">
          <div>
            <p>草稿箱</p>
            <h2>待合并外勤（{drafts.length}）</h2>
          </div>
        </div>
        {drafts.length === 0 ? (
          <p className="empty">暂无待合并草稿</p>
        ) : (
          <div className="draft-list">
            {drafts.map((f) => {
              const p = state.patterns.find((pp) => pp.id === f.patternId);
              const op = state.syncOps.find((o) => o.fieldRecordId === f.id);
              return (
                <article key={f.id} className={"draft-card " + (f.failedStep ? "failed" : "")}>
                  <div className="draft-head">
                    <strong>{p?.code ?? f.patternId}</strong>
                    <span className="draft-time">{new Date(f.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                  <p className="draft-note">{f.damageNote || "（无破损描述）"}</p>
                  <div className="draft-cards">
                    {f.threadColorCardIds.map((cid) => {
                      const c = state.colorCards.find((cc) => cc.id === cid);
                      return (
                        <span key={cid} className="card-chip">
                          <i style={{ background: c?.hex }} />
                          {c?.code} {c?.name}
                        </span>
                      );
                    })}
                  </div>
                  {op && (
                    <div className="step-progress">
                      {op.steps.map((s) => (
                        <span key={s.key} className={"step-dot " + (s.done ? "done" : "") + (op.status === "failed" && s.key === f.failedStep ? " failed" : "")}>
                          {s.done ? "✓" : "○"} {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {f.failedStep && <p className="fail-reason">合并中断于「{f.failedStep}」：{f.error}</p>}
                  <div className="draft-actions">
                    {f.failedStep ? (
                      <button className="primary" onClick={() => resumeRecord(f.id)} disabled={!online}>
                        从「{f.failedStep}」续传
                      </button>
                    ) : (
                      <button className="primary" onClick={() => mergeRecord(f.id)} disabled={!online}>
                        {online ? "回网合并" : "离线不可合并"}
                      </button>
                    )}
                    {!online && <span className="offline-hint">草稿已保留，联网后即可合并</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {synced.length > 0 && (
        <div className="panel">
          <div className="heading">
            <div>
              <p>已合并</p>
              <h2>历史外勤（{synced.length}）</h2>
            </div>
          </div>
          <ul className="timeline">
            {synced.map((f) => {
              const p = state.patterns.find((pp) => pp.id === f.patternId);
              return (
                <li key={f.id}>
                  <span className="badge ev-note">已合并</span>
                  {p?.code} · {f.damageNote || "补线记录"}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
