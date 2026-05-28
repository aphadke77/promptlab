import { useState, useEffect, useRef } from "react";
import "./index.css";

const PROVIDERS = {
  gemini: {
    id: "gemini",
    label: "Gemini",
    model: "gemini-2.0-flash",
    badge: "Gemini 2.0 Flash · Free",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Get a free key at aistudio.google.com/apikey. Gemini 2.0 Flash is free — no credit card required.",
    envVar: "VITE_GEMINI_API_KEY"
  },
  groq: {
    id: "groq",
    label: "Groq",
    model: "llama-3.3-70b-versatile",
    badge: "Llama 3.3 70B · Groq",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "Get a key at console.groq.com/keys.",
    envVar: "VITE_GROQ_API_KEY"
  }
};

const CATEGORIES = [
  { id: "clarity",     label: "Clarity",      color: "#2563EB" },
  { id: "specificity", label: "Specificity",   color: "#7C3AED" },
  { id: "context",     label: "Context",       color: "#059669" },
  { id: "structure",   label: "Structure",     color: "#D97706" },
  { id: "constraints", label: "Constraints",   color: "#DC2626" },
];

const EXAMPLE_PROMPTS = [
  "Write me a blog post about AI",
  "Help me with my Python code",
  "Make a marketing email",
  "Summarize this document for me",
];

