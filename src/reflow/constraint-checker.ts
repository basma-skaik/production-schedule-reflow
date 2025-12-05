// src/reflow/constraint-checker.ts
/**
 * ConstraintChecker
 *
 * Responsibilities:
 *  - Given a work center and earliestPossibleStart + durationMinutes, compute the earliest feasible
 *    (start, end) slot that:
 *      * fits within recurring shifts (weekly)
 *      * avoids maintenance windows (absolute datetimes)
 *      * does not overlap already scheduled slots for that work center
 *
 *  - Exposes small helpers used by the scheduler.
 *
 * Notes:
 *  - Uses Luxon DateTime and Interval internally. Reflow service should convert to/from ISO strings.
 *  - This class does not perform dependency or work-center conflict resolution across multiple work
 *    centers — it only computes feasible slots for a single work center given existing schedule.
 *
 * Install types if you get IDE warnings:
 *   npm i --save-dev @types/luxon
 */

import { DateTime, Interval } from "luxon";
import { WorkCenterDoc, WorkCenterShift } from "./types";

/** A scheduled slot (internal representation) */
export interface ScheduledSlot {
  workOrderDocId: string;
  workCenterDocId: string;
  start: DateTime; // guaranteed non-null
  end: DateTime; // guaranteed non-null
}

export interface LoggerLike {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

/**
 * ConstraintChecker class
 *
 * Constructor:
 *  - workCenters: array of work center documents (must include docId + data.shifts + data.maintenanceWindows)
 *  - existingSchedule: optional pre-filled ScheduledSlot[] (slots must have DateTime start/end)
 *  - options.logger: optional logger object (defaults to console)
 */
export class ConstraintChecker {
  private workCentersById: Map<string, WorkCenterDoc>;
  private schedule: ScheduledSlot[];
  private logger: LoggerLike;

  constructor(
    workCenters: WorkCenterDoc[],
    existingSchedule: ScheduledSlot[] = [],
    options?: { logger?: LoggerLike }
  ) {
    this.workCentersById = new Map(workCenters.map((wc) => [wc.docId, wc]));
    // keep a shallow copy so caller-owned arrays aren't mutated unexpectedly
    this.schedule = existingSchedule.slice();
    this.logger = options?.logger ?? console;

    // normalize schedule: sort by start time for faster overlap checks (defensive)
    try {
      this.schedule.sort((a, b) => a.start.toMillis() - b.start.toMillis());
    } catch (err) {
      // if something odd is in existingSchedule, log and continue with unsorted
      this.logger.warn(
        "ConstraintChecker: failed to sort existing schedule:",
        err
      );
    }
  }

  /**
   * Push a newly accepted slot into internal schedule.
   * Caller should pass DateTime start/end; this method will append & keep schedule sorted.
   */
  public pushScheduledSlot(slot: ScheduledSlot) {
    if (!slot || !slot.start || !slot.end) {
      this.logger.error("pushScheduledSlot: invalid slot provided", slot);
      throw new Error(
        "Invalid ScheduledSlot: start and end must be valid DateTime"
      );
    }
    // append and maintain sort (append then insertion-sort shift)
    this.schedule.push(slot);
    // keep schedule ordered by start time; schedule is expected small per WC in tests so this is OK
    this.schedule.sort((a, b) => a.start.toMillis() - b.start.toMillis());
    this.logger.info(
      `pushScheduledSlot: added slot for workCenter ${
        slot.workCenterDocId
      } [${slot.start.toISO()} - ${slot.end.toISO()}]`
    );
  }

