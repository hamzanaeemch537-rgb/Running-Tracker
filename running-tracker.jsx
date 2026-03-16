import { useState, useEffect, useCallback } from "react";

// ============================================================
// SUPABASE CONFIG — replace with your own project credentials
// ============================================================
const SUPABASE_URL = "https://mvdropyeecuufpnfatlp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZHJvcHllZWN1dWZwbmZhdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTY1ODMsImV4cCI6MjA4OTIzMjU4M30.Pr3LZrqyg-91H2PGQvnBBDLXB53kGPkjbbYpEDhwmTA";

// Lightweight Supabase client (no npm needed inside artifact)
const supabase = (() => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const base = `${SUPABASE_URL}/rest/v1`;

  return {
    from: (table) => ({
      select: async (cols = "*") => {
        const r = await fetch(`${base}/${table}?select=${cols}&order=date.desc`, { headers });
        return r.ok ? { data: await r.json(), error: null } : { data: null, error: await r.json() };
      },
      insert: async (row) => {
        const r = await fetch(`${base}/${table}`, { method: "POST", headers, body: JSON.stringify(row) });
        return r.ok ? { data: await r.json(), error: null } : { data: null, error: await r.json() };
      },
      delete: async (id) => {
        const r = await fetch(`${base}/${table}?id=eq.${id}`, { method: "DELETE", headers });
        return r.ok ? { error: null } : { error: await r.json() };
      },
      update: async (id, row) => {
        const r = await fetch(`${base}/${table}?id=eq.${id}`, {
          method: "PATCH", headers, body: JSON.stringify(row),
        });
        return r.ok ? { data: await r.json(), error: null } : { data: null, error: await r.json() };
      },
    }),
  };
})();

// ============================================================
// HELPERS
// ============================================================
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const fmtPace = (distKm, secs) => {
  if (!distKm || !secs) return "--:--";
  const secsPerKm = secs / distKm;
  return `${pad(Math.floor(secsPerKm / 60))}:${pad(Math.round(secsPerKm % 60))}`;
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const runTypes = ["Easy", "Tempo", "Intervals", "Long Run", "Recovery", "Race"];
const typeColors = {
  Easy: "#22d3ee", Tempo: "#f97316", Intervals: "#a78bfa",
  "Long Run": "#34d399", Recovery: "#94a3b8", Race: "#f43f5e",
};

// ============================================================
// SQL for Supabase — show user the setup script
// ============================================================
const SQL_SETUP = `-- Run this in your Supabase SQL editor:
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  distance_km numeric(6,2) not null,
  duration_seconds integer not null,
  type text not null default 'Easy',
  notes text,
  heart_rate_avg integer,
  elevation_m integer,
  created_at timestamptz default now()
);

-- Enable Row Level Security (optional but recommended)
alter table runs enable row level security;
create policy "Public runs" on runs for all using (true);`;

// ============================================================
// COMPONENTS
// ============================================================

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 24px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, width: 3, height: "100%",
        background: accent, borderRadius: "16px 0 0 16px",
      }} />
      <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9", fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function RunCard({ run, onDelete }) {
  const pace = fmtPace(run.distance_km, run.duration_seconds);
  const color = typeColors[run.type] || "#64748b";
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center",
      gap: 16, transition: "background .2s", cursor: "default",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "50%", background: color + "22",
        border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>🏃</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color, background: color + "22",
            padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.8,
          }}>{run.type}</span>
          <span style={{ fontSize: 12, color: "#475569" }}>{fmtDate(run.date)}</span>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", fontFamily: "'DM Mono', monospace" }}>
            {Number(run.distance_km).toFixed(2)} <span style={{ fontSize: 12, color: "#64748b", fontFamily: "inherit" }}>km</span>
          </span>
          <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>
            {fmtTime(run.duration_seconds)}
          </span>
          <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>
            {pace} <span style={{ fontSize: 11, color: "#475569" }}>/km</span>
          </span>
          {run.heart_rate_avg && (
            <span style={{ fontSize: 14, color: "#f43f5e88", alignSelf: "center" }}>
              ♥ {run.heart_rate_avg} bpm
            </span>
          )}
          {run.elevation_m && (
            <span style={{ fontSize: 14, color: "#34d39988", alignSelf: "center" }}>
              ↑ {run.elevation_m}m
            </span>
          )}
        </div>
        {run.notes && <div style={{ fontSize: 12, color: "#475569", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{run.notes}</div>}
      </div>
      <button onClick={() => onDelete(run.id)} style={{
        background: "transparent", border: "none", color: "#475569", cursor: "pointer",
        fontSize: 16, padding: 6, borderRadius: 8, transition: "color .2s",
        flexShrink: 0,
      }}
        onMouseEnter={e => e.currentTarget.style.color = "#f43f5e"}
        onMouseLeave={e => e.currentTarget.style.color = "#475569"}
      >✕</button>
    </div>
  );
}

