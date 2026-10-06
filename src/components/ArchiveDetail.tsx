import { useState } from "react";
import type { Db, PatternArchive } from "../types";
import { advanceProcess, archiveNow, confirmProcessColor, simulateExternalConfirm } from "../store";
import MotifMap from "./MotifMap";

interface Props {
  db: Db;
  archive: PatternArchive;
  onDb: (db: Db) => void;
  notify: (msg: string) => void;
}

const SEV_CLASS: Record<string, string> = { 轻: "ok", 中: "warn", 重: "err" };
const STATUS_CLASS: Record<string, string> = {
  待开始: "s-todo",
  进行中: "s-doing",
  已完成: "s-done",
  已入库: "s-archived",
};

export default function ArchiveDetail({ db, archive, onDb, notify }: Props) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const archived = Boolean(archive.archivedAt);
  const doneCount = archive.processes.filter((p) => p.status === "已完成" || p.status === "已入库").length;
  const pct = archive.processes.length ? Math.round((doneCount / archive.processes.length) * 100) : 0;
  const allDone = archive.processes.every((p) => p.status === "已完成" || p.status === "已入库");
  const batch = db.batches.find((b) => b.id === archive.batchId);

  return (
    <section className="panel detail">
      <div className="heading">
        <div>
          <p>
            {archive.id} · v{archive.version}
            {batch ? ` · ${batch.name}` : ""}
          </p>
          <h2>{archive.name}</h2>
        </div>
        <span className={`badge ${archived ? "ok" : "warn"}`}>
          {archived ? `已入库 ${archive.archivedAt}` : "在修"}
        </span>
      </div>

      {archived && (
        <div className="note-banner">已入库记录：补线色号展示当时色卡快照，后续色卡批号更新不影响此处。</div>
      )}

      <div className="info-grid">
        <div>
          <small>地毯产地</small>
          <b>{archive.origin}</b>
        </div>
        <div>
          <small>年代</small>
          <b>{archive.era}</b>
        </div>
        <div>
          <small>结密度</small>
          <b>{archive.knotDensity} 结/5cm</b>
        </div>
        <div>
          <small>材质</small>
          <b>{archive.material}</b>
        </div>
        <div>
          <small>染色类型</small>
          <b>{archive.dyeType}</b>
        </div>
        <div>
          <small>破损区域</small>
          <b>{archive.zones.length} 处</b>
        </div>
      </div>

      <h3>纹样局部标记图</h3>
      <MotifMap zones={archive.zones} selectedId={zoneId} onSelect={(id) => setZoneId(id === zoneId ? null : id)} />
      <div className="zones">
        {archive.zones.map((z, i) => (
          <button
            key={z.id}
            className={`zone ${zoneId === z.id ? "active" : ""}`}
            onClick={() => setZoneId(zoneId === z.id ? null : z.id)}
          >
            <b>
              {i + 1}. {z.label}
            </b>
            <span>{z.description}</span>
            <em>
              <i className={`badge ${SEV_CLASS[z.severity]}`}>{z.severity}</i>
              <i className={`badge ${z.source === "外勤" ? "info" : ""}`}>{z.source}</i>
            </em>
          </button>
        ))}
      </div>

      <div className="heading sub">
        <div>
          <p>修复工序</p>
          <h3>
            进度 {doneCount}/{archive.processes.length} · {pct}%
          </h3>
        </div>
        {!archived && allDone && (
          <button
            className="primary"
            onClick={() => {
              onDb(archiveNow(archive.id));
              notify("已全部入库，此后展示当时色卡快照");
            }}
          >
            批次入库
          </button>
        )}
      </div>
      <div className="progress">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="procs">
        {archive.processes.map((p) => {
          const cardId = choice[p.id] ?? db.colorCards[0]?.id ?? "";
          return (
            <article key={p.id} className="proc">
              <div className="proc-main">
                <span className={`dot ${STATUS_CLASS[p.status]}`} />
                <div>
                  <b>{p.name}</b>
                  <small>
                    {p.assignee} · {p.status}
                    {p.confirmedAt ? ` · 确认于 ${p.confirmedAt}` : ""}
                  </small>
                </div>
              </div>
              <div className="proc-thread">
                {p.thread ? (
                  <>
                    <span className="swatch" style={{ background: p.thread.hex }} />
                    <span>
                      {p.thread.name} · 批号 {p.thread.batch}
                      {archived ? "（当时色卡）" : ""}
                    </span>
                  </>
                ) : (
                  <span className="muted">未确认补线色号</span>
                )}
                <span className="muted">材料 {p.materialUsed}g</span>
              </div>
              {!archived && (
                <div className="proc-ops">
                  <select value={cardId} onChange={(e) => setChoice({ ...choice, [p.id]: e.target.value })}>
                    {db.colorCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.batch}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary"
                    onClick={() => {
                      const res = confirmProcessColor(archive.id, p.id, cardId, archive.version, "修复师A");
                      onDb(res.db);
                      notify(res.message);
                    }}
                  >
                    确认色号
                  </button>
                  <button onClick={() => onDb(advanceProcess(archive.id, p.id))} disabled={p.status === "已完成"}>
                    推进
                  </button>
                  <button
                    className="ghost"
                    title="模拟另一名修复师在服务端保存同一工序（不刷新本地视图）"
                    onClick={() => {
                      simulateExternalConfirm(archive.id, p.id);
                      notify("修复师B 已在服务端保存该工序（本地视图未刷新），再次「确认色号」将触发冲突");
                    }}
                  >
                    并发模拟
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="ba">
        <div>
          <h3>修复前记录</h3>
          <ul>
            {archive.beforeNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>修复后记录</h3>
          {archive.afterNotes.length ? (
            <ul>
              {archive.afterNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">修复进行中，暂无</p>
          )}
        </div>
      </div>

      <h3>证据链（外勤记录只补证据，不覆盖工坊数据）</h3>
      <div className="evs">
        {archive.evidences.map((ev) => (
          <article key={ev.id} className="ev">
            <span className={`badge ${ev.kind === "外勤" ? "info" : ev.kind === "工坊" ? "ok" : ""}`}>{ev.kind}</span>
            <div>
              <p>{ev.text}</p>
              <small>
                {ev.by} · {ev.at}
              </small>
            </div>
          </article>
        ))}
        {!archive.evidences.length && <p className="muted">暂无证据</p>}
      </div>
    </section>
  );
}