  /**
   * findEarliestFeasibleSlot
   *
   * For the requested workCenterDocId and earliestPossibleStart, finds the earliest (start,end)
   * that (a) can consume durationMinutes of working time inside shifts, (b) avoids maintenance,
   * and (c) does not overlap existing scheduled slots in this.workCenterDocId.
   *
   * Returns DateTime pair: { start, end } (both in UTC DateTime)
   *
   * Throws an Error if:
   *  - work center not found
   *  - no feasible slot within maxSearchDays
   */
  public async findEarliestFeasibleSlot(
    workCenterDocId: string,
    earliestPossibleStart: DateTime,
    durationMinutes: number,
    maxSearchDays = 30
  ): Promise<{ start: DateTime; end: DateTime }> {
    const wc = this.workCentersById.get(workCenterDocId);
    if (!wc) {
      this.logger.error(
        "findEarliestFeasibleSlot: WorkCenter not found:",
        workCenterDocId
      );
      throw new Error(`WorkCenter not found: ${workCenterDocId}`);
    }
    if (!earliestPossibleStart || !earliestPossibleStart.isValid) {
      throw new Error("Invalid earliestPossibleStart DateTime");
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error("Invalid durationMinutes (must be positive number)");
    }

    let cursor = earliestPossibleStart.toUTC();
    const deadline = cursor.plus({ days: maxSearchDays });

    let loopCount = 0;
    while (cursor <= deadline) {
      loopCount++;
      if (loopCount > 10000) {
        this.logger.error(
          "findEarliestFeasibleSlot: infinite-loop protection triggered"
        );
        throw new Error("Infinite loop protection triggered in scheduler");
      }

      // 1) Align cursor to a shift start if needed
      cursor = this.moveToNextShiftIfNeeded(wc, cursor);

      // 2) Skip maintenance windows that contain cursor
      cursor = this.skipMaintenanceStartingBeforeOrAt(wc, cursor);

      // 3) Compute end (consumes working minutes across shifts, skipping maintenance)
      const candidateEnd = this.addWorkingMinutesConsideringShifts(
        cursor,
        durationMinutes,
        wc
      );

      // 4) Check overlap with existing slots for this work center
      const overlapping = this.findOverlappingSlot(
        wc.docId,
        cursor,
        candidateEnd
      );

      if (!overlapping) {
        this.logger.info(
          `findEarliestFeasibleSlot: found slot for ${workCenterDocId} [${cursor.toISO()} - ${candidateEnd.toISO()}]`
        );
        return { start: cursor, end: candidateEnd };
      }

      // Move cursor to just after overlapping slot end and retry
      cursor = overlapping.end.plus({ minutes: 1 }).toUTC();
    }

    this.logger.error(
      `findEarliestFeasibleSlot: no feasible slot found within ${maxSearchDays} days for ${workCenterDocId}`
    );
    throw new Error(
      `No feasible slot found within ${maxSearchDays} days for workCenter ${workCenterDocId}`
    );
  }

  /* -------------------------
   * Maintenance helpers
   * ------------------------*/

  /** Returns true if dt is inside any maintenance window for wc */
  public isInsideMaintenance(wc: WorkCenterDoc, dt: DateTime): boolean {
    const mwList = wc.data.maintenanceWindows;
    if (!mwList || mwList.length === 0) return false;

    for (const mw of mwList) {
      // build interval from ISO pair
      const interval = safeIntervalFromISO(mw.startDate, mw.endDate);
      if (!interval) continue; // skip invalid maintenance entries
      if (interval.contains(dt)) return true;
    }
    return false;
  }

  /**
   * If cursor is inside (or maintenance starts before/at cursor and ends after cursor),
   * move cursor to the end of that maintenance window.
   */
  private skipMaintenanceStartingBeforeOrAt(
    wc: WorkCenterDoc,
    cursor: DateTime
  ): DateTime {
    const mwList = wc.data.maintenanceWindows;
    if (!mwList || mwList.length === 0) return cursor;

    for (const mw of mwList) {
      const interval = safeIntervalFromISO(mw.startDate, mw.endDate);
      if (!interval) continue;
      // if cursor inside the interval or interval.start <= cursor < interval.end
      if (
        interval.contains(cursor) ||
        (interval.start! <= cursor && interval.end! > cursor)
      ) {
        // return end of maintenance (in UTC)
        return interval.end!.toUTC();
      }
    }
    return cursor;
  }

  /* -------------------------
   * Shift helpers
   * ------------------------*/

  /**
   * If cursor is already inside a shift interval for the work center returns cursor.
   * Otherwise moves cursor to the next shift.start (searching up to 14 days ahead).
   */
  private moveToNextShiftIfNeeded(
    wc: WorkCenterDoc,
    cursor: DateTime
  ): DateTime {
    // Lookahead up to 14 days for the next shift (should be enough for typical schedules)
    for (let d = 0; d < 14; d++) {
      const day = cursor.plus({ days: d }).toUTC();

      const intervals = this.buildShiftIntervalsForDate(wc.data.shifts, day);
      for (const iv of intervals) {
        if (!iv.start || !iv.end) continue;
        if (iv.contains(cursor)) return cursor;
        if (iv.start >= cursor) return iv.start!;
      }
    }
    // no shift found in lookahead — return original cursor (caller will eventually fail)
    this.logger.warn(
      `moveToNextShiftIfNeeded: no shift found in 14-day lookahead for wc ${wc.docId}`
    );
    return cursor;
  }

