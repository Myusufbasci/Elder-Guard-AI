"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ArrowLeft, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import {
  formatScoresToChartPoints,
  classifyRiskLevel,
  getRiskColor,
} from "@/lib/dashboard-helpers";
import type { AnomalyScoreRecord } from "@/lib/dashboard-helpers";

/**
 * Elder Detail View — /dashboard/elder/[id]
 * Shows 7-day anomaly score trend chart + recent readings.
 */
export default function ElderDetailPage() {
  const params = useParams();
  const elderId = params.id as string;

  const [scores, setScores] = useState<AnomalyScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Real-time Firestore listener for this elder's scores ──
  useEffect(() => {
    if (!elderId) return;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const q = query(
      collection(db, COLLECTIONS.anomalyScores),
      where("elderId", "==", elderId),
      where("computedAt", ">=", sevenDaysAgo),
      orderBy("computedAt", "desc"),
      limit(500)
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
        console.error("[ElderDetail] Firestore listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [elderId]);

  // ── Derived data ──
  const chartData = useMemo(
    () => formatScoresToChartPoints(scores, 7),
    [scores]
  );

  const latestScore = scores.length > 0 ? scores[0]?.score ?? 0 : 0;
  const avgScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 10
        ) / 10
      : 0;
  const maxScore =
    scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0;
  const riskLevel = classifyRiskLevel(latestScore);

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Risk Matrix
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Elder {elderId.slice(0, 12)}…
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            7-day anomaly score trend and history
          </p>
        </div>
        <span
          className="inline-flex px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider"
          style={{
            color: getRiskColor(riskLevel),
            backgroundColor: `${getRiskColor(riskLevel)}15`,
          }}
        >
          {riskLevel}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Latest Score
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: getRiskColor(riskLevel) }}
          >
            {loading ? "—" : latestScore}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              7d Average
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-200">
            {loading ? "—" : avgScore}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Peak Score
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: getRiskColor(classifyRiskLevel(maxScore)) }}
          >
            {loading ? "—" : maxScore}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          Anomaly Score Trend (7 Days)
        </h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : chartData.length < 2 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-slate-500">
              Insufficient data for chart. Needs at least 2 days of data.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                }}
              />
              <ReferenceLine
                y={80}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: "Critical",
                  position: "insideTopRight",
                  fill: "#ef4444",
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                y={50}
                stroke="#eab308"
                strokeDasharray="3 3"
                label={{
                  value: "Warning",
                  position: "insideTopRight",
                  fill: "#eab308",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ fill: "#0ea5e9", r: 4 }}
                activeDot={{ r: 6, fill: "#0ea5e9" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Scores Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            Recent Scores ({scores.length})
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Sensor Reading
              </th>
            </tr>
          </thead>
          <tbody>
            {scores.slice(0, 20).map((s, i) => {
              const level = classifyRiskLevel(s.score);
              return (
                <tr
                  key={`${s.sensorReadingId}-${i}`}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-3 text-sm text-slate-300">
                    {new Date(s.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="text-sm font-bold"
                      style={{ color: getRiskColor(level) }}
                    >
                      {s.score}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase"
                      style={{
                        color: getRiskColor(level),
                        backgroundColor: `${getRiskColor(level)}15`,
                      }}
                    >
                      {level}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500 font-mono">
                    {s.sensorReadingId.slice(0, 16)}…
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
