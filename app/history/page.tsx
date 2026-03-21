"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";

type MoodOption = "Calm" | "Happy" | "Irritable" | "Energetic";
type AppetiteOption = "Low" | "Normal" | "High";
type OutburstTriggerOption =
  | "Brother"
  | "TV"
  | "iPad"
  | "Hunger"
  | "Fatigue"
  | "Sensory overload"
  | "Communication"
  | "Medication change (timing/dose/new)";
type MedicationKey =
  | "leucovorin"
  | "omega3"
  | "b12"
  | "nac"
  | "atomoxetine"
  | "magnesium";
type MedicationState = Partial<Record<MedicationKey, boolean>>;

type DailyLogRow = {
  log_date: string;
  sleep_quality: number | null;
  morning_outburst_time: string | null;
  morning_outburst_minutes: number | null;
  morning_outburst_trigger: OutburstTriggerOption | null;
  evening_outburst_time: string | null;
  evening_outburst_minutes: number | null;
  evening_outburst_trigger: OutburstTriggerOption | null;
  evening_appetite: AppetiteOption | null;
  morning_mood: MoodOption | null;
  evening_mood: MoodOption | null;
  morning_meds: MedicationState | null;
  evening_meds: MedicationState | null;
};

type ChartRow = {
  date: string;
  sleepQuality: number | null;
  morningOutburstTime: string | null;
  morningOutburstMinutes: number | null;
  morningOutburstTrigger: OutburstTriggerOption | null;
  eveningOutburstTime: string | null;
  eveningOutburstMinutes: number | null;
  eveningOutburstTrigger: OutburstTriggerOption | null;
  eveningAppetiteLabel: AppetiteOption | null;
  eveningAppetiteScore: number | null;
  morningMoodLabel: MoodOption | null;
  eveningMoodLabel: MoodOption | null;
  morningMeds: MedicationState | null;
  eveningMeds: MedicationState | null;
};

const appetiteScoreMap: Record<AppetiteOption, number> = {
  Low: 1,
  Normal: 2,
  High: 3,
};

const appetiteLabelByScore: Record<number, AppetiteOption> = {
  1: "Low",
  2: "Normal",
  3: "High",
};

const moodColorMap: Record<MoodOption, string> = {
  Calm: "#60a5fa",
  Happy: "#22c55e",
  Irritable: "#f97316",
  Energetic: "#a78bfa",
};

const triggerColorMap: Record<OutburstTriggerOption, string> = {
  Brother: "#3b82f6",
  TV: "#22c55e",
  iPad: "#8b5cf6",
  Hunger: "#f97316",
  Fatigue: "#64748b",
  "Sensory overload": "#ec4899",
  Communication: "#f59e0b",
  "Medication change (timing/dose/new)": "#14b8a6",
};

const formatDateShort = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(date);
};

const formatDateShortFromTimestamp = (value: number) =>
  new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date(value));

const parseOutburstTimeToMinutes = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
};

const formatMinutesToTime = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const getTorontoDateString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
  }).format(new Date());

