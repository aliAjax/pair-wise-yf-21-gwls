import { useCallback, useEffect, useState } from "react";
import "./styles.css";
import type { Db, OutboxItem } from "./types";
import { loadDb } from "./store";
import { loadOutbox, runSync } from "./sync";
import ArchiveDetail from "./components/ArchiveDetail";
import FieldPanel from "./components/FieldPanel";
import ColorCardPanel from "./components/ColorCardPanel";

const ORIGINS = ["全部", "波斯", "安纳托利亚", "高加索", "藏毯"];

function App() {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [outbox, setOutbox] = useState<OutboxItem[]>(() => loadOutbox());
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [origin, setOrigin] = useState("全部");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("CAR-117");
  const [toast, setToast] = useState<string | null>(null);
  const [showMigration, setShowMigration] = useState(true);

  const notify = useCallback((msg: string) => setToast(msg), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const { db: d, outbox: o } = await runSync((nd, no) => {
        setDb(nd);
        setOutbox(no);
      });
      setDb(d);
      setOutbox([...o]);
    } finally {
      setSyncing(false);
    }
  }, []);

  const pendingCount = outbox.filter((i) => i.status !== "已同步").length;
  useEffect(() => {
    if (online && pendingCount > 0 && !syncing) void syncNow();
    // 仅在回网瞬间触发自动合并
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const filtered = db.archives.filter(
    (a) => (origin === "全部" || a.origin === origin) && (!batchId || a.batchId === batchId),
  );
  const selected = db.archives.find((a) => a.id === selectedId) ?? filtered[0] ?? db.archives[0];

  const totalProcs = db.archives.reduce((n, a) => n + a.processes.length, 0);
  const doneProcs = db.archives.reduce(
    (n, a) => n + a.processes.filter((p) => p.status === "已完成" || p.status === "已入库").length,
    0,
  );
  const metrics = [
    { label: "待修复", value: db.archives.filter((a) => !a.archivedAt).length },
    { label: "纹样档案", value: db.archives.length },
    { label: "色卡数量", value: db.colorCards.length },
    { label: "完工率", value: `${totalProcs ? Math.round((doneProcs / totalProcs) * 100) : 0}%` },
  ];

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p>hxyfront-62009 · 手工地毯修复工作室</p>
          <h1>地毯修复纹样档案</h1>
          <span>
            纹样档案、修复批次与材料色卡已打通：外勤离线登记的破损与补线色号在回网后合并进工坊工序；
            并发保存先确认者保留、后到修改列入冲突；色卡批号更新只重算未完成工序，已入库记录仍展示当时色卡。
          </span>
        </div>
        <div className="net-box">
          <button className={`net ${online ? "on" : "off"}`} onClick={() => setOnline(!online)}>
            {online ? "● 在线（工坊）" : "● 离线（外勤模式）"}
          </button>
          <small>
            {syncing ? "正在合并外勤草稿…" : pendingCount > 0 ? `${pendingCount} 条本地草稿待合并` : "同步队列已清空"}
          </small>
        </div>
      </section>

      {showMigration && db.migrationNotes.length > 0 && (
        <div className="banner">
          <div>
            <b>数据升级完成（v1 → v2）</b>
            <ul>
              {db.migrationNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setShowMigration(false)}>知道了</button>
        </div>
      )}

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <div className="layout">
        <aside className="side">
          <section className="panel">
            <h2>按产地筛选</h2>
            <div className="chips">
              {ORIGINS.map((o) => (
                <button key={o} className={origin === o ? "active" : ""} onClick={() => setOrigin(o)}>
                  {o}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>纹样档案（{filtered.length}）</h2>
            <div className="list">
              {filtered.map((a) => {
                const done = a.processes.filter((p) => p.status === "已完成" || p.status === "已入库").length;
                return (
                  <button
                    key={a.id}
                    className={`arch-item ${selected.id === a.id ? "active" : ""}`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <div className="ob-head">
                      <b>{a.id}</b>
                      <span className={`badge ${a.archivedAt ? "ok" : "warn"}`}>{a.archivedAt ? "已入库" : "在修"}</span>
                    </div>
                    <span>
                      {a.name} · {a.origin}
                    </span>
                    <small>
                      工序 {done}/{a.processes.length} · 破损 {a.zones.length} 处
                    </small>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="muted">该筛选条件下暂无档案</p>}
            </div>
          </section>

          <section className="panel">
            <h2>修复批次</h2>
            <div className="list">
              <button className={`batch-item ${batchId === null ? "active" : ""}`} onClick={() => setBatchId(null)}>
                全部批次
              </button>
              {db.batches.map((b) => (
                <button
                  key={b.id}
                  className={`batch-item ${batchId === b.id ? "active" : ""}`}
                  onClick={() => setBatchId(batchId === b.id ? null : b.id)}
                >
                  <div className="ob-head">
                    <b>{b.id}</b>
                    <span className={`badge ${b.status === "已入库" ? "ok" : "info"}`}>{b.status}</span>
                  </div>
                  <span>{b.name}</span>
                  <small>
                    {b.archiveIds.length} 条档案 · {b.at}
                  </small>
                </button>
              ))}
            </div>
            <p className="muted tiny">已入库的历史批次点击即可打开，展示当时色卡快照。</p>
          </section>
        </aside>

        <ArchiveDetail db={db} archive={selected} onDb={setDb} notify={notify} />

        <div className="side">
          <section className="panel rules">
            <h2>合并规则</h2>
            <ul>
              <li>外勤离线登记回网后合并进工坊工序；只补证据，不覆盖已确认数据</li>
              <li>同一纹样两人同时保存：先确认的工序保留，后到修改列入冲突</li>
              <li>色卡批号更新：未完成工序按新批号重算，已入库记录展示当时色卡</li>
              <li>合并失败保留本地草稿，恢复后从失败步骤续传，材料消耗按幂等键去重</li>
              <li>旧数据缺色卡批号：升级时按默认色卡回填，历史批次照常打开</li>
            </ul>
          </section>

          <FieldPanel
            db={db}
            online={online}
            syncing={syncing}
            outbox={outbox}
            onOutbox={setOutbox}
            onSync={syncNow}
            notify={notify}
          />

          <ColorCardPanel db={db} onDb={setDb} notify={notify} />

          <section className="panel">
            <div className="heading">
              <div>
                <p>并发与合并</p>
                <h2>冲突列表（{db.conflicts.length}）</h2>
              </div>
            </div>
            {db.conflicts.length === 0 && (
              <p className="muted">暂无冲突。同一纹样两名修复师同时保存时，先确认的工序保留，后到修改会列在这里。</p>
            )}
            {db.conflicts.map((c) => (
              <article key={c.id} className="cf">
                <div className="ob-head">
                  <b>{c.title}</b>
                  <span className={`badge ${c.source === "外勤合并" ? "info" : "err"}`}>{c.source}</span>
                </div>
                <p>保留（先确认）：{c.kept}</p>
                <p>驳回（后到修改）：{c.rejected}</p>
                <small>{c.at}</small>
              </article>
            ))}
          </section>
        </div>
      </div>

      <footer className="foot">
        <span>hxyfront-62009 · 数据保存在浏览器本地（localStorage）</span>
        <button
          className="ghost"
          onClick={() => {
            localStorage.clear();
            location.reload();
          }}
        >
          重置演示数据
        </button>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
