export interface WorkOrder {
  id: number; // Unique ID for the work order
  name: string;

  workCenterId: number; // The machine/work center this order must run on
  durationMinutes: number; // Processing time in minutes

  earliestStartAt: string; // Earliest allowed start time (ISO string)
  dueAt: string; // Deadline (ISO string)

  dependencies?: number[]; // Other work orders that must be completed first
  priority?: number; // Higher means more urgent
}

export interface WorkCenter {
  id: number; // Unique machine/work-center ID
  name: string;

  capacity: number; // How many jobs it can run at once (usually 1)

  shifts: Shift[]; // Times the machine is available
  maintenance: MaintenanceWindow[]; // Times the machine cannot operate
}

export interface Shift {
  id: number;
  startsAt: string; // ISO datetime
  endsAt: string; // ISO datetime
}

export interface MaintenanceWindow {
  id: number;
  startsAt: string; // ISO datetime
  endsAt: string; // ISO datetime
  reason?: string;
}

export interface ReflowResult {
  workOrderId: number;
  workCenterId: number;

  startsAt: string; // Scheduled start time (ISO string)
  endsAt: string; // Scheduled end time (ISO string)

  wasDelayed: boolean; // True if the reflow scheduling caused a delay
  delayReason?: string; // Optional explanation
}

/*
RELATIONSHIPS:

- WorkCenter has many Shifts and many MaintenanceWindow entries.
- WorkOrder belongs to exactly one WorkCenter (via workCenterId).
- WorkOrder may depend on other WorkOrders (dependencies array).
- ReflowResult represents the final scheduled start/end times for each WorkOrder.
*/
