# AI Prompt Documentation for Production Schedule Reflow Project

This file collects all prompts and interactions I used with the AI during the production schedule reflow project. It shows my thought process, questions, and analysis while working on the code.

---

## 1. Understanding the project and planning

I started by asking about the **basic idea of the project** and the task duration:

> "حد زمني من وجهة نظر ميد ليفل باك اند ديفيلوبر. طب احكيلي ايش الفكرة الأساسية للمشروع"

This helped me clarify the scope: rescheduling work orders intelligently during disruptions while respecting constraints like shifts, maintenance, and dependencies.

---

## 2. Designing the DependencyGraph and using topological sort

I carefully analyzed how to **build the DependencyGraph**. I considered each `WorkOrderDoc` as a node in a directed graph and dependencies as edges from parent to child. My goals were:

1. Ensure **all parent work orders are scheduled before dependent work orders**.
2. Detect **cycles** (circular dependencies) that would make scheduling impossible.
3. Keep the implementation **readable and maintainable**.

I discussed with AI how **topological sort** works and why it’s necessary for scheduling dependent tasks. I then decided to implement **BFS (Kahn’s algorithm)** instead of DFS because:

- BFS naturally processes tasks in **layers**, which matches scheduling needs (tasks start as soon as dependencies are done).
- BFS makes **cycle detection straightforward** with in-degree counts.
- DFS could generate a valid order, but it is **less intuitive for scheduling** and harder to debug when cycles exist.

I also asked AI to **explain the full logic step by step**, and together we decided:

- Use an **adjacency list** to represent the graph.
- Track **in-degree** for each node to know which tasks are ready to schedule.
- Use a **queue for BFS traversal**, pushing nodes with zero in-degree.
- Reduce in-degree of children as parents are processed and enqueue them when ready.
- Throw an **error if not all nodes are processed**, indicating a cycle.

This approach allowed me to **start simple** (just creating nodes and edges) and **gradually add cycle detection and topological ordering**, step by step, ensuring I fully understood each part before moving deeper.

---

## 3. Terminal errors and debugging tests

When running `npm run test`, I got the following output:

FAIL tests/dependency-graph.test.ts (6.64 s)

- DependencyGraph › should throw error on cycle

I shared my `constraint-checker.ts` file and test files with AI, asking:

> "look what i had in the terminal"  
> "also this is the test file ..."

I wanted to understand **why the cycle detection test failed**. AI helped me analyze the `DependencyGraph` code and pointed out that the **cycle check only happens in `getTopologicalOrder()`**, not in the constructor.

---

## 4. Fixing DependencyGraph test

I asked how to modify the test to make cycle detection work correctly:

> "Where should I add this in the code: `expect(() => { const graph = new DependencyGraph([wo1, wo2]); graph.getTopologicalOrder(); }).toThrow(/Dependency not found|Cycle/);`"

AI explained to **wrap the `getTopologicalOrder()` call inside the `expect().toThrow()`** block. I applied it, and the test passed.

---

## 5. Writing proper commits

After finishing tests, I wanted a **conventional commit message for GitHub**:

> "ok that was sooo good now i want to write a commit to push all the test in github make sure to write a commit with the github conventiel naming"

AI suggested:

test(dependency-graph): fix cycle detection test and add topological sort test

I learned how to use **conventional commits** for clear history and proper scope documentation.

---

### Summary

This document illustrates my workflow:

1. Fully understand the **project requirements** before writing code.
2. Start simple, then **incrementally build complexity**, testing and analyzing each step.
3. Ask **precise AI prompts** to understand errors, logic, and implementation choices.
4. Apply **step-by-step fixes** and verify results.
5. Document reasoning, analysis, and solutions clearly for future reference.
