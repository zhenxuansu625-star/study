import { SCHEDULER_CONFIG, type SchedulerConfig } from './config';
import { MINUTE, ceilTo } from './intervals';
import type { Interval, SplitOverride } from './types';

export interface PlacementOption {
  chunks: Interval[];
  placedMinutes: number;
  /** End of the last chunk, or undefined if nothing was placed. */
  finish?: number;
}

/** Earliest single block of `minutes` inside the gaps, snapped to the slot grid. */
export function findOneSitting(
  gaps: Interval[],
  minutes: number,
  cfg: SchedulerConfig = SCHEDULER_CONFIG,
): Interval | null {
  for (const g of gaps) {
    const start = ceilTo(g.start, cfg.slotMinutes);
    const end = start + minutes * MINUTE;
    if (end <= g.end) return { start, end };
  }
  return null;
}

/**
 * Greedily fill the earliest gaps with chunks between the min and max chunk size,
 * keeping `breakMinutes` between consecutive chunks in the same gap.
 */
export function fillChunks(
  gaps: Interval[],
  minutes: number,
  breakMinutes: number,
  cfg: SchedulerConfig = SCHEDULER_CONFIG,
): PlacementOption {
  const chunks: Interval[] = [];
  let left = minutes;
  for (const g of gaps) {
    let cursor = ceilTo(g.start, cfg.slotMinutes);
    while (left > 0) {
      const avail = Math.floor((g.end - cursor) / MINUTE);
      if (avail <= 0) break;
      let take = Math.min(left, cfg.maxChunkMinutes, avail);
      const after = left - take;
      if (after > 0 && after < cfg.minFinalChunkMinutes) {
        // Don't leave a scrap too small to be worth a sitting: leave a full minimum chunk instead.
        const shrunk = left - cfg.minChunkMinutes;
        if (shrunk < cfg.minChunkMinutes) break; // can't split this sensibly here; try a bigger gap
        take = Math.min(take, shrunk);
      }
      const isFinal = take === left;
      const ok =
        take >= cfg.minChunkMinutes ||
        (isFinal && (take >= cfg.minFinalChunkMinutes || left < cfg.minFinalChunkMinutes));
      if (!ok) break;
      chunks.push({ start: cursor, end: cursor + take * MINUTE });
      left -= take;
      cursor = ceilTo(cursor + (take + breakMinutes) * MINUTE, cfg.slotMinutes);
    }
    if (left <= 0) break;
  }
  return {
    chunks,
    placedMinutes: minutes - left,
    finish: chunks.length ? chunks[chunks.length - 1].end : undefined,
  };
}

export interface SplitDecision {
  /** Chunks to use; may be a partial placement when `complete` is false. */
  chunks: Interval[];
  complete: boolean;
  split: boolean;
}

/**
 * Decide between one sitting and chunks, following the rules in config.ts:
 * - short tasks always stay in one sitting;
 * - medium tasks stay in one sitting unless splitting finishes > a day sooner;
 * - long tasks are split into as few 45–120 min chunks as possible.
 * The user's override, if any, takes precedence.
 */
export function decidePlacement(
  gaps: Interval[],
  minutes: number,
  breakMinutes: number,
  override: SplitOverride | undefined,
  cfg: SchedulerConfig = SCHEDULER_CONFIG,
): SplitDecision {
  const one = findOneSitting(gaps, minutes, cfg);
  const oneResult = (): SplitDecision => ({ chunks: [one!], complete: true, split: false });

  if (override === 'one-sitting' || (!override && minutes <= cfg.shortTaskMaxMinutes)) {
    return one ? oneResult() : { chunks: [], complete: false, split: false };
  }

  const chunked = fillChunks(gaps, minutes, breakMinutes, cfg);
  const chunkedComplete = chunked.placedMinutes >= minutes;
  const chunkedResult = (): SplitDecision => ({
    chunks: chunked.chunks,
    complete: chunkedComplete,
    split: chunked.chunks.length > 1,
  });

  if (override === 'allow-split') {
    if (one && (!chunkedComplete || one.end <= chunked.finish!)) return oneResult();
    return chunkedResult();
  }

  if (minutes <= cfg.mediumTaskMaxMinutes) {
    if (one && (!chunkedComplete || one.end - chunked.finish! <= cfg.oneSittingMaxDelayMinutes * MINUTE)) {
      return oneResult();
    }
    return chunkedResult();
  }

  // Long task: always chunked (fillChunks already uses as few chunks as the gaps allow).
  return chunkedResult();
}
