"use client";
import { useState, useCallback } from "react";

const EXAMPLE_INPUT = `A->B, A->C, B->D, C->E, E->F, X->Y, Y->Z, Z->X, P->Q, Q->R, G->H, G->H, G->I, hello, 1->2, A->`;

function renderTreeText(tree, prefix, isLast) {
  const keys = Object.keys(tree);
  if (keys.length === 0) return [];
  const lines = [];
  keys.forEach((key, i) => {
    const last = i === keys.length - 1;
    const connector = isLast !== undefined ? (last ? "└── " : "├── ") : "";
    const newPrefix =
      isLast !== undefined ? prefix + (last ? "    " : "│   ") : "";
    lines.push({ prefix: prefix + connector, node: key });
    const children = tree[key];
    if (children && Object.keys(children).length > 0) {
      lines.push(...renderTreeText(children, newPrefix, last));
    }
  });
  return lines;
}

function TreeView({ tree }) {
  const rootKey = Object.keys(tree)[0];
  if (!rootKey) return null;
  const lines = [{ prefix: "", node: rootKey }];
  const children = tree[rootKey];
  if (children) {
    const childKeys = Object.keys(children);
    childKeys.forEach((key, i) => {
      const last = i === childKeys.length - 1;
      lines.push({ prefix: last ? "└── " : "├── ", node: key });
      const sub = children[key];
      if (sub && Object.keys(sub).length > 0) {
        const subPrefix = last ? "    " : "│   ";
        lines.push(...renderTreeText(sub, subPrefix, last));
      }
    });
  }
  return (
    <div className="tree-viz">
      {lines.map((l, i) => (
        <div key={i}>
          <span className="tree-branch">{l.prefix}</span>
          <span className="tree-node">{l.node}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError("");
    setResult(null);
    setShowJson(false);

    const trimmed = input.trim();
    if (!trimmed) {
      setError("Please enter at least one node relationship.");
      return;
    }

    const data = trimmed
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const res = await fetch("/api/bfhl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Server responded with ${res.status}`);
      }
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setError(err.message || "Failed to connect to the API.");
    } finally {
      setLoading(false);
    }
  }, [input]);

  const loadExample = () => {
    setInput(EXAMPLE_INPUT);
    setResult(null);
    setError("");
  };

  return (
    <>
      <header className="hero">
        <div className="hero-badge">⚡ SRM Full Stack Challenge</div>
        <h1>Hierarchy Visualizer</h1>
        <p>
          Parse node relationships, detect cycles, build trees, and visualize
          hierarchical structures in real time.
        </p>
      </header>

      <main className="container">
        <section className="card input-section" id="input-section">
          <label htmlFor="node-input">Node Relationships</label>
          <div className="textarea-wrap">
            <textarea
              id="node-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Enter node edges like: A->B, A->C, B->D&#10;Or one per line:&#10;A->B&#10;A->C&#10;B->D'
              spellCheck={false}
            />
          </div>
          <div className="input-hint">
            💡 Use commas or newlines to separate edges. Format: X→Y where X, Y
            are single uppercase letters.
          </div>

          <div className="btn-row">
            <button
              id="submit-btn"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Processing…
                </>
              ) : (
                <>🔍 Analyze Hierarchies</>
              )}
            </button>
            <button
              id="example-btn"
              className="btn btn-secondary"
              onClick={loadExample}
            >
              📋 Load Example
            </button>
          </div>

          {error && (
            <div className="error-banner" id="error-message">
              ⚠️ {error}
            </div>
          )}
        </section>

        {result && (
          <section className="results-section" id="results-section">
            <div className="results-header">
              <h2>Results</h2>
              <span className="badge">✓ Success</span>
            </div>

            <div className="info-grid">
              <div className="info-item">
                <div className="label">User ID</div>
                <div className="value">{result.user_id}</div>
              </div>
              <div className="info-item">
                <div className="label">Email</div>
                <div className="value">{result.email_id}</div>
              </div>
              <div className="info-item">
                <div className="label">Roll Number</div>
                <div className="value">{result.college_roll_number}</div>
              </div>
            </div>

            <div className="summary-grid">
              <div className="stat-card stat-trees">
                <div className="stat-value">
                  {result.summary.total_trees}
                </div>
                <div className="stat-label">Valid Trees</div>
              </div>
              <div className="stat-card stat-cycles">
                <div className="stat-value">
                  {result.summary.total_cycles}
                </div>
                <div className="stat-label">Cycles Detected</div>
              </div>
              <div className="stat-card stat-root">
                <div className="stat-value">
                  {result.summary.largest_tree_root || "—"}
                </div>
                <div className="stat-label">Largest Tree Root</div>
              </div>
            </div>

            <h3 className="hierarchies-title">
              🌲 Hierarchies ({result.hierarchies.length})
            </h3>

            {result.hierarchies.map((h, i) => (
              <div className="hierarchy-card" key={i} id={`hierarchy-${i}`}>
                <div className="hierarchy-header">
                  <div className="root-label">
                    <span
                      className={`root-node ${
                        h.has_cycle ? "cycle-root" : "tree-root"
                      }`}
                    >
                      {h.root}
                    </span>
                    <span style={{ fontWeight: 600 }}>Root: {h.root}</span>
                  </div>
                  <div className="hierarchy-meta">
                    {h.has_cycle ? (
                      <span className="meta-badge cycle-badge">⟳ Cycle</span>
                    ) : (
                      <>
                        <span className="meta-badge tree-badge">✓ Tree</span>
                        <span className="meta-badge depth-badge">
                          Depth: {h.depth}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {h.has_cycle ? (
                  <div
                    className="tree-viz"
                    style={{ color: "var(--error)", fontStyle: "italic" }}
                  >
                    Cycle detected — no tree structure available
                  </div>
                ) : (
                  Object.keys(h.tree).length > 0 && (
                    <TreeView tree={h.tree} />
                  )
                )}
              </div>
            ))}

            <div className="tags-section">
              <h3>
                ❌ Invalid Entries ({result.invalid_entries.length})
              </h3>
              <div className="tags-wrap">
                {result.invalid_entries.length === 0 ? (
                  <span className="tag-none">No invalid entries</span>
                ) : (
                  result.invalid_entries.map((e, i) => (
                    <span className="tag tag-invalid" key={i}>
                      {e || '""'}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="tags-section" style={{ marginTop: 16 }}>
              <h3>
                🔁 Duplicate Edges ({result.duplicate_edges.length})
              </h3>
              <div className="tags-wrap">
                {result.duplicate_edges.length === 0 ? (
                  <span className="tag-none">No duplicates</span>
                ) : (
                  result.duplicate_edges.map((e, i) => (
                    <span className="tag tag-duplicate" key={i}>
                      {e}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="json-toggle">
              <button onClick={() => setShowJson(!showJson)}>
                {showJson ? "▾ Hide" : "▸ Show"} Raw JSON
              </button>
              {showJson && (
                <pre className="json-block">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        BFHL Hierarchy Visualizer — SRM Full Stack Engineering Challenge
      </footer>
    </>
  );
}
