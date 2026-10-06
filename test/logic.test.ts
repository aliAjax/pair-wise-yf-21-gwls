import assert from "node:assert";

// mock localStorage
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

async function main() {
const { loadState, saveState, clearState } = await import("../src/lib/storage.js");
const { mergeFieldRecord, saveStep, simulateColleagueSave, warehouseStep, updateColorCardBatch } =
  await import("../src/lib/sync.js");

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

clearState();
let s = loadState();

test("迁移：v1 旧数据升级后色卡批号被回填", () => {
  assert.equal(s.schemaVersion, 2);
  assert.ok(s.colorCards.every((c) => c.batchNo), "所有色卡应有批号");
  assert.ok(s.patterns.every((p) => p.steps.every((st) => st.colorCardId)), "所有工序应指向色卡");
});

test("迁移：已入库旧工序获得默认色卡快照，历史批次可打开", () => {
  const warehoused = s.patterns.flatMap((p) => p.steps).filter((st) => st.status === "warehoused");
  assert.ok(warehoused.length > 0, "应有已入库工序");
  assert.ok(warehoused.every((st) => st.colorCardSnapshot), "已入库工序应有快照");
  assert.ok(warehoused.every((st) => st.colorCardSnapshot!.batchNo), "快照应含批号");
});

test("合并：外勤记录合并后证据追加、材料消耗计入", () => {
  const fr = {
    id: "fr-test-1",
    patternId: "p1",
    damageNote: "边缘新磨损约2cm",
    threadColorCardIds: ["cc1", "cc2"],
    evidence: [{ kind: "note" as const, content: "现场照片：边缘磨损" }],
    createdAt: Date.now(),
    synced: false,
  };
  s = { ...s, fieldRecords: [...s.fieldRecords, fr] };
  const before = s.consumption.length;
  const { state: next } = mergeFieldRecord(s, fr.id);
  s = next;
  const p = s.patterns.find((p) => p.id === "p1")!;
  assert.ok(p.evidence.some((e) => e.fieldRecordId === fr.id), "证据应追加");
  assert.ok(p.damageLog.some((d) => d.fieldRecordId === fr.id), "破损描述应追加");
  assert.equal(s.consumption.length - before, 2, "应计入2条材料消耗");
  assert.ok(s.fieldRecords.find((f) => f.id === fr.id)!.synced, "应标记已同步");
});

test("幂等：同一外勤记录重复合并，材料消耗不重复追加", () => {
  const fr = s.fieldRecords.find((f) => f.id === "fr-test-1")!;
  const before = s.consumption.length;
  const { state: next } = mergeFieldRecord(s, fr.id);
  s = next;
  assert.equal(s.consumption.length, before, "重复合并不应追加消耗");
});

test("失败续传：模拟合并失败后从失败步骤续传，不重复消耗", () => {
  const fr = {
    id: "fr-test-2",
    patternId: "p1",
    damageNote: "中心缺口补线",
    threadColorCardIds: ["cc3"],
    evidence: [],
    createdAt: Date.now(),
    synced: false,
  };
  s = { ...s, fieldRecords: [...s.fieldRecords, fr], settings: { ...s.settings, simulateMergeFailure: true } };
  const before = s.consumption.length;
  const { state: failed } = mergeFieldRecord(s, fr.id);
  s = failed;
  assert.ok(!s.fieldRecords.find((f) => f.id === fr.id)!.synced, "失败后应保留草稿");
  assert.equal(s.fieldRecords.find((f) => f.id === fr.id)!.failedStep, "consumption", "应停在消耗步骤");
  assert.equal(s.consumption.length, before, "失败时不应计入消耗");
  // 续传（故障注入已一次性复位）
  const { state: resumed } = mergeFieldRecord(s, fr.id);
  s = resumed;
  assert.ok(s.fieldRecords.find((f) => f.id === fr.id)!.synced, "续传后应已同步");
  assert.equal(s.consumption.length, before + 1, "续传应只补计1条，不重复");
});

test("并发冲突：同事先保存后，后到修改列冲突且不覆盖", () => {
  const p = s.patterns.find((p) => p.id === "p2")!;
  const baseVersion = p.version;
  // 同事先保存
  s = simulateColleagueSave(s, "p2");
  // 当前修复师基于旧版本保存
  const { state: next, conflict } = saveStep(s, "p2", "s5", baseVersion, { status: "done" });
  s = next;
  assert.ok(conflict, "应产生冲突");
  assert.equal(conflict!.winnerBy, "扎西", "先到者（扎西）应保留");
  assert.equal(conflict!.loserBy, "卓玛", "后到者（卓玛）应列为冲突");
  const pAfter = s.patterns.find((p) => p.id === "p2")!;
  assert.equal(pAfter.version, baseVersion + 1, "纹样版本应保持先到者的版本");
  assert.equal(pAfter.steps.find((st) => st.id === "s5")!.status, "in-progress", "后到修改不应覆盖工序状态");
});

test("色卡批号更新：未完成工序按新批号重算", () => {
  const before = s.consumption.find((c) => c.colorCardId === "cc3" && c.patternId === "p1");
  assert.ok(before, "应有 cc3 消耗");
  const oldBatch = before!.batchNo;
  s = updateColorCardBatch(s, "cc3");
  const after = s.consumption.find((c) => c.colorCardId === "cc3" && c.patternId === "p1");
  assert.notEqual(after!.batchNo, oldBatch, "未完成工序批号应重算为新批号");
});

test("色卡批号更新：已入库记录仍展示当时色卡（快照冻结）", () => {
  // p1 的 s2 已入库，其消耗应保持原批号
  const warehousedStep = s.patterns.flatMap((p) => p.steps).find((st) => st.status === "warehoused")!;
  const card = s.colorCards.find((c) => c.id === warehousedStep.colorCardId)!;
  const frozenBatch = warehousedStep.colorCardSnapshot!.batchNo;
  // 强制更新该色卡批号
  s = updateColorCardBatch(s, card.id);
  const stepAfter = s.patterns.flatMap((p) => p.steps).find((st) => st.id === warehousedStep.id)!;
  assert.equal(stepAfter.colorCardSnapshot!.batchNo, frozenBatch, "已入库快照批号不应变");
  assert.ok(stepAfter.colorCardSnapshot!.code, "快照应保留色号");
});

test("入库：工序入库时冻结色卡快照", () => {
  s = warehouseStep(s, "p3", "s6");
  const step = s.patterns.find((p) => p.id === "p3")!.steps.find((st) => st.id === "s6")!;
  assert.equal(step.status, "warehoused");
  assert.ok(step.colorCardSnapshot, "入库应生成快照");
});

console.log(`\n${passed} 项测试通过`);
process.exitCode = process.exitCode ?? 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
