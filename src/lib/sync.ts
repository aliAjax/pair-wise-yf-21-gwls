import type {
  AppState,
  ColorCard,
  ConflictRecord,
  FieldRecord,
  MaterialConsumption,
  Pattern,
  ProcessStep,
  SyncOp,
  SyncStepState,
} from "./types";
import { uid } from "./storage";

/** 合并步骤（顺序执行，每步以幂等键保证重试不重复追加） */
export const MERGE_STEPS: { key: string; label: string }[] = [
  { key: "validate", label: "校验纹样档案" },
  { key: "evidence", label: "合并证据（照片/记录）" },
  { key: "damage", label: "追加破损描述" },
  { key: "consumption", label: "补线色号计入材料消耗" },
  { key: "finalize", label: "回写同步状态" },
];

class MergeError extends Error {
  step: string;
  constructor(step: string, message: string) {
    super(message);
    this.step = step;
  }
}

function freshOp(fieldRecordId: string, patternId: string): SyncOp {
  return {
    id: uid("op"),
    fieldRecordId,
    patternId,
    status: "merging",
    steps: MERGE_STEPS.map((s) => ({ ...s, done: false })),
    attempts: 0,
    createdAt: Date.now(),
  };
}

function upsertOp(ops: SyncOp[], op: SyncOp): SyncOp[] {
  const idx = ops.findIndex((o) => o.id === op.id);
  if (idx >= 0) return ops.map((o, i) => (i === idx ? op : o));
  return [...ops, op];
}

/**
 * 合并一条外勤记录到工坊工序。
 * - 逐步执行，任一步失败则停在该步，保留本地草稿（failedStep）
 * - 恢复时从失败步骤续传：已完成步骤靠幂等键跳过，不重复追加材料消耗
 * - 外勤记录只补证据，不覆盖工序字段
 */
export function mergeFieldRecord(
  state: AppState,
  fieldRecordId: string
): { state: AppState; op: SyncOp } {
  const fr = state.fieldRecords.find((f) => f.id === fieldRecordId);
  if (!fr) throw new Error("外勤记录不存在");

  let op =
    state.syncOps.find((o) => o.fieldRecordId === fieldRecordId && o.status !== "merged") ??
    freshOp(fieldRecordId, fr.patternId);
  op = { ...op, status: "merging", attempts: op.attempts + 1, error: undefined };

  let patterns: Pattern[] = state.patterns.map((p) => ({
    ...p,
    steps: p.steps.map((s) => ({ ...s })),
    evidence: p.evidence.map((e) => ({ ...e })),
    damageLog: p.damageLog.map((d) => ({ ...d })),
  }));
  let consumption: MaterialConsumption[] = state.consumption.map((c) => ({ ...c }));
  let fieldRecords: FieldRecord[] = state.fieldRecords.map((f) => ({ ...f }));

  const markDone = (key: string) => {
    op = {
      ...op,
      steps: op.steps.map((s) => (s.key === key ? { ...s, done: true } : s)),
    };
  };

  try {
    // 1. 校验纹样档案
    const pattern = patterns.find((p) => p.id === fr.patternId);
    if (!pattern) throw new MergeError("validate", "纹样档案不存在或已删除");
    markDone("validate");

    // 2. 合并证据（幂等：证据 id 为 `${fr.id}:${kind}:${摘要}`，重试不重复）
    for (const ev of fr.evidence) {
      const evId = `${fr.id}:${ev.kind}:${ev.content.slice(0, 24)}`;
      if (!pattern.evidence.some((e) => e.id === evId)) {
        pattern.evidence.push({
          id: evId,
          kind: ev.kind,
          content: ev.content,
          fieldRecordId: fr.id,
          createdAt: fr.createdAt,
        });
      }
    }
    markDone("evidence");

    // 3. 追加破损描述（幂等：同一外勤记录只追加一次）
    if (fr.damageNote && !pattern.damageLog.some((d) => d.fieldRecordId === fr.id)) {
      pattern.damageLog.push({
        id: uid("dmg"),
        note: fr.damageNote,
        fieldRecordId: fr.id,
        createdAt: fr.createdAt,
      });
    }
    markDone("damage");

    // 4. 补线色号计入材料消耗（幂等：id = `${fr.id}:${colorCardId}`，恢复续传不重复追加）
    //    绑定到当前未入库的补线工序；若补线工序均已入库，则绑定到第一个未入库工序，
    //    保证未完成工序的消耗能随批号更新重算，已入库记录保持冻结。
    const step =
      pattern.steps.find((s) => s.name.includes("补线") && s.status !== "warehoused") ??
      pattern.steps.find((s) => s.status !== "warehoused") ??
      pattern.steps[0];
    for (const cardId of fr.threadColorCardIds) {
      const cid = `${fr.id}:${cardId}`;
      if (!consumption.some((c) => c.id === cid)) {
        const card = state.colorCards.find((c) => c.id === cardId);
        if (!card) throw new MergeError("consumption", `色卡 ${cardId} 不存在`);
        // 一次性故障注入：下次合并在材料消耗步骤失败
        if (state.settings.simulateMergeFailure) {
          throw new MergeError("consumption", "网络中断：材料消耗写入失败，草稿已保留");
        }
        consumption.push({
          id: cid,
          patternId: pattern.id,
          stepId: step.id,
          colorCardId: cardId,
          batchNo: card.batchNo,
          amount: 1,
          note: `外勤补线 ${card.code}`,
          fieldRecordId: fr.id,
          createdAt: fr.createdAt,
        });
      }
    }
    markDone("consumption");

    // 5. 回写同步状态
    fieldRecords = fieldRecords.map((f) =>
      f.id === fr.id ? { ...f, synced: true, failedStep: undefined, error: undefined } : f
    );
    op = { ...op, status: "merged", mergedAt: Date.now() };
    markDone("finalize");
  } catch (e) {
    const err = e as MergeError;
    op = { ...op, status: "failed", error: err.message };
    fieldRecords = fieldRecords.map((f) =>
      f.id === fr.id
        ? { ...f, synced: false, failedStep: err.step, error: err.message }
        : f
    );
  }

  const newState: AppState = {
    ...state,
    patterns,
    consumption,
    fieldRecords,
    syncOps: upsertOp(state.syncOps, op),
    // 故障注入为一次性，消费后复位
    settings: state.settings.simulateMergeFailure
      ? { ...state.settings, simulateMergeFailure: false }
      : state.settings,
  };
  return { state: newState, op };
}

