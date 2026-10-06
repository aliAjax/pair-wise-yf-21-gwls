import { useStore } from "../lib/store";

export default function SyncTab() {
  const { state, resolveConflict, resumeRecord, online } = useStore();

  const ops = [...state.syncOps].sort((a, b) => b.createdAt - a.createdAt);
  const pendingConflicts = state.conflicts.filter((c) => !c.resolved);
  const resolvedConflicts = state.conflicts.filter((c) => c.resolved);

  return (
    <div className="sync-tab">
      <div className="panel">
        <div className="heading">
          <div>
            <p>并发冲突</p>
            <h2>工序保存冲突（{pendingConflicts.length} 待处理）</h2>
          </div>
        </div>
        {pendingConflicts.length === 0 ? (
          <p className="empty">无并发冲突。两名修复师同时保存同一纹样时，先确认的工序保留，后到的修改列为本列表。</p>
        ) : (
          <div className="conflict-list">
            {pendingConflicts.map((c) => {
              const p = state.patterns.find((pp) => pp.id === c.patternId);
              return (
                <article key={c.id} className="conflict-card">
                  <div className="conflict-head">
                    <strong>{p?.code ?? c.patternId}</strong>
                    <span className="badge status-pending">冲突</span>
                  </div>
                  <p className="conflict-detail">{c.detail}</p>
                  <div className="conflict-parties">
                    <span className="winner">保留：{c.winnerBy}（先确认 v{c.winnerVersion}）</span>
                    <span className="loser">驳回：{c.loserBy}（后到，基于 v{c.loserBaseVersion}）</span>
                  </div>
                  <button onClick={() => resolveConflict(c.id)}>已知悉（保留先到工序）</button>
                </article>
              );
            })}
          </div>
        )}
        {resolvedConflicts.length > 0 && (
          <details className="resolved">
            <summary>已处理冲突（{resolvedConflicts.length}）</summary>
            <ul className="timeline">
              {resolvedConflicts.map((c) => (
                <li key={c.id}>
                  <span className="badge ev-note">已处理</span>
                  {c.detail}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="panel">
        <div className="heading">
          <div>
            <p>合并流水</p>
            <h2>同步操作记录</h2>
          </div>
        </div>
        {ops.length === 0 ? (
          <p className="empty">暂无合并记录。外勤记录回网合并后，此处展示每一步的完成状态与断点。</p>
        ) : (
          <div className="op-list">
            {ops.map((op) => {
              const p = state.patterns.find((pp) => pp.id === op.patternId);
              const fr = state.fieldRecords.find((f) => f.id === op.fieldRecordId);
              return (
                <article key={op.id} className={"op-card " + op.status}>
                  <div className="op-head">
                    <strong>{p?.code ?? op.patternId}</strong>
                    <span className={"badge op-" + op.status}>
                      {op.status === "merged" ? "已合并" : op.status === "failed" ? "失败待续传" : "合并中"}
                    </span>
                    <span className="op-attempts">第 {op.attempts} 次尝试</span>
                  </div>
                  <div className="step-progress">
                    {op.steps.map((s) => (
                      <span
                        key={s.key}
                        className={
                          "step-dot " +
                          (s.done ? "done" : "") +
                          (op.status === "failed" && s.key === fr?.failedStep ? " failed" : "")
                        }
                      >
                        {s.done ? "✓" : "○"} {s.label}
                      </span>
                    ))}
                  </div>
                  {op.status === "failed" && (
                    <p className="fail-reason">
                      中断于「{fr?.failedStep}」：{op.error}。恢复时从该步骤续传，已完成步骤不重复执行，材料消耗不会重复追加。
                    </p>
                  )}
                  {op.status === "failed" && (
                    <button className="primary" onClick={() => resumeRecord(op.fieldRecordId)} disabled={!online}>
                      从「{fr?.failedStep}」续传
                    </button>
                  )}
                  {op.mergedAt && <span className="op-time">完成于 {new Date(op.mergedAt).toLocaleString("zh-CN")}</span>}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
