import { useEffect, useMemo, useState } from "react";
import axios from "axios";

function Chip({ text, variant = "neutral" }) {
  const styles =
    variant === "good"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : variant === "bad"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${styles}`}
    >
      {text}
    </span>
  );
}

function ScoreCard({ score }) {
  const tone =
    score >= 75
      ? "bg-emerald-50 ring-emerald-200 text-emerald-800"
      : score >= 50
      ? "bg-amber-50 ring-amber-200 text-amber-800"
      : "bg-rose-50 ring-rose-200 text-rose-800";

  return (
    <div className={`rounded-2xl p-5 ring-1 ${tone}`}>
      <p className="text-sm font-medium">Match score</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-4xl font-semibold">{score}</span>
        <span className="pb-1 text-sm opacity-80">/ 100</span>
      </div>
      <p className="mt-2 text-sm opacity-80">
        This is a semantic similarity score (embeddings) + skills gap.
      </p>
    </div>
  );
}

export default function App() {
  const API_BASE = import.meta.env.VITE_API_URL;

  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);

  // NEW: Job meta fields (A)
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");

  // History (B)
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const jdCharCount = useMemo(() => jobDescription.length, [jobDescription]);

  function persistHistory(next) {
    setHistory(next);
    localStorage.setItem("aiCareerCopilotHistory", JSON.stringify(next));
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aiCareerCopilotHistory");
      if (raw) {
        const parsed = JSON.parse(raw);
        setHistory(parsed);
        if (parsed.length > 0) setSelectedId(parsed[0].id);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // Pick which result to render: selected history item > current in-memory result
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return history.find((h) => h.id === selectedId) || null;
  }, [history, selectedId]);

  const activeResult = selected ? selected.result : result;

  const recs = activeResult?.recommendations || [];
  const visibleRecs = showAllRecs ? recs : recs.slice(0, 3);

  const handleAnalyze = async () => {
    if (!resumeFile) {
      alert("Please upload a resume PDF first.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("job_description", jobDescription);

      const response = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = response.data;
      setResult(data);

      // Save run to history (now includes jobTitle + company)
      const item = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        filename: resumeFile?.name || "resume.pdf",
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        jdPreview: (jobDescription || "").slice(0, 120),
        result: data,
      };

      const next = [item, ...history].slice(0, 15);
      persistHistory(next);
      setSelectedId(item.id);
      setShowAllRecs(false);
    } catch (err) {
      console.error(err);
      alert("Error calling backend. Check backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResumeFile(null);
    setJobDescription("");
    setResult(null);
    setShowAllRecs(false);

    // Reset the new fields too
    setJobTitle("");
    setCompany("");

    // fall back to latest saved analysis (if any)
    if (history.length > 0) setSelectedId(history[0].id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              AI Career Copilot
            </h1>
            <p className="text-sm text-slate-500">
              Upload your resume and paste a job description to get a semantic
              match score, skills gap analysis, and tailored recommendations.
            </p>
          </div>
          <span className="text-xs rounded-full bg-slate-100 px-3 py-1 text-slate-600">
          AI Powered • Resume Analyzer
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8 grid gap-6 lg:grid-cols-2">
        {/* Inputs Card */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-lg font-semibold">Inputs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start by uploading a PDF resume and pasting a job description.
          </p>

          {/* File upload */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">
              Resume (PDF)
            </label>

            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer">
                <span>Choose file</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">
                  {resumeFile ? resumeFile.name : "No file selected"}
                </p>
                <p className="text-xs text-slate-500">PDF only</p>
              </div>
            </div>
          </div>

          {/* NEW: Job Title + Company */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g., Software Engineer II"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., AvidXchange"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* Job description */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Job Description
              </label>
              <span className="text-xs text-slate-500">{jdCharCount} chars</span>
            </div>

            <textarea
              rows={10}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm outline-none focus:border-slate-400"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job description here..."
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>

            <button
              onClick={handleReset}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>

          {/* Tip */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Tip:</span> Use the exact job
              description you’re applying to. For each key tool in the JD, add
              one bullet that shows what you built + how + measurable result
              (time saved, performance, scale).
            </p>
          </div>
        </section>

        {/* Results Card */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Results</h2>
            </div>
          </div>

          {/* History dropdown */}
          {history.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={selectedId || ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {history.map((h) => {
                  const labelTitle = h.jobTitle ? h.jobTitle : "Untitled role";
                  const labelCompany = h.company ? ` @ ${h.company}` : "";
                  const score =
                    h.result?.match_score != null
                      ? `${h.result.match_score}/100`
                      : "—";
                  const when = new Date(h.createdAt).toLocaleString();

                  return (
                    <option key={h.id} value={h.id}>
                      {when} — {labelTitle}
                      {labelCompany} — {score}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => {
                  persistHistory([]);
                  setSelectedId(null);
                  setResult(null);
                  setShowAllRecs(false);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear history
              </button>
            </div>
          )}

          {!activeResult && !loading && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No results yet. Upload a resume and click{" "}
              <span className="font-medium text-slate-700">Analyze</span>.
            </div>
          )}

          {loading && (
            <div className="mt-6 space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          )}

          {activeResult && !activeResult.error && (
            <div className="mt-6 space-y-5">
              <ScoreCard score={activeResult.match_score ?? 0} />

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Keywords present
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Top keywords from the job description that appear in your
                  resume.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(activeResult.skills_present || []).length === 0 ? (
                    <span className="text-sm text-slate-500">
                      No matches found yet.
                    </span>
                  ) : (
                    activeResult.skills_present.map((k) => (
                      <Chip key={`p-${k}`} text={k} variant="good" />
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Keywords missing
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {(activeResult.skills_missing || []).length > 0
                    ? "Consider adding these if they truly match your experience."
                    : "Nice — no key missing skills detected from our checklist."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(activeResult.skills_missing || []).length === 0 ? (
                    <Chip text="No obvious gaps found 🎉" variant="good" />
                  ) : (
                    activeResult.skills_missing.map((k) => (
                      <Chip key={`m-${k}`} text={k} variant="bad" />
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Recommendations
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Recommendations are generated from scoring + detected skill
                  gaps. Only add skills you can confidently discuss in
                  interviews.
                </p>

                <ul className="mt-3 space-y-2">
                  {visibleRecs.map((r, idx) => (
                    <li
                      key={`rec-${idx}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                    >
                      <span className="font-semibold text-slate-900">
                        #{idx + 1}.
                      </span>{" "}
                      {r}
                    </li>
                  ))}
                </ul>

                {recs.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRecs((v) => !v)}
                    className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {showAllRecs ? "Show less" : `Show more (${recs.length - 3})`}
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">{activeResult.message}</p>
              </div>
            </div>
          )}

          {activeResult && activeResult.error && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-800">Error</p>
              <p className="mt-1 text-sm text-rose-700">{activeResult.error}</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <p className="text-xs text-slate-500">
          Built with React + FastAPI + Tailwind. Includes PDF text extraction,
          embeddings similarity scoring, skills gap, recommendations, and saved
          analysis history.
        </p>
      </footer>
    </div>
  );
}