// Live stopwatch
function Stopwatch({ onSave }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTs, setStartTs] = useState(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 500);
    return () => clearInterval(id);
  }, [running, startTs]);

  const start = () => { setStartTs(Date.now() - elapsed * 1000); setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setElapsed(0); };

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20, padding: 28, textAlign: "center",
    }}>
      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Live Timer</div>
      <div style={{
        fontSize: 56, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: running ? "#22d3ee" : "#f1f5f9",
        letterSpacing: 2, transition: "color .3s",
      }}>{fmtTime(elapsed)}</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        {!running
          ? <button onClick={start} style={btnStyle("#22d3ee")}>▶ {elapsed > 0 ? "Resume" : "Start"}</button>
          : <button onClick={pause} style={btnStyle("#f97316")}>⏸ Pause</button>
        }
        <button onClick={reset} style={btnStyle("#475569", true)}>↺ Reset</button>
        {elapsed > 0 && !running && (
          <button onClick={() => onSave(elapsed)} style={btnStyle("#a78bfa")}>✓ Log Run</button>
        )}
      </div>
    </div>
  );
}

const btnStyle = (color, ghost = false) => ({
  background: ghost ? "transparent" : color + "22",
  border: `1px solid ${color}55`,
  color: ghost ? "#64748b" : color,
  padding: "10px 20px", borderRadius: 10, cursor: "pointer",
  fontSize: 13, fontWeight: 600, transition: "all .2s",
});

