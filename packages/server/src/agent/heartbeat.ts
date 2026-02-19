import { db } from '../db/index.js';
import { cells, cellState } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { runConductor, type Signal } from './conductor.js';
import * as yaml from 'yaml';

// ═══════════════════════════════════════════════════════
// HEARTBEAT SYSTEM — Proactive Agent Checks
// Reads HEARTBEAT rules from cell state, runs checklists on schedule
// ═══════════════════════════════════════════════════════

export interface HeartbeatRule {
  id: string;
  cron: string;
  enabled?: boolean;
  checklist: string[];
}

export interface HeartbeatConfig {
  rules: HeartbeatRule[];
  min_interval?: string;
}

export async function runHeartbeat(cellId: string, userId: string): Promise<void> {
  console.log(`[Heartbeat] Running heartbeat for cell ${cellId}`);

  // Get heartbeat config from cell state
  const states = await db.select().from(cellState)
    .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, 'heartbeat')));

  if (states.length === 0) {
    console.log('[Heartbeat] No heartbeat config found for cell');
    return;
  }

  let config: HeartbeatConfig;
  try {
    config = yaml.parse(states[0].content) as HeartbeatConfig;
  } catch (e) {
    console.error('[Heartbeat] Failed to parse heartbeat config:', (e as Error).message);
    return;
  }

  if (!config.rules || config.rules.length === 0) return;

  // Run each enabled rule's checklist
  for (const rule of config.rules) {
    if (rule.enabled === false) continue;

    const checklistText = rule.checklist.map((item, i) => `${i + 1}. ${item}`).join('\n');

    const signal: Signal = {
      type: 'heartbeat',
      userId,
      cellId,
      content: `Heartbeat check (${rule.id}):\n${checklistText}\n\nReview each item. If there are updates or actions needed, notify the user. If nothing noteworthy, stay silent.`,
    };

    try {
      const result = await runConductor(signal);
      if (result.response && result.response.trim()) {
        console.log(`[Heartbeat] Rule ${rule.id} produced response: ${result.response.substring(0, 100)}`);
      } else {
        console.log(`[Heartbeat] Rule ${rule.id}: nothing to report`);
      }
    } catch (e) {
      console.error(`[Heartbeat] Rule ${rule.id} failed:`, (e as Error).message);
    }
  }
}
