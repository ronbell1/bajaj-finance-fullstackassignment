const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

const USER_ID = "RohanSinghAswal_04052004";
const EMAIL_ID = "rs9951@srmist.edu.in";
const COLLEGE_ROLL_NUMBER = "RA2311003020088";

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Helpers ---

function isValidEdge(entry) {
  const t = typeof entry === "string" ? entry.trim() : "";
  if (!t) return { valid: false, trimmed: t };
  const m = t.match(/^([A-Z])->([A-Z])$/);
  if (!m || m[1] === m[2]) return { valid: false, trimmed: t };
  return { valid: true, parent: m[1], child: m[2], trimmed: t };
}

function hasCycle(adj, nodes) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const n of nodes) color.set(n, WHITE);
  for (const start of nodes) {
    if (color.get(start) !== WHITE) continue;
    const stack = [{ node: start, phase: "enter" }];
    while (stack.length > 0) {
      const { node, phase } = stack.pop();
      if (phase === "exit") { color.set(node, BLACK); continue; }
      if (color.get(node) === GRAY) { color.set(node, BLACK); continue; }
      if (color.get(node) === BLACK) continue;
      color.set(node, GRAY);
      stack.push({ node, phase: "exit" });
      for (const nb of adj.get(node) || []) {
        const c = color.get(nb);
        if (c === GRAY) return true;
        if (c === WHITE) stack.push({ node: nb, phase: "enter" });
      }
    }
  }
  return false;
}

function buildTree(root, adj) {
  const tree = {};
  tree[root] = {};
  for (const child of (adj.get(root) || []).sort()) {
    const sub = buildTree(child, adj);
    tree[root][child] = sub[child];
  }
  return tree;
}

function calcDepth(root, adj) {
  let maxDepth = 0;
  const stack = [{ node: root, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop();
    const children = adj.get(node) || [];
    if (children.length === 0) maxDepth = Math.max(maxDepth, depth);
    else for (const c of children) stack.push({ node: c, depth: depth + 1 });
  }
  return maxDepth;
}

function findComponents(edges) {
  const allNodes = new Set();
  const undirected = new Map();
  for (const { parent, child } of edges) {
    allNodes.add(parent); allNodes.add(child);
    if (!undirected.has(parent)) undirected.set(parent, new Set());
    if (!undirected.has(child)) undirected.set(child, new Set());
    undirected.get(parent).add(child);
    undirected.get(child).add(parent);
  }
  const visited = new Set();
  const components = [];
  for (const node of allNodes) {
    if (visited.has(node)) continue;
    const comp = new Set();
    const q = [node];
    while (q.length > 0) {
      const cur = q.pop();
      if (visited.has(cur)) continue;
      visited.add(cur); comp.add(cur);
      for (const nb of undirected.get(cur) || []) {
        if (!visited.has(nb)) q.push(nb);
      }
    }
    components.push(comp);
  }
  return components;
}

function processData(data) {
  const invalidEntries = [];
  const dupSet = new Set();
  const seen = new Set();
  const validEdges = [];

  for (const entry of data) {
    if (entry === null || entry === undefined || typeof entry !== "string") {
      invalidEntries.push(String(entry ?? ""));
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed === "") { invalidEntries.push(entry); continue; }
    const r = isValidEdge(trimmed);
    if (!r.valid) { invalidEntries.push(r.trimmed); continue; }
    const key = `${r.parent}->${r.child}`;
    if (seen.has(key)) { dupSet.add(key); continue; }
    seen.add(key);
    validEdges.push({ parent: r.parent, child: r.child });
  }

  const childOwner = new Map();
  const finalEdges = [];
  for (const e of validEdges) {
    if (childOwner.has(e.child)) continue;
    childOwner.set(e.child, e.parent);
    finalEdges.push(e);
  }

  const components = findComponents(finalEdges);
  const childSet = new Set(finalEdges.map(e => e.child));
  const hierarchies = [];

  for (const comp of components) {
    const adj = new Map();
    for (const n of comp) adj.set(n, []);
    for (const e of finalEdges) {
      if (comp.has(e.parent) && comp.has(e.child)) adj.get(e.parent).push(e.child);
    }
    const nodes = Array.from(comp);
    const cyclic = hasCycle(adj, nodes);

    if (cyclic) {
      const roots = nodes.filter(n => !childSet.has(n));
      const root = roots.length > 0 ? roots.sort()[0] : nodes.sort()[0];
      hierarchies.push({ root, tree: {}, has_cycle: true, cycle_nodes: nodes.sort() });
    } else {
      const root = nodes.filter(n => !childSet.has(n)).sort()[0];
      hierarchies.push({ root, tree: buildTree(root, adj), depth: calcDepth(root, adj) });
    }
  }

  const trees = hierarchies.filter(h => !h.has_cycle);
  let largestTreeRoot = "";
  let maxDepth = 0;
  for (const t of trees) {
    if (t.depth > maxDepth || (t.depth === maxDepth && t.root < largestTreeRoot)) {
      maxDepth = t.depth; largestTreeRoot = t.root;
    }
  }

  return {
    user_id: USER_ID, email_id: EMAIL_ID, college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: Array.from(dupSet),
    summary: {
      total_trees: trees.length,
      total_cycles: hierarchies.filter(h => h.has_cycle).length,
      largest_tree_root: largestTreeRoot,
    },
  };
}

// --- Routes ---

app.get("/bfhl", (req, res) => {
  res.json({ operation_code: 1, user_id: USER_ID });
});

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body || {};

    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Request body must be a JSON object." });
    }
    if (!("data" in req.body)) {
      return res.status(400).json({ error: "Missing required field: 'data'." });
    }
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "'data' must be an array of strings." });
    }

    const result = processData(data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "bfhl-api" });
});

app.listen(PORT, () => {
  console.log(`BFHL API server running on port ${PORT}`);
});