// Log form
function LogForm({ prefillSeconds, onLogged, onCancel }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    distance_km: "",
    hours: prefillSeconds ? String(Math.floor(prefillSeconds / 3600)) : "0",
    minutes: prefillSeconds ? String(Math.floor((prefillSeconds % 3600) / 60)) : "",
    seconds: prefillSeconds ? String(prefillSeconds % 60) : "",
    type: "Easy",
    notes: "",
    heart_rate_avg: "",
    elevation_m: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    const secs = +form.hours * 3600 + +form.minutes * 60 + +form.seconds;
    if (!form.distance_km || secs === 0) { setErr("Distance and duration are required."); return; }
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("runs").insert({
      date: form.date,
      distance_km: parseFloat(form.distance_km),
      duration_seconds: secs,
      type: form.type,
      notes: form.notes || null,
      heart_rate_avg: form.heart_rate_avg ? +form.heart_rate_avg : null,
      elevation_m: form.elevation_m ? +form.elevation_m : null,
    });
    setSaving(false);
    if (error) { setErr(JSON.stringify(error.message || error)); return; }
    onLogged();
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "10px 14px", color: "#f1f5f9", fontSize: 14,
    width: "100%", outline: "none", boxSizing: "border-box",
  };
  const label = (txt) => <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>{txt}</div>;

  return (
    <div style={{
      background: "rgba(10,15,30,0.95)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 20, padding: 28, maxWidth: 520,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 24 }}>Log a Run</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          {label("Date")}
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} />
        </div>
        <div>
          {label("Distance (km)")}
          <input type="number" step="0.01" placeholder="5.00" value={form.distance_km} onChange={e => set("distance_km", e.target.value)} style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          {label("Duration")}
          <div style={{ display: "flex", gap: 8 }}>
            {[["hours", "h"], ["minutes", "m"], ["seconds", "s"]].map(([k, u]) => (
              <div key={k} style={{ flex: 1, position: "relative" }}>
                <input type="number" min="0" max={k === "hours" ? 23 : 59} placeholder="00" value={form[k]} onChange={e => set(k, e.target.value)} style={{ ...inputStyle, paddingRight: 28 }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: 12 }}>{u}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          {label("Run Type")}
          <select value={form.type} onChange={e => set("type", e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
            {runTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          {label("Avg Heart Rate (bpm)")}
          <input type="number" placeholder="optional" value={form.heart_rate_avg} onChange={e => set("heart_rate_avg", e.target.value)} style={inputStyle} />
        </div>
        <div>
          {label("Elevation Gain (m)")}
          <input type="number" placeholder="optional" value={form.elevation_m} onChange={e => set("elevation_m", e.target.value)} style={inputStyle} />
        </div>
        <div>
          {label("Notes")}
          <input placeholder="optional..." value={form.notes} onChange={e => set("notes", e.target.value)} style={inputStyle} />
        </div>
      </div>
      {err && <div style={{ color: "#f43f5e", fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ ...btnStyle("#22d3ee"), flex: 1, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "✓ Save Run"}
        </button>
        {onCancel && <button onClick={onCancel} style={btnStyle("#475569", true)}>Cancel</button>}
      </div>
    </div>
  );
}

// Mini bar chart
function WeeklyChart({ runs }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const byDay = Array(7).fill(0);
  runs.forEach(r => {
    const d = new Date(r.date);
    const diff = Math.round((d - monday) / 86400000);
    if (diff >= 0 && diff < 7) byDay[diff] += Number(r.distance_km);
  });

  const max = Math.max(...byDay, 1);

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 24px",
    }}>
      <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>This Week</div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
        {byDay.map((km, i) => {
          const isToday = i === (now.getDay() + 6) % 7;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: "100%", height: Math.max(km / max * 72, km > 0 ? 4 : 0),
                background: isToday ? "#22d3ee" : "#22d3ee44",
                borderRadius: 4, transition: "height .4s ease",
              }} title={`${km.toFixed(1)} km`} />
              <span style={{ fontSize: 10, color: isToday ? "#22d3ee" : "#475569" }}>{days[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetupModal({ onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(SQL_SETUP); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: 32, maxWidth: 580, width: "100%", maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>⚡ Supabase Setup</div>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
          Follow these steps to connect your Supabase project:
        </p>
        <ol style={{ color: "#94a3b8", fontSize: 13, lineHeight: 2, paddingLeft: 20, marginBottom: 20 }}>
          <li>Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: "#22d3ee" }}>supabase.com</a></li>
          <li>Go to <b>SQL Editor</b> and run the script below</li>
          <li>Go to <b>Project Settings → API</b>, copy your <b>URL</b> and <b>anon key</b></li>
          <li>Replace <code style={{ color: "#a78bfa" }}>SUPABASE_URL</code> and <code style={{ color: "#a78bfa" }}>SUPABASE_ANON_KEY</code> at the top of this file</li>
        </ol>
        <pre style={{
          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: 16, fontSize: 12, color: "#94a3b8",
          overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>{SQL_SETUP}</pre>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={copy} style={btnStyle("#a78bfa")}>
            {copied ? "✓ Copied!" : "📋 Copy SQL"}
          </button>
          <button onClick={onClose} style={btnStyle("#22d3ee")}>Got it →</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function RunTracker() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard"); // dashboard | log | stopwatch | history
  const [prefillSecs, setPrefillSecs] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [connStatus, setConnStatus] = useState("checking"); // checking | ok | error

  const loadRuns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("runs").select("*");
    setLoading(false);
    if (error) { setConnStatus("error"); return; }
    setConnStatus("ok");
    setRuns(data || []);
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const deleteRun = async (id) => {
    await supabase.from("runs").delete(id);
    setRuns(r => r.filter(x => x.id !== id));
  };

  const totalKm = runs.reduce((s, r) => s + Number(r.distance_km), 0);
  const totalSecs = runs.reduce((s, r) => s + r.duration_seconds, 0);
  const avgDist = runs.length ? totalKm / runs.length : 0;
  const weekRuns = runs.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    const diff = (now - d) / 86400000;
    return diff <= 7;
  });
  const weekKm = weekRuns.reduce((s, r) => s + Number(r.distance_km), 0);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "log", label: "Log Run", icon: "+" },
    { id: "stopwatch", label: "Timer", icon: "◷" },
    { id: "history", label: "History", icon: "≡" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080e1a",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#f1f5f9",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input, select { font-family: 'DM Sans', system-ui, sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏃</span>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>RunLog</span>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 20,
            background: connStatus === "ok" ? "#22d3ee22" : connStatus === "error" ? "#f43f5e22" : "#f9731622",
            color: connStatus === "ok" ? "#22d3ee" : connStatus === "error" ? "#f43f5e" : "#f97316",
            border: `1px solid ${connStatus === "ok" ? "#22d3ee44" : connStatus === "error" ? "#f43f5e44" : "#f9731644"}`,
            animation: connStatus === "checking" ? "pulse 1.5s infinite" : "none",
          }}>
            {connStatus === "ok" ? "● Supabase Connected" : connStatus === "error" ? "● Not Connected" : "● Connecting…"}
          </span>
        </div>
        <button onClick={() => setShowSetup(true)} style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#64748b", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12,
        }}>⚙ Setup</button>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
        {/* Sidebar nav */}
        <nav style={{
          width: 200, padding: "24px 12px", borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
        }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => { setView(n.id); setPrefillSecs(null); }} style={{
              background: view === n.id ? "rgba(34,211,238,0.1)" : "transparent",
              border: "none",
              borderLeft: `2px solid ${view === n.id ? "#22d3ee" : "transparent"}`,
              color: view === n.id ? "#22d3ee" : "#475569",
              padding: "10px 16px", borderRadius: "0 10px 10px 0",
              cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: view === n.id ? 600 : 400,
              display: "flex", gap: 10, alignItems: "center", transition: "all .15s",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto", maxWidth: 900 }}>

          {/* DASHBOARD */}
          {view === "dashboard" && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Dashboard</h1>
                <p style={{ color: "#475569", fontSize: 14, marginTop: 4 }}>Your running at a glance</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
                <StatCard label="Total Distance" value={`${totalKm.toFixed(1)} km`} sub={`${runs.length} runs`} accent="#22d3ee" />
                <StatCard label="This Week" value={`${weekKm.toFixed(1)} km`} sub={`${weekRuns.length} runs`} accent="#a78bfa" />
                <StatCard label="Total Time" value={fmtTime(totalSecs)} sub="hh:mm:ss" accent="#f97316" />
                <StatCard label="Avg Distance" value={`${avgDist.toFixed(1)} km`} sub="per run" accent="#34d399" />
              </div>
              <WeeklyChart runs={runs} />
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, color: "#475569", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.2 }}>Recent Runs</div>
                {loading && <div style={{ color: "#475569", textAlign: "center", padding: 40 }}>Loading…</div>}
                {!loading && runs.length === 0 && (
                  <div style={{ color: "#334155", textAlign: "center", padding: 48, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 16 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
                    <div style={{ fontSize: 16 }}>No runs yet. Log your first run!</div>
                    <button onClick={() => setView("log")} style={{ ...btnStyle("#22d3ee"), marginTop: 16 }}>Log a Run →</button>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {runs.slice(0, 5).map(r => <RunCard key={r.id} run={r} onDelete={deleteRun} />)}
                </div>
                {runs.length > 5 && (
                  <button onClick={() => setView("history")} style={{ ...btnStyle("#475569", true), marginTop: 12, width: "100%" }}>
                    View all {runs.length} runs →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* LOG RUN */}
          {view === "log" && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Log a Run</h1>
                <p style={{ color: "#475569", fontSize: 14, marginTop: 4 }}>Record your latest activity</p>
              </div>
              <LogForm
                prefillSeconds={prefillSecs}
                onLogged={() => { loadRuns(); setView("dashboard"); setPrefillSecs(null); }}
              />
            </div>
          )}

          {/* STOPWATCH */}
          {view === "stopwatch" && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Live Timer</h1>
                <p style={{ color: "#475569", fontSize: 14, marginTop: 4 }}>Time your run, then log it</p>
              </div>
              <div style={{ maxWidth: 420 }}>
                <Stopwatch onSave={(secs) => { setPrefillSecs(secs); setView("log"); }} />
              </div>
            </div>
          )}

          {/* HISTORY */}
          {view === "history" && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Run History</h1>
                <p style={{ color: "#475569", fontSize: 14, marginTop: 4 }}>{runs.length} total runs</p>
              </div>
              {loading && <div style={{ color: "#475569", textAlign: "center", padding: 40 }}>Loading…</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {runs.map(r => <RunCard key={r.id} run={r} onDelete={deleteRun} />)}
              </div>
              {!loading && runs.length === 0 && (
                <div style={{ color: "#334155", textAlign: "center", padding: 48 }}>No runs logged yet.</div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