/**
 * 保存工序（乐观并发）。
 * - baseVersion 与当前版本一致：确认保存，版本号 +1
 * - 不一致：先确认的工序保留，后到的修改列为冲突（不覆盖）
 */
export function saveStep(
  state: AppState,
  patternId: string,
  stepId: string,
  baseVersion: number,
  patch: Partial<Pick<ProcessStep, "name" | "status" | "assignee" | "colorCardId">>
): { state: AppState; conflict?: ConflictRecord } {
  const pattern = state.patterns.find((p) => p.id === patternId);
  const step = pattern?.steps.find((s) => s.id === stepId);
  if (!pattern || !step) return { state };

  if (pattern.version !== baseVersion) {
    const conflict: ConflictRecord = {
      id: uid("cf"),
      patternId,
      stepId,
      type: "concurrent-save",
      winnerBy: pattern.updatedBy ?? "同事",
      loserBy: state.restorers.find((r) => r.id === state.currentRestorerId)?.name ?? "当前修复师",
      loserBaseVersion: baseVersion,
      winnerVersion: pattern.version,
      detectedAt: Date.now(),
      detail: `工序「${step.name}」已被 ${pattern.updatedBy ?? "同事"} 先保存（v${pattern.version}），后到的修改（基于 v${baseVersion}）未覆盖，已列为冲突`,
      resolved: false,
    };
    return {
      state: { ...state, conflicts: [...state.conflicts, conflict] },
      conflict,
    };
  }

  const restorerName = state.restorers.find((r) => r.id === state.currentRestorerId)?.name;
  const patterns = state.patterns.map((p) => {
    if (p.id !== patternId) return p;
    return {
      ...p,
      version: p.version + 1,
      updatedAt: Date.now(),
      updatedBy: restorerName,
      steps: p.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              ...patch,
              version: s.version + 1,
              updatedAt: Date.now(),
              updatedBy: restorerName,
            }
          : s
      ),
    };
  });
  return { state: { ...state, patterns } };
}

/** 模拟同事先保存： bump 纹样版本，制造并发场景 */
export function simulateColleagueSave(state: AppState, patternId: string): AppState {
  const colleague = state.restorers.find((r) => r.id !== state.currentRestorerId) ?? state.restorers[0];
  const patterns = state.patterns.map((p) => {
    if (p.id !== patternId) return p;
    return {
      ...p,
      version: p.version + 1,
      updatedAt: Date.now(),
      updatedBy: colleague.name,
      steps: p.steps.map((s) => ({
        ...s,
        version: s.version + 1,
        updatedAt: Date.now(),
        updatedBy: colleague.name,
      })),
    };
  });
  return { ...state, patterns };
}

/** 工序入库：冻结当前色卡为快照，已入库记录仍展示当时色卡 */
export function warehouseStep(state: AppState, patternId: string, stepId: string): AppState {
  const pattern = state.patterns.find((p) => p.id === patternId);
  const step = pattern?.steps.find((s) => s.id === stepId);
  if (!pattern || !step) return state;
  const card: ColorCard | undefined =
    state.colorCards.find((c) => c.id === (step.colorCardId ?? pattern.steps[0]?.colorCardId)) ??
    state.colorCards[0];
  if (!card) return state;
  const snapshot = {
    code: card.code,
    name: card.name,
    hex: card.hex,
    batchNo: card.batchNo,
  };
  const patterns = state.patterns.map((p) => {
    if (p.id !== patternId) return p;
    return {
      ...p,
      steps: p.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              status: "warehoused" as const,
              colorCardId: card.id,
              colorCardSnapshot: snapshot,
              warehousedAt: Date.now(),
              updatedAt: Date.now(),
            }
          : s
      ),
    };
  });
  return { ...state, patterns };
}

/**
 * 色卡批号更新：
 * - 未完成工序（未入库）的材料消耗按新批号重算
 * - 已入库记录冻结为当时批号（历史快照不变）
 */
export function updateColorCardBatch(state: AppState, cardId: string): AppState {
  const stamp = new Date();
  const datePart = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(
    stamp.getDate()
  ).padStart(2, "0")}`;
  const newBatch = `B${datePart}-${Math.floor(100 + Math.random() * 900)}`;

  const colorCards = state.colorCards.map((c) =>
    c.id === cardId ? { ...c, batchNo: newBatch, updatedAt: Date.now() } : c
  );

  const consumption = state.consumption.map((c) => {
    if (c.colorCardId !== cardId) return c;
    const pattern = state.patterns.find((p) => p.id === c.patternId);
    const step = pattern?.steps.find((s) => s.id === c.stepId);
    if (step?.status === "warehoused") return c; // 已入库：保留当时批号
    return { ...c, batchNo: newBatch }; // 未完成：按新批号重算
  });

  return { ...state, colorCards, consumption };
}
