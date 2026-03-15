"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";

type MoodOption = "Calm" | "Happy" | "Irritable" | "Energetic" | "Outburst";

type DailyLogRow = {
  log_date: string;
  sleep_quality: number | null;
  morning_mood: MoodOption | null;
};

type ChartRow = {
  date: string;
  sleepQuality: number | null;
  morningMoodLabel: MoodOption | null;
  morningMoodScore: number | null;
};

const moodScoreMap: Record<MoodOption, number> = {
  Calm: 1,
  Happy: 2,
  Energetic: 3,
  Irritable: 4,
  Outburst: 5,
};

const moodLabelByScore: Record<number, MoodOption> = {
  1: "Calm",
  2: "Happy",
  3: "Energetic",
  4: "Irritable",
  5: "Outburst",
};

const formatDateShort = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(date);
};

export default function HistoryPage() {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!supabase) {
        setError(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("daily_logs")
        .select("log_date, sleep_quality, morning_mood")
        .order("log_date", { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const mappedRows: ChartRow[] = (data as DailyLogRow[]).map((log) => {
        const moodScore = log.morning_mood
          ? moodScoreMap[log.morning_mood]
          : null;

        return {
          date: log.log_date,
          sleepQuality: log.sleep_quality,
          morningMoodLabel: log.morning_mood,
          morningMoodScore: moodScore,
        };
      });

      setRows(mappedRows);
      setLoading(false);
    };

    void fetchLogs();
  }, []);

  const hasData = useMemo(() => rows.length > 0, [rows]);

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Daily History
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Sleep quality and morning mood trends over time.
          </p>
        </header>

        {loading && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
            <p className="text-sm text-gray-600">Loading chart data...</p>
          </section>
        )}

        {!loading && error && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
            <p className="text-sm text-red-600">Unable to load history: {error}</p>
          </section>
        )}

        {!loading && !error && !hasData && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
            <p className="text-sm text-gray-600">
              No daily logs yet. Submit a few entries to see trends.
            </p>
          </section>
        )}

        {!loading && !error && hasData && (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Sleep Quality Over Time
              </h2>
              <div className="h-64 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={rows}
                    margin={{ top: 8, right: 8, left: -18, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      labelFormatter={(label) =>
                        new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                          timeZone: "America/Toronto",
                        }).format(new Date(`${label}T00:00:00`))
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="sleepQuality"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Morning Mood By Day
              </h2>
              <div className="h-64 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows}
                    margin={{ top: 8, right: 8, left: -18, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tickFormatter={(value) => moodLabelByScore[value] ?? ""}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      formatter={(_, __, item) =>
                        item.payload.morningMoodLabel ?? "No mood selected"
                      }
                      labelFormatter={(label) =>
                        new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                          timeZone: "America/Toronto",
                        }).format(new Date(`${label}T00:00:00`))
                      }
                    />
                    <Bar
                      dataKey="morningMoodScore"
                      fill="#334155"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
