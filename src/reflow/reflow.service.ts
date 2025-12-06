// src/reflow/reflow.service.ts
import { DateTime } from "luxon";
import { WorkOrderDoc, WorkCenterDoc, ReflowResult } from "./types";
import { DependencyGraph } from "./dependency-graph";
import { ConstraintChecker, ScheduledSlot } from "./constraint-checker";

export interface ReflowServiceOptions {
  existingSchedule?: ScheduledSlot[];
  logger?: {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  };
}

export class ReflowService {
  private workOrders: WorkOrderDoc[];
  private workCenters: WorkCenterDoc[];
  private constraintChecker: ConstraintChecker;
  private logger: NonNullable<ReflowServiceOptions["logger"]>;

  constructor(
    workOrders: WorkOrderDoc[],
    workCenters: WorkCenterDoc[],
    options: ReflowServiceOptions = {}
  ) {
    this.workOrders = workOrders;
    this.workCenters = workCenters;
    this.logger = options.logger ?? console;

    this.constraintChecker = new ConstraintChecker(
      workCenters,
      options.existingSchedule ?? [],
      { logger: this.logger }
    );
  }

  /**
   * Main method: computes a reflow schedule for all work orders.
   */
  public async computeReflow(): Promise<ReflowResult[]> {
    const results: ReflowResult[] = [];

    // 1) Build dependency graph
    const depGraph = new DependencyGraph(this.workOrders);
    const orderedWorkOrderIds = depGraph.getTopologicalOrder();

    // Map docId -> WorkOrderDoc for fast lookup
    const woById = new Map(this.workOrders.map((wo) => [wo.docId, wo]));

    // 2) Schedule each work order in dependency order
    for (const woId of orderedWorkOrderIds) {
      const wo = woById.get(woId);
      if (!wo) {
        this.logger.warn(`WorkOrder not found for id: ${woId}, skipping.`);
        continue;
      }

      // Skip maintenance work orders (cannot be rescheduled)
      if (wo.data.isMaintenance) {
        this.logger.info(
          `Skipping maintenance work order ${wo.data.workOrderNumber}`
        );
        results.push({
          workOrderDocId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          workCenterDocId: wo.data.workCenterId,
          startDate: wo.data.startDate,
          endDate: wo.data.endDate,
          wasDelayed: false,
        });
        continue;
      }

      // Determine earliest possible start based on dependencies
      let earliestStart = DateTime.fromISO(wo.data.startDate, { zone: "utc" });

      if (
        wo.data.dependsOnWorkOrderIds &&
        wo.data.dependsOnWorkOrderIds.length > 0
      ) {
        for (const depId of wo.data.dependsOnWorkOrderIds) {
          const depResult = results.find((r) => r.workOrderDocId === depId);
          if (depResult) {
            const depEnd = DateTime.fromISO(depResult.endDate, { zone: "utc" });
            if (depEnd > earliestStart) earliestStart = depEnd;
          }
        }
      }

      try {
        // 3) Use ConstraintChecker to find earliest feasible slot
        const slot = await this.constraintChecker.findEarliestFeasibleSlot(
          wo.data.workCenterId,
          earliestStart,
          wo.data.durationMinutes
        );

        // 4) Compute delay info
        const plannedStart = DateTime.fromISO(wo.data.startDate, {
          zone: "utc",
        });
        const wasDelayed = slot.start > plannedStart;
        const delayMinutes = wasDelayed
          ? Math.round(slot.start.diff(plannedStart, "minutes").minutes)
          : 0;

        // 5) Push slot into internal schedule
        this.constraintChecker.pushScheduledSlot({
          workOrderDocId: wo.docId,
          workCenterDocId: wo.data.workCenterId,
          start: slot.start,
          end: slot.end,
        });

        // 6) Add result
        results.push({
          workOrderDocId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          workCenterDocId: wo.data.workCenterId,
          startDate: String(slot.start.toISO() ?? wo.data.startDate),
          endDate: String(slot.end.toISO() ?? wo.data.endDate),
          wasDelayed,
          delayMinutes: wasDelayed ? delayMinutes : undefined,
          delayReason: wasDelayed ? "Resource/shift constraints" : undefined,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to schedule work order ${wo.data.workOrderNumber}:`,
          err
        );
        // If cannot schedule, push placeholder result
        results.push({
          workOrderDocId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          workCenterDocId: wo.data.workCenterId,
          startDate: wo.data.startDate,
          endDate: wo.data.endDate,
          wasDelayed: true,
          delayReason: `Scheduling failed: ${err.message}`,
        });
      }
    }

    return results;
  }
}
