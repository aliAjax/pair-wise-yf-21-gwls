import type { AppState } from "./types";

const STORAGE_KEY = "hxyfront-62009-state";
export const SCHEMA_VERSION = 2;

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const now = Date.now();
const DAY = 86400000;

/**
 * 生成 v1 旧数据：旧数据缺色卡批号（无 batchNo、工序无 colorCardId、已入库无快照），
 * 用于演示「升级时按默认色卡回填，历史修复批次照样能打开」。
 */
function seedV1(): any {
  return {
    schemaVersion: 1,
    restorers: [
      { id: "r1", name: "卓玛" },
      { id: "r2", name: "扎西" },
    ],
    currentRestorerId: "r1",
    colorCards: [
      { id: "cc1", code: "CC-014", name: "靛蓝", hex: "#1e3a8a", updatedAt: now - 30 * DAY },
      { id: "cc2", code: "CC-027", name: "茜草红", hex: "#9f1239", updatedAt: now - 20 * DAY },
      { id: "cc3", code: "CC-031", name: "核桃棕", hex: "#78350f", updatedAt: now - 10 * DAY },
    ],
    patterns: [
      {
        id: "p1",
        code: "CAR-092",
        origin: "波斯",
        era: "约1960s",
        knotDensity: "42 结/cm²",
        material: "羊毛",
        dyeType: "植物染",
        damageAreas: ["边缘磨损", "局部断线"],
        markers: [
          { x: 22, y: 30, label: "边缘磨损" },
          { x: 70, y: 60, label: "中心缺口" },
        ],
        steps: [
          { id: "s1", name: "清洗", status: "done", assignee: "卓玛", version: 1, updatedAt: now - 5 * DAY, updatedBy: "卓玛" },
          { id: "s2", name: "补线", status: "warehoused", assignee: "扎西", version: 1, updatedAt: now - 2 * DAY, updatedBy: "扎西", warehousedAt: now - 2 * DAY },
          { id: "s3", name: "修整", status: "pending", version: 1, updatedAt: now - 2 * DAY },
        ],
        evidence: [],
        damageLog: [],
        version: 1,
        updatedAt: now - 2 * DAY,
        createdAt: now - 60 * DAY,
      },
      {
        id: "p2",
        code: "CAR-117",
        origin: "安纳托利亚",
        era: "约1950s",
        knotDensity: "38 结/cm²",
        material: "羊毛+棉",
        dyeType: "植物染",
        damageAreas: ["中心纹样缺口"],
        markers: [{ x: 45, y: 45, label: "中心缺口" }],
        steps: [
          { id: "s4", name: "清洗", status: "done", assignee: "卓玛", version: 1, updatedAt: now - 3 * DAY, updatedBy: "卓玛" },
          { id: "s5", name: "补线", status: "in-progress", assignee: "扎西", version: 1, updatedAt: now - 1 * DAY, updatedBy: "扎西" },
        ],
        evidence: [],
        damageLog: [],
        version: 1,
        updatedAt: now - 1 * DAY,
        createdAt: now - 45 * DAY,
      },
      {
        id: "p3",
        code: "CAR-138",
        origin: "藏毯",
        era: "约1980s",
        knotDensity: "36 结/cm²",
        material: "羊毛",
        dyeType: "化学染",
        damageAreas: ["局部褪色"],
        markers: [{ x: 60, y: 25, label: "褪色区" }],
        steps: [
          { id: "s6", name: "补线", status: "pending", version: 1, updatedAt: now - 1 * DAY },
        ],
        evidence: [],
        damageLog: [],
        version: 1,
        updatedAt: now - 1 * DAY,
        createdAt: now - 20 * DAY,
      },
    ],
    fieldRecords: [],
    syncOps: [],
    conflicts: [],
    consumption: [],
    settings: { simulateMergeFailure: false },
  };
}

/**
 * 升级迁移：旧数据缺色卡批号，按默认色卡回填。
 * - 色卡缺批号 -> 回填默认批号 B000-DEFAULT
 * - 工序缺 colorCardId -> 指向默认色卡
 * - 已入库工序缺快照 -> 用默认色卡冻结快照（历史批次照样能打开）
 * - 材料消耗缺批号 -> 回填默认批号
 */
function migrate(v1: any): AppState {
  const defaultCard = v1.colorCards[0];
  const defaultBatch = defaultCard?.batchNo ?? "B000-DEFAULT";

  const colorCards = (v1.colorCards ?? []).map((c: any) => ({
    ...c,
    batchNo: c.batchNo ?? defaultBatch,
  }));

  const patterns = (v1.patterns ?? []).map((p: any) => ({
    ...p,
    steps: (p.steps ?? []).map((s: any) => {
      const colorCardId = s.colorCardId ?? defaultCard?.id;
      const card = colorCards.find((c: any) => c.id === colorCardId) ?? colorCards[0];
      const colorCardSnapshot =
        s.status === "warehoused" && !s.colorCardSnapshot && card
          ? { code: card.code, name: card.name, hex: card.hex, batchNo: card.batchNo }
          : s.colorCardSnapshot;
      return { ...s, colorCardId, colorCardSnapshot };
    }),
  }));

  const consumption = (v1.consumption ?? []).map((c: any) => ({
    ...c,
    colorCardId: c.colorCardId ?? defaultCard?.id,
    batchNo: c.batchNo ?? defaultBatch,
  }));

  return {
    ...v1,
    schemaVersion: SCHEMA_VERSION,
    colorCards,
    patterns,
    consumption,
    fieldRecords: v1.fieldRecords ?? [],
    syncOps: v1.syncOps ?? [],
    conflicts: v1.conflicts ?? [],
    settings: v1.settings ?? { simulateMergeFailure: false },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion < SCHEMA_VERSION) {
        const migrated = migrate(parsed);
        saveState(migrated);
        return migrated;
      }
      return parsed as AppState;
    }
  } catch (e) {
    console.warn("读取本地档案失败，使用种子数据", e);
  }
  const seeded = migrate(seedV1());
  saveState(seeded);
  return seeded;
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("写入本地档案失败", e);
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
