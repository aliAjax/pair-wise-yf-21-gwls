export type Severity = "轻" | "中" | "重";
export type ProcessStatus = "待开始" | "进行中" | "已完成" | "已入库";

/** 工序确认时固化的色卡快照：批号更新后，已入库记录仍展示当时色卡 */
export interface ColorSnapshot {
  cardId: string;
  name: string;
  hex: string;
  batch: string;
}

export interface ColorCard {
  id: string;
  name: string;
  hex: string;
  material: string;
  batch: string;
  history: { batch: string; at: string; note: string }[];
}

export interface DamageZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  severity: Severity;
  description: string;
  source: "工坊" | "外勤";
}

export interface Evidence {
  id: string;
  kind: "外勤" | "工坊" | "系统";
  text: string;
  by: string;
  at: string;
}

export interface ProcessStep {
  id: string;
  name: string;
  status: ProcessStatus;
  assignee: string;
  thread?: ColorSnapshot;
  materialUsed: number;
  confirmedAt?: string;
}

export interface PatternArchive {
  id: string;
  name: string;
  origin: string;
  era: string;
  knotDensity: number;
  material: string;
  dyeType: string;
  beforeNotes: string[];
  afterNotes: string[];
  zones: DamageZone[];
  processes: ProcessStep[];
  evidences: Evidence[];
  archivedAt?: string;
  batchId?: string;
  version: number;
}

export interface RestorationBatch {
  id: string;
  name: string;
  status: "进行中" | "已入库";
  archiveIds: string[];
  at: string;
}

export interface ConflictEntry {
  id: string;
  archiveId: string;
  processId?: string;
  title: string;
  kept: string;
  rejected: string;
  source: "工坊并发" | "外勤合并";
  at: string;
}

/** 材料消耗按幂等键（= 外勤单号）去重，续传不会重复追加 */
export interface ConsumptionEntry {
  key: string;
  archiveId: string;
  processId: string;
  grams: number;
  at: string;
}

export interface Db {
  schemaVersion: number;
  colorCards: ColorCard[];
  archives: PatternArchive[];
  batches: RestorationBatch[];
  conflicts: ConflictEntry[];
  consumption: ConsumptionEntry[];
  migrationNotes: string[];
}

/** 外勤离线登记的本地草稿，回网后逐步合并；step 记录续传起点 */
export interface OutboxItem {
  id: string;
  archiveId: string;
  by: string;
  at: string;
  zoneLabel: string;
  severity: Severity;
  description: string;
  threadCardId?: string;
  note: string;
  status: "待同步" | "同步中" | "失败" | "已同步";
  step: number;
  error?: string;
  log: string[];
}
