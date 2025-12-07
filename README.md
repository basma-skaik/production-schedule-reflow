# Production Schedule Reflow

A TypeScript project that **reflows and reschedules manufacturing work orders** in a production facility, handling delays, dependencies, shifts, and maintenance windows.

---

## Overview

This project implements a **reflow algorithm** that:

- Reschedules work orders when disruptions occur
- Respects work center constraints (no overlaps, shifts, maintenance)
- Ensures all dependencies are satisfied
- Produces updated schedules with explanations of any changes

The system simulates realistic manufacturing constraints, including multi-shift operations, maintenance blocks, and cascading delays.

---

## Algorithm Approach

The core reflow algorithm:

1. **Collect inputs**: work orders, work centers, shifts, maintenance, dependencies.
2. **Sort work orders using dependency rules** (topological-like approach).
3. **Iterate through work orders**:
   - Validate dependency completion.
   - Find earliest feasible slot within shifts & maintenance limits.
   - Recalculate timings if delays occur.
4. **Apply updates**:
   - Adjust start/end times.
   - Record delays and reasons.
5. **Output**:
   - Valid final schedule.
   - Summary of delays.
   - Detailed reasoning behind every adjustment.

---

## Designing the DependencyGraph and Using Topological Sort

While implementing the `DependencyGraph`, I analyzed how to represent dependencies between `WorkOrderDoc` items as a directed graph. Each work order is a node; dependencies form edges.

I compared DFS-based topological sorting and BFS (Kahn’s Algorithm). I chose **BFS** because:

- It processes nodes in **layers**, matching real scheduling logic (a task becomes ready as soon as parents finish).
- Cycle detection becomes **simple and explicit** using in-degree counts.
- BFS is more intuitive for debugging dependency chains in scheduling systems.

I began with a simple adjacency list, then added in-degree tracking, queue processing, and finally cycle detection. This allowed me to fully understand each step before moving deeper into the final implementation.

---

## Project Structure

```bash
production-schedule-reflow/
├── node_modules/
├── package.json
├── tsconfig.json
├── jest.config.js              # Jest configuration for tests
├── tests/                      # Jest test suite
│   ├── dependency-graph.test.ts
│   └── reflow.service.test.ts
├── prompts/
│   └── project-interactions.md
└── src/
    ├── main.ts                 # Entry point
    ├── data/                   # JSON scenario files
    │   ├── scenario1.json
    │   ├── scenario2.json
    │   └── scenario3.json
    └── reflow/
        ├── reflow.service.ts       # Main reflow scheduling algorithm
        ├── constraint-checker.ts   # Constraint validation using Luxon
        ├── types.ts                # Shared TypeScript types
        └── dependency-graph.ts     # Dependency processing
```

> Note: No `utils/` folder — Luxon is directly used inside `constraint-checker.ts` and `reflow.service.ts`.

---

## Sample Data

- `scenario1.json` (optional): Simple case with a single work order.
- `scenario2.json`: Shift + maintenance conflict scenario (Requirement #2).
- `scenario3.json`: Full delay cascade scenario with dependencies (Requirement #1).

---

## Installation

```bash
git clone https://github.com/basma-skaik/production-schedule-reflow.git
cd production-schedule-reflow
npm install
```

---

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

## Running Tests

This project includes Jest test coverage for:

- DependencyGraph (topological ordering, cycle detection)

- Reflow service behavior

To run all tests:

```bash
npm run test
```

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

---

## License

ISC
