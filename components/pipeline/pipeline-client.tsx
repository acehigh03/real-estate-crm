"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import type { PipelineLeadCard, PipelineStage } from "@/lib/data";
import { updatePipelineStage } from "@/app/actions";
import { leadDisplayName, streetOnly, messageSnippet } from "@/lib/utils";

// ── Column definitions ────────────────────────────────────────────────────────
// Maps user-visible label → internal PipelineStage used by derivePipelineStage()

interface Column {
  label: string;
  stage: PipelineStage;
  accent: string;
}

const COLUMNS: Column[] = [
  { label: "New",            stage: "New Leads",  accent: "var(--t3)"  },
  { label: "Contacted",      stage: "Contacted",  accent: "var(--blu)" },
  { label: "Warm",           stage: "Replied",    accent: "var(--amb)" },
  { label: "Offer Sent",     stage: "Offer Sent", accent: "var(--pur)" },
  { label: "Under Contract", stage: "Qualified",  accent: "var(--g)"   },
];

// Maps PipelineStage → the string value updatePipelineStage() expects
const STAGE_ACTION: Record<PipelineStage, string> = {
  "New Leads":  "New Leads",
  "Contacted":  "Contacted",
  "Replied":    "Replied",
  "Qualified":  "Qualified",
  "Offer Sent": "Offer Sent",
  "Dead":       "Dead",
};

// ── Classification badge ──────────────────────────────────────────────────────

const CLASS_STYLES: Record<string, { bg: string; color: string }> = {
  HOT:     { bg: "var(--redd)", color: "var(--red)" },
  WARM:    { bg: "var(--ambd)", color: "var(--amb)" },
  COLD:    { bg: "var(--blud)", color: "var(--blu)" },
  DEAD:    { bg: "var(--b1)",   color: "var(--t3)"  },
  OPT_OUT: { bg: "var(--purd)", color: "var(--pur)" },
};

function ClassBadge({ cls }: { cls: string }) {
  const s = CLASS_STYLES[cls];
  if (!s || cls === "UNKNOWN") return null;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "1px 5px",
        borderRadius: 3,
        background: s.bg,
        color: s.color,
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}
    >
      {cls === "OPT_OUT" ? "STOP" : cls}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PipelineClientProps {
  cards: PipelineLeadCard[];
}

export function PipelineClient({ cards: initialCards }: PipelineClientProps) {
  const [cards, setCards] = useState(initialCards);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PipelineStage | null>(null);
  const [, startTransition] = useTransition();

  function cardsForStage(stage: PipelineStage) {
    return cards.filter((c) => c.stage === stage);
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDrop(targetStage: PipelineStage) {
    if (!draggingId) return;
    const card = cards.find((c) => c.lead.id === draggingId);
    setDraggingId(null);
    setDropTarget(null);

    if (!card || card.stage === targetStage) return;

    // Optimistic update
    setCards((prev) =>
      prev.map((c) =>
        c.lead.id === draggingId ? { ...c, stage: targetStage } : c
      )
    );

    // Server action
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", card.lead.id);
      fd.set("stage", STAGE_ACTION[targetStage]);
      try {
        await updatePipelineStage(fd);
      } catch (err) {
        console.error("pipeline stage update failed", err);
        // Revert
        setCards((prev) =>
          prev.map((c) =>
            c.lead.id === card.lead.id ? { ...c, stage: card.stage } : c
          )
        );
      }
    });
  }

  const totalCards = cards.length;

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
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", flex: 1 }}>
          Pipeline
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--t3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {totalCards} lead{totalCards !== 1 ? "s" : ""}
        </span>
        <Link
          href="/import"
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "5px 12px",
            borderRadius: 6,
            background: "var(--s2)",
            color: "var(--t2)",
            border: "1px solid var(--b1)",
            textDecoration: "none",
          }}
        >
          Import CSV
        </Link>
      </div>

      {/* Kanban board */}
      <div
        style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "16px 20px",
        }}
      >
        {totalCards === 0 ? (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: "var(--s1)",
                border: "1px solid var(--b1)",
                borderRadius: 12,
                padding: "40px 32px",
                textAlign: "center",
                maxWidth: 360,
              }}
            >
              <div
                style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}
              >
                No leads in pipeline
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
                Import a CSV or add leads to start tracking deals.
              </div>
              <Link
                href="/import"
                style={{
                  display: "inline-block",
                  padding: "7px 16px",
                  borderRadius: 6,
                  background: "var(--t1)",
                  color: "var(--bg)",
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Import CSV
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 12,
              height: "100%",
              minWidth: `${COLUMNS.length * 268}px`,
            }}
          >
            {COLUMNS.map((col) => {
              const colCards = cardsForStage(col.stage);
              const isOver = dropTarget === col.stage;

              return (
                <div
                  key={col.stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(col.stage);
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={() => handleDrop(col.stage)}
                  style={{
                    width: 256,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    background: isOver ? "var(--s2)" : "var(--s1)",
                    borderRadius: 10,
                    border: isOver
                      ? `1px solid ${col.accent}`
                      : "1px solid var(--b1)",
                    overflow: "hidden",
                    transition: "border-color 0.12s, background 0.12s",
                  }}
                >
                  {/* Column header */}
                  <div
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--b1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 12,
                        borderRadius: 2,
                        background: col.accent,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--t1)",
                        flex: 1,
                      }}
                    >
                      {col.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--t3)",
                        background: "var(--s2)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {colCards.length}
                    </span>
                  </div>

                  {/* Cards scroll area */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {colCards.length === 0 ? (
                      <div
                        style={{
                          padding: "20px 10px",
                          textAlign: "center",
                          color: "var(--t3)",
                          fontSize: 11.5,
                          border: "1px dashed var(--b2)",
                          borderRadius: 8,
                        }}
                      >
                        Drop leads here
                      </div>
                    ) : (
                      colCards.map(({ lead, lastMessagePreview, campaignName }) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead.id)}
                          onDragEnd={handleDragEnd}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background:
                              draggingId === lead.id ? "var(--s3)" : "var(--s2)",
                            border: "1px solid var(--b1)",
                            cursor: "grab",
                            opacity: draggingId === lead.id ? 0.45 : 1,
                            transition: "opacity 0.12s",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 6,
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 500,
                                fontSize: 12.5,
                                color: "var(--t1)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {leadDisplayName(lead)}
                            </div>
                            <ClassBadge cls={lead.classification} />
                          </div>

                          {lead.property_address && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--t3)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginBottom: 5,
                              }}
                            >
                              {streetOnly(lead.property_address)}
                            </div>
                          )}

                          {lastMessagePreview && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--t3)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                borderTop: "1px solid var(--b0)",
                                paddingTop: 5,
                                marginTop: 4,
                              }}
                            >
                              {messageSnippet(lastMessagePreview, 48)}
                            </div>
                          )}

                          {!lastMessagePreview && campaignName && (
                            <div
                              style={{
                                fontSize: 10.5,
                                color: "var(--t3)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                borderTop: "1px solid var(--b0)",
                                paddingTop: 5,
                                marginTop: 4,
                              }}
                            >
                              {campaignName}
                            </div>
                          )}

                          <div style={{ marginTop: 8 }}>
                            <Link
                              href={`/leads/${lead.id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: 10.5,
                                color: "var(--t3)",
                                textDecoration: "none",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              View →
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
