import { useState, useEffect, useCallback } from "react";

// ── Palette & helpers ────────────────────────────────────────────────────────
const COLORS = {
  indigo: "#4F46E5",
  violet: "#7C3AED",
  pink: "#EC4899",
  amber: "#F59E0B",
  emerald: "#10B981",
  sky: "#0EA5E9",
  rose: "#F43F5E",
  bg: "#0F0A1E",
  card: "#1A1135",
  cardBorder: "#2D2050",
};

const DIFFICULTY_CONFIG = {
  Easy: { color: COLORS.emerald, emoji: "🌱" },
  Medium: { color: COLORS.amber, emoji: "🔥" },
  Hard: { color: COLORS.rose, emoji: "💀" },
};

const QUIZ_TYPES = ["MCQ", "True/False", "Mixed"];
const Q_COUNTS = [5, 10, 15, "Auto"];

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!active) return;
    const p = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: [COLORS.pink, COLORS.amber, COLORS.emerald, COLORS.sky, COLORS.violet][i % 5],
      delay: Math.random() * 1.5,
      duration: 2 + Math.random() * 2,
      size: 6 + Math.random() * 8,
    }));
    setParticles(p);
    const t = setTimeout(() => setParticles([]), 4000);
    return () => clearTimeout(t);
  }, [active]);
  if (!particles.length) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: "-20px",
          width: p.size, height: p.size, borderRadius: "2px",
          backgroundColor: p.color,
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          to { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ value, max, size = 80, color = COLORS.indigo, label }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / max) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.cardBorder} strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="13" fontWeight="700" fontFamily="'Outfit', sans-serif">
        {label}
      </text>
    </svg>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function Timer({ seconds, total, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => { setLeft(seconds); }, [seconds]);
  useEffect(() => {
    if (left <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onExpire]);
  const pct = left / total;
  const color = pct > 0.5 ? COLORS.emerald : pct > 0.25 ? COLORS.amber : COLORS.rose;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        background: `${color}22`, border: `1px solid ${color}55`,
        borderRadius: 8, padding: "4px 12px",
        fontFamily: "'Outfit', sans-serif", fontWeight: 700,
        color, fontSize: 16, letterSpacing: 2,
        animation: left <= 10 ? "pulse 1s infinite" : "none",
      }}>
        ⏱ {mm}:{ss}
      </div>
    </div>
  );
}

