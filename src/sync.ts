import type { Db, OutboxItem } from "./types";
import { loadDb, now, saveDb, uid } from "./store";

const OUTBOX_KEY = "carpet-archive-outbox";

export const SYNC_STEPS = ["校验档案", "合并破损区域", "合并补线色号", "追加证据", "登记材料消耗"] as const;

export function loadOutbox(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

export function saveOutbox(items: OutboxItem[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

/** 外勤离线登记：写入本地草稿（刷新页面也不丢） */
export function addToOutbox(item: OutboxItem): OutboxItem[] {
  const items = [item, ...loadOutbox()];
  saveOutbox(items);
  return items;
}

export function clearDoneOutbox(): OutboxItem[] {
  const items = loadOutbox().filter((i) => i.status !== "已同步");
  saveOutbox(items);
  return items;
}

let failAtStep: number | null = null;
/** 故障注入：下次同步在指定步骤中断（仅生效一次），用于演示草稿保留与断点续传 */
export function injectFailure(step: number | null) {
  failAtStep = step;
}

let running = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** 单个合并步骤：外勤记录只补证据 / 填空缺，绝不覆盖工坊已确认数据 */
function applyStep(db: Db, item: OutboxItem, step: number): Db {
  const archive = db.archives.find((a) => a.id === item.archiveId);
  switch (step) {
    case 0: {
      if (!archive) throw new Error(`档案 ${item.archiveId} 不存在`);
      item.log.push(`档案 ${archive.id} 校验通过`);
      break;
    }
    case 1: {
      if (!archive) break;
      const existing = archive.zones.find((z) => z.label.trim() === item.zoneLabel.trim());
      if (existing) {
        archive.evidences.unshift({
          id: uid("EV"),
          kind: "外勤",
          text: `外勤复核破损「${item.zoneLabel}」：${item.description}（工坊原记录保留，仅补充证据）`,
          by: item.by,
          at: item.at,
        });
        item.log.push(`破损「${item.zoneLabel}」已存在 → 仅补证据，不覆盖`);
      } else {
        const h = hashStr(item.zoneLabel + item.archiveId);
        archive.zones.push({
          id: uid("DZ"),
          label: item.zoneLabel,
          x: 8 + (h % 52),
          y: 8 + ((h >> 4) % 38),
          w: 16 + ((h >> 7) % 10),
          h: 10 + ((h >> 9) % 8),
          severity: item.severity,
          description: item.description,
          source: "外勤",
        });
        item.log.push(`新增外勤破损区域「${item.zoneLabel}」`);
      }
      break;
    }
    case 2: {
      if (!archive || !item.threadCardId) {
        item.log.push("无补线色号，跳过");
        break;
      }
      const card = db.colorCards.find((c) => c.id === item.threadCardId);
      if (!card) {
        item.log.push("色卡不存在，跳过");
        break;
      }
      const target = archive.processes.find(
        (p) => (p.status === "待开始" || p.status === "进行中") && !p.thread,
      );
      if (target) {
        target.thread = { cardId: card.id, name: card.name, hex: card.hex, batch: card.batch };
        target.confirmedAt = now();
        archive.version += 1;
        archive.evidences.unshift({
          id: uid("EV"),
          kind: "外勤",
          text: `外勤补线色号 ${card.name} · 批号 ${card.batch} 已合并进工序「${target.name}」`,
          by: item.by,
          at: item.at,
        });
        item.log.push(`色号 ${card.name} 合并进工序「${target.name}」`);
      } else {
        archive.evidences.unshift({
          id: uid("EV"),
          kind: "外勤",
          text: `外勤建议补线色号 ${card.name} · 批号 ${card.batch}：相关工序均已确认，按规则仅作证据保留，不覆盖`,
          by: item.by,
          at: item.at,
        });
        db.conflicts.unshift({
          id: uid("CF"),
          archiveId: archive.id,
          title: `${archive.id} ${archive.name} / 外勤补线色号`,
          kept: "工坊已确认工序",
          rejected: `${card.name} · 批号 ${card.batch}（外勤 ${item.by}）`,
          source: "外勤合并",
          at: now(),
        });
        item.log.push("工序均已确认 → 色号仅作证据，列入冲突");
      }
      break;
    }
    case 3: {
      if (!archive) break;
      archive.evidences.unshift({
        id: uid("EV"),
        kind: "外勤",
        text: `外勤登记：${item.description}${item.note ? `（备注：${item.note}）` : ""}`,
        by: item.by,
        at: item.at,
      });
      item.log.push("证据已追加");
      break;
    }
    case 4: {
      if (!archive) break;
      if (db.consumption.some((c) => c.key === item.id)) {
        item.log.push(`材料消耗已存在（幂等键 ${item.id}），跳过重复登记`);
        break;
      }
      const target =
        archive.processes.find((p) => p.status === "进行中") ??
        archive.processes.find((p) => p.status === "待开始");
      if (!target) {
        item.log.push("无进行中工序，免登记材料");
        break;
      }
      const grams = 20;
      target.materialUsed += grams;
      db.consumption.push({ key: item.id, archiveId: archive.id, processId: target.id, grams, at: now() });
      item.log.push(`登记材料消耗 ${grams}g → 工序「${target.name}」`);
      break;
    }
  }
  return db;
}

/**
 * 回网合并：逐条处理本地草稿，每条从 item.step 续传（失败恢复不重头）。
 * 注入故障发生在「登记材料消耗」时，模拟“消耗已提交、确认丢失”：
 * 先落库再标记失败，续传时按幂等键跳过，不重复追加材料消耗。
 */
export async function runSync(
  onUpdate: (db: Db, outbox: OutboxItem[]) => void,
): Promise<{ db: Db; outbox: OutboxItem[] }> {
  if (running) return { db: loadDb(), outbox: loadOutbox() };
  running = true;
  try {
    let db = loadDb();
    const outbox = loadOutbox();
    for (const item of outbox) {
      if (item.status === "已同步") continue;
      item.status = "同步中";
      item.error = undefined;
      saveOutbox(outbox);
      onUpdate(db, [...outbox]);
      for (let s = item.step; s < SYNC_STEPS.length; s++) {
        await sleep(500);
        if (failAtStep === s) {
          failAtStep = null;
          if (s === SYNC_STEPS.length - 1) {
            db = applyStep(db, item, s);
            saveDb(db);
          }
          item.status = "失败";
          item.error = `步骤「${SYNC_STEPS[s]}」连接中断，本地草稿已保留`;
          item.log.push(`失败于步骤 ${s + 1}「${SYNC_STEPS[s]}」，恢复后从此续传`);
          saveOutbox(outbox);
          onUpdate(db, [...outbox]);
          break;
        }
        try {
          db = applyStep(db, item, s);
        } catch (e) {
          item.status = "失败";
          item.error = e instanceof Error ? e.message : "未知错误";
          saveOutbox(outbox);
          onUpdate(db, [...outbox]);
          break;
        }
        item.step = s + 1;
        saveDb(db);
        saveOutbox(outbox);
        onUpdate(db, [...outbox]);
      }
      if (item.step >= SYNC_STEPS.length) {
        item.status = "已同步";
        saveOutbox(outbox);
        onUpdate(db, [...outbox]);
      }
    }
    return { db, outbox };
  } finally {
    failAtStep = null;
    running = false;
  }
}
