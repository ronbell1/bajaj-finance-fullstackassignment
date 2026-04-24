"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  Sun, Moon, Zap, Search, GitMerge, RefreshCw, AlertTriangle, 
  CheckCircle, Copy, Download, ChevronDown, ChevronRight, Code, 
  ListTree, Network, Braces, AlertCircle, Shuffle, Check
} from "lucide-react";

/* In production (Vercel), point to Render backend. In dev, use local Next.js API route. */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/bfhl";

/* ── Presets ──────────────────────────────────── */
const PRESETS = {
  mixed: { label: "Mixed", icon: Shuffle, data: "A->B, A->C, B->D, C->E, E->F, X->Y, Y->Z, Z->X, P->Q, Q->R, G->H, G->H, G->I, hello, 1->2, A->" },
  trees: { label: "Trees Only", icon: ListTree, data: "A->B, A->C, B->D, C->E, P->Q, Q->R, G->H, G->I" },
  cycles: { label: "Cycles Only", icon: RefreshCw, data: "X->Y, Y->Z, Z->X, M->N, N->O, O->M" },
  edge: { label: "Edge Cases", icon: Zap, data: "hello, 1->2, A->, AB->C, A-B, A->A, , A->B,  A->B " },
};

/* ── Helpers ──────────────────────────────────── */
function validateLive(text) {
  if (!text.trim()) return null;
  const entries = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const pat = /^[A-Z]->[A-Z]$/;
  const seen = new Set();
  let valid = 0, invalid = 0, dupes = 0;
  for (const e of entries) {
    if (!pat.test(e) || e[0] === e[3]) invalid++;
    else if (seen.has(e)) dupes++;
    else { seen.add(e); valid++; }
  }
  return { total: entries.length, valid, invalid, dupes, edges: seen.size };
}

function buildRequestJson(text) {
  if (!text.trim()) return null;
  return { data: text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean) };
}

/* ── Graph Layout ────────────────────────────── */
function computeTreeGraph(treeObj) {
  const nodes = [], edges = [];
  let leafIdx = 0;
  const spacing = 70, levelH = 80, pad = 40;
  function process(id, children, depth, parentId) {
    const ck = Object.keys(children);
    if (ck.length === 0) {
      const x = pad + (leafIdx + 0.5) * spacing;
      nodes.push({ id, x, y: pad + depth * levelH, depth });
      leafIdx++;
      if (parentId) edges.push({ from: parentId, to: id });
      return x;
    }
    const cxs = ck.map(c => process(c, children[c], depth + 1, id));
    const x = cxs.reduce((a, b) => a + b, 0) / cxs.length;
    nodes.push({ id, x, y: pad + depth * levelH, depth });
    if (parentId) edges.push({ from: parentId, to: id });
    return x;
  }
  const root = Object.keys(treeObj)[0];
  if (!root) return null;
  process(root, treeObj[root], 0, null);
  const mx = Math.max(...nodes.map(n => n.x));
  const my = Math.max(...nodes.map(n => n.y));
  return { nodes, edges, w: mx + pad, h: my + pad };
}

