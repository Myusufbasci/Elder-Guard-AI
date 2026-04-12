"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";
import {
  AlertTriangle,
  Download,
  Filter,
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  aggregateElderRisks,
  filterByRiskLevel,
  formatRiskMatrixCsv,
  downloadCsv,
  getRiskColor,
} from "@/lib/dashboard-helpers";
import type { AnomalyScoreRecord, ElderRiskRow } from "@/lib/dashboard-helpers";

const PAGE_SIZE = 20;

/**
 * Risk Matrix — Enterprise Dashboard main page.
 * Real-time Firestore subscription to anomalyScores.
 * Sorted by risk (descending), paginated, filterable.
 */
export default function RiskMatrixPage() {
  const [scores, setScores] = useState<AnomalyScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<
    "all" | "critical" | "warning" | "safe"
  >("all");
  const [currentPage, setCurrentPage] = useState(0);

  // Mock elder names (in production, fetched from elders collection)
  const [elderNames] = useState<Record<string, string>>({});

  // ── Real-time Firestore listener ──
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.anomalyScores),
      orderBy("computedAt", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: AnomalyScoreRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            sensorReadingId: data.sensorReadingId as string,
            elderId: data.elderId as string,
            score: data.score as number,
            normalizedScore: data.normalizedScore as number,
            timestamp: data.timestamp as number,
            computedAt: data.computedAt as number,
          };
        });
        setScores(docs);
        setLoading(false);
      },
      (error) => {
        console.error("[RiskMatrix] Firestore listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── Derived data ──
  const allRows = useMemo(
    () => aggregateElderRisks(scores, elderNames),
    [scores, elderNames]
  );

  const filteredRows = useMemo(
    () => filterByRiskLevel(allRows, riskFilter),
    [allRows, riskFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // Stats
  const criticalCount = allRows.filter((r) => r.riskLevel === "critical").length;
  const warningCount = allRows.filter((r) => r.riskLevel === "warning").length;
  const safeCount = allRows.filter((r) => r.riskLevel === "safe").length;

  const handleExportCsv = () => {
    const csv = formatRiskMatrixCsv(filteredRows);
    const date = new Date().toISOString().split("T")[0];
    downloadCsv(csv, `elder-guard-risk-matrix-${date}.csv`);
  };

  const handleFilterChange = (
    level: "all" | "critical" | "warning" | "safe"
  ) => {
    setRiskFilter(level);
    setCurrentPage(0);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Matrix</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time anomaly monitoring across all elders
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
              Critical
            </span>
          </div>
          <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400 uppercase tracking-wider">
              Warning
            </span>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{warningCount}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              Safe
            </span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{safeCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-slate-500" />
        {(["all", "critical", "warning", "safe"] as const).map((level) => (
          <button
            key={level}
            onClick={() => handleFilterChange(level)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              riskFilter === level
                ? "bg-sky-500 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Elder
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Risk Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Risk Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Readings
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Last Activity
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto" />
                  <p className="mt-3 text-sm text-slate-400">
                    Loading data...
                  </p>
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <p className="text-slate-400">No elders found.</p>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row: ElderRiskRow) => (
                <tr
                  key={row.elderId}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-white">
                      {row.elderName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {row.elderId.slice(0, 12)}…
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="text-lg font-bold"
                      style={{ color: getRiskColor(row.riskLevel) }}
                    >
                      {row.latestScore}
                    </span>
                    <span className="text-xs text-slate-500">/100</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                      style={{
                        color: getRiskColor(row.riskLevel),
                        backgroundColor: `${getRiskColor(row.riskLevel)}15`,
                      }}
                    >
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {row.readingCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(row.lastActivityAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/elder/${row.elderId}`}
                      className="text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Page {currentPage + 1} of {totalPages} ({filteredRows.length}{" "}
              results)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
