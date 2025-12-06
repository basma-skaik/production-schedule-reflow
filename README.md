# Production Schedule Reflow

A TypeScript project that **reflows and reschedules manufacturing work orders** in a production facility, handling delays, dependencies, shifts, and maintenance windows.

---

## Overview

This project implements a **reflow algorithm** that:

- Reschedules work orders when disruptions occur
- Respects work center constraints (no overlaps, shifts, maintenance)
- Ensures all dependencies are satisfied
- Produces updated schedules with explanations of any changes

The system simulates **realistic manufacturing constraints**, including multi-shift operations, maintenance blocks, and cascading delays.

---

## Algorithm Approach

The core **reflow algorithm** works as follows:

1. **Collect inputs**: Work orders, work centers (with shifts and maintenance), and manufacturing orders.
2. **Sort by dependencies**: Using a topological-like approach so parent orders are scheduled before children.
3. **Iterate through work orders**:
   - Check **dependencies**: Ensure all parent work orders are complete before scheduling.
   - Find the **earliest feasible time slot** for the work order:
     - Respect **work center shifts**
     - Avoid **maintenance windows**
     - Prevent **overlaps** with other scheduled orders
   - If the original time cannot be respected, compute **delay** and record the reason.
4. **Schedule updates**:
   - Update start/end times
   - Add entry to changes log with `wasDelayed`, `delayMinutes`, and `delayReason`.
5. **Output**:
   - Final valid schedule
   - Summary of delays
   - Detailed explanation for each moved work order

> Example: If a 120-min order starts Monday 4 PM, and the shift ends 5 PM, it works 60 min, pauses, then resumes Tuesday 8 AM → completes 9 AM.

---

## Project Structure

production-schedule-reflow/
├── node_modules/
├── package.json
├── tsconfig.json
└── src/
├── main.ts # Entry point
├── data/ # JSON scenario files
│ ├── scenario1.json
│ ├── scenario2.json
│ └── scenario3.json
└── reflow/
├── reflow.service.ts # Main algorithm
├── constraint-checker.ts # Validates constraints & uses Luxon
├── types.ts # TypeScript types
└── dependency-graph.ts # Optional: Dependency management

> Note: No `utils/` folder — Luxon is directly used inside `constraint-checker.ts` and `reflow.service.ts`.

---

## Sample Data

- `scenario1.json`: Single work order, no conflicts
- `scenario2.json`: Multiple work orders, same work center, sequential scheduling
- `scenario3.json`: Multiple work orders across work centers with dependencies and maintenance

---

## Installation

```bash
git clone https://github.com/basma-skaik/production-schedule-reflow.git
cd production-schedule-reflow
npm install
```

## Running the Project

### Using npm script:

```bash
npm start
```

### Or directly with ts-node:

```bash
npx ts-node src/main.ts
```

Make sure ts-node is installed globally or as a dev dependency.

---

## Example Output

- Work orders scheduled:

- WO-001 (Mixer): 2025-12-09 08:00 → 2025-12-09 12:00, no delay

- EX-010 (Extruder B): 2025-12-15 11:00 → 2025-12-22 10:00, delayed due to shift & maintenance

---

## Summary:

- Total work orders: 3

- Delayed work orders: 3

- Total delay minutes: 27,600

---

## Notes

- All dates in UTC

- Maintenance work orders cannot be moved

- Algorithm respects all constraints listed in the technical test

- Future improvements can include DAG optimization, automated tests, and enhanced scheduling metrics (@upgrade tags in code)

---

## Dependencies

- luxon — for date/time manipulation

- @types/node and @types/luxon — for TypeScript type support

## License

ISC
