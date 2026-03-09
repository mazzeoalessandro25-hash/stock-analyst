import { useState, useEffect, useRef } from "react";

const ANTHROPIC_API = "/api/claude";

// ── Utility ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callClaude = async (systemPrompt, userPrompt) => {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  if (!data.content || !Array.isArray(data.content)) throw new Error("Risposta non valida dall'API");
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text) throw new Error("Nessun testo nella risposta");
  return text;
};

const parseJSON = (text) => {
  try {
    // Remove markdown code blocks
    let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    // Find the outermost JSON object
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    clean = clean.slice(start, end + 1);
    return JSON.parse(clean);
  } catch {
    // Try to find any valid JSON object in the text
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return null;
  }
};

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80, label, color }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const ringColor = score >= 70 ? "#00D4AA" : score >= 45 ? "#FFB547" : "#FF6B6B";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || ringColor} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          style={{ fill: "#fff", fontSize: size * 0.22, fontWeight: 900, fontFamily: "monospace", transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}>
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace", letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

// ── Pulse Loader ──────────────────────────────────────────────────────────────
function Loader({ message }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" }}>
      <div style={{ width: 48, height: 48, border: "3px solid rgba(0,212,170,0.2)", borderTop: "3px solid #00D4AA", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ color: "#888", fontFamily: "monospace", fontSize: 13 }}>{message}{dots}</div>
    </div>
  );
}

// ── News Card ─────────────────────────────────────────────────────────────────
function NewsCard({ item }) {
  const sentiment = item.sentiment === "positive" ? "#00D4AA" : item.sentiment === "negative" ? "#FF6B6B" : "#FFB547";
  return (
    <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, borderLeft: `3px solid ${sentiment}` }}>
      <div style={{ fontSize: 13, color: "#ddd", lineHeight: 1.5, marginBottom: 4 }}>{item.headline}</div>
      <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>{item.date} · <span style={{ color: sentiment }}>{item.sentiment}</span></div>
    </div>
  );
}

// ── Scenario Bar ──────────────────────────────────────────────────────────────
function ScenarioBar({ label, value, max, color, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "#ccc", fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 13, color, fontWeight: 700, fontFamily: "monospace" }}>${value}B</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 1s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{description}</div>
    </div>
  );
}

// ── Ticker Utils ──────────────────────────────────────────────────────────────
const EXCHANGE_MAP = {
  ".MI": { name: "Borsa Italiana (Milano)", currency: "EUR", country: "Italia" },
  ".PA": { name: "Euronext Paris", currency: "EUR", country: "Francia" },
  ".DE": { name: "Xetra (Francoforte)", currency: "EUR", country: "Germania" },
  ".L":  { name: "London Stock Exchange", currency: "GBP", country: "UK" },
  ".AS": { name: "Euronext Amsterdam", currency: "EUR", country: "Olanda" },
  ".MC": { name: "Bolsa de Madrid", currency: "EUR", country: "Spagna" },
  ".SW": { name: "SIX Swiss Exchange", currency: "CHF", country: "Svizzera" },
  ".TO": { name: "Toronto Stock Exchange", currency: "CAD", country: "Canada" },
  ".T":  { name: "Tokyo Stock Exchange", currency: "JPY", country: "Giappone" },
  ".HK": { name: "Hong Kong Stock Exchange", currency: "HKD", country: "Hong Kong" },
};

