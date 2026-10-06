import type { ColorCard, ConflictEntry, Db, PatternArchive } from "./types";

export const DB_KEY = "carpet-archive-db";

export const now = () => new Date().toLocaleString("zh-CN", { hour12: false });
export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/**
 * 旧版（schemaVersion 1）种子数据：
 * 工序只有 threadCardId、没有色卡批号快照，档案没有 version，
 * 用于演示升级迁移（按默认色卡回填）与历史批次可打开。
 */
const LEGACY_DB = {
  schemaVersion: 1,
  colorCards: [
    { id: "CC-IND", name: "靛蓝", hex: "#1e3a8a", material: "羊毛", batch: "2026-09-A", history: [] },
    { id: "CC-MAD", name: "茜草红", hex: "#b91c1c", material: "羊毛", batch: "2026-09-A", history: [] },
    { id: "CC-POM", name: "石榴黄", hex: "#d97706", material: "真丝", batch: "2026-08-C", history: [] },
    { id: "CC-TUR", name: "松石绿", hex: "#0f766e", material: "羊毛", batch: "2026-09-A", history: [] },
    { id: "CC-IVO", name: "象牙白", hex: "#e7e0cf", material: "棉线", batch: "2026-07-B", history: [] },
    { id: "CC-WAL", name: "胡桃褐", hex: "#7c2d12", material: "羊毛", batch: "2026-09-A", history: [] },
  ],
  archives: [
    {
      id: "CAR-001",
      name: "克尔曼花园毯",
      origin: "波斯",
      era: "约1920s",
      knotDensity: 36,
      material: "羊毛",
      dyeType: "植物染",
      batchId: "RB-2025-12",
      archivedAt: "2025-12-20 16:40:00",
      beforeNotes: ["北缘流苏脱落约 40cm", "花园纹主区褪色明显"],
      afterNotes: ["补线色差 ΔE<1.5，目测无痕", "锁边牢固，拉力测试通过"],
      zones: [
        { id: "Z-001-1", label: "花园纹补线区", x: 35, y: 22, w: 30, h: 20, severity: "中", description: "主纹区缺绒，已织补", source: "工坊" },
        { id: "Z-001-2", label: "北缘锁边区", x: 8, y: 4, w: 40, h: 8, severity: "轻", description: "流苏根部重锁", source: "工坊" },
      ],
      processes: [
        { id: "P-001-1", name: "清洗去尘", status: "已入库", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-001-2", name: "花园纹补线", status: "已入库", assignee: "老马", threadCardId: "CC-IND", materialUsed: 85 },
        { id: "P-001-3", name: "北缘锁边", status: "已入库", assignee: "老马", threadCardId: "CC-WAL", materialUsed: 40 },
        { id: "P-001-4", name: "定型质检", status: "已入库", assignee: "阿依古丽", materialUsed: 0 },
      ],
      evidences: [
        { id: "EV-001-1", kind: "系统", text: "2025-12-20 随批次 RB-2025-12 入库", by: "系统", at: "2025-12-20 16:40:00" },
      ],
    },
    {
      id: "CAR-092",
      name: "伊斯法罕奖章纹",
      origin: "波斯",
      era: "约1960s",
      knotDensity: 42,
      material: "羊毛",
      dyeType: "植物染",
      batchId: "RB-2026-04",
      beforeNotes: ["medallion 中心缺绒 2 处", "北缘磨损露经"],
      afterNotes: [],
      zones: [
        { id: "Z-092-1", label: "边缘磨损·北", x: 4, y: 4, w: 30, h: 10, severity: "中", description: "北缘流苏根部磨损，需补线", source: "工坊" },
        { id: "Z-092-2", label: "中心纹样缺口", x: 40, y: 24, w: 20, h: 16, severity: "重", description: "medallion 中心缺绒", source: "工坊" },
        { id: "Z-092-3", label: "角落虫蛀", x: 78, y: 50, w: 14, h: 12, severity: "轻", description: "外勤初检：东南角虫蛀点", source: "外勤" },
      ],
      processes: [
        { id: "P-092-1", name: "清洗去尘", status: "已完成", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-092-2", name: "结构加固", status: "进行中", assignee: "老马", materialUsed: 15 },
        { id: "P-092-3", name: "补线·靛蓝", status: "待开始", assignee: "老马", threadCardId: "CC-IND", materialUsed: 0 },
        { id: "P-092-4", name: "补线·茜红", status: "待开始", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-092-5", name: "定型", status: "待开始", assignee: "老马", materialUsed: 0 },
      ],
      evidences: [
        { id: "EV-092-1", kind: "外勤", text: "外勤初检：东南角虫蛀点，建议隔离存放", by: "外勤·小李", at: "2026-09-28 10:12:00" },
      ],
    },
    {
      id: "CAR-117",
      name: "祈祷龛纹毯",
      origin: "安纳托利亚",
      era: "约1880s",
      knotDensity: 38,
      material: "羊毛+棉",
      dyeType: "矿物染",
      batchId: "RB-2026-04",
      beforeNotes: ["中心祈祷龛缺口 6×8cm", "边框植物染褪色"],
      afterNotes: [],
      zones: [
        { id: "Z-117-1", label: "中心祈祷龛缺口", x: 38, y: 18, w: 24, h: 20, severity: "重", description: "龛形主纹缺口，需对花织补", source: "工坊" },
        { id: "Z-117-2", label: "边框褪色", x: 6, y: 52, w: 40, h: 10, severity: "轻", description: "外勤记录：下边框日晒褪色", source: "外勤" },
      ],
      processes: [
        { id: "P-117-1", name: "清洗去尘", status: "已完成", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-117-2", name: "补线·中心龛", status: "进行中", assignee: "老马", threadCardId: "CC-MAD", materialUsed: 30 },
        { id: "P-117-3", name: "补线·边框", status: "待开始", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-117-4", name: "染色校正", status: "待开始", assignee: "老马", materialUsed: 0 },
        { id: "P-117-5", name: "质检", status: "待开始", assignee: "阿依古丽", materialUsed: 0 },
      ],
      evidences: [
        { id: "EV-117-1", kind: "工坊", text: "拆边时发现经线断头 3 处，已在标记图标出", by: "阿依古丽", at: "2026-09-30 14:05:00" },
      ],
    },
    {
      id: "CAR-138",
      name: "祥云纹藏毯",
      origin: "藏毯",
      era: "约1950s",
      knotDensity: 50,
      material: "牦牛毛",
      dyeType: "植物染（靛蓝）",
      batchId: "RB-2026-05",
      beforeNotes: ["靛蓝区域局部褪色，需匹配靛蓝色卡"],
      afterNotes: [],
      zones: [
        { id: "Z-138-1", label: "靛蓝区褪色", x: 30, y: 20, w: 26, h: 18, severity: "中", description: "局部褪色，需匹配靛蓝色卡", source: "工坊" },
        { id: "Z-138-2", label: "边缘松散", x: 70, y: 6, w: 22, h: 10, severity: "轻", description: "边缘经纬松散", source: "工坊" },
      ],
      processes: [
        { id: "P-138-1", name: "清洗去尘", status: "进行中", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-138-2", name: "补线·靛蓝", status: "待开始", assignee: "老马", threadCardId: "CC-IND", materialUsed: 0 },
        { id: "P-138-3", name: "定型", status: "待开始", assignee: "老马", materialUsed: 0 },
      ],
      evidences: [],
    },
    {
      id: "CAR-150",
      name: "十字星纹毯",
      origin: "高加索",
      era: "约1900s",
      knotDensity: 30,
      material: "羊毛",
      dyeType: "矿物染",
      batchId: "RB-2026-05",
      beforeNotes: ["十字星主纹缺口"],
      afterNotes: [],
      zones: [
        { id: "Z-150-1", label: "十字星缺口", x: 44, y: 26, w: 16, h: 14, severity: "中", description: "主纹几何缺口", source: "工坊" },
      ],
      processes: [
        { id: "P-150-1", name: "清洗去尘", status: "待开始", assignee: "阿依古丽", materialUsed: 0 },
        { id: "P-150-2", name: "补线·十字星", status: "待开始", assignee: "老马", materialUsed: 0 },
        { id: "P-150-3", name: "质检", status: "待开始", assignee: "阿依古丽", materialUsed: 0 },
      ],
      evidences: [],
    },
  ],
  batches: [
    { id: "RB-2025-12", name: "2025 冬·入库批", status: "已入库", archiveIds: ["CAR-001"], at: "2025-12-20 16:40:00" },
    { id: "RB-2026-04", name: "2026 春·修复批", status: "进行中", archiveIds: ["CAR-092", "CAR-117"], at: "2026-04-02 09:00:00" },
    { id: "RB-2026-05", name: "2026 秋·修复批", status: "进行中", archiveIds: ["CAR-138", "CAR-150"], at: "2026-09-15 09:00:00" },
  ],
  conflicts: [],
  consumption: [],
  migrationNotes: [],
};

/**
 * v1 → v2 迁移：
 * - 旧工序缺色卡批号 → 按（引用的或默认的）色卡当前批号回填快照
 * - 补齐档案版本号 / 证据与破损数组
 * - 校验历史修复批次仍可打开
 */
function migrate(raw: any): Db {
  if (raw.schemaVersion >= 2) return raw as Db;
  const notes: string[] = [];
  const cards = (raw.colorCards ?? []) as ColorCard[];
  const defaultCard = cards[0];
  let backfilled = 0;
  let versioned = 0;
  for (const a of (raw.archives ?? []) as any[]) {
    a.zones ??= [];
    a.evidences ??= [];
    a.beforeNotes ??= [];
    a.afterNotes ??= [];
    if (a.version == null) {
      a.version = 1;
      versioned++;
    }
    for (const p of a.processes ?? []) {
      if (!p.thread && p.threadCardId) {
        const card = cards.find((c) => c.id === p.threadCardId) ?? defaultCard;
        if (card) {
          p.thread = { cardId: card.id, name: card.name, hex: card.hex, batch: card.batch };
          backfilled++;
        }
        delete p.threadCardId;
      }
      p.materialUsed ??= 0;
    }
  }
  raw.conflicts ??= [];
  raw.consumption ??= [];
  if (backfilled > 0) notes.push(`旧数据缺色卡批号：已按默认色卡回填 ${backfilled} 条工序（批号取自色卡当前批号）`);
  if (versioned > 0) notes.push(`为 ${versioned} 条纹样档案补齐版本号（用于并发冲突检测）`);
  const archivedBatches = ((raw.batches ?? []) as { status: string }[]).filter((b) => b.status === "已入库");
  notes.push(`历史修复批次 ${archivedBatches.length} 个校验通过，可正常打开（展示当时色卡快照）`);
  raw.schemaVersion = 2;
  raw.migrationNotes = [...(raw.migrationNotes ?? []), ...notes];
  return raw as Db;
}

export function loadDb(): Db {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion < 2) {
      const migrated = migrate(parsed);
      localStorage.setItem(DB_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed as Db;
  }
  const seeded = migrate(JSON.parse(JSON.stringify(LEGACY_DB)));
  localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveDb(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function touch(db: Db): Db {
  saveDb(db);
  return db;
}

/**
 * 工坊确认工序色号。携带调用方看到的档案版本号：
 * 若服务端版本已前进（另一修复师先保存），先确认的工序保留，
 * 后到的修改列入冲突，不覆盖。
 */
export function confirmProcessColor(
  archiveId: string,
  processId: string,
  cardId: string,
  baseVersion: number,
  by: string,
): { db: Db; message: string; conflicted: boolean } {
  const db = loadDb();
  const archive = db.archives.find((a) => a.id === archiveId);
  const proc = archive?.processes.find((p) => p.id === processId);
  const card = db.colorCards.find((c) => c.id === cardId);
  if (!archive || !proc || !card) return { db, message: "记录不存在", conflicted: false };
  if (archive.archivedAt) return { db, message: "已入库档案不可修改", conflicted: false };
  const attempt = `${card.name} · 批号 ${card.batch}`;
  if (archive.version !== baseVersion) {
    const kept = proc.thread ? `${proc.thread.name} · 批号 ${proc.thread.batch}` : "（尚未确认色号）";
    const conflict: ConflictEntry = {
      id: uid("CF"),
      archiveId,
      processId,
      title: `${archive.id} ${archive.name} / ${proc.name}`,
      kept,
      rejected: `${attempt}（${by} 基于 v${baseVersion} 提交，服务端已为 v${archive.version}）`,
      source: "工坊并发",
      at: now(),
    };
    db.conflicts.unshift(conflict);
    archive.evidences.unshift({
      id: uid("EV"),
      kind: "系统",
      text: `并发保存：${by} 的修改（${attempt}）列为冲突，保留先确认工序（${kept}）`,
      by: "系统",
      at: now(),
    });
    return { db: touch(db), message: "检测到并发保存：先确认的工序已保留，你的修改已列入冲突", conflicted: true };
  }
  proc.thread = { cardId: card.id, name: card.name, hex: card.hex, batch: card.batch };
  proc.confirmedAt = now();
  if (proc.status === "待开始") proc.status = "进行中";
  archive.version += 1;
  archive.evidences.unshift({
    id: uid("EV"),
    kind: "工坊",
    text: `${by} 确认工序「${proc.name}」补线色号：${attempt}`,
    by,
    at: now(),
  });
  return { db: touch(db), message: `已确认「${proc.name}」：${attempt}`, conflicted: false };
}

/** 模拟另一名修复师在服务端直接保存（不刷新本地视图），用于演示并发冲突 */
export function simulateExternalConfirm(archiveId: string, processId: string): void {
  const db = loadDb();
  const archive = db.archives.find((a) => a.id === archiveId);
  const proc = archive?.processes.find((p) => p.id === processId);
  if (!archive || !proc || archive.archivedAt) return;
  const card = db.colorCards.find((c) => c.id !== proc.thread?.cardId) ?? db.colorCards[0];
  proc.thread = { cardId: card.id, name: card.name, hex: card.hex, batch: card.batch };
  proc.confirmedAt = now();
  if (proc.status === "待开始") proc.status = "进行中";
  archive.version += 1;
  archive.evidences.unshift({
    id: uid("EV"),
    kind: "工坊",
    text: `修复师B 确认工序「${proc.name}」补线色号：${card.name} · 批号 ${card.batch}（并发模拟，服务端已保存）`,
    by: "修复师B",
    at: now(),
  });
  saveDb(db);
}

export function advanceProcess(archiveId: string, processId: string): Db {
  const db = loadDb();
  const archive = db.archives.find((a) => a.id === archiveId);
  const proc = archive?.processes.find((p) => p.id === processId);
  if (!archive || !proc || archive.archivedAt) return db;
  if (proc.status === "待开始") proc.status = "进行中";
  else if (proc.status === "进行中") proc.status = "已完成";
  archive.version += 1;
  return touch(db);
}

/** 批次入库：此后档案展示当时色卡快照，不再受批号更新影响 */
export function archiveNow(archiveId: string): Db {
  const db = loadDb();
  const archive = db.archives.find((a) => a.id === archiveId);
  if (!archive || archive.archivedAt) return db;
  archive.archivedAt = now();
  for (const p of archive.processes) p.status = "已入库";
  archive.version += 1;
  archive.evidences.unshift({
    id: uid("EV"),
    kind: "系统",
    text: "全部工序完成，档案入库；此后展示当时色卡快照，不受批号更新影响",
    by: "系统",
    at: now(),
  });
  const batch = db.batches.find((b) => b.id === archive.batchId);
  if (batch && batch.archiveIds.every((id) => db.archives.find((a) => a.id === id)?.archivedAt)) {
    batch.status = "已入库";
  }
  return touch(db);
}

/** 色卡批号更新：未完成工序按新批号重算；已完成/已入库记录保持当时色卡 */
export function updateColorBatch(cardId: string): { db: Db; recalculated: number; newBatch: string } {
  const db = loadDb();
  const card = db.colorCards.find((c) => c.id === cardId);
  if (!card) return { db, recalculated: 0, newBatch: "" };
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const m = card.batch.match(/-([A-Z])$/);
  const nextLetter = String.fromCharCode((m ? m[1].charCodeAt(0) : 64) + 1);
  const newBatch = `${ym}-${nextLetter}`;
  card.history = [{ batch: card.batch, at: now(), note: "批号更新" }, ...card.history];
  card.batch = newBatch;
  let recalculated = 0;
  for (const a of db.archives) {
    if (a.archivedAt) continue;
    for (const p of a.processes) {
      if (p.thread?.cardId === cardId && (p.status === "待开始" || p.status === "进行中")) {
        p.thread = { ...p.thread, batch: newBatch };
        recalculated++;
      }
    }
  }
  return { db: touch(db), recalculated, newBatch };
}

export type { PatternArchive };
