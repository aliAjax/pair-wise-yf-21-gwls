import { useEffect, useState } from "react";
import type { Db, OutboxItem, Severity } from "../types";
import { now, uid } from "../store";
import { SYNC_STEPS, addToOutbox, clearDoneOutbox, injectFailure } from "../sync";

interface Props {
  db: Db;
  online: boolean;
  syncing: boolean;
  outbox: OutboxItem[];
  onOutbox: (items: OutboxItem[]) => void;
  onSync: () => void;
  notify: (msg: string) => void;
}

export default function FieldPanel({ db, online, syncing, outbox, onOutbox, onSync, notify }: Props) {
  const active = db.archives.filter((a) => !a.archivedAt);
  const [archiveId, setArchiveId] = useState(active[0]?.id ?? db.archives[0]?.id ?? "");
  const [zoneLabel, setZoneLabel] = useState("");
  const [severity, setSeverity] = useState<Severity>("中");
  const [description, setDescription] = useState("");
  const [threadCardId, setThreadCardId] = useState("");
  const [note, setNote] = useState("");
  const [fail, setFail] = useState("");

  useEffect(() => {
    if (!syncing) setFail("");
  }, [syncing]);

  const submit = () => {
    if (!archiveId || !zoneLabel.trim() || !description.trim()) {
      notify("请填写档案、破损区域与描述");
      return;
    }
    const item: OutboxItem = {
      id: uid("OB"),
      archiveId,
      by: "外勤·小李",
      at: now(),
      zoneLabel: zoneLabel.trim(),
      severity,
      description: description.trim(),
      threadCardId: threadCardId || undefined,
      note: note.trim(),
      status: "待同步",
      step: 0,
      log: [],
    };
    onOutbox(addToOutbox(item));
    setZoneLabel("");
    setDescription("");
    setNote("");
    notify(online ? "已登记到同步队列" : "已离线保存为本地草稿，回网后合并进工坊工序");
  };

  const pending = outbox.filter((i) => i.status !== "已同步").length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>外勤离线登记</p>
          <h2>破损与补线色号</h2>
        </div>
        <button className="primary" disabled={!online || syncing || pending === 0} onClick={onSync}>
          {syncing ? "同步中…" : online ? `回网同步（${pending}）` : "离线中"}
        </button>
      </div>

      <div className="field-grid one">
        <label>
          <span>纹样档案</span>
          <select value={archiveId} onChange={(e) => setArchiveId(e.target.value)}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>破损区域</span>
          <input value={zoneLabel} onChange={(e) => setZoneLabel(e.target.value)} placeholder="如：南缘磨损（同名区域只补证据）" />
        </label>
        <label>
          <span>严重程度</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            <option>轻</option>
            <option>中</option>
            <option>重</option>
          </select>
        </label>
        <label>
          <span>破损描述</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="外勤现场记录" />
        </label>
        <label>
          <span>补线色卡（可选）</span>
          <select value={threadCardId} onChange={(e) => setThreadCardId(e.target.value)}>
            <option value="">不指定</option>
            {db.colorCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.batch}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="照片编号、测量值等" />
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={submit}>
          离线登记
        </button>
        <select
          className="fail-inject"
          value={fail}
          onChange={(e) => {
            const v = e.target.value;
            setFail(v);
            injectFailure(v === "" ? null : Number(v));
          }}
          title="演示：下次同步在指定步骤中断，验证草稿保留与断点续传"
        >
          <option value="">不注入故障</option>
          {SYNC_STEPS.map((s, i) => (
            <option key={s} value={i}>
              下次同步在「{s}」失败
            </option>
          ))}
        </select>
      </div>

      <div className="outbox">
        {outbox.length === 0 && <p className="muted">同步队列为空。离线登记的草稿会保留在本地，回网后逐步合并。</p>}
        {outbox.map((item) => (
          <article key={item.id} className={`ob ${item.status === "失败" ? "failed" : ""}`}>
            <div className="ob-head">
              <b>
                {item.archiveId} · {item.zoneLabel}
              </b>
              <span
                className={`badge ${
                  item.status === "已同步" ? "ok" : item.status === "失败" ? "err" : item.status === "同步中" ? "info" : ""
                }`}
              >
                {item.status}
              </span>
            </div>
            <small>
              {item.by} · {item.at} · 步骤 {item.step}/{SYNC_STEPS.length}
            </small>
            <div className="steps">
              {SYNC_STEPS.map((s, i) => (
                <i
                  key={s}
                  title={s}
                  className={i < item.step ? "done" : item.status === "失败" && i === item.step ? "fail" : ""}
                />
              ))}
            </div>
            {item.error && (
              <p className="err-text">
                {item.error}；恢复后从「{SYNC_STEPS[item.step]}」续传
              </p>
            )}
            {item.log.length > 0 && (
              <ul className="log">
                {item.log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {outbox.some((i) => i.status === "已同步") && (
          <button className="ghost" onClick={() => onOutbox(clearDoneOutbox())}>
            清理已同步记录
          </button>
        )}
      </div>
    </section>
  );
}
