"use client";

import Link from "next/link";
import { Upload, MessageSquareText } from "lucide-react";

interface TopbarProps {
  page: string;
}

export function Topbar({ page }: TopbarProps) {
  return (
    <div
      style={{
        height: 44,
        background: "var(--s1)",
        borderBottom: "1px solid var(--b0)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 10,
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="topbar-crumb" style={{ fontSize: 12.5, color: "var(--t3)" }}>sellingmy.casa</span>
        <span className="topbar-crumb" style={{ fontSize: 12.5, color: "var(--t3)" }}>/</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--t1)" }}>{page}</span>
      </div>

      {/* Right buttons */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Link
          href="/import"
          className="topbar-secondary"
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "0 10px",
            borderRadius: 6,
            border: "1px solid var(--b2)",
            background: "transparent",
            color: "var(--t2)",
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          <Upload size={12} />
          Import
        </Link>

        <Link
          href="/leads"
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "0 12px",
            borderRadius: 6,
            background: "var(--g)",
            color: "var(--on-g)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            transition: "all 0.12s",
          }}
        >
          <MessageSquareText size={12} />
          Text leads
        </Link>
      </div>
    </div>
  );
}
