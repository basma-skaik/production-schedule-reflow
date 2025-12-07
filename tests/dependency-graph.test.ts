import { DependencyGraph } from "../src/reflow/dependency-graph";
import { WorkOrderDoc } from "../src/reflow/types";

describe("DependencyGraph", () => {
  it("should sort work orders in topological order", () => {
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

    const graph = new DependencyGraph([wo1, wo2]);
    const order = graph.getTopologicalOrder();
    expect(order).toEqual(["wo1", "wo2"]);
  });

  it("should throw error on cycle", () => {
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
        dependsOnWorkOrderIds: ["wo2"],
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

    // Call getTopologicalOrder() inside expect to trigger cycle detection
    expect(() => {
      const graph = new DependencyGraph([wo1, wo2]);
      graph.getTopologicalOrder();
    }).toThrow(/Dependency not found|Cycle/);
  });
});
