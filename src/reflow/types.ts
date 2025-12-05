// Top-level document wrapper used throughout the task
export interface Doc<TData = any> {
  docId: string; // Unique identifier for the document (string)
  docType: string; // Document type, e.g. "workOrder", "workCenter", "manufacturingOrder"
  data: TData;
}

/* -----------------------
   Work Order document
   ----------------------- */
export interface WorkOrderData {
  workOrderNumber: string; // Business identifier (not the docId)
  manufacturingOrderId: string; // References manufacturingOrder.docId
  workCenterId: string; // References workCenter.docId

  // Timing (ISO strings)
  startDate: string; // Planned start (ISO)
  endDate: string; // Planned end (ISO)
  durationMinutes: number; // Total working time required

  // Constraints
  isMaintenance: boolean; // If true, cannot be rescheduled

  // Dependencies (can have multiple parents) - array of workOrder docIds
  dependsOnWorkOrderIds: string[]; // All must complete before this starts
}

/* Work Order document wrapper */
export type WorkOrderDoc = Doc<WorkOrderData>;

/* -----------------------
   Work Center document
   ----------------------- */
export interface WorkCenterShift {
  dayOfWeek: number; // 0-6, Sunday = 0
  startHour: number; // 0-23 (hour when shift starts)
  endHour: number; // 0-23 (hour when shift ends)
}

export interface MaintenanceWindow {
  startDate: string; // ISO datetime string
  endDate: string; // ISO datetime string
  reason?: string;
}

export interface WorkCenterData {
  name: string;

  // Shifts: recurring weekly schedule expressed as dayOfWeek + start/end hours
  shifts: WorkCenterShift[];

  // Maintenance windows: specific blocked time ranges (absolute datetimes)
  maintenanceWindows: MaintenanceWindow[];
}

/* Work Center document wrapper */
export type WorkCenterDoc = Doc<WorkCenterData>;

/* -----------------------
   Manufacturing Order document
   ----------------------- */
export interface ManufacturingOrderData {
  manufacturingOrderNumber: string;
  itemId: string;
  quantity: number;
  dueDate: string; // ISO datetime
}

/* Manufacturing Order document wrapper */
export type ManufacturingOrderDoc = Doc<ManufacturingOrderData>;

/* -----------------------
   Reflow result (output structure)
   ----------------------- */
export interface ReflowResult {
  workOrderDocId: string; // WorkOrder.docId
  workOrderNumber?: string; // Optional human-friendly id from data.workOrderNumber
  workCenterDocId: string; // WorkCenter.docId

  // scheduled times (ISO)
  startDate: string;
  endDate: string;

  // meta
  wasDelayed: boolean;
  delayMinutes?: number;
  delayReason?: string;
}

/* -----------------------
   Relationships note
   -----------------------
   - Each top-level document uses the wrapper: { docId, docType, data }.
   - WorkOrderDoc.data.workCenterId references WorkCenterDoc.docId.
   - WorkOrderDoc.data.manufacturingOrderId references ManufacturingOrderDoc.docId.
   - WorkOrderDoc.data.dependsOnWorkOrderIds contains docId strings that reference other WorkOrderDoc.docId values.
   - Shifts inside WorkCenterData are recurring weekly intervals (dayOfWeek + hours).
   - Maintenance windows are absolute datetime ranges (use these to block scheduling).
   - ReflowResult refers to work orders by their top-level docId so the output can be linked back to source documents.
*/