function computeCycleGraph(cycleNodes) {
  if (!cycleNodes || cycleNodes.length === 0) return null;
  const nodes = [], edges = [];
  const cx = 120, cy = 100, r = Math.min(60, cycleNodes.length * 20);
  cycleNodes.forEach((id, i) => {
    const angle = (2 * Math.PI * i / cycleNodes.length) - Math.PI / 2;
    nodes.push({ id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    edges.push({ from: id, to: cycleNodes[(i + 1) % cycleNodes.length] });
  });
  return { nodes, edges, w: cx * 2, h: cy * 2 };
}

/* ── Components ──────────────────────────────── */
function GraphViz({ hierarchy }) {
  const g = hierarchy.has_cycle
    ? computeCycleGraph(hierarchy.cycle_nodes)
    : computeTreeGraph(hierarchy.tree);
  if (!g) return <div className="cycle-indicator"><RefreshCw size={32} className="cycle-icon" />Cycle detected</div>;
  const { nodes, edges, w, h } = g;
  const markerId = hierarchy.has_cycle ? "arrow-cycle" : "arrow-tree";
  const strokeColor = hierarchy.has_cycle ? "var(--error)" : "var(--accent-light)";
  
  return (
    <div className="graph-container">
      <svg width={Math.max(w, 160)} height={Math.max(h, 100)} viewBox={`0 0 ${Math.max(w, 160)} ${Math.max(h, 100)}`}>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={strokeColor} opacity="0.8" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const f = nodes.find(n => n.id === e.from);
          const t = nodes.find(n => n.id === e.to);
          const dx = t.x - f.x, dy = t.y - f.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return (
            <line key={i} className="graph-edge"
              x1={f.x + (dx / dist) * 18} y1={f.y + (dy / dist) * 18}
              x2={t.x - (dx / dist) * 18} y2={t.y - (dy / dist) * 18}
              stroke={strokeColor} markerEnd={`url(#${markerId})`}
              style={{ animationDelay: `${0.2 + i * 0.08}s` }} />
          );
        })}
        {nodes.map((n, i) => (
          <g key={n.id}>
            <circle className="graph-node-circle" cx={n.x} cy={n.y} r={18}
              stroke={hierarchy.has_cycle ? "var(--error)" : "var(--accent-light)"}
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
    const res = [];
    const root = Object.keys(tree)[0];
    if (!root) return res;
    res.push({ pre: "", node: root });
    function walk(obj, prefix) {
      const keys = Object.keys(obj);
      keys.forEach((k, i) => {
        const last = i === keys.length - 1;
        res.push({ pre: prefix + (last ? "└── " : "├── "), node: k });
        if (Object.keys(obj[k]).length > 0) walk(obj[k], prefix + (last ? "    " : "│   "));
      });
    }
    walk(tree[root], "");
    return res;
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
  const [d, setD] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const anim = (now) => {
      const p = Math.min((now - t0) / 500, 1);
      setD(Math.round(value * p));
      if (p < 1) raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return d;
}

/* ── Main ────────────────────────────────────── */
export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [vizMode, setVizMode] = useState("graph");
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("hierarchies");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("bfhl-theme");
    if (s) { setTheme(s); document.documentElement.setAttribute("data-theme", s); }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bfhl-theme", next);
  };

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const validation = useMemo(() => validateLive(input), [input]);
  const requestPreview = useMemo(() => buildRequestJson(input), [input]);

  const handleSubmit = useCallback(async () => {
    setError(""); setResult(null); setResponseTime(null); setActiveTab("hierarchies");
    const trimmed = input.trim();
    if (!trimmed) { setError("Please enter at least one node relationship."); return; }
    const data = trimmed.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
      setResponseTime(Math.round(performance.now() - t0));
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Status ${res.status}`); }
      setResult(await res.json());
    } catch (err) {
      setResponseTime(Math.round(performance.now() - t0));
      setError(err.message || "Failed to connect.");
    } finally { setLoading(false); }
  }, [input]);

  const copyJson = () => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const downloadJson = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    a.download = "bfhl-result.json"; a.click();
  };

  const loadPreset = (key) => { setInput(PRESETS[key].data); setResult(null); setError(""); };

  const TABS = [
    { id: "hierarchies", label: "Hierarchies", icon: Network, count: result?.hierarchies?.length },
    { id: "invalid", label: "Invalid", icon: AlertCircle, count: result?.invalid_entries?.length },
    { id: "duplicates", label: "Duplicates", icon: Copy, count: result?.duplicate_edges?.length },
    { id: "json", label: "JSON", icon: Braces },
  ];

  return (
    <>
      <div className="ambient-background">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="topbar">
        <button className="theme-toggle" onClick={toggleTheme} id="theme-toggle" aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <header className="hero">
        <div className="hero-badge"><Zap size={14} className="text-accent" /> SRM Full Stack Challenge</div>
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
              <span className="vb-item"><span className="vb-dot" style={{ background: "var(--accent-light)" }} />{validation.edges} unique edges</span>
            </div>
          )}

          <div className="btn-row">
            <button id="submit-btn" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><span className="spinner" /> Processing…</> : <><Search size={16} /> Analyze</>}
            </button>
            {Object.entries(PRESETS).map(([key, p]) => (
              <button key={key} className="btn btn-secondary btn-sm" onClick={() => loadPreset(key)}>
                <p.icon size={14} /> {p.label}
              </button>
            ))}
          </div>

          {input.trim() && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Request Preview
              </button>
              {showPreview && requestPreview && (
                <div className="json-block-wrapper">
                  <pre className="json-block">{JSON.stringify(requestPreview, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {error && <div className="error-banner" id="error-message"><AlertTriangle size={16} /> {error}</div>}
        </section>

        {result && (
          <section className="results-section" id="results-section">
            <div className="results-header">
              <h2>Results</h2>
              <div className="results-meta">
                <span className="badge badge-success"><CheckCircle size={12} /> Success</span>
                {responseTime !== null && <span className="badge badge-time">{responseTime}ms</span>}
              </div>
            </div>

            <div className="summary-grid">
              <div className="stat-card stat-trees" style={{ animationDelay: "0s" }}>
                <div className="stat-icon-wrap bg-success"><ListTree size={20} /></div>
                <div>
                  <div className="stat-value"><AnimatedNum value={result.summary.total_trees} /></div>
                  <div className="stat-label">Valid Trees</div>
                </div>
              </div>
              <div className="stat-card stat-cycles" style={{ animationDelay: "0.1s" }}>
                <div className="stat-icon-wrap bg-error"><RefreshCw size={20} /></div>
                <div>
                  <div className="stat-value"><AnimatedNum value={result.summary.total_cycles} /></div>
                  <div className="stat-label">Cycles</div>
                </div>
              </div>
              <div className="stat-card stat-root" style={{ animationDelay: "0.2s" }}>
                <div className="stat-icon-wrap bg-accent"><GitMerge size={20} /></div>
                <div>
                  <div className="stat-value">{result.summary.largest_tree_root || "—"}</div>
                  <div className="stat-label">Largest Root</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {TABS.map(t => (
                <button key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
                  <t.icon size={16} /> {t.label}
                  {t.count !== undefined && <span className="tab-count">{t.count}</span>}
                </button>
              ))}
            </div>

            {/* Tab: Hierarchies */}
            {activeTab === "hierarchies" && (
              <div className="tab-content">
                <div className="viz-toggle">
                  <button className={vizMode === "graph" ? "active" : ""} onClick={() => setVizMode("graph")}><Network size={14} /> Graph</button>
                  <button className={vizMode === "text" ? "active" : ""} onClick={() => setVizMode("text")}><Code size={14} /> Text</button>
                </div>
                {result.hierarchies.map((h, i) => (
                  <div className="hierarchy-card" key={i} id={`hierarchy-${i}`} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="hierarchy-header">
                      <div className="root-label">
                        <span className={`root-node ${h.has_cycle ? "cycle-root" : "tree-root"}`}>{h.root}</span>
                        <span style={{ fontWeight: 600 }}>Root: {h.root}</span>
                      </div>
                      <div className="hierarchy-meta">
                        {h.has_cycle
                          ? <><span className="meta-badge cycle-badge"><RefreshCw size={12} /> Cycle</span>
                              {h.cycle_nodes && <span className="meta-badge cycle-badge" style={{ opacity: 0.8 }}>{h.cycle_nodes.join(" → ")} → {h.cycle_nodes[0]}</span>}</>
                          : <><span className="meta-badge tree-badge"><CheckCircle size={12} /> Tree</span><span className="meta-badge depth-badge">Depth: {h.depth}</span></>
                        }
                      </div>
                    </div>
                    {vizMode === "graph"
                      ? <GraphViz hierarchy={h} />
                      : h.has_cycle
                        ? <div className="cycle-indicator"><RefreshCw size={32} className="cycle-icon" />Cycle detected — {h.cycle_nodes?.join(" → ")} → {h.cycle_nodes?.[0]}</div>
                        : Object.keys(h.tree).length > 0 && <TreeText tree={h.tree} />
                    }
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Invalid */}
            {activeTab === "invalid" && (
              <div className="tab-content">
                {result.invalid_entries.length === 0
                  ? <div className="empty-state"><CheckCircle size={24} className="mb-2 text-success" /> No invalid entries found</div>
                  : <div className="tags-wrap">{result.invalid_entries.map((e, i) => <span className="tag tag-invalid" key={i}>{e || '""'}</span>)}</div>
                }
              </div>
            )}

            {/* Tab: Duplicates */}
            {activeTab === "duplicates" && (
              <div className="tab-content">
                {result.duplicate_edges.length === 0
                  ? <div className="empty-state"><CheckCircle size={24} className="mb-2 text-success" /> No duplicate edges found</div>
                  : <div className="tags-wrap">{result.duplicate_edges.map((e, i) => <span className="tag tag-duplicate" key={i}>{e}</span>)}</div>
                }
              </div>
            )}

            {/* Tab: JSON */}
            {activeTab === "json" && (
              <div className="tab-content">
                <div className="json-bar">
                  <button className="btn btn-secondary btn-sm" onClick={copyJson}><Copy size={14} /> Copy</button>
                  <button className="btn btn-secondary btn-sm" onClick={downloadJson}><Download size={14} /> Download</button>
                </div>
                <div className="json-block-wrapper">
                  <pre className="json-block">{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">BFHL Hierarchy Visualizer — SRM Full Stack Engineering Challenge</footer>
      {copied && <div className="toast"><Check size={16} /> Copied to clipboard</div>}
    </>
  );
}
