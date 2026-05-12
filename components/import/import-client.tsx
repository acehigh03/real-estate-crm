"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X, Check, AlertCircle } from "lucide-react";

import { parseLeadCsv, type CsvLeadRow } from "@/lib/csv/parse-leads";

interface ImportClientProps {
  campaigns: { id: string; name: string }[];
}

interface ImportResult {
  imported: number;
  messaged: number;
  queued: number;
  skipped: number;
}

const PREVIEW_COLS: { key: keyof CsvLeadRow; label: string }[] = [
  { key: "first_name",       label: "first_name"       },
  { key: "last_name",        label: "last_name"         },
  { key: "phone_normalized", label: "phone"             },
  { key: "property_address", label: "property_address"  },
  { key: "status",           label: "status"            },
];

const COL_MAPPINGS: { csv: string; db: string }[] = [
  { csv: "first_name",       db: "leads.first_name"       },
  { csv: "last_name",        db: "leads.last_name"         },
  { csv: "phone",            db: "leads.phone"             },
  { csv: "property_address", db: "leads.property_address"  },
  { csv: "status",           db: "leads.status"            },
  { csv: "email",            db: "leads.email"             },
  { csv: "lead_source",      db: "leads.lead_source"       },
  { csv: "tag",              db: "leads.tag"               },
  { csv: "notes",            db: "leads.notes_summary"     },
  { csv: "mailing_address",  db: "leads.mailing_address"   },
];

