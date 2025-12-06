import path from "path";
import fs from "fs";
import { ReflowService } from "./reflow/reflow.service";
import { WorkOrderDoc, WorkCenterDoc } from "./reflow/types";
import { ScheduledSlot } from "./reflow/constraint-checker";

type Scenario = {
  workOrders: WorkOrderDoc[];
  workCenters: WorkCenterDoc[];
};

function loadScenario(filepath: string): Scenario | null {
  try {
    const absolute = path.resolve(filepath);
    const raw = fs.readFileSync(absolute, "utf8");
    const parsed = JSON.parse(raw);
    return parsed as Scenario;
  } catch (err) {
    console.warn(
      `Could not load scenario ${filepath}:`,
      (err as Error).message
    );
    return null;
  }
}

function demoScenario(): Scenario {
  const wk1: WorkCenterDoc = {
    docId: "wc-1",
    docType: "workCenter",
    data: {
      name: "Extruder A",
      shifts: [
        // Mon-Fri 08:00-17:00
        { dayOfWeek: 1, startHour: 8, endHour: 17 },
        { dayOfWeek: 2, startHour: 8, endHour: 17 },
        { dayOfWeek: 3, startHour: 8, endHour: 17 },
        { dayOfWeek: 4, startHour: 8, endHour: 17 },
        { dayOfWeek: 5, startHour: 8, endHour: 17 },
      ],
      maintenanceWindows: [
        // example maintenance blocking one day
        {
          startDate: "2025-12-10T08:00:00Z",
          endDate: "2025-12-10T17:00:00Z",
          reason: "Planned maintenance",
        },
      ],
    },
  };

  const wo1: WorkOrderDoc = {
    docId: "wo-1",
    docType: "workOrder",
    data: {
      workOrderNumber: "WO-001",
      manufacturingOrderId: "mo-1",
      workCenterId: "wc-1",
      startDate: "2025-12-09T16:00:00Z",
      endDate: "2025-12-09T18:00:00Z",
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  };

  const wo2: WorkOrderDoc = {
    docId: "wo-2",
    docType: "workOrder",
    data: {
      workOrderNumber: "WO-002",
      manufacturingOrderId: "mo-2",
      workCenterId: "wc-1",
      startDate: "2025-12-09T18:00:00Z",
      endDate: "2025-12-09T20:00:00Z",
      durationMinutes: 120,
      isMaintenance: false,
      dependsOnWorkOrderIds: ["wo-1"],
    },
  };

  return { workCenters: [wk1], workOrders: [wo1, wo2] };
}

async function runScenario(scenario: Scenario, label = "scenario") {
  console.log(`\n=== Running ${label} ===\n`);

  // Existing schedule (optional) — empty for now
  const existingSchedule: ScheduledSlot[] = [];

  const service = new ReflowService(scenario.workOrders, scenario.workCenters, {
    existingSchedule,
    logger: console,
  });

  try {
    const results = await service.computeReflow();

    console.log("Reflow results (detailed):");
    console.table(
      results.map((r) => ({
        workOrderDocId: r.workOrderDocId,
        workOrderNumber: r.workOrderNumber,
        workCenterDocId: r.workCenterDocId,
        startDate: r.startDate,
        endDate: r.endDate,
        wasDelayed: r.wasDelayed,
        delayMinutes: r.delayMinutes ?? 0,
        delayReason: r.delayReason ?? "",
      }))
    );

    // Summary metrics
    const totalDelay = results.reduce(
      (acc, r) => acc + (r.delayMinutes ?? 0),
      0
    );
    const delayedCount = results.filter((r) => r.wasDelayed).length;

    console.log(`\nSummary for ${label}:`);
    console.log(`  work orders: ${results.length}`);
    console.log(`  delayed work orders: ${delayedCount}`);
    console.log(`  total delay minutes: ${totalDelay}`);
    console.log("\n");
  } catch (err) {
    console.error("Error running reflow:", err);
  }
}

async function main() {
  const dataDir = path.resolve(__dirname, "../data");
  const files = ["scenario1.json", "scenario2.json", "scenario3.json"];
  let anyLoaded = false;

  for (const f of files) {
    const fp = path.join(dataDir, f);
    const sc = loadScenario(fp);
    if (sc) {
      anyLoaded = true;
      await runScenario(sc, f);
    }
  }

  if (!anyLoaded) {
    console.warn(
      "No scenario files found in src/data/. Running demo scenario."
    );
    const sc = demoScenario();
    await runScenario(sc, "demo-scenario");
  }
}

main().catch((err) => {
  console.error("Fatal error in main:", err);
  process.exit(1);
});