// ── API call ──────────────────────────────────────────────────────────────────
async function generateQuiz({ notes, type, count, difficulty, topic }) {
  const autoCount = count === "Auto"
    ? Math.min(15, Math.max(5, Math.floor(notes.split(" ").length / 40)))
    : count;

  const typeInstructions = type === "MCQ"
    ? 'All questions must be multiple-choice with exactly 4 options (A, B, C, D).'
    : type === "True/False"
    ? 'All questions must be True/False with exactly 2 options: "True" and "False".'
    : 'Mix of multiple-choice (4 options) and True/False (2 options) questions.';

  const prompt = `You are a quiz generator. Generate exactly ${autoCount} ${difficulty} difficulty quiz questions from the following study notes.

Topic tag: "${topic || "General"}"
Quiz type: ${typeInstructions}

For each question return a JSON object. Return ONLY a valid JSON array, no markdown, no extra text.

Each object must have:
- "id": number (1-based)
- "type": "mcq" or "truefalse"
- "question": string
- "options": array of strings
- "correct": string (exact text of correct option)
- "explanation": string (1-2 sentence explanation)
- "topic": "${topic || "General"}"
- "difficulty": "${difficulty}"

Study Notes:
${notes}`;

  // This now calls your secure Vercel Serverless Function
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch quiz from server");
  }

  const data = await res.json();
  return data;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function QuizCraft() {
  const [screen, setScreen] = useState("home"); // home | quiz | attempt | results | share
  const [notes, setNotes] = useState("");
  const [quizType, setQuizType] = useState("MCQ");
  const [qCount, setQCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Medium");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  const timerSeconds = difficulty === "Easy" ? 60 : difficulty === "Medium" ? 45 : 30;

  // Encode quiz to shareable URL
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.href.split("?")[0]}?quiz=${encodeURIComponent(btoa(JSON.stringify(questions)))}`
    : "";

  // Load quiz from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("quiz");
    if (q) {
      try {
        const parsed = JSON.parse(atob(decodeURIComponent(q)));
        setQuestions(parsed);
        setScreen("share");
      } catch {}
    }
  }, []);

  const handleGenerate = async () => {
    if (!notes.trim() || notes.trim().length < 50) {
      setError("Please paste at least 50 characters of study notes.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const qs = await generateQuiz({ notes, type: quizType, count: qCount, difficulty, topic });
      setQuestions(qs);
      setScreen("quiz");
    } catch (e) {
      setError("Failed to generate quiz. Please try again.");
    }
    setLoading(false);
  };

  const startAttempt = () => {
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setAnswers([]);
    setTimerKey(k => k + 1);
    setScreen("attempt");
  };

  const handleSelect = (opt) => {
    if (revealed) return;
    setSelected(opt);
  };

  const handleSubmit = () => {
    if (!selected) return;
    setRevealed(true);
    setAnswers(a => [...a, { q: current, selected, correct: questions[current].correct }]);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      const score = answers.filter(a => a.selected === a.correct).length +
        (selected === questions[current].correct ? 1 : 0);
      if (score / questions.length >= 0.7) setShowConfetti(true);
      setScreen("results");
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setRevealed(false);
      setTimerKey(k => k + 1);
    }
  };

  const handleTimeUp = () => {
    if (!revealed) {
      setRevealed(true);
      setAnswers(a => [...a, { q: current, selected: null, correct: questions[current].correct }]);
    }
  };

  const score = answers.filter(a => a.selected === a.correct).length;
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const grade = pct >= 90 ? { label: "Outstanding! 🏆", color: COLORS.emerald }
    : pct >= 70 ? { label: "Great Job! 🎉", color: COLORS.sky }
    : pct >= 50 ? { label: "Good Effort 👍", color: COLORS.amber }
    : { label: "Keep Practicing 💪", color: COLORS.rose };

  const downloadPDF = () => {
    const win = window.open("", "_blank");
    const html = `<html><head><title>QuizCraft - ${topic || "Quiz"}</title>
    <style>body{font-family:sans-serif;padding:32px;color:#111}h1{color:#4F46E5}
    .q{margin:24px 0;padding:16px;border:1px solid #ddd;border-radius:8px}
    .opt{margin:4px 0;padding:6px 12px;background:#f5f5f5;border-radius:4px}
    .correct{background:#d1fae5;font-weight:bold}.exp{color:#666;font-size:13px;margin-top:8px}
    </style></head><body>
    <h1>📚 QuizCraft — ${topic || "Quiz"}</h1>
    <p><strong>Difficulty:</strong> ${difficulty} | <strong>Questions:</strong> ${questions.length}</p>
    ${questions.map((q, i) => `
      <div class="q">
        <strong>Q${i + 1}. ${q.question}</strong>
        ${q.options.map(o => `<div class="opt ${o === q.correct ? "correct" : ""}">${o}${o === q.correct ? " ✓" : ""}</div>`).join("")}
        <div class="exp">💡 ${q.explanation}</div>
      </div>`).join("")}
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    app: {
      minHeight: "100vh", background: COLORS.bg, color: "white",
      fontFamily: "'Outfit', sans-serif",
      backgroundImage: `radial-gradient(ellipse at 20% 20%, #1e1050 0%, transparent 60%),
        radial-gradient(ellipse at 80% 80%, #0d1f3c 0%, transparent 60%)`,
    },
    center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" },
    card: {
      background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: 20, padding: "32px", width: "100%", maxWidth: 680,
      boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
    },
    btn: (bg, full) => ({
      background: bg, color: "white", border: "none", borderRadius: 12,
      padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer",
      width: full ? "100%" : "auto", fontFamily: "'Outfit', sans-serif",
      transition: "opacity 0.2s, transform 0.1s",
    }),
    input: {
      background: "#0F0A1E", border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: 10, padding: "12px 16px", color: "white", fontSize: 15,
      fontFamily: "'Outfit', sans-serif", width: "100%", outline: "none",
      boxSizing: "border-box",
    },
    label: { fontSize: 13, color: "#9CA3AF", marginBottom: 6, display: "block", fontWeight: 600, letterSpacing: 0.5 },
    chip: (active, color) => ({
      padding: "8px 16px", borderRadius: 20, border: `2px solid ${active ? color : COLORS.cardBorder}`,
      background: active ? `${color}22` : "transparent", color: active ? color : "#9CA3AF",
      cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s",
      fontFamily: "'Outfit', sans-serif",
    }),
    tag: (color) => ({
      display: "inline-flex", alignItems: "center", gap: 4,
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700,
    }),
  };

  // ── Screens ─────────────────────────────────────────────────────────────────

  // HOME
  if (screen === "home") return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=Space+Grotesk:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus, input:focus { border-color: ${COLORS.indigo} !important; }
        button:hover { opacity: 0.88; transform: translateY(-1px); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer { 0%{background-position:-200%} 100%{background-position:200%} }
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#0F0A1E}
        ::-webkit-scrollbar-thumb{background:${COLORS.cardBorder};border-radius:3px}
      `}</style>
      <div style={S.center}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 8, animation: "float 3s ease-in-out infinite" }}>⚡</div>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.1,
            background: `linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.pink}, ${COLORS.amber})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 12,
          }}>QuizCraft</h1>
          <p style={{ color: "#9CA3AF", fontSize: 17, maxWidth: 420, margin: "0 auto" }}>
            Paste your notes. Get an instant quiz. Study smarter, not harder.
          </p>
        </div>

        <div style={S.card}>
          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>📄 PASTE YOUR STUDY NOTES</label>
            <textarea
              rows={6} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Paste any text — lecture notes, textbook chapters, articles…"
              style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
              {notes.trim().split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {/* Topic */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>🏷️ TOPIC / SUBJECT (optional)</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Cloud Computing, World War II, Calculus…"
              style={S.input} />
          </div>

          {/* Quiz Type */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>🎯 QUIZ TYPE</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {QUIZ_TYPES.map(t => (
                <button key={t} style={S.chip(quizType === t, COLORS.violet)} onClick={() => setQuizType(t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>🔢 NUMBER OF QUESTIONS</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Q_COUNTS.map(c => (
                <button key={c} style={S.chip(qCount === c, COLORS.sky)} onClick={() => setQCount(c)}>
                  {c === "Auto" ? "⚙️ Auto" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: 28 }}>
            <label style={S.label}>💪 DIFFICULTY</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(DIFFICULTY_CONFIG).map(([d, cfg]) => (
                <button key={d} style={S.chip(difficulty === d, cfg.color)} onClick={() => setDifficulty(d)}>
                  {cfg.emoji} {d}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: `${COLORS.rose}22`, border: `1px solid ${COLORS.rose}44`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: COLORS.rose, fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <button onClick={handleGenerate} disabled={loading}
            style={{
              ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`, true),
              padding: "14px 24px", fontSize: 16,
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? (
              <span>✨ Generating your quiz…</span>
            ) : (
              <span>⚡ Generate Quiz</span>
            )}
          </button>
        </div>

        {/* Footer */}
        <p style={{ color: "#4B5563", fontSize: 12, marginTop: 24 }}>
          Powered by Claude AI · Built with ❤️ for students & teachers
        </p>
      </div>
    </div>
  );

  // QUIZ PREVIEW (after generation)
  if (screen === "quiz") return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} button:hover{opacity:0.88;transform:translateY(-1px)} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      <div style={S.center}>
        <div style={S.card}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>Quiz Ready!</h2>
            <p style={{ color: "#9CA3AF", fontSize: 15 }}>
              {questions.length} questions generated
            </p>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Questions", value: questions.length, icon: "❓" },
              { label: "Type", value: quizType, icon: "🎯" },
              { label: "Difficulty", value: difficulty, icon: DIFFICULTY_CONFIG[difficulty].emoji },
              { label: "Timer", value: `${timerSeconds}s/Q`, icon: "⏱" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, minWidth: 100, background: "#0F0A1E",
                borderRadius: 12, padding: "12px 16px", textAlign: "center",
                border: `1px solid ${COLORS.cardBorder}`,
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Preview first 3 questions */}
          <div style={{ marginBottom: 24 }}>
            <label style={S.label}>PREVIEW</label>
            {questions.slice(0, 3).map((q, i) => (
              <div key={i} style={{
                background: "#0F0A1E", borderRadius: 10, padding: "12px 16px",
                marginBottom: 8, border: `1px solid ${COLORS.cardBorder}`,
              }}>
                <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 4 }}>Q{i + 1}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{q.question}</div>
              </div>
            ))}
            {questions.length > 3 && (
              <div style={{ textAlign: "center", color: "#6B7280", fontSize: 13 }}>
                +{questions.length - 3} more questions…
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={startAttempt}
              style={{ ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`, false), flex: 2, padding: "13px" }}>
              🚀 Start Attempt
            </button>
            <button onClick={downloadPDF}
              style={{ ...S.btn(`${COLORS.emerald}22`, false), flex: 1, padding: "13px", border: `1px solid ${COLORS.emerald}55`, color: COLORS.emerald }}>
              📄 PDF
            </button>
            <button onClick={() => setScreen("share")}
              style={{ ...S.btn(`${COLORS.sky}22`, false), flex: 1, padding: "13px", border: `1px solid ${COLORS.sky}55`, color: COLORS.sky }}>
              🔗 Share
            </button>
          </div>

          <button onClick={() => setScreen("home")} style={{ ...S.btn("transparent", true), color: "#6B7280", marginTop: 12, fontSize: 13 }}>
            ← Generate a new quiz
          </button>
        </div>
      </div>
    </div>
  );

  // ATTEMPT SCREEN
  if (screen === "attempt") {
    const q = questions[current];
    const isCorrect = revealed && selected === q.correct;
    const isWrong = revealed && selected !== q.correct && selected !== null;
    const progress = ((current) / questions.length) * 100;

    return (
      <div style={S.app}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} button:hover{opacity:0.88} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={S.center}>
          <div style={{ ...S.card, animation: "slideIn 0.3s ease" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={S.tag(DIFFICULTY_CONFIG[q.difficulty || difficulty].color)}>
                  {DIFFICULTY_CONFIG[q.difficulty || difficulty].emoji} {q.difficulty || difficulty}
                </span>
                {q.topic && <span style={S.tag(COLORS.sky)}>🏷 {q.topic}</span>}
              </div>
              <Timer key={timerKey} seconds={timerSeconds} total={timerSeconds} onExpire={handleTimeUp} />
            </div>

            {/* Progress bar */}
            <div style={{ background: COLORS.cardBorder, borderRadius: 4, height: 4, marginBottom: 20, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: `linear-gradient(90deg, ${COLORS.indigo}, ${COLORS.pink})`,
                width: `${progress}%`, transition: "width 0.4s ease",
              }} />
            </div>

            <div style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 8 }}>
              Question {current + 1} of {questions.length}
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5, marginBottom: 24 }}>
              {q.question}
            </h3>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {q.options.map((opt, i) => {
                const isSelected = selected === opt;
                const isCorrectOpt = revealed && opt === q.correct;
                const isWrongOpt = revealed && isSelected && opt !== q.correct;
                let bg = "#0F0A1E", border = COLORS.cardBorder, textColor = "white";
                if (isCorrectOpt) { bg = `${COLORS.emerald}22`; border = COLORS.emerald; textColor = COLORS.emerald; }
                else if (isWrongOpt) { bg = `${COLORS.rose}22`; border = COLORS.rose; textColor = COLORS.rose; }
                else if (isSelected) { bg = `${COLORS.indigo}33`; border = COLORS.indigo; }

                return (
                  <button key={i} onClick={() => handleSelect(opt)} style={{
                    background: bg, border: `2px solid ${border}`, borderRadius: 12,
                    padding: "13px 18px", textAlign: "left", color: textColor,
                    fontFamily: "'Outfit', sans-serif", fontSize: 15, cursor: revealed ? "default" : "pointer",
                    transition: "all 0.2s", display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, border: `2px solid ${border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, flexShrink: 0,
                      background: isSelected || isCorrectOpt ? border : "transparent",
                      color: isSelected || isCorrectOpt ? COLORS.bg : border,
                    }}>
                      {isCorrectOpt ? "✓" : isWrongOpt ? "✗" : String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {revealed && (
              <div style={{
                background: `${isCorrect ? COLORS.emerald : COLORS.rose}11`,
                border: `1px solid ${isCorrect ? COLORS.emerald : COLORS.rose}33`,
                borderRadius: 10, padding: "12px 16px", marginBottom: 20,
                animation: "slideIn 0.3s ease",
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: isCorrect ? COLORS.emerald : COLORS.rose }}>
                  {selected === null ? "⏰ Time's up!" : isCorrect ? "✅ Correct!" : "❌ Incorrect"}
                </div>
                <div style={{ fontSize: 14, color: "#D1D5DB", lineHeight: 1.6 }}>
                  {q.explanation}
                </div>
              </div>
            )}

            {/* Buttons */}
            {!revealed ? (
              <button onClick={handleSubmit} disabled={!selected}
                style={{
                  ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`, true),
                  opacity: selected ? 1 : 0.4, padding: "13px",
                }}>
                Submit Answer
              </button>
            ) : (
              <button onClick={handleNext}
                style={{ ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.pink})`, true), padding: "13px" }}>
                {current + 1 >= questions.length ? "🏁 See Results" : "Next Question →"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (screen === "results") {
    return (
      <div style={S.app}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} button:hover{opacity:0.88;transform:translateY(-1px)} @keyframes slideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <Confetti active={showConfetti} />
        <div style={S.center}>
          <div style={{ ...S.card, animation: "slideIn 0.4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>
                {pct >= 90 ? "🏆" : pct >= 70 ? "🎉" : pct >= 50 ? "👍" : "💪"}
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, color: grade.color }}>
                {grade.label}
              </h2>
              <p style={{ color: "#9CA3AF" }}>Quiz complete!</p>
            </div>

            {/* Score */}
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 28, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <ProgressRing value={score} max={questions.length} size={90} color={grade.color} label={`${score}/${questions.length}`} />
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Score</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <ProgressRing value={pct} max={100} size={90} color={COLORS.violet} label={`${pct}%`} />
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Accuracy</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <ProgressRing
                  value={answers.filter(a => a.selected === null).length === 0 ? questions.length : questions.length - answers.filter(a => a.selected === null).length}
                  max={questions.length} size={90} color={COLORS.sky}
                  label={`${answers.filter(a => a.selected !== null).length}/${questions.length}`}
                />
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Answered</div>
              </div>
            </div>

            {/* Per-question review */}
            <div style={{ marginBottom: 24 }}>
              <label style={S.label}>QUESTION REVIEW</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                {questions.map((q, i) => {
                  const ans = answers[i];
                  const correct = ans?.selected === ans?.correct;
                  const skipped = ans?.selected === null;
                  return (
                    <div key={i} style={{
                      background: "#0F0A1E", borderRadius: 10, padding: "10px 14px",
                      border: `1px solid ${skipped ? COLORS.amber : correct ? COLORS.emerald : COLORS.rose}44`,
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>
                        {skipped ? "⏰" : correct ? "✅" : "❌"}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{q.question}</div>
                        {!correct && !skipped && (
                          <div style={{ fontSize: 11, color: COLORS.emerald, marginTop: 3 }}>
                            ✓ {q.correct}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={startAttempt}
                style={{ ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`, false), flex: 2, padding: "12px" }}>
                🔁 Retry Quiz
              </button>
              <button onClick={downloadPDF}
                style={{ ...S.btn("transparent", false), flex: 1, padding: "12px", border: `1px solid ${COLORS.emerald}55`, color: COLORS.emerald }}>
                📄 PDF
              </button>
              <button onClick={() => setScreen("share")}
                style={{ ...S.btn("transparent", false), flex: 1, padding: "12px", border: `1px solid ${COLORS.sky}55`, color: COLORS.sky }}>
                🔗 Share
              </button>
            </div>
            <button onClick={() => { setScreen("home"); setQuestions([]); setNotes(""); }}
              style={{ ...S.btn("transparent", true), color: "#6B7280", marginTop: 10, fontSize: 13 }}>
              ← Make a new quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SHARE SCREEN
  if (screen === "share") return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} button:hover{opacity:0.88;transform:translateY(-1px)}`}</style>
      <div style={S.center}>
        <div style={S.card}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>Share This Quiz</h2>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>
              Anyone with this link can attempt the quiz — perfect for teachers sharing with students.
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>SHAREABLE LINK</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={shareUrl}
                style={{ ...S.input, fontSize: 12, flex: 1 }} />
              <button onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                style={{ ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`, false), padding: "12px 16px", flexShrink: 0 }}>
                Copy
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
              ℹ️ The entire quiz is encoded in the URL — no server needed.
            </div>
          </div>

          <div style={{ background: "#0F0A1E", borderRadius: 12, padding: "16px", marginBottom: 24, border: `1px solid ${COLORS.cardBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#9CA3AF" }}>QUIZ SUMMARY</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>📝 <strong>{questions.length}</strong> questions</div>
              <div>{DIFFICULTY_CONFIG[questions[0]?.difficulty || difficulty]?.emoji} <strong>{questions[0]?.difficulty || difficulty}</strong></div>
              <div>🏷 <strong>{questions[0]?.topic || topic || "General"}</strong></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={startAttempt}
              style={{ ...S.btn(`linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`, false), flex: 2, padding: "13px" }}>
              🚀 Attempt Quiz
            </button>
            <button onClick={downloadPDF}
              style={{ ...S.btn("transparent", false), flex: 1, padding: "13px", border: `1px solid ${COLORS.emerald}55`, color: COLORS.emerald }}>
              📄 PDF
            </button>
          </div>
          {questions.length > 0 && screen === "share" && (
            <button onClick={() => setScreen("quiz")}
              style={{ ...S.btn("transparent", true), color: "#6B7280", marginTop: 10, fontSize: 13 }}>
              ← Back to quiz preview
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return null;
}