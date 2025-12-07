import { ReflowService } from "../src/reflow/reflow.service";
import { WorkOrderDoc, WorkCenterDoc } from "../src/reflow/types";

describe("ReflowService", () => {
  it("should schedule work orders respecting dependencies", async () => {
    const wc: WorkCenterDoc = {
      docId: "wc1",
      docType: "workCenter",
      data: {
        name: "WC1",
        shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }],
        maintenanceWindows: [],
      },
    };
    const wo1: WorkOrderDoc = {
      docId: "wo1",
      docType: "workOrder",
      data: {
        workOrderNumber: "WO1",
        manufacturingOrderId: "mo1",
        workCenterId: "wc1",
        startDate: "2025-12-01T08:00:00Z",
        endDate: "2025-12-01T10:00:00Z",
        durationMinutes: 120,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    };
    const wo2: WorkOrderDoc = {
      docId: "wo2",
      docType: "workOrder",
      data: {
        workOrderNumber: "WO2",
        manufacturingOrderId: "mo2",
        workCenterId: "wc1",
        startDate: "2025-12-01T10:00:00Z",
        endDate: "2025-12-01T12:00:00Z",
        durationMinutes: 120,
        isMaintenance: false,
        dependsOnWorkOrderIds: ["wo1"],
      },
    };

    const service = new ReflowService([wo1, wo2], [wc]);
    const results = await service.computeReflow();

    expect(results[0].workOrderDocId).toBe("wo1");
    expect(results[1].workOrderDocId).toBe("wo2");
    expect(results[1].startDate >= results[0].endDate).toBeTruthy();
  });
});
