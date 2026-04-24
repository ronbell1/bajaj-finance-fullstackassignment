"use client";
import { useState, useCallback, useEffect, useMemo } from "react";

const EXAMPLE = `A->B, A->C, B->D, C->E, E->F, X->Y, Y->Z, Z->X, P->Q, Q->R, G->H, G->H, G->I, hello, 1->2, A->`;

/* ── Helpers ─────────────────────────────────── */

function validateInputLive(text) {
  if (!text.trim()) return null;
  const entries = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const pat = /^[A-Z]->[A-Z]$/;
  const seen = new Set();
  let valid = 0, invalid = 0, dupes = 0;
  for (const e of entries) {
    if (!pat.test(e) || e[0] === e[3]) { invalid++; }
    else if (seen.has(e)) { dupes++; }
    else { seen.add(e); valid++; }
  }
  return { total: entries.length, valid, invalid, dupes };
}

/* ── Graph Layout ────────────────────────────── */

function computeTreeGraph(treeObj) {
  const nodes = [], edges = [];
  let leafIdx = 0;
  const spacing = 70, levelH = 80, pad = 40;

  function process(nodeId, children, depth, parentId) {
    const ck = Object.keys(children);
    if (ck.length === 0) {
      const x = pad + (leafIdx + 0.5) * spacing;
      nodes.push({ id: nodeId, x, y: pad + depth * levelH, depth });
      leafIdx++;
      if (parentId) edges.push({ from: parentId, to: nodeId });
      return x;
    }
    const cxs = ck.map(c => process(c, children[c], depth + 1, nodeId));
    const x = cxs.reduce((a, b) => a + b, 0) / cxs.length;
    nodes.push({ id: nodeId, x, y: pad + depth * levelH, depth });
    if (parentId) edges.push({ from: parentId, to: nodeId });
    return x;
  }

  const root = Object.keys(treeObj)[0];
  if (!root) return null;
  process(root, treeObj[root], 0, null);
  const mx = Math.max(...nodes.map(n => n.x));
  const my = Math.max(...nodes.map(n => n.y));
  return { nodes, edges, w: mx + pad, h: my + pad };
}

/* ── Components ──────────────────────────────── */