const medicationRows: { key: MedicationKey; label: string }[] = [
  { key: "b12", label: "B12" },
  { key: "nac", label: "NAC" },
  { key: "atomoxetine", label: "Atomoxetine" },
  { key: "leucovorin", label: "Leucovorin" },
  { key: "omega3", label: "Omega-3" },
  { key: "magnesium", label: "Magnesium" },
];

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
        .select(
          "log_date, sleep_quality, morning_outburst_time, morning_outburst_minutes, morning_outburst_trigger, evening_outburst_time, evening_outburst_minutes, evening_outburst_trigger, evening_appetite, morning_mood, evening_mood, morning_meds, evening_meds",
        )
        .order("log_date", { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const mappedRows: ChartRow[] = (data as DailyLogRow[]).map((log) => {
        const appetiteScore = log.evening_appetite
          ? appetiteScoreMap[log.evening_appetite]
          : null;

        return {
          date: log.log_date,
          sleepQuality: log.sleep_quality,
          morningOutburstTime: log.morning_outburst_time,
          morningOutburstMinutes: log.morning_outburst_minutes,
          morningOutburstTrigger: log.morning_outburst_trigger,
          eveningOutburstTime: log.evening_outburst_time,
          eveningOutburstMinutes: log.evening_outburst_minutes,
          eveningOutburstTrigger: log.evening_outburst_trigger,
          eveningAppetiteLabel: log.evening_appetite,
          eveningAppetiteScore: appetiteScore,
          morningMoodLabel: log.morning_mood,
          eveningMoodLabel: log.evening_mood,
          morningMeds: log.morning_meds,
          eveningMeds: log.evening_meds,
        };
      });

      setRows(mappedRows);
      setLoading(false);
    };

    void fetchLogs();
  }, []);

  const hasData = useMemo(() => rows.length > 0, [rows]);
  const last30DayStart = useMemo(() => {
    const today = new Date(`${getTorontoDateString()}T00:00:00`);
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return start;
  }, []);
  const moodBalanceData = useMemo(() => {
    const morningCounts: Record<MoodOption, number> = {
      Calm: 0,
      Happy: 0,
      Irritable: 0,
      Energetic: 0,
    };
    const eveningCounts: Record<MoodOption, number> = {
      Calm: 0,
      Happy: 0,
      Irritable: 0,
      Energetic: 0,
    };

    rows
      .filter((row) => new Date(`${row.date}T00:00:00`) >= last30DayStart)
      .forEach((row) => {
        if (row.morningMoodLabel) morningCounts[row.morningMoodLabel] += 1;
        if (row.eveningMoodLabel) eveningCounts[row.eveningMoodLabel] += 1;
      });

    const toPieData = (counts: Record<MoodOption, number>) =>
      (Object.keys(counts) as MoodOption[])
        .map((mood) => ({
          name: mood,
          value: counts[mood],
          color: moodColorMap[mood],
        }))
        .filter((item) => item.value > 0);

    return {
      morning: toPieData(morningCounts),
      evening: toPieData(eveningCounts),
    };
  }, [last30DayStart, rows]);
  const rowByDate = useMemo(
    () => new Map(rows.map((row) => [row.date, row])),
    [rows],
  );
  const eveningOutburstScatterData = useMemo(
    () =>
      rows
        .filter((row) => row.eveningOutburstMinutes != null)
        .map((row) => ({
          timestamp: new Date(`${row.date}T00:00:00`).getTime(),
          date: row.date,
          minutes: row.eveningOutburstMinutes as number,
        }))
        .sort((a, b) => a.timestamp - b.timestamp),
    [rows],
  );
  const eveningOutburstTrendLine = useMemo(() => {
    const twentyEightDaysAgo = new Date(`${getTorontoDateString()}T00:00:00`);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 27);
    const minTimestamp = twentyEightDaysAgo.getTime();

    const recentData = eveningOutburstScatterData.filter(
      (point) => point.timestamp >= minTimestamp,
    );

    if (recentData.length < 2) return null;

    const n = recentData.length;
    const sumX = recentData.reduce((acc, point) => acc + point.timestamp, 0);
    const sumY = recentData.reduce((acc, point) => acc + point.minutes, 0);
    const sumXY = recentData.reduce(
      (acc, point) => acc + point.timestamp * point.minutes,
      0,
    );
    const sumXX = recentData.reduce(
      (acc, point) => acc + point.timestamp * point.timestamp,
      0,
    );

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const startX = recentData[0].timestamp;
    const endX = recentData[recentData.length - 1].timestamp;

    const startY = Math.max(0, slope * startX + intercept);
    const endY = Math.max(0, slope * endX + intercept);

    return {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
    };
  }, [eveningOutburstScatterData]);
  const triggerTimelineData = useMemo(() => {
    const minTimestamp = last30DayStart.getTime();
    const points: {
      timestamp: number;
      outburstTimeMinutes: number;
      trigger: OutburstTriggerOption;
      period: "Morning" | "Evening";
      durationMinutes: number | null;
      date: string;
    }[] = [];

    rows.forEach((row) => {
      const timestamp = new Date(`${row.date}T00:00:00`).getTime();
      if (timestamp < minTimestamp) return;

      const morningMinutes = parseOutburstTimeToMinutes(row.morningOutburstTime);
      if (row.morningOutburstTrigger && morningMinutes != null) {
        points.push({
          timestamp,
          outburstTimeMinutes: morningMinutes,
          trigger: row.morningOutburstTrigger,
          period: "Morning",
          durationMinutes: row.morningOutburstMinutes,
          date: row.date,
        });
      }

      const eveningMinutes = parseOutburstTimeToMinutes(row.eveningOutburstTime);
      if (row.eveningOutburstTrigger && eveningMinutes != null) {
        points.push({
          timestamp,
          outburstTimeMinutes: eveningMinutes,
          trigger: row.eveningOutburstTrigger,
          period: "Evening",
          durationMinutes: row.eveningOutburstMinutes,
          date: row.date,
        });
      }
    });

    return points.sort((a, b) => a.timestamp - b.timestamp);
  }, [last30DayStart, rows]);
  const triggerFrequencyData = useMemo(() => {
    const minTimestamp = last30DayStart.getTime();
    const counts: Record<OutburstTriggerOption, number> = {
      Brother: 0,
      TV: 0,
      iPad: 0,
      Hunger: 0,
      Fatigue: 0,
      "Sensory overload": 0,
      Communication: 0,
      "Medication change (timing/dose/new)": 0,
    };

    rows.forEach((row) => {
      const timestamp = new Date(`${row.date}T00:00:00`).getTime();
      if (timestamp < minTimestamp) return;
      if (row.morningOutburstTrigger) counts[row.morningOutburstTrigger] += 1;
      if (row.eveningOutburstTrigger) counts[row.eveningOutburstTrigger] += 1;
    });

    return (Object.keys(counts) as OutburstTriggerOption[])
      .map((trigger) => ({
        name: trigger,
        value: counts[trigger],
        color: triggerColorMap[trigger],
      }))
      .filter((item) => item.value > 0);
  }, [last30DayStart, rows]);
  const last7Dates = useMemo(() => {
    const torontoToday = new Date(`${getTorontoDateString()}T00:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(torontoToday);
      date.setDate(torontoToday.getDate() - (6 - index));
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, "0");
      const day = `${date.getDate()}`.padStart(2, "0");
      return `${year}-${month}-${day}`;
    });
  }, []);

  const wasMorningMedicationTaken = (
    row: ChartRow | undefined,
    medication: MedicationKey,
  ) => Boolean(row?.morningMeds?.[medication]);

  const wasEveningMedicationTaken = (
    row: ChartRow | undefined,
    medication: MedicationKey,
  ) => Boolean(row?.eveningMeds?.[medication]);

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Daily History
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Sleep quality and morning mood trends over time.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Back to Daily Log
            </Link>
          </div>
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
                Sleep and Morning Outburst Trends
              </h2>
              <div className="h-64 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
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
                      yAxisId="sleep"
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      yAxisId="outburst"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "sleepQuality") {
                          return [value ?? "Not set", "Sleep Quality"];
                        }
                        return [value ?? 0, "Morning Outburst (min)"];
                      }}
                      labelFormatter={(label) =>
                        new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                          timeZone: "America/Toronto",
                        }).format(new Date(`${label}T00:00:00`))
                      }
                    />
                    <Bar
                      yAxisId="outburst"
                      dataKey="morningOutburstMinutes"
                      fill="#fca5a5"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="sleep"
                      type="monotone"
                      dataKey="sleepQuality"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Evening Appetite and Outburst
              </h2>
              <div className="h-64 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
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
                      yAxisId="appetite"
                      domain={[1, 3]}
                      ticks={[1, 2, 3]}
                      tickFormatter={(value) => appetiteLabelByScore[value] ?? ""}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      yAxisId="outburst"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      formatter={(_, name, item) => {
                        if (name === "eveningAppetiteScore") {
                          return [
                            item.payload.eveningAppetiteLabel ?? "Not set",
                            "Evening Appetite",
                          ];
                        }
                        return [item.payload.eveningOutburstMinutes ?? 0, "Evening Outburst (min)"];
                      }}
                      labelFormatter={(label) =>
                        new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                          timeZone: "America/Toronto",
                        }).format(new Date(`${label}T00:00:00`))
                      }
                    />
                    <Bar
                      yAxisId="outburst"
                      dataKey="eveningOutburstMinutes"
                      fill="#fca5a5"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="appetite"
                      type="monotone"
                      dataKey="eveningAppetiteScore"
                      stroke="#86efac"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Mood Balance
              </h2>
              <p className="mb-2 text-sm text-gray-600">
                Morning and evening mood frequency over the last 30 days.
              </p>
              {moodBalanceData.morning.length === 0 &&
              moodBalanceData.evening.length === 0 ? (
                <p className="text-sm text-gray-600">No mood data available yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="h-72 w-full">
                    <h3 className="mb-2 text-center text-sm font-semibold text-gray-800">
                      Morning Mood
                    </h3>
                    {moodBalanceData.morning.length === 0 ? (
                      <p className="text-center text-sm text-gray-500">
                        No morning mood data.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(value) => [value, "Entries"]}
                            labelFormatter={(label) => `Mood: ${label}`}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            wrapperStyle={{ fontSize: "12px" }}
                          />
                          <Pie
                            data={moodBalanceData.morning}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {moodBalanceData.morning.map((entry) => (
                              <Cell key={`morning-${entry.name}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="h-72 w-full">
                    <h3 className="mb-2 text-center text-sm font-semibold text-gray-800">
                      Evening Mood
                    </h3>
                    {moodBalanceData.evening.length === 0 ? (
                      <p className="text-center text-sm text-gray-500">
                        No evening mood data.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(value) => [value, "Entries"]}
                            labelFormatter={(label) => `Mood: ${label}`}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            wrapperStyle={{ fontSize: "12px" }}
                          />
                          <Pie
                            data={moodBalanceData.evening}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {moodBalanceData.evening.map((entry) => (
                              <Cell key={`evening-${entry.name}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Trigger vs Outburst Time (Last 30 Days)
              </h2>
              <p className="mb-2 text-sm text-gray-600">
                Recommended view: this scatter chart highlights when each trigger tends
                to happen during the day.
              </p>
              {triggerTimelineData.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No trigger + outburst time data available yet.
                </p>
              ) : (
                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        dataKey="timestamp"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={formatDateShortFromTimestamp}
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis
                        type="number"
                        dataKey="outburstTimeMinutes"
                        domain={[0, 1439]}
                        ticks={[0, 240, 480, 720, 960, 1200, 1439]}
                        tickFormatter={formatMinutesToTime}
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                        label={{
                          value: "Outburst Time",
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle", fill: "#6b7280", fontSize: 12 },
                        }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(_, name, item) => {
                          if (name !== "outburstTimeMinutes") return null;
                          return [
                            `${formatMinutesToTime(item.payload.outburstTimeMinutes)} (${item.payload.period})`,
                            item.payload.trigger,
                          ];
                        }}
                        labelFormatter={(label) =>
                          new Intl.DateTimeFormat("en-CA", {
                            dateStyle: "medium",
                            timeZone: "America/Toronto",
                          }).format(new Date(Number(label)))
                        }
                      />
                      <Scatter data={triggerTimelineData} dataKey="outburstTimeMinutes">
                        {triggerTimelineData.map((point, index) => (
                          <Cell key={`${point.date}-${point.period}-${index}`} fill={triggerColorMap[point.trigger]} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Most Common Triggers (Last 30 Days)
              </h2>
              {triggerFrequencyData.length === 0 ? (
                <p className="text-sm text-gray-600">No trigger data available yet.</p>
              ) : (
                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(value) => [value, "Occurrences"]}
                        labelFormatter={(label) => `Trigger: ${label}`}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: "12px" }}
                      />
                      <Pie
                        data={triggerFrequencyData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {triggerFrequencyData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Medication Consistency (Last 7 Days)
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Green means marked true, gray means false or not logged.
              </p>

              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[760px]">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "160px repeat(14, minmax(34px, 1fr))" }}
                  >
                    <div />
                    {last7Dates.map((date, dateIndex) => (
                      <div
                        key={date}
                        className={`col-span-2 text-center text-xs font-medium text-gray-600 ${
                          dateIndex < last7Dates.length - 1 ? "border-r border-gray-200" : ""
                        }`}
                      >
                        {formatDateShort(date)}
                      </div>
                    ))}

                    <div />
                    {last7Dates.map((date, dateIndex) => (
                      <Fragment key={`${date}-dose-headings`}>
                        <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          AM
                        </div>
                        <div
                          className={`text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 ${
                            dateIndex < last7Dates.length - 1
                              ? "border-r border-gray-200"
                              : ""
                          }`}
                        >
                          PM
                        </div>
                      </Fragment>
                    ))}

                    {medicationRows.map((medication) => (
                      <Fragment key={medication.key}>
                        <div className="flex items-center text-sm font-medium text-gray-800">
                          {medication.label}
                        </div>
                        {last7Dates.map((date, dateIndex) => {
                          const row = rowByDate.get(date);
                          const takenMorning = wasMorningMedicationTaken(
                            row,
                            medication.key,
                          );
                          const takenEvening = wasEveningMedicationTaken(
                            row,
                            medication.key,
                          );

                          return (
                            <Fragment key={`${medication.key}-${date}`}>
                              <div
                                className="flex items-center justify-center py-1"
                                title={`${medication.label} AM on ${formatDateShort(date)}: ${
                                  takenMorning ? "Taken" : "Not taken"
                                }`}
                              >
                                <span
                                  className={`h-3 w-3 rounded-full ${
                                    takenMorning ? "bg-emerald-500" : "bg-gray-300"
                                  }`}
                                />
                              </div>
                              <div
                                className={`flex items-center justify-center py-1 ${
                                  dateIndex < last7Dates.length - 1
                                    ? "border-r border-gray-200"
                                    : ""
                                }`}
                                title={`${medication.label} PM on ${formatDateShort(date)}: ${
                                  takenEvening ? "Taken" : "Not taken"
                                }`}
                              >
                                <span
                                  className={`h-3 w-3 rounded-full ${
                                    takenEvening ? "bg-emerald-500" : "bg-gray-300"
                                  }`}
                                />
                              </div>
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Evening Outburst Intensity
              </h2>
              <p className="mb-2 text-sm text-gray-600">
                Scatter plot of evening outburst duration by day. Trend line uses
                recent weeks (last 28 days).
              </p>
              {eveningOutburstScatterData.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No evening outburst data available yet.
                </p>
              ) : (
                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        dataKey="timestamp"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={formatDateShortFromTimestamp}
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis
                        type="number"
                        dataKey="minutes"
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                        label={{
                          value: "Evening Outburst (min)",
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle", fill: "#6b7280", fontSize: 12 },
                        }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(value, name) => {
                          if (name !== "minutes") return null;
                          return [value, "Outburst Duration (min)"];
                        }}
                        labelFormatter={(label) =>
                          new Intl.DateTimeFormat("en-CA", {
                            dateStyle: "medium",
                            timeZone: "America/Toronto",
                          }).format(new Date(Number(label)))
                        }
                      />
                      <Scatter
                        name="Evening Outburst"
                        data={eveningOutburstScatterData}
                        fill="#f97316"
                      />
                      {eveningOutburstTrendLine && (
                        <ReferenceLine
                          segment={[
                            eveningOutburstTrendLine.start,
                            eveningOutburstTrendLine.end,
                          ]}
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
