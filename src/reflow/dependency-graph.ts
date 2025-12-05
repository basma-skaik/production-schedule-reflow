import { WorkOrderDoc } from "../reflow/types";

/**
 * Class to represent a Directed Acyclic Graph of WorkOrders.
 * Handles topological sort and cycle detection.
 */
export class DependencyGraph {
  private workOrders: WorkOrderDoc[];
  private adjList: Map<string, string[]>; // docId -> children docIds
  private inDegree: Map<string, number>; // docId -> number of dependencies

  constructor(workOrders: WorkOrderDoc[]) {
    this.workOrders = workOrders;
    this.adjList = new Map();
    this.inDegree = new Map();

    this.buildGraph();
  }

  /**
   * Build adjacency list and in-degree map from workOrders
   */
  private buildGraph() {
    // Initialize every node
    for (const wo of this.workOrders) {
      this.adjList.set(wo.docId, []);
      this.inDegree.set(wo.docId, 0);
    }

    // Populate adjacency list & in-degree
    for (const wo of this.workOrders) {
      if (wo.data.dependsOnWorkOrderIds) {
        for (const depId of wo.data.dependsOnWorkOrderIds) {
          if (!this.adjList.has(depId)) {
            throw new Error(
              `Dependency not found: WorkOrder ${depId} (required by ${wo.docId})`
            );
          }
          this.adjList.get(depId)!.push(wo.docId);
          this.inDegree.set(wo.docId, (this.inDegree.get(wo.docId) || 0) + 1);
        }
      }
    }
  }

  /**
   * Perform topological sort using BFS (Kahn's Algorithm)
   * Returns an array of workOrder docIds in dependency order
   */
  public getTopologicalOrder(): string[] {
    const queue: string[] = [];
    const sorted: string[] = [];

    // Start with nodes with zero dependencies
    for (const [id, degree] of this.inDegree.entries()) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of this.adjList.get(current)!) {
        this.inDegree.set(neighbor, this.inDegree.get(neighbor)! - 1);
        if (this.inDegree.get(neighbor) === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== this.workOrders.length) {
      throw new Error(
        "Cycle detected in work orders! Cannot generate valid schedule."
      );
    }

    return sorted;
  }
}

/*
RELATIONSHIPS:
- Each WorkOrderDoc is a node in the graph.
- dependsOnWorkOrderIds represents edges from parent -> child.
- BFS topological sort ensures all parents are scheduled before children.
- Throws error if a cycle exists (circular dependency).
*/