const getTickerInfo = (raw) => {
  const upper = raw.trim().toUpperCase();
  for (const [suffix, info] of Object.entries(EXCHANGE_MAP)) {
    if (upper.endsWith(suffix.toUpperCase())) {
      const base = upper.slice(0, upper.length - suffix.length);
      return { ticker: upper, base, ...info, isUS: false };
    }
  }
  return { ticker: upper, base: upper, name: "NYSE/NASDAQ", currency: "USD", country: "USA", isUS: true };
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function StockAnalystPro() {
  const [ticker, setTicker] = useState("");
  const [phase, setPhase] = useState("home"); // home | loading | result | error
  const [loadingMsg, setLoadingMsg] = useState("");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const inputRef = useRef(null);

  const analyze = async () => {
    if (!ticker.trim()) return;
    setPhase("loading");

    const tickerInfo = getTickerInfo(ticker);

    try {
      // Step 1: Financial data
      setLoadingMsg("Recupero dati finanziari...");
      const financialsRaw = await callClaude(
        `Analista finanziario. Rispondi SOLO con JSON valido, zero testo extra.`,
        `Dati di ${tickerInfo.ticker} (${tickerInfo.country}, ${tickerInfo.currency}). Restituisci SOLO questo JSON:
{"name":"","sector":"","currency":"${tickerInfo.currency}","exchange":"${tickerInfo.name}","country":"${tickerInfo.country}","price":0,"priceChange1Y":0,"marketCap":"","pe":0,"forwardPE":0,"evEbitda":0,"peg":0,"roe":0,"debtEquity":0,"grossMargin":0,"operatingMargin":0,"revenueGrowthYoY":0,"revenue":0,"freeCashFlow":0,"dividendYield":0,"analystTarget":0,"analystBuys":0,"analystHolds":0,"analystSells":0,"description":""}`
      );
      const financials = parseJSON(financialsRaw);
      if (!financials) throw new Error("Impossibile recuperare i dati finanziari.");

      // Step 2: News
      setLoadingMsg("Analisi notizie recenti...");
      await sleep(2000);
      const newsRaw = await callClaude(
        `Analista finanziario. Rispondi SOLO con JSON valido.`,
        `Ultime 3 notizie su ${financials.name || tickerInfo.base}. SOLO questo JSON:
{"news":[{"headline":"","date":"","sentiment":"positive"},{"headline":"","date":"","sentiment":"neutral"},{"headline":"","date":"","sentiment":"negative"}]}`
      );
      const newsData = parseJSON(newsRaw);

      // Step 3: Ratings
      setLoadingMsg("Calcolo rating Buffett & Lynch...");
      await sleep(2000);
      const ratingsRaw = await callClaude(
        `Sei Buffett e Lynch. Rispondi SOLO con JSON valido.`,
        `Analizza ${tickerInfo.ticker}: PE=${financials.pe}, ROE=${financials.roe}%, D/E=${financials.debtEquity}, Margin=${financials.grossMargin}%, Growth=${financials.revenueGrowthYoY}%, PEG=${financials.peg}.
SOLO questo JSON:
{"buffettScore":0,"buffettVerdict":"","buffettPros":["","",""],"buffettCons":["",""],"lynchScore":0,"lynchVerdict":"","lynchCategory":"","lynchPros":["","",""],"lynchCons":["",""],"dcfBull":0,"dcfBase":0,"dcfBear":0,"dcfRationale":"","moatRating":"","cyclePhase":"","rotationSectors":["","",""]}`
      );
      const ratings = parseJSON(ratingsRaw);
      if (!ratings) throw new Error("Impossibile calcolare i rating.");

      // Step 4: Revenue scenarios
      const rev = financials.revenue || 10;
      const scenarios = {
        bull: { value: +(rev * 1.35).toFixed(1), label: "Ottimista +35%", color: "#00D4AA", description: "Crescita accelerata, espansione mercato, nuovi prodotti" },
        base: { value: +(rev * 1.15).toFixed(1), label: "Base +15%", color: "#7C6FFF", description: "Crescita in linea con le attese degli analisti" },
        bear: { value: +(rev * 0.95).toFixed(1), label: "Pessimista -5%", color: "#FF6B6B", description: "Rallentamento macro, pressione competitiva" },
      };

      setData({ financials, news: newsData?.news || [], ratings, scenarios, tickerInfo });
      setPhase("result");
      setActiveTab("overview");
    } catch (err) {
      console.error(err);
      setPhase("error");
      const msg = typeof err.message === "object" ? JSON.stringify(err.message) : (err.message || "Errore sconosciuto");
      setLoadingMsg(msg);
    }
  };

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (phase === "home") {
    return (
      <div style={{ minHeight: "100vh", background: "#060810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Palatino Linotype', 'Book Antiqua', serif", padding: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(0,212,170,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(124,111,255,0.06) 0%, transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,212,170,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.025) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />

        <div style={{ position: "relative", textAlign: "center", maxWidth: 560 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 6, color: "#00D4AA", marginBottom: 24, opacity: 0.8 }}>AI · POWERED · ANALYSIS</div>

          <h1 style={{ fontSize: "clamp(44px, 10vw, 80px)", fontWeight: 900, margin: 0, lineHeight: 1, letterSpacing: -3, color: "#fff" }}>
            Stock<br /><span style={{ color: "#00D4AA", fontStyle: "italic" }}>Analyst</span><br />
            <span style={{ fontSize: "0.35em", color: "#444", letterSpacing: 2, fontStyle: "normal" }}>PRO</span>
          </h1>

          <p style={{ color: "#666", fontSize: 14, lineHeight: 1.8, margin: "28px 0 24px", fontFamily: "monospace" }}>
            Inserisci un ticker. L'AI recupera i dati, calcola il rating<br />secondo Buffett & Lynch e stima il prezzo obiettivo.
          </p>

          {/* Exchange hints */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
            {[
              { label: "🇺🇸 USA", ex: "AMD, AAPL" },
              { label: "🇮🇹 Italia", ex: "ENI.MI, ENEL.MI" },
              { label: "🇩🇪 Germania", ex: "SAP.DE, BMW.DE" },
              { label: "🇫🇷 Francia", ex: "LVMH.PA, AIR.PA" },
              { label: "🇬🇧 UK", ex: "SHEL.L, BP.L" },
            ].map(({ label, ex }) => (
              <div key={label} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, fontSize: 11, color: "#666", fontFamily: "monospace" }}>
                {label} <span style={{ color: "#444" }}>· {ex}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, maxWidth: 420, margin: "0 auto" }}>
            <input
              ref={inputRef}
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              placeholder="es. ENI.MI · AMD · SAP.DE"
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 12, color: "#fff", padding: "14px 20px", fontSize: 18, outline: "none", fontFamily: "monospace", letterSpacing: 3, textAlign: "center" }}
            />
            <button
              onClick={analyze}
              disabled={!ticker.trim()}
              style={{ padding: "14px 24px", background: ticker ? "#00D4AA" : "#1a1a1a", border: "none", borderRadius: 12, color: ticker ? "#060810" : "#444", cursor: ticker ? "pointer" : "not-allowed", fontWeight: 900, fontSize: 18, transition: "all 0.2s", fontFamily: "monospace" }}
            >
              →
            </button>
          </div>

          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 48, flexWrap: "wrap" }}>
            {["Dati in tempo reale", "Rating Buffett & Lynch", "Price Target AI", "Scenari fatturato", "Notizie recenti"].map((f) => (
              <div key={f} style={{ fontSize: 11, color: "#555", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#00D4AA" }}>✦</span> {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#060810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#00D4AA", marginBottom: 8, letterSpacing: -1 }}>{ticker}</div>
        <Loader message={loadingMsg} />
        <div style={{ color: "#333", fontSize: 11, marginTop: 20, letterSpacing: 2 }}>ANALISI IN CORSO</div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div style={{ minHeight: "100vh", background: "#060810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", gap: 16, padding: 24 }}>
        <div style={{ color: "#FF6B6B", fontSize: 32 }}>⚠</div>
        <div style={{ color: "#fff", fontSize: 16 }}>Ticker non trovato o errore di rete</div>
        {loadingMsg && (
          <div style={{ color: "#FF6B6B", fontSize: 12, background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "10px 16px", maxWidth: 500, textAlign: "center", wordBreak: "break-all" }}>
            {loadingMsg}
          </div>
        )}
        <div style={{ color: "#666", fontSize: 13 }}>Controlla il ticker e riprova</div>
        <button onClick={() => { setPhase("home"); setTicker(""); setLoadingMsg(""); }} style={{ marginTop: 16, padding: "12px 28px", background: "#00D4AA", border: "none", borderRadius: 10, color: "#060810", cursor: "pointer", fontWeight: 700 }}>
          ← Riprova
        </button>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  const { financials, news, ratings, scenarios, tickerInfo } = data;
  const currSymbol = financials.currency === "EUR" ? "€" : financials.currency === "GBP" ? "£" : "$";
  const priceVsTarget = financials.analystTarget ? (((financials.analystTarget - financials.price) / financials.price) * 100).toFixed(1) : null;
  const dcfVsPrice = ratings.dcfBase ? (((ratings.dcfBase - financials.price) / financials.price) * 100).toFixed(1) : null;
  const combinedScore = Math.round((ratings.buffettScore + ratings.lynchScore) / 2);
  const overallColor = combinedScore >= 70 ? "#00D4AA" : combinedScore >= 45 ? "#FFB547" : "#FF6B6B";
  const TABS = ["overview", "valutazione", "buffett", "lynch", "scenari", "notizie"];
  const TAB_LABELS = { overview: "Overview", valutazione: "Valutazione", buffett: "Buffett", lynch: "Lynch", scenari: "Scenari", notizie: "Notizie" };

  return (
    <div style={{ minHeight: "100vh", background: "#060810", fontFamily: "'Palatino Linotype', serif", color: "#fff" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => { setPhase("home"); setTicker(""); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>← Nuova</button>
          <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{tickerInfo.ticker}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#00D4AA" }}>{financials.name}</div>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555" }}>{financials.exchange || tickerInfo.name} · {financials.currency || tickerInfo.currency}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>{financials.currency === "EUR" ? "€" : financials.currency === "GBP" ? "£" : "$"}{financials.price?.toFixed(2)}</div>
            <div style={{ fontSize: 11, color: financials.priceChange1Y >= 0 ? "#00D4AA" : "#FF6B6B", fontFamily: "monospace" }}>
              {financials.priceChange1Y >= 0 ? "▲" : "▼"} {Math.abs(financials.priceChange1Y)}% (1Y)
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${overallColor}22`, border: `2px solid ${overallColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontWeight: 900, fontSize: 15, color: overallColor }}>
            {combinedScore}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "12px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "8px 16px", background: activeTab === t ? "rgba(0,212,170,0.12)" : "transparent", border: "none", borderBottom: activeTab === t ? "2px solid #00D4AA" : "2px solid transparent", color: activeTab === t ? "#00D4AA" : "#666", cursor: "pointer", fontFamily: "monospace", fontSize: 12, letterSpacing: 1, whiteSpace: "nowrap", transition: "all 0.2s" }}>
            {TAB_LABELS[t].toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 16px 60px" }}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div>
            <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.8, marginBottom: 28, fontStyle: "italic", borderLeft: "3px solid #00D4AA44", paddingLeft: 16 }}>{financials.description}</p>

            {/* Score trio */}
            <div style={{ display: "flex", justifyContent: "space-around", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "28px 16px", marginBottom: 20 }}>
              <ScoreRing score={ratings.buffettScore} label="BUFFETT" color="#FFB547" />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: overallColor, fontFamily: "monospace" }}>{combinedScore}</div>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "monospace", letterSpacing: 2 }}>SCORE GLOBALE</div>
                <div style={{ fontSize: 11, color: overallColor, fontFamily: "monospace", background: `${overallColor}18`, padding: "3px 10px", borderRadius: 20 }}>
                  {combinedScore >= 70 ? "✦ FORTE" : combinedScore >= 45 ? "◑ NEUTRO" : "○ DEBOLE"}
                </div>
              </div>
              <ScoreRing score={ratings.lynchScore} label="LYNCH" color="#7C6FFF" />
            </div>

            {/* Key metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Market Cap", value: financials.marketCap, color: "#fff" },
                { label: "P/E Ratio", value: financials.pe?.toFixed(1) + "x", color: "#fff" },
                { label: "Forward P/E", value: financials.forwardPE?.toFixed(1) + "x", color: "#7C6FFF" },
                { label: "EV/EBITDA", value: financials.evEbitda?.toFixed(1) + "x", color: "#fff" },
                { label: "ROE", value: financials.roe?.toFixed(1) + "%", color: financials.roe > 15 ? "#00D4AA" : "#FFB547" },
                { label: "Gross Margin", value: financials.grossMargin?.toFixed(1) + "%", color: financials.grossMargin > 40 ? "#00D4AA" : "#FFB547" },
                { label: "Revenue Growth", value: "+" + financials.revenueGrowthYoY?.toFixed(1) + "%", color: financials.revenueGrowthYoY > 15 ? "#00D4AA" : "#888" },
                { label: "Debt/Equity", value: financials.debtEquity?.toFixed(2), color: financials.debtEquity < 0.5 ? "#00D4AA" : financials.debtEquity < 1.5 ? "#FFB547" : "#FF6B6B" },
                { label: "PEG Ratio", value: financials.peg?.toFixed(2), color: financials.peg < 1 ? "#00D4AA" : financials.peg < 2 ? "#FFB547" : "#FF6B6B" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "monospace" }}>{value || "—"}</div>
                </div>
              ))}
            </div>

            {/* Price targets row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {priceVsTarget && (
                <div style={{ background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 10, color: "#00D4AA", fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>TARGET ANALISTI</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace" }}>{currSymbol}{financials.analystTarget}</div>
                  <div style={{ fontSize: 12, color: parseFloat(priceVsTarget) > 0 ? "#00D4AA" : "#FF6B6B", fontFamily: "monospace", marginTop: 4 }}>
                    {parseFloat(priceVsTarget) > 0 ? "▲" : "▼"} {Math.abs(priceVsTarget)}% vs prezzo attuale
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 6, fontFamily: "monospace" }}>
                    Buy: {financials.analystBuys} · Hold: {financials.analystHolds} · Sell: {financials.analystSells}
                  </div>
                </div>
              )}
              {ratings.dcfBase && (
                <div style={{ background: "rgba(124,111,255,0.06)", border: "1px solid rgba(124,111,255,0.2)", borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 10, color: "#7C6FFF", fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>FAIR VALUE (DCF)</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace" }}>{currSymbol}{ratings.dcfBase}</div>
                  <div style={{ fontSize: 12, color: parseFloat(dcfVsPrice) > 0 ? "#00D4AA" : "#FF6B6B", fontFamily: "monospace", marginTop: 4 }}>
                    {parseFloat(dcfVsPrice) > 0 ? "▲ Sottovalutata" : "▼ Sopravvalutata"} del {Math.abs(dcfVsPrice)}%
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 6, fontFamily: "monospace" }}>
                    Moat: {ratings.moatRating} · Ciclo: {ratings.cyclePhase}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VALUTAZIONE ── */}
        {activeTab === "valutazione" && (
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20, letterSpacing: -1 }}>Valutazione & Price Target</h3>

            {/* DCF range */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#7C6FFF", fontFamily: "monospace", letterSpacing: 3, marginBottom: 20 }}>STIMA DCF — TRE SCENARI</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Bear", val: ratings.dcfBear, color: "#FF6B6B" },
                  { label: "Base", val: ratings.dcfBase, color: "#7C6FFF" },
                  { label: "Bull", val: ratings.dcfBull, color: "#00D4AA" },
                ].map(({ label, val, color }) => {
                  const maxH = 120;
                  const maxVal = Math.max(ratings.dcfBear || 0, ratings.dcfBase || 0, ratings.dcfBull || 0);
                  const h = maxVal ? (val / maxVal) * maxH : 40;
                  return (
                    <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900, color }}>${val}</div>
                      <div style={{ width: "100%", height: h, background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 8, transition: "height 0.8s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "60%", height: "70%", background: color, borderRadius: 4, opacity: 0.6 }} />
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#888" }}>{label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                {ratings.dcfRationale}
              </div>
            </div>

            {/* Current price marker */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#FFB547", fontFamily: "monospace", letterSpacing: 3, marginBottom: 16 }}>PREZZO ATTUALE VS TARGET</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Prezzo attuale", val: `${currSymbol}${financials.price?.toFixed(2)}`, color: "#fff" },
                  { label: "Target analisti", val: `${currSymbol}${financials.analystTarget}`, sub: priceVsTarget ? `${parseFloat(priceVsTarget) > 0 ? "+" : ""}${priceVsTarget}%` : null, color: "#00D4AA" },
                  { label: "Fair Value DCF", val: `${currSymbol}${ratings.dcfBase}`, sub: dcfVsPrice ? `${parseFloat(dcfVsPrice) > 0 ? "+" : ""}${dcfVsPrice}%` : null, color: "#7C6FFF" },
                ].map(({ label, val, sub, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace", marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "monospace" }}>{val}</div>
                    {sub && <div style={{ fontSize: 12, color: parseFloat(sub) > 0 ? "#00D4AA" : "#FF6B6B", fontFamily: "monospace", marginTop: 4 }}>{sub}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Sector rotation */}
            <div style={{ background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.15)", borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 11, color: "#FF6B6B", fontFamily: "monospace", letterSpacing: 3, marginBottom: 16 }}>SE {tickerInfo.ticker} SCENDE → RUOTA IN</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(ratings.rotationSectors || []).map((s) => (
                  <div key={s} style={{ padding: "8px 16px", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 20, fontSize: 13, color: "#FF6B6B", fontFamily: "monospace" }}>→ {s}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BUFFETT ── */}
        {activeTab === "buffett" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
              <ScoreRing score={ratings.buffettScore} size={100} label="BUFFETT SCORE" color="#FFB547" />
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>Warren Buffett</h3>
                <div style={{ fontSize: 11, color: "#FFB547", fontFamily: "monospace", marginTop: 4, letterSpacing: 2 }}>VALUE INVESTING · MOAT · LONG TERM</div>
              </div>
            </div>

            <div style={{ background: "rgba(255,181,71,0.06)", border: "1px solid rgba(255,181,71,0.2)", borderRadius: 16, padding: 20, marginBottom: 20, fontStyle: "italic", fontSize: 15, lineHeight: 1.8, color: "#ddd" }}>
              "{ratings.buffettVerdict}"
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(0,212,170,0.05)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#00D4AA", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>✦ APPREZZEREBBE</div>
                {(ratings.buffettPros || []).map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", lineHeight: 1.5 }}>• {p}</div>
                ))}
              </div>
              <div style={{ background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.15)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#FF6B6B", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>✦ LO PREOCCUPEREBBE</div>
                {(ratings.buffettCons || []).map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", lineHeight: 1.5 }}>• {p}</div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 8 }}>MOAT RATING</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: ratings.moatRating === "Forte" ? "#00D4AA" : ratings.moatRating === "Medio" ? "#FFB547" : "#FF6B6B" }}>
                {ratings.moatRating}
              </div>
            </div>
          </div>
        )}

        {/* ── LYNCH ── */}
        {activeTab === "lynch" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
              <ScoreRing score={ratings.lynchScore} size={100} label="LYNCH SCORE" color="#7C6FFF" />
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>Peter Lynch</h3>
                <div style={{ fontSize: 11, color: "#7C6FFF", fontFamily: "monospace", marginTop: 4, letterSpacing: 2 }}>GARP · PEG · GROWTH AT FAIR PRICE</div>
              </div>
            </div>

            <div style={{ background: "rgba(124,111,255,0.06)", border: "1px solid rgba(124,111,255,0.2)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#7C6FFF", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>CATEGORIA LYNCH</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{ratings.lynchCategory}</div>
            </div>

            <div style={{ background: "rgba(124,111,255,0.06)", border: "1px solid rgba(124,111,255,0.2)", borderRadius: 16, padding: 20, marginBottom: 20, fontStyle: "italic", fontSize: 15, lineHeight: 1.8, color: "#ddd" }}>
              "{ratings.lynchVerdict}"
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(0,212,170,0.05)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#00D4AA", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>✦ APPREZZEREBBE</div>
                {(ratings.lynchPros || []).map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", lineHeight: 1.5 }}>• {p}</div>
                ))}
              </div>
              <div style={{ background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.15)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#FF6B6B", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>✦ LO PREOCCUPEREBBE</div>
                {(ratings.lynchCons || []).map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", lineHeight: 1.5 }}>• {p}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SCENARI ── */}
        {activeTab === "scenari" && (
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, letterSpacing: -1 }}>Scenari Fatturato</h3>
            <p style={{ color: "#888", fontSize: 13, fontFamily: "monospace", marginBottom: 28 }}>Proiezione a 12 mesi basata sul revenue attuale di ${financials.revenue}B</p>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, marginBottom: 20 }}>
              {Object.values(scenarios).map((s) => (
                <ScenarioBar key={s.label} label={s.label} value={s.value} max={scenarios.bull.value * 1.1} color={s.color} description={s.description} />
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {Object.values(scenarios).map((s) => (
                <div key={s.label} style={{ background: `${s.color}0d`, border: `1px solid ${s.color}33`, borderRadius: 12, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: s.color, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>${s.value}B</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 8, lineHeight: 1.5 }}>{s.description}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, background: "rgba(255,181,71,0.06)", border: "1px solid rgba(255,181,71,0.15)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 11, color: "#FFB547", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>📌 NOTA</div>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.7 }}>
                Questi scenari sono basati sui trend attuali e sulle stime degli analisti. Per inserire le tue proiezioni personalizzate, confronta con i report di Investor Relations dell'azienda su <span style={{ color: "#FFB547", fontFamily: "monospace" }}>ir.{tickerInfo.base.toLowerCase()}.com</span>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIZIE ── */}
        {activeTab === "notizie" && (
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20, letterSpacing: -1 }}>Notizie Recenti</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {news.length > 0
                ? news.map((n, i) => <NewsCard key={i} item={n} />)
                : <div style={{ color: "#666", fontFamily: "monospace", fontSize: 13, textAlign: "center", padding: 40 }}>Nessuna notizia disponibile</div>
              }
            </div>
            <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, fontSize: 12, color: "#555", fontFamily: "monospace", lineHeight: 1.7 }}>
              Per notizie in tempo reale: Bloomberg, Reuters, Seeking Alpha, CNBC
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