  /**
   * Build shift intervals for a given date (UTC)
   * - shifts: WorkCenterShift[] (dayOfWeek 0-6 Sunday=0)
   * - date: DateTime (any time; function uses its UTC date components)
   */
  private buildShiftIntervalsForDate(
    shifts: WorkCenterShift[],
    date: DateTime
  ): Interval[] {
    const intervals: Interval[] = [];
    if (!shifts || shifts.length === 0) return intervals;

    const dateUTC = date.toUTC();
    const jsDayOfWeek = dateUTC.weekday % 7; // Luxon weekday: 1..7 (Mon..Sun), convert to 0..6 Sun=0

    for (const s of shifts) {
      if (s.dayOfWeek !== jsDayOfWeek) continue;

      const start = DateTime.utc(
        dateUTC.year,
        dateUTC.month,
        dateUTC.day,
        s.startHour,
        0
      );
      const end = DateTime.utc(
        dateUTC.year,
        dateUTC.month,
        dateUTC.day,
        s.endHour,
        0
      );

      if (!start.isValid || !end.isValid) {
        this.logger.warn(
          "buildShiftIntervalsForDate: invalid shift DateTimes",
          s,
          dateUTC.toISO()
        );
        continue;
      }

      if (end <= start) {
        // skip invalid or zero-length shift
        continue;
      }

      intervals.push(Interval.fromDateTimes(start, end));
    }

    // sort by start time (non-null asserted after we created them)
    intervals.sort((a, b) => a.start!.toMillis() - b.start!.toMillis());
    return intervals;
  }

  /* -------------------------
   * Working minutes consumption across shifts
   * ------------------------*/

  /**
   * Add working minutes while honoring shifts and skipping maintenance windows.
   * Returns the DateTime when the required working minutes are consumed.
   */
  public addWorkingMinutesConsideringShifts(
    start: DateTime,
    durationMinutes: number,
    wc: WorkCenterDoc
  ): DateTime {
    if (!start.isValid)
      throw new Error(
        "addWorkingMinutesConsideringShifts: invalid start DateTime"
      );
    let remaining = durationMinutes;
    let cursor = start.toUTC();
    const maxDays = 365;
    let daysScanned = 0;

    while (remaining > 0 && daysScanned < maxDays) {
      daysScanned += 1;

      const shiftIntervals = this.buildShiftIntervalsForDate(
        wc.data.shifts,
        cursor
      );
      let currentShift: Interval | null = null;

      // find shift that contains cursor, else next shift on this day
      for (const si of shiftIntervals) {
        if (!si.start || !si.end) continue;
        if (si.contains(cursor) || si.start > cursor) {
          currentShift = si;
          break;
        }
      }

      // if no shift today, move to next day's 00:00 and retry
      if (!currentShift) {
        cursor = cursor.plus({ days: 1 }).startOf("day");
        continue;
      }

      // ensure we start at shift.start if cursor is before it
      if (cursor < currentShift.start!) cursor = currentShift.start!;

      // if cursor is inside maintenance, skip to maintenance end
      if (this.isInsideMaintenance(wc, cursor)) {
        cursor = this.skipMaintenanceStartingBeforeOrAt(wc, cursor);
        continue;
      }

      // compute availableUntil as min(shift end, next maintenance.start)
      let availableUntil = currentShift.end!;
      for (const mw of wc.data.maintenanceWindows || []) {
        const interval = safeIntervalFromISO(mw.startDate, mw.endDate);
        if (!interval) continue;
        if (interval.start! > cursor && interval.start! < availableUntil) {
          availableUntil = interval.start!;
        }
      }

      const availableMinutes = Math.max(
        0,
        Math.floor((availableUntil.toMillis() - cursor.toMillis()) / 60000)
      );

      if (availableMinutes <= 0) {
        cursor = currentShift.end!;
        continue;
      }

      const consume = Math.min(availableMinutes, remaining);
      cursor = cursor.plus({ minutes: consume });
      remaining -= consume;

      if (this.isInsideMaintenance(wc, cursor)) {
        cursor = this.skipMaintenanceStartingBeforeOrAt(wc, cursor);
      }
    }

    if (remaining > 0) {
      this.logger.error(
        `addWorkingMinutesConsideringShifts: could not schedule ${durationMinutes} minutes within ${maxDays} days for work center ${wc.docId}`
      );
      throw new Error(
        `Could not schedule ${durationMinutes} minutes within ${maxDays} days for work center ${wc.docId}`
      );
    }

    return cursor;
  }

  /* -------------------------
   * Overlap detection
   * ------------------------*/

  /**
   * Return the first overlapping ScheduledSlot in the same work center that intersects [start, end).
   */
  private findOverlappingSlot(
    workCenterDocId: string,
    start: DateTime,
    end: DateTime
  ): ScheduledSlot | null {
    for (const s of this.schedule) {
      if (s.workCenterDocId !== workCenterDocId) continue;
      if (s.start < end && start < s.end) return s;
    }
    return null;
  }
}

/* -------------------------
 * Utility: safe Interval builder
 * ------------------------*/

/**
 * Build Interval safely from two ISO strings.
 * Returns null if input invalid or Interval has null boundaries.
 */
function safeIntervalFromISO(
  startIso: string | undefined,
  endIso: string | undefined
): Interval | null {
  if (!startIso || !endIso) return null;
  try {
    const iv = Interval.fromISO(`${startIso}/${endIso}`);
    if (!iv || !iv.start || !iv.end) return null;
    return iv;
  } catch (err) {
    return null;
  }
}