// ─── ScoreRing ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 100, animated = false }) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (displayScore / 100) * circumference;
  const color =
    score >= 80 ? "#059669" : score >= 60 ? "#D97706" : score >= 40 ? "#EA580C" : "#DC2626";

  useEffect(() => {
    if (!animated) { setDisplayScore(score); return; }
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1000, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(ease * score));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score, animated]);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth="7" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="score-ring-label">
        <span style={{ fontSize: size * 0.27, fontWeight: 700, color, lineHeight: 1 }}>{displayScore}</span>
        <span style={{ fontSize: size * 0.12, color: "#94A3B8", letterSpacing: "0.06em", marginTop: 1 }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── CategoryBar ─────────────────────────────────────────────────────────────
function CategoryBar({ label, score, color, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), delay + 50);
    return () => clearTimeout(t);
  }, [score, delay]);
  return (
    <div className="category-bar">
      <div className="category-bar-header">
        <span className="category-label">{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{score}</span>
      </div>
      <div className="category-track">
        <div style={{ height: "100%", borderRadius: 4, background: color, width: `${width}%`, opacity: 0.75, transition: "width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
      </div>
    </div>
  );
}

// ─── ActionTag ───────────────────────────────────────────────────────────────
function ActionTag({ text, type }) {
  const styles = {
    add:         { bg: "#F0FDF4", border: "#BBF7D0", color: "#166534" },
    improve:     { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" },
    remove:      { bg: "#FFF1F2", border: "#FECDD3", color: "#BE123C" },
    restructure: { bg: "#FAF5FF", border: "#E9D5FF", color: "#7E22CE" },
  };
  const s = styles[type] || styles.improve;
  return (
    <span className="action-tag" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {type === "add" ? "＋" : type === "remove" ? "－" : type === "restructure" ? "↺" : "↑"}
      {text}
    </span>
  );
}

// ─── Dots (loading) ───────────────────────────────────────────────────────────
function Dots() {
  return (
    <span className="dots">
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("enhanced");
  // API key: prefer env var, fall back to state
  const [geminiApiKey, setGeminiApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || "");
  const [groqApiKey, setGroqApiKey] = useState(import.meta.env.VITE_GROQ_API_KEY || "");
  const [provider, setProvider] = useState("gemini");
  const [keyDraft, setKeyDraft] = useState("");
  const [showModal, setShowModal] = useState(false);
  const textareaRef = useRef(null);

  const apiKey = provider === "gemini" ? geminiApiKey : groqApiKey;

  const analyze = async () => {
    if (!prompt.trim() || loading) return;
    if (!apiKey) { setKeyDraft(""); setShowModal(true); return; }
    setLoading(true);
    setResult(null);
    try {
      if (provider === "gemini") {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDERS.gemini.model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Analyze this prompt and return ONLY valid JSON, no markdown, no backticks:\n\nPROMPT: "${prompt}"\n\nReturn:\n{"overallScore":<0-100>,"scores":{"clarity":<0-100>,"specificity":<0-100>,"context":<0-100>,"structure":<0-100>,"constraints":<0-100>},"enhancedPrompt":"<improved prompt>","actions":[{"type":"add|improve|remove|restructure","text":"<max 5 words>"}],"summary":"<1 sentence critique>"}`,
                }],
              }],
              generationConfig: { maxOutputTokens: 1000, temperature: 0.3 },
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        setResult(JSON.parse(text.replace(/```json|```/g, "").trim()));
      } else {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: PROVIDERS.groq.model,
            messages: [{
              role: "user",
              content: `Analyze this prompt and return ONLY valid JSON, no markdown, no backticks:\n\nPROMPT: "${prompt}"\n\nReturn:\n{"overallScore":<0-100>,"scores":{"clarity":<0-100>,"specificity":<0-100>,"context":<0-100>,"structure":<0-100>,"constraints":<0-100>},"enhancedPrompt":"<improved prompt>","actions":[{"type":"add|improve|remove|restructure","text":"<max 5 words>"}],"summary":"<1 sentence critique>"}`
            }],
            temperature: 0.3,
            response_format: { type: "json_object" }
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const text = data.choices?.[0]?.message?.content || "";
        setResult(JSON.parse(text));
      }
    } catch (e) {
      setResult({ error: e.message || "Something went wrong. Check your API key." });
    }
    setLoading(false);
  };

  const saveKey = () => {
    if (keyDraft.trim()) {
      if (provider === "gemini") {
        setGeminiApiKey(keyDraft.trim());
      } else {
        setGroqApiKey(keyDraft.trim());
      }
      setShowModal(false);
    }
  };

  return (
    <div className="app">

      {/* ── API Key Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="modal-title">Add {PROVIDERS[provider].label} API Key</h2>
            <p className="modal-body">
              {PROVIDERS[provider].keyHint}
            </p>
            <p className="modal-hint">
              Tip: set <code>{PROVIDERS[provider].envVar}</code> in a <code>.env</code> file to skip this step.
            </p>
            <input
              type="password" autoFocus value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder="API key..."
              className="key-input"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveKey} disabled={!keyDraft.trim()}>
                Save key →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="header">
        <span className="logo">PromptLab</span>
        <div className="header-right">
          <div className="provider-selector">
            {Object.values(PROVIDERS).map((p) => (
              <button
                key={p.id}
                className={`provider-chip ${provider === p.id ? "provider-chip--active" : ""}`}
                onClick={() => setProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            className={`key-chip ${apiKey ? "key-chip--active" : ""}`}
            onClick={() => { setKeyDraft(apiKey); setShowModal(true); }}
          >
            {apiKey ? "✓ Key active" : "+ API key"}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <h1 className="hero-title">Better prompts,<br /><em>better results.</em></h1>
        <p className="hero-sub">
          Paste any prompt and get an instant quality score, breakdown, and an improved version — powered by {PROVIDERS[provider].label}, free.
        </p>
      </section>

      {/* ── Input ── */}
      <main className="main">
        <div className="input-box">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyze(); }}
            placeholder="Type or paste your prompt here…"
            className="prompt-textarea"
          />
          <div className="input-footer">
            <span className="char-count">{prompt.length} chars</span>
            <button
              className={`btn-analyze ${prompt.trim() && !loading ? "btn-analyze--active" : ""}`}
              onClick={analyze}
              disabled={!prompt.trim() || loading}
            >
              {loading ? <><Dots /> Analyzing</> : "Analyze →"}
            </button>
          </div>
        </div>

        <div className="examples">
          <span className="examples-label">TRY:</span>
          {EXAMPLE_PROMPTS.map((ex) => (
            <button key={ex} className="ex-chip" onClick={() => { setPrompt(ex); textareaRef.current?.focus(); }}>
              {ex}
            </button>
          ))}
        </div>

        {/* ── Results ── */}
        {result && !result.error && (
          <div className="results">
            <div className="results-grid">

              {/* Left: scores */}
              <div className="score-col">
                <div className="score-card">
                  <ScoreRing score={result.overallScore} size={100} animated />
                  <p className="score-summary">{result.summary}</p>
                </div>
                <div className="bars-card">
                  {CATEGORIES.map((c, i) => (
                    <CategoryBar key={c.id} label={c.label} score={result.scores?.[c.id] ?? 0} color={c.color} delay={i * 70} />
                  ))}
                </div>
              </div>

              {/* Right: enhanced + actions */}
              <div className="right-col">
                <div className="tabs-card">
                  <div className="tabs-header">
                    {["enhanced", "actions"].map((tab) => (
                      <button
                        key={tab}
                        className={`tab ${activeTab === tab ? "tab--active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab === "enhanced" ? "Enhanced Prompt" : "Suggested Actions"}
                      </button>
                    ))}
                  </div>
                  <div className="tab-content">
                    {activeTab === "enhanced" ? (
                      <p className="enhanced-text">{result.enhancedPrompt}</p>
                    ) : (
                      <div>
                        <p className="actions-label">RECOMMENDED IMPROVEMENTS</p>
                        {result.actions?.map((a, i) => <ActionTag key={i} text={a.text} type={a.type} />)}
                      </div>
                    )}
                  </div>
                  {activeTab === "enhanced" && (
                    <div className="copy-row">
                      <button
                        className={`copy-btn ${copied ? "copy-btn--copied" : ""}`}
                        onClick={() => {
                          navigator.clipboard.writeText(result.enhancedPrompt);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? "✓ Copied" : "Copy enhanced prompt"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="gain-card">
                  <span className="gain-score">+{Math.max(0, 95 - result.overallScore)}</span>
                  <span className="gain-label">points of potential improvement<br />by using the enhanced version</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {result?.error && (
          <div className="error-box">
            <span>⚠</span>
            <div>
              {result.error}
              <button className="error-link" onClick={() => { setKeyDraft(apiKey); setShowModal(true); }}>
                → Update API key
              </button>
            </div>
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="results">
            <div className="results-grid">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          </div>
        )}
      </main>

      <div style={{ height: 80 }} />
    </div>
  );
}
