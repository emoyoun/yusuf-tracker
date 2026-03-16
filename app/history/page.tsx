"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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

type MoodOption = "Calm" | "Happy" | "Irritable" | "Energetic" | "Outburst";
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
  morning_outburst_minutes: number | null;
  evening_outburst_minutes: number | null;
  morning_mood: MoodOption | null;
  evening_mood: MoodOption | null;
  morning_meds: MedicationState | null;
  evening_meds: MedicationState | null;
};

type ChartRow = {
  date: string;
  sleepQuality: number | null;
  morningOutburstMinutes: number | null;
  eveningOutburstMinutes: number | null;
  morningMoodLabel: MoodOption | null;
  eveningMoodLabel: MoodOption | null;
  morningMoodScore: number | null;
  morningMeds: MedicationState | null;
  eveningMeds: MedicationState | null;
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

const moodColorMap: Record<MoodOption, string> = {
  Calm: "#60a5fa",
  Happy: "#22c55e",
  Irritable: "#f97316",
  Energetic: "#a78bfa",
  Outburst: "#ef4444",
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
          "log_date, sleep_quality, morning_outburst_minutes, evening_outburst_minutes, morning_mood, evening_mood, morning_meds, evening_meds",
        )
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
          morningOutburstMinutes: log.morning_outburst_minutes,
          eveningOutburstMinutes: log.evening_outburst_minutes,
          morningMoodLabel: log.morning_mood,
          eveningMoodLabel: log.evening_mood,
          morningMoodScore: moodScore,
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
      Outburst: 0,
    };
    const eveningCounts: Record<MoodOption, number> = {
      Calm: 0,
      Happy: 0,
      Irritable: 0,
      Energetic: 0,
      Outburst: 0,
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
                        formatter={(value) => [value, "Outburst Duration (min)"]}
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
