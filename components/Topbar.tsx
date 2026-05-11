"use client";

import Link from "next/link";
import { Search, Upload, MessageSquareText } from "lucide-react";

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
        <span style={{ fontSize: 12.5, color: "var(--t3)" }}>sellingmy.casa</span>
        <span style={{ fontSize: 12.5, color: "var(--t3)" }}>/</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--t1)" }}>{page}</span>
      </div>

      {/* Telnyx pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--gd)",
          border: "1px solid var(--gb)",
          borderRadius: 5,
          padding: "3px 9px",
          marginLeft: 8,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--g)",
            flexShrink: 0,
            animation: "pulse 2.4s infinite",
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--g)",
          }}
        >
          +1 (713) 565-0807
        </span>
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
        <button
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
            cursor: "pointer",
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--s2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <Search size={12} />
          Search
        </button>

        <button
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
            cursor: "pointer",
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--s2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <Upload size={12} />
          Import
        </button>

        <Link
          href="/leads"
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "0 12px",
            borderRadius: 6,
            background: "var(--t1)",
            color: "var(--bg)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            transition: "all 0.12s",
          }}
        >
          <MessageSquareText size={12} />
          Blast SMS
        </Link>
      </div>
    </div>
  );
}
