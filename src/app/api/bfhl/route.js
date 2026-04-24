import { NextResponse } from "next/server";

// --- Configuration ---
const USER_ID = "rohan_24042004"; // fullname_ddmmyyyy
const EMAIL_ID = "rp2aborz@srmap.edu.in";
const COLLEGE_ROLL_NUMBER = "AP22110011406";

// --- Helpers ---

/**
 * Validates a single entry against the X->Y format.
 * X and Y must each be a single uppercase letter A-Z.
 * Self-loops (A->A) are invalid.
 */
function isValidEntry(entry) {
  const trimmed = entry.trim();
  const regex = /^([A-Z])->([A-Z])$/;
  const match = trimmed.match(regex);
  if (!match) return { valid: false, trimmed };
  if (match[1] === match[2]) return { valid: false, trimmed }; // self-loop
  return { valid: true, parent: match[1], child: match[2], trimmed };
}

/**
 * Detects cycles in a directed graph using DFS.
 * Returns true if any cycle is found within the component containing startNode.
 */
function hasCycle(adjacency, nodes) {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = {};
  for (const n of nodes) color[n] = WHITE;

  function dfs(u) {
    color[u] = GRAY;
    for (const v of adjacency[u] || []) {
      if (color[v] === GRAY) return true;
      if (color[v] === WHITE && dfs(v)) return true;
    }
    color[u] = BLACK;
    return false;
  }

  for (const n of nodes) {
    if (color[n] === WHITE && dfs(n)) return true;
  }
  return false;
}

/**
 * Builds a nested tree object from root using adjacency list.
 */
function buildTree(root, adjacency) {
  const tree = {};
  tree[root] = {};
  const children = adjacency[root] || [];
  for (const child of children.sort()) {
    const subtree = buildTree(child, adjacency);
    tree[root][child] = subtree[child];
  }
  return tree;
}

/**
 * Calculates depth = number of nodes on the longest root-to-leaf path.
 */
function calculateDepth(root, adjacency) {
  const children = adjacency[root] || [];
  if (children.length === 0) return 1;
  let maxChildDepth = 0;
  for (const child of children) {
    maxChildDepth = Math.max(maxChildDepth, calculateDepth(child, adjacency));
  }
  return 1 + maxChildDepth;
}

/**
 * Finds connected components in an undirected version of the graph.
 */
function findComponents(edges) {
  const allNodes = new Set();
  const undirected = {};

  for (const { parent, child } of edges) {
    allNodes.add(parent);
    allNodes.add(child);
    if (!undirected[parent]) undirected[parent] = new Set();
    if (!undirected[child]) undirected[child] = new Set();
    undirected[parent].add(child);
    undirected[child].add(parent);
  }

  const visited = new Set();
  const components = [];

  for (const node of allNodes) {
    if (visited.has(node)) continue;
    const component = new Set();
    const stack = [node];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      component.add(current);
      for (const neighbor of undirected[current] || []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }

  return components;
}

// --- Main Processing ---
function processData(data) {
  const invalidEntries = [];
  const duplicateEdgesSet = new Set();
  const seenEdges = new Set();
  const validEdges = [];

  // Step 1: Parse and validate each entry
  for (const entry of data) {
    if (typeof entry !== "string") {
      invalidEntries.push(String(entry));
      continue;
    }

    const trimmed = entry.trim();

    // Empty string is invalid
    if (trimmed === "") {
      invalidEntries.push(entry);
      continue;
    }

    const result = isValidEntry(trimmed);

    if (!result.valid) {
      invalidEntries.push(trimmed);
      continue;
    }

    const edgeKey = `${result.parent}->${result.child}`;

    // Duplicate check
    if (seenEdges.has(edgeKey)) {
      duplicateEdgesSet.add(edgeKey);
      continue;
    }

    seenEdges.add(edgeKey);
    validEdges.push({ parent: result.parent, child: result.child });
  }

  // Step 2: Handle diamond / multi-parent case
  // If a child has more than one parent, only the first-encountered parent edge wins
  const childParentMap = {};
  const finalEdges = [];

  for (const edge of validEdges) {
    if (childParentMap[edge.child] !== undefined) {
      // This child already has a parent; silently discard
      continue;
    }
    childParentMap[edge.child] = edge.parent;
    finalEdges.push(edge);
  }

  // Step 3: Find connected components
  const components = findComponents(finalEdges);

  // Step 4: Build hierarchies
  const hierarchies = [];
  const childSet = new Set(finalEdges.map((e) => e.child));

  for (const component of components) {
    // Build directed adjacency for this component
    const adjacency = {};
    const componentNodes = Array.from(component);

    for (const node of componentNodes) {
      adjacency[node] = [];
    }

    for (const edge of finalEdges) {
      if (component.has(edge.parent) && component.has(edge.child)) {
        adjacency[edge.parent].push(edge.child);
      }
    }

    // Detect cycle
    const cycleDetected = hasCycle(adjacency, componentNodes);

    if (cycleDetected) {
      // Pure cycle or cycle in component
      // Find root: node that never appears as child, or lexicographically smallest
      const roots = componentNodes.filter((n) => !childSet.has(n));
      let root;
      if (roots.length > 0) {
        root = roots.sort()[0];
      } else {
        root = componentNodes.sort()[0];
      }

      hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });
    } else {
      // Valid tree
      const roots = componentNodes.filter((n) => !childSet.has(n));
      const root = roots.sort()[0]; // Should always have exactly one root in a tree

      const tree = buildTree(root, adjacency);
      const depth = calculateDepth(root, adjacency);

      hierarchies.push({
        root,
        tree,
        depth,
      });
    }
  }

  // Sort hierarchies: trees first (by root), then cycles (by root)
  hierarchies.sort((a, b) => {
    // Maintain order as they were found in input
    return 0;
  });

  // Step 5: Build summary
  const trees = hierarchies.filter((h) => !h.has_cycle);
  const cycles = hierarchies.filter((h) => h.has_cycle);

  let largestTreeRoot = "";
  if (trees.length > 0) {
    let maxDepth = 0;
    for (const t of trees) {
      if (
        t.depth > maxDepth ||
        (t.depth === maxDepth && t.root < largestTreeRoot)
      ) {
        maxDepth = t.depth;
        largestTreeRoot = t.root;
      }
    }
  }

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: Array.from(duplicateEdgesSet),
    summary: {
      total_trees: trees.length,
      total_cycles: cycles.length,
      largest_tree_root: largestTreeRoot,
    },
  };
}

// --- Route Handlers ---
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: "Invalid request: 'data' must be an array of strings." },
        { status: 400 }
      );
    }

    const result = processData(body.data);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { operation_code: 1 },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
