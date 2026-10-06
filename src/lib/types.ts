// 地毯修复纹样档案 —— 核心数据模型

/** 材料色卡 */
export interface ColorCard {
  id: string;
  code: string;        // 色卡号，如 CC-014
  name: string;        // 色名，如 靛蓝
  hex: string;         // 展示色
  batchNo: string;     // 当前批号
  updatedAt: number;
}

/** 修复师（用于并发保存时区分身份） */
export interface Restorer {
  id: string;
  name: string;
}

/** 外勤证据（照片/文字记录，只追加不覆盖） */
export interface Evidence {
  id: string;                 // 幂等键：`${fieldRecordId}:${kind}:${内容摘要}`
  kind: "note" | "photo";
  content: string;
  fieldRecordId: string;
  createdAt: number;
}

/** 材料消耗（补线色号计入） */
export interface MaterialConsumption {
  id: string;                 // 幂等键：`${fieldRecordId}:${colorCardId}`，防重复追加
  patternId: string;
  stepId: string;
  colorCardId: string;
  batchNo: string;             // 生效批号：未完成工序随色卡重算，已入库冻结为快照
  amount: number;
  note?: string;
  fieldRecordId?: string;
  createdAt: number;
}

export type StepStatus = "pending" | "in-progress" | "done" | "warehoused";

/** 修复工序 */
export interface ProcessStep {
  id: string;
  name: string;
  status: StepStatus;
  assignee?: string;
  colorCardId?: string;        // 本工序使用的色卡（用于批号重算）
  /** 入库时冻结的色卡快照：已入库记录仍展示当时色卡，不受后续批号更新影响 */
  colorCardSnapshot?: {
    code: string;
    name: string;
    hex: string;
    batchNo: string;
  };
  version: number;             // 乐观并发版本号
  updatedAt: number;
  updatedBy?: string;
  warehousedAt?: number;
}

/** 纹样档案 */
export interface Pattern {
  id: string;
  code: string;                // 档案号 CAR-092
  origin: string;              // 产地
  era: string;                 // 年代
  knotDensity: string;         // 结密度
  material: string;            // 材质
  dyeType: string;              // 染色类型
  damageAreas: string[];       // 破损区域
  markers: { x: number; y: number; label: string }[]; // 纹样局部标记
  steps: ProcessStep[];
  evidence: Evidence[];
  damageLog: { id: string; note: string; fieldRecordId: string; createdAt: number }[];
  version: number;
  updatedAt: number;
  updatedBy?: string;
  createdAt: number;
}

/** 外勤记录（离线登记，回网后合并） */
export interface FieldRecord {
  id: string;
  patternId: string;
  damageNote: string;            // 破损描述
  threadColorCardIds: string[];  // 补线色号（色卡 id）
  evidence: { kind: "note" | "photo"; content: string }[];
  createdAt: number;
  synced: boolean;
  failedStep?: string;           // 合并失败时的断点步骤
  error?: string;
}

/** 并发保存冲突：先确认的工序保留，后到的修改列冲突 */
export interface ConflictRecord {
  id: string;
  patternId: string;
  stepId?: string;
  type: "concurrent-save";
  winnerBy: string;              // 先确认、被保留的一方
  loserBy: string;               // 后到、被列为冲突的一方
  loserBaseVersion: number;
  winnerVersion: number;
  detectedAt: number;
  detail: string;
  resolved: boolean;
}

export interface SyncStepState {
  key: string;
  label: string;
  done: boolean;
}

/** 合并操作记录（含断点续传状态） */
export interface SyncOp {
  id: string;
  fieldRecordId: string;
  patternId: string;
  status: "pending" | "merging" | "merged" | "failed";
  steps: SyncStepState[];
  error?: string;
  attempts: number;
  createdAt: number;
  mergedAt?: number;
}

export interface AppState {
  schemaVersion: number;
  restorers: Restorer[];
  currentRestorerId: string;
  colorCards: ColorCard[];
  patterns: Pattern[];
  fieldRecords: FieldRecord[];
  syncOps: SyncOp[];
  conflicts: ConflictRecord[];
  consumption: MaterialConsumption[];
  settings: {
    simulateMergeFailure: boolean; // 一次性：下次合并在「材料消耗」步骤失败
  };
}