function GraphViz({ hierarchy }) {
  if (hierarchy.has_cycle) {
    return (
      <div className="cycle-indicator">
        <span className="cycle-icon">⟳</span>
        Cycle detected — no tree structure available
      </div>
    );
  }
  const g = computeTreeGraph(hierarchy.tree);
  if (!g) return null;
  const { nodes, edges, w, h } = g;

  return (
    <div className="graph-container">
      <svg width={Math.max(w, 160)} height={Math.max(h, 100)} viewBox={`0 0 ${Math.max(w, 160)} ${Math.max(h, 100)}`}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="var(--text-muted)" opacity="0.6" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const f = nodes.find(n => n.id === e.from);
          const t = nodes.find(n => n.id === e.to);
          return (
            <line key={i} className="graph-edge"
              x1={f.x} y1={f.y + 18} x2={t.x} y2={t.y - 18}
              markerEnd="url(#arrowhead)"
              style={{ animationDelay: `${0.2 + i * 0.08}s` }}
            />
          );
        })}
        {nodes.map((n, i) => (
          <g key={n.id} style={{ animationDelay: `${i * 0.1}s` }}>
            <circle className="graph-node-circle" cx={n.x} cy={n.y} r={18}
              style={{ animationDelay: `${i * 0.1}s` }} />
            <text className="graph-node-text" x={n.x} y={n.y}
              style={{ animationDelay: `${i * 0.1}s` }}>{n.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function TreeText({ tree }) {
  const lines = useMemo(() => {
    const result = [];
    const root = Object.keys(tree)[0];
    if (!root) return result;
    result.push({ pre: "", node: root });
    function walk(obj, prefix) {
      const keys = Object.keys(obj);
      keys.forEach((k, i) => {
        const last = i === keys.length - 1;
        result.push({ pre: prefix + (last ? "└── " : "├── "), node: k });
        if (Object.keys(obj[k]).length > 0)
          walk(obj[k], prefix + (last ? "    " : "│   "));
      });
    }
    walk(tree[root], "");
    return result;
  }, [tree]);

  return (
    <div className="tree-viz">
      {lines.map((l, i) => (
        <div key={i}><span className="tree-branch">{l.pre}</span><span className="tree-node">{l.node}</span></div>
      ))}
    </div>
  );
}

function AnimatedNum({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const animate = (now) => {
      const p = Math.min((now - start) / 500, 1);
      setDisplay(Math.round(value * p));
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}

/* ── Main ────────────────────────────────────── */

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [vizMode, setVizMode] = useState("graph"); // "graph" | "text"
  const [theme, setTheme] = useState("dark");

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem("bfhl-theme");
    if (saved) { setTheme(saved); document.documentElement.setAttribute("data-theme", saved); }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bfhl-theme", next);
  };

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const validation = useMemo(() => validateInputLive(input), [input]);

  const handleSubmit = useCallback(async () => {
    setError(""); setResult(null); setShowJson(false); setResponseTime(null);
    const trimmed = input.trim();
    if (!trimmed) { setError("Please enter at least one node relationship."); return; }
    const data = trimmed.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/bfhl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      setResponseTime(Math.round(performance.now() - t0));
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `Server responded with ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setResponseTime(Math.round(performance.now() - t0));
      setError(err.message || "Failed to connect to the API.");
    } finally { setLoading(false); }
  }, [input]);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bfhl-result.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="topbar">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" id="theme-toggle">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      <header className="hero">
        <div className="hero-badge">⚡ SRM Full Stack Challenge</div>
        <h1>Hierarchy Visualizer</h1>
        <p>Parse node relationships, detect cycles, build trees, and visualize hierarchical structures in real time.</p>
        <div className="kbd-hint">Press <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to submit</div>
      </header>

      <main className="container">
        <section className="card input-section" id="input-section">
          <label htmlFor="node-input">Node Relationships</label>
          <div className="textarea-wrap">
            <textarea id="node-input" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={"Enter node edges like: A->B, A->C, B->D\nOr one per line:\nA->B\nA->C\nB->D"} spellCheck={false} />
          </div>

          {validation && (
            <div className="validation-bar">
              <span className="vb-item"><span className="vb-dot blue" />{validation.total} total</span>
              <span className="vb-item"><span className="vb-dot green" />{validation.valid} valid</span>
              <span className="vb-item"><span className="vb-dot red" />{validation.invalid} invalid</span>
              <span className="vb-item"><span className="vb-dot yellow" />{validation.dupes} dupes</span>
            </div>
          )}

          <div className="btn-row">
            <button id="submit-btn" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><span className="spinner" /> Processing…</> : <>🔍 Analyze</>}
            </button>
            <button id="example-btn" className="btn btn-secondary"
              onClick={() => { setInput(EXAMPLE); setResult(null); setError(""); }}>
              📋 Load Example
            </button>
          </div>

          {error && <div className="error-banner" id="error-message">⚠️ {error}</div>}
        </section>

        {result && (
          <section className="results-section" id="results-section">
            <div className="results-header">
              <h2>Results</h2>
              <div className="results-meta">
                <span className="badge badge-success">✓ Success</span>
                {responseTime !== null && <span className="badge badge-time">{responseTime}ms</span>}
              </div>
            </div>

            <div className="info-grid">
              <div className="info-item"><div className="label">User ID</div><div className="value">{result.user_id}</div></div>
              <div className="info-item"><div className="label">Email</div><div className="value">{result.email_id}</div></div>
              <div className="info-item"><div className="label">Roll Number</div><div className="value">{result.college_roll_number}</div></div>
            </div>

            <div className="summary-grid">
              <div className="stat-card stat-trees" style={{ animationDelay: "0s" }}>
                <div className="stat-value"><AnimatedNum value={result.summary.total_trees} /></div>
                <div className="stat-label">Valid Trees</div>
              </div>
              <div className="stat-card stat-cycles" style={{ animationDelay: "0.1s" }}>
                <div className="stat-value"><AnimatedNum value={result.summary.total_cycles} /></div>
                <div className="stat-label">Cycles</div>
              </div>
              <div className="stat-card stat-root" style={{ animationDelay: "0.2s" }}>
                <div className="stat-value">{result.summary.largest_tree_root || "—"}</div>
                <div className="stat-label">Largest Root</div>
              </div>
            </div>

            <h3 className="hierarchies-title">🌲 Hierarchies ({result.hierarchies.length})</h3>

            {!result.hierarchies[0]?.has_cycle && (
              <div className="viz-toggle">
                <button className={vizMode === "graph" ? "active" : ""} onClick={() => setVizMode("graph")}>◉ Graph</button>
                <button className={vizMode === "text" ? "active" : ""} onClick={() => setVizMode("text")}>≡ Text</button>
              </div>
            )}

            {result.hierarchies.map((h, i) => (
              <div className="hierarchy-card" key={i} id={`hierarchy-${i}`} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="hierarchy-header">
                  <div className="root-label">
                    <span className={`root-node ${h.has_cycle ? "cycle-root" : "tree-root"}`}>{h.root}</span>
                    <span style={{ fontWeight: 600 }}>Root: {h.root}</span>
                  </div>
                  <div className="hierarchy-meta">
                    {h.has_cycle
                      ? <span className="meta-badge cycle-badge">⟳ Cycle</span>
                      : <><span className="meta-badge tree-badge">✓ Tree</span><span className="meta-badge depth-badge">Depth: {h.depth}</span></>
                    }
                  </div>
                </div>
                {h.has_cycle ? (
                  <GraphViz hierarchy={h} />
                ) : vizMode === "graph" ? (
                  <GraphViz hierarchy={h} />
                ) : (
                  Object.keys(h.tree).length > 0 && <TreeText tree={h.tree} />
                )}
              </div>
            ))}

            <div className="tags-section">
              <h3>❌ Invalid Entries ({result.invalid_entries.length})</h3>
              <div className="tags-wrap">
                {result.invalid_entries.length === 0
                  ? <span className="tag-none">No invalid entries</span>
                  : result.invalid_entries.map((e, i) => <span className="tag tag-invalid" key={i}>{e || '""'}</span>)
                }
              </div>
            </div>
            <div className="tags-section" style={{ marginTop: 16 }}>
              <h3>🔁 Duplicate Edges ({result.duplicate_edges.length})</h3>
              <div className="tags-wrap">
                {result.duplicate_edges.length === 0
                  ? <span className="tag-none">No duplicates</span>
                  : result.duplicate_edges.map((e, i) => <span className="tag tag-duplicate" key={i}>{e}</span>)
                }
              </div>
            </div>

            <div className="json-section">
              <div className="json-bar">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowJson(!showJson)}>
                  {showJson ? "▾ Hide" : "▸ Show"} JSON
                </button>
                <button className="btn btn-secondary btn-sm" onClick={copyJson}>📋 Copy</button>
                <button className="btn btn-secondary btn-sm" onClick={downloadJson}>⬇ Download</button>
              </div>
              {showJson && <pre className="json-block">{JSON.stringify(result, null, 2)}</pre>}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">BFHL Hierarchy Visualizer — SRM Full Stack Engineering Challenge</footer>
      {copied && <div className="toast">✓ Copied to clipboard</div>}
    </>
  );
}
