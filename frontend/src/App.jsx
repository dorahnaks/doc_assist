import { useState, useRef } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (selectedFile) => {
    setError(null);
    setResult(null);

    if (!selectedFile) return;

    const allowed = ["application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"
    ];
    const name = selectedFile.name.toLowerCase();
    if (!allowed.includes(selectedFile.type) && !name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("Please upload a PDF or Word (.docx) file only.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    handleFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 90000); // 90 seconds

    try {
      const response = await fetch(`${API_URL}/api/analyze/`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setResult(data);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        setError("The document is too large and timed out. Try a smaller document or wait and try again.");
      } else {
        setError("Could not connect to the server. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#4F46E5" />
              <path d="M8 8h12M8 12h12M8 16h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>DocAssist</span>
          </div>
          <p className="header-sub">AI-powered document analysis</p>
        </div>
      </header>

      <main className="main">
        {!result ? (
          <div className="upload-section">
            <h1 className="title">Analyze your document</h1>
            <p className="subtitle">Upload a PDF or Word file and get an instant AI-powered summary, key points, and more.</p>

            {/* Drop Zone */}
            <div
              className={`dropzone ${dragOver ? "dragover" : ""} ${file ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="file-info">
                  <div className="file-icon">
                    {file.name.endsWith(".pdf") ? "📄" : "📝"}
                  </div>
                  <div>
                    <p className="file-name">{file.name}</p>
                    <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <div className="drop-hint">
                  <div className="drop-icon">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <path d="M20 8v16M12 16l8-8 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 28h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="drop-text">Drop your file here or <span>browse</span></p>
                  <p className="drop-sub">Supports PDF and Word (.docx) — max 10MB</p>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="error-box">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="btn-row">
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!file || loading}
              >
                {loading ? (
                  <><span className="spinner" /> Analyzing... please wait</>
                ) : (
                  "Analyze document"
                )}
              </button>
              {file && (
                <button className="btn-ghost" onClick={handleReset}>
                  Clear
                </button>
              )}
            </div>
            {loading && (
              <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                Large documents may take up to 60 seconds to analyze.
              </p>
            )}
          </div>
        ) : (
          <div className="results-section">
            <div className="results-header">
              <div>
                <h2 className="results-title">Analysis complete</h2>
                <p className="results-meta">{result.filename} · {result.word_count} words</p>
              </div>
              <button className="btn-ghost" onClick={handleReset}>
                Analyze another
              </button>
            </div>

            <div className="cards-grid">
              {/* Document info */}
              <div className="card card-wide">
                <div className="card-label">Document</div>
                <div className="card-badge">{result.result.document_type}</div>
                <h3 className="card-title">{result.result.title}</h3>
                {result.result.author !== "Not mentioned" && (
                  <p className="card-author">by {result.result.author}</p>
                )}
              </div>

              {/* Summary */}
              <div className="card card-wide">
                <div className="card-label">Summary</div>
                <div className="summary-text">
                  {result.result.summary
                    .split('\n\n')
                    .filter(p => p.trim())
                    .map((paragraph, i) => (
                      <p key={i} style={{ marginBottom: '12px', lineHeight: '1.8', color: '#444', fontSize: '15px' }}>
                        {paragraph.trim()}
                      </p>
                    ))
                  }
                </div>
              </div>

              {/* Key points */}
              <div className="card card-wide">
                <div className="card-label">Key points</div>
                <ul className="points-list">
                  {result.result.main_points.map((point, i) => (
                    <li key={i} className="point-item">
                      <span className="point-num">{i + 1}</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key terms */}
              {result.result.key_terms && (
                <div className="card card-wide">
                  <div className="card-label">Key terms</div>
                  <div className="terms-wrap">
                    {result.result.key_terms.map((term, i) => (
                      <span key={i} className="term-badge">{term}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conclusion */}
              {result.result.conclusion && (
                <div className="card card-wide conclusion-card">
                  <div className="card-label">Conclusion</div>
                  <p className="card-text">{result.result.conclusion}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Made by Dorothy N
      </footer>
    </div>
  );
}