export function ImportClient({ campaigns }: ImportClientProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvLeadRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setCsvError(null);
    setResult(null);
    setPreview([]);
    try {
      const text = await f.text();
      const { rows, skippedCount } = parseLeadCsv(text);
      setPreview(rows.slice(0, 20));
      if (rows.length === 0) {
        setCsvError(
          skippedCount > 0
            ? `All ${skippedCount} rows were skipped (missing phone numbers).`
            : "No valid rows found. Make sure the CSV has a \"phone\" column."
        );
      }
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "CSV parsing failed");
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.toLowerCase().endsWith(".csv")) {
      handleFile(f);
    } else if (f) {
      setCsvError("Only .csv files are supported.");
    }
  }

  async function handleImport() {
    if (!file || preview.length === 0) return;
    setImporting(true);
    setCsvError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (campaignId) fd.append("campaign_id", campaignId);

      const res = await fetch("/api/upload-csv", { method: "POST", body: fd });
      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Import failed");
      }

      setResult({
        imported: Number(data.imported ?? 0),
        messaged: Number(data.messaged ?? 0),
        queued:   Number(data.queued   ?? 0),
        skipped:  Number(data.skipped  ?? 0),
      });
      setFile(null);
      setPreview([]);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function clearFile() {
    setFile(null);
    setPreview([]);
    setCsvError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--s1)",
          borderBottom: "1px solid var(--b1)",
          padding: "12px 20px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>
          Import CSV
        </div>
        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>
          Required columns: first_name, last_name, phone, property_address
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Success result */}
          {result && (
            <div
              style={{
                background: "var(--gd)",
                border: "1px solid var(--gb)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Check size={15} style={{ color: "var(--g)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--g)" }}>
                  Import complete
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  fontSize: 12,
                  color: "var(--t2)",
                  fontFamily: "var(--font-mono)",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  Imported:{" "}
                  <strong style={{ color: "var(--t1)" }}>{result.imported}</strong>
                </span>
                <span>
                  Messaged:{" "}
                  <strong style={{ color: "var(--t1)" }}>{result.messaged}</strong>
                </span>
                {result.queued > 0 && (
                  <span>
                    Queued:{" "}
                    <strong style={{ color: "var(--t1)" }}>{result.queued}</strong>
                  </span>
                )}
                <span>
                  Skipped:{" "}
                  <strong style={{ color: "var(--t1)" }}>{result.skipped}</strong>
                </span>
              </div>
              <button
                onClick={() => setResult(null)}
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--t3)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Import another file
              </button>
            </div>
          )}

          {/* Campaign selector */}
          {!result && campaigns.length > 0 && (
            <div
              style={{
                background: "var(--s1)",
                border: "1px solid var(--b1)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--t2)",
                  marginBottom: 8,
                }}
              >
                Assign to Campaign{" "}
                <span style={{ color: "var(--t3)", fontWeight: 400 }}>(optional)</span>
              </div>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--b1)",
                  background: "var(--s2)",
                  color: "var(--t1)",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="">No campaign — import only</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Drop zone */}
          {!result && !file && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--g)" : "var(--b2)"}`,
                borderRadius: 12,
                padding: "44px 20px",
                textAlign: "center",
                background: dragOver ? "var(--gd)" : "var(--s1)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <Upload
                size={28}
                style={{
                  color: dragOver ? "var(--g)" : "var(--t3)",
                  margin: "0 auto 10px",
                  display: "block",
                  transition: "color 0.15s",
                }}
              />
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--t1)",
                  marginBottom: 5,
                }}
              >
                Drop a CSV file here or click to browse
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>
                Supports: first_name, last_name, phone, property_address, status,
                email, lead_source, tag, notes
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}

          {/* File selected indicator */}
          {!result && file && (
            <div
              style={{
                background: "var(--s1)",
                border: "1px solid var(--b1)",
                borderRadius: 10,
                padding: "11px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FileText size={15} style={{ color: "var(--blu)", flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "var(--t1)",
                  fontFamily: "var(--font-mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file.name}
              </span>
              {preview.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--t3)",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {preview.length} rows parsed
                </span>
              )}
              <button
                onClick={clearFile}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--t3)",
                  padding: 2,
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Error */}
          {csvError && (
            <div
              style={{
                background: "var(--redd)",
                border: "1px solid var(--redb)",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <AlertCircle
                size={14}
                style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ fontSize: 12.5, color: "var(--red)" }}>{csvError}</span>
            </div>
          )}

          {/* Column mapping */}
          {preview.length > 0 && (
            <div
              style={{
                background: "var(--s1)",
                border: "1px solid var(--b1)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--b1)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--t2)",
                }}
              >
                Column Mapping
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {COL_MAPPINGS.map((m) => (
                  <div
                    key={m.csv}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "var(--s2)",
                      border: "1px solid var(--b1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span
                      style={{ color: "var(--t3)", fontFamily: "var(--font-mono)" }}
                    >
                      {m.csv}
                    </span>
                    <span style={{ color: "var(--b3)" }}>→</span>
                    <span
                      style={{
                        color: "var(--g)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                      }}
                    >
                      {m.db}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div
              style={{
                background: "var(--s1)",
                border: "1px solid var(--b1)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--b1)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--t2)",
                    flex: 1,
                  }}
                >
                  Preview
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--t3)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {preview.length} rows
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                >
                  <thead>
                    <tr style={{ background: "var(--s2)" }}>
                      {PREVIEW_COLS.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            padding: "7px 12px",
                            textAlign: "left",
                            fontSize: 10,
                            fontWeight: 500,
                            color: "var(--t3)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            fontFamily: "var(--font-mono)",
                            borderBottom: "1px solid var(--b1)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid var(--b0)" }}
                      >
                        {PREVIEW_COLS.map((col) => (
                          <td
                            key={col.key}
                            style={{
                              padding: "6px 12px",
                              color:
                                col.key === "status"
                                  ? "var(--t3)"
                                  : col.key === "phone_normalized"
                                  ? "var(--t2)"
                                  : "var(--t1)",
                              fontFamily:
                                col.key === "phone_normalized" ||
                                col.key === "status"
                                  ? "var(--font-mono)"
                                  : "inherit",
                              fontSize:
                                col.key === "phone_normalized" ||
                                col.key === "status"
                                  ? 11
                                  : 12,
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {String(row[col.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import button */}
          {file && preview.length > 0 && !csvError && (
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                padding: "10px 20px",
                borderRadius: 7,
                background: importing ? "var(--s3)" : "var(--g)",
                color: importing ? "var(--t3)" : "#000",
                fontWeight: 600,
                fontSize: 13,
                border: "none",
                cursor: importing ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                alignSelf: "flex-start",
              }}
            >
              {importing
                ? "Importing…"
                : `Import ${preview.length} lead${preview.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
