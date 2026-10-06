import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import PatternsTab from "./components/PatternsTab";
import FieldTab from "./components/FieldTab";
import SyncTab from "./components/SyncTab";
import CardsTab from "./components/CardsTab";

type Tab = "patterns" | "field" | "sync" | "cards";

const TABS: { key: Tab; label: string }[] = [
  { key: "patterns", label: "纹样档案" },
  { key: "field", label: "外勤登记" },
  { key: "sync", label: "同步中心" },
  { key: "cards", label: "色卡管理" },
];

function Metrics() {
  const { state } = useStore();
  const patternCount = state.patterns.length;
  const pendingField = state.fieldRecords.filter((f) => !f.synced).length;
  const conflicts = state.conflicts.filter((c) => !c.resolved).length;
  const totalSteps = state.patterns.reduce((n, p) => n + p.steps.length, 0);
  const doneSteps = state.patterns.reduce(
    (n, p) => n + p.steps.filter((s) => s.status === "done" || s.status === "warehoused").length,
    0
  );
  const rate = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const items = [
    { label: "纹样档案", value: patternCount },
    { label: "待合并外勤", value: pendingField },
    { label: "待处理冲突", value: conflicts },
    { label: "工序完工率", value: `${rate}%` },
  ];

  return (
    <section className="metrics">
      {items.map((m) => (
        <article key={m.label}>
          <small>{m.label}</small>
          <strong>{m.value}</strong>
        </article>
      ))}
    </section>
  );
}

function TopBar() {
  const {
    state,
    online,
    setOnline,
    setCurrentRestorer,
    toggleSimulateFailure,
    resetAll,
  } = useStore();

  return (
    <div className="topbar">
      <div className="topbar-group">
        <span className="topbar-label">修复师身份</span>
        <select
          value={state.currentRestorerId}
          onChange={(e) => setCurrentRestorer(e.target.value)}
        >
          {state.restorers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="topbar-group">
        <span className="topbar-label">网络</span>
        <button className={online ? "online-btn on" : "online-btn off"} onClick={() => setOnline(!online)}>
          {online ? "在线（点击模拟离线）" : "离线（点击回网）"}
        </button>
      </div>
      <div className="topbar-group">
        <label className="switch">
          <input
            type="checkbox"
            checked={state.settings.simulateMergeFailure}
            onChange={toggleSimulateFailure}
          />
          <span>模拟下次合并失败（材料消耗步骤）</span>
        </label>
      </div>
      <div className="topbar-group">
        <button className="reset-btn" onClick={resetAll}>
          重置演示数据
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("patterns");
  const { state } = useStore();
  const pendingConflicts = state.conflicts.filter((c) => !c.resolved).length;
  const pendingField = state.fieldRecords.filter((f) => !f.synced).length;

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62009 · 手工地毯修复 · 离线同步</p>
        <h1>地毯修复纹样档案</h1>
        <span>
          外勤离线登记破损与补线色号，回网后合并进工坊工序；同一纹样两名修复师同时保存时，先确认的工序保留，后到的修改列成冲突，外勤记录只补证据不覆盖。色卡批号更新后，未完成工序按新批号重算，已入库记录仍展示当时色卡。合并失败保留本地草稿，恢复时从失败步骤续传，不重复追加材料消耗；旧数据缺色卡批号，升级时按默认色卡回填，历史修复批次照样能打开。
        </span>
      </section>

      <TopBar />
      <Metrics />

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "field" && pendingField > 0 && <em className="tab-badge">{pendingField}</em>}
            {t.key === "sync" && pendingConflicts > 0 && (
              <em className="tab-badge alert">{pendingConflicts}</em>
            )}
          </button>
        ))}
      </nav>

      <section className="panel tab-panel">
        {tab === "patterns" && <PatternsTab />}
        {tab === "field" && <FieldTab />}
        {tab === "sync" && <SyncTab />}
        {tab === "cards" && <CardsTab />}
      </section>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
