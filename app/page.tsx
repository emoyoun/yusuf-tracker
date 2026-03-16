"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MoodOption = "" | "Calm" | "Happy" | "Irritable" | "Energetic" | "Outburst";
type AppetiteOption = "" | "Low" | "Normal" | "High";
type MorningMedicationKey =
  | "leucovorin"
  | "omega3"
  | "b12"
  | "nac"
  | "atomoxetine";
type EveningMedicationKey = "atomoxetine" | "leucovorin" | "nac" | "magnesium";

type DailyLogRecord = {
  log_date: string;
  sleep_quality: number | null;
  morning_mood: Exclude<MoodOption, ""> | null;
  morning_outburst_minutes: number | null;
  morning_outburst_time: string | null;
  morning_appetite: Exclude<AppetiteOption, ""> | null;
  morning_meds: Record<MorningMedicationKey, boolean> | null;
  evening_mood: Exclude<MoodOption, ""> | null;
  evening_outburst_minutes: number | null;
  evening_outburst_time: string | null;
  evening_appetite: Exclude<AppetiteOption, ""> | null;
  evening_meds: Record<EveningMedicationKey, boolean> | null;
  notes: string | null;
};

const initialMorningMeds: Record<MorningMedicationKey, boolean> = {
  leucovorin: false,
  omega3: false,
  b12: false,
  nac: false,
  atomoxetine: false,
};

const initialEveningMeds: Record<EveningMedicationKey, boolean> = {
  atomoxetine: false,
  leucovorin: false,
  nac: false,
  magnesium: false,
};

const outburstTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

const getTorontoOffset = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const timezonePart = parts.find((part) => part.type === "timeZoneName")?.value;

  if (!timezonePart) return "-05:00";

  const offsetMatch = timezonePart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!offsetMatch) return "-05:00";

  const signAndHour = offsetMatch[1];
  const sign = signAndHour.startsWith("-") ? "-" : "+";
  const hours = signAndHour.replace(/[+-]/, "").padStart(2, "0");
  const minutes = offsetMatch[2] ?? "00";

  return `${sign}${hours}:${minutes}`;
};

const toTorontoTimeWithOffset = (time: string) => {
  if (!time) return null;
  return `${time}:00${getTorontoOffset()}`;
};

const getTorontoDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
  }).format(new Date());

const formatTorontoDateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "America/Toronto",
  }).format(new Date(`${date}T00:00:00`));

const fromStoredTimeToDropdown = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 5);
};

const normalizeMorningMeds = (
  value: DailyLogRecord["morning_meds"],
): Record<MorningMedicationKey, boolean> => ({
  leucovorin: Boolean(value?.leucovorin),
  omega3: Boolean(value?.omega3),
  b12: Boolean(value?.b12),
  nac: Boolean(value?.nac),
  atomoxetine: Boolean(value?.atomoxetine),
});

const normalizeEveningMeds = (
  value: DailyLogRecord["evening_meds"],
): Record<EveningMedicationKey, boolean> => ({
  atomoxetine: Boolean(value?.atomoxetine),
  leucovorin: Boolean(value?.leucovorin),
  nac: Boolean(value?.nac),
  magnesium: Boolean(value?.magnesium),
});

const hasAnyMedication = (meds: Record<string, boolean> | null) =>
  !!meds && Object.values(meds).some(Boolean);

const SavedBadge = () => (
  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
    Saved for this date
  </span>
);

export default function Home() {
  const torontoToday = getTorontoDate();
  const [sleepQuality, setSleepQuality] = useState<number>(0);
  const [morningMood, setMorningMood] = useState<MoodOption>("");
  const [morningOutburstTime, setMorningOutburstTime] = useState<string>("");
  const [morningOutburstDuration, setMorningOutburstDuration] =
    useState<string>("");
  const [eveningMood, setEveningMood] = useState<MoodOption>("");
  const [eveningOutburstTime, setEveningOutburstTime] = useState<string>("");
  const [eveningOutburstDuration, setEveningOutburstDuration] =
    useState<string>("");
  const [morningAppetite, setMorningAppetite] = useState<AppetiteOption>("");
  const [eveningAppetite, setEveningAppetite] = useState<AppetiteOption>("");
  const [morningMeds, setMorningMeds] =
    useState<Record<MorningMedicationKey, boolean>>(initialMorningMeds);
  const [eveningMeds, setEveningMeds] =
    useState<Record<EveningMedicationKey, boolean>>(initialEveningMeds);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingToday, setIsLoadingToday] = useState<boolean>(true);
  const [selectedLogDate, setSelectedLogDate] = useState<string>(torontoToday);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [todaysLog, setTodaysLog] = useState<DailyLogRecord | null>(null);
  const [morningMedsTouched, setMorningMedsTouched] = useState<boolean>(false);
  const [eveningMedsTouched, setEveningMedsTouched] = useState<boolean>(false);

  const applyRecordToForm = (record: DailyLogRecord | null) => {
    if (!record) {
      setSleepQuality(0);
      setMorningMood("");
      setMorningOutburstTime("");
      setMorningOutburstDuration("");
      setEveningMood("");
      setEveningOutburstTime("");
      setEveningOutburstDuration("");
      setMorningAppetite("");
      setEveningAppetite("");
      setMorningMeds({ ...initialMorningMeds });
      setEveningMeds({ ...initialEveningMeds });
      setNotes("");
      setMorningMedsTouched(false);
      setEveningMedsTouched(false);
      return;
    }

    setSleepQuality(record.sleep_quality ?? 0);
    setMorningMood(record.morning_mood ?? "");
    setMorningOutburstTime(fromStoredTimeToDropdown(record.morning_outburst_time));
    setMorningOutburstDuration(
      record.morning_outburst_minutes ? String(record.morning_outburst_minutes) : "",
    );
    setEveningMood(record.evening_mood ?? "");
    setEveningOutburstTime(fromStoredTimeToDropdown(record.evening_outburst_time));
    setEveningOutburstDuration(
      record.evening_outburst_minutes ? String(record.evening_outburst_minutes) : "",
    );
    setMorningAppetite(record.morning_appetite ?? "");
    setEveningAppetite(record.evening_appetite ?? "");
    setMorningMeds(normalizeMorningMeds(record.morning_meds));
    setEveningMeds(normalizeEveningMeds(record.evening_meds));
    setNotes(record.notes ?? "");
    setMorningMedsTouched(false);
    setEveningMedsTouched(false);
  };

  useEffect(() => {
    const loadSelectedDateLog = async () => {
      setIsLoadingToday(true);
      setTodaysLog(null);
      applyRecordToForm(null);

      if (!supabase) {
        setIsLoadingToday(false);
        return;
      }

      const { data, error } = await supabase
        .from("daily_logs")
        .select(
          "log_date, sleep_quality, morning_mood, morning_outburst_minutes, morning_outburst_time, morning_appetite, morning_meds, evening_mood, evening_outburst_minutes, evening_outburst_time, evening_appetite, evening_meds, notes",
        )
        .eq("log_date", selectedLogDate)
        .maybeSingle();

      if (!error && data) {
        const record = data as DailyLogRecord;
        setTodaysLog(record);
        applyRecordToForm(record);
      }

      setIsLoadingToday(false);
    };

    void loadSelectedDateLog();
  }, [selectedLogDate]);

  const handleMorningMedicationChange = (key: MorningMedicationKey) => {
    setMorningMedsTouched(true);
    setMorningMeds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleEveningMedicationChange = (key: EveningMedicationKey) => {
    setEveningMedsTouched(true);
    setEveningMeds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      alert(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.",
      );
      return;
    }

    setIsSaving(true);

    const resolvedMorningMood = morningMood || todaysLog?.morning_mood || null;
    const resolvedEveningMood = eveningMood || todaysLog?.evening_mood || null;

    const payload: Omit<DailyLogRecord, "id" | "created_at"> = {
      log_date: selectedLogDate,
      sleep_quality: sleepQuality > 0 ? sleepQuality : (todaysLog?.sleep_quality ?? null),
      morning_mood: resolvedMorningMood,
      morning_outburst_minutes:
        resolvedMorningMood === "Outburst"
          ? morningOutburstDuration
            ? Number.parseInt(morningOutburstDuration, 10)
            : (todaysLog?.morning_outburst_minutes ?? null)
          : null,
      morning_outburst_time:
        resolvedMorningMood === "Outburst"
          ? morningOutburstTime
            ? toTorontoTimeWithOffset(morningOutburstTime)
            : (todaysLog?.morning_outburst_time ?? null)
          : null,
      morning_appetite: morningAppetite || todaysLog?.morning_appetite || null,
      morning_meds: morningMedsTouched
        ? morningMeds
        : (todaysLog?.morning_meds ?? null),
      evening_mood: resolvedEveningMood,
      evening_outburst_minutes:
        resolvedEveningMood === "Outburst"
          ? eveningOutburstDuration
            ? Number.parseInt(eveningOutburstDuration, 10)
            : (todaysLog?.evening_outburst_minutes ?? null)
          : null,
      evening_outburst_time:
        resolvedEveningMood === "Outburst"
          ? eveningOutburstTime
            ? toTorontoTimeWithOffset(eveningOutburstTime)
            : (todaysLog?.evening_outburst_time ?? null)
          : null,
      evening_appetite: eveningAppetite || todaysLog?.evening_appetite || null,
      evening_meds: eveningMedsTouched
        ? eveningMeds
        : (todaysLog?.evening_meds ?? null),
      notes: notes.trim() || todaysLog?.notes || null,
    };

    try {
      const { error, data } = await supabase
        .from("daily_logs")
        .upsert(payload, { onConflict: "log_date" })
        .select(
          "log_date, sleep_quality, morning_mood, morning_outburst_minutes, morning_outburst_time, morning_appetite, morning_meds, evening_mood, evening_outburst_minutes, evening_outburst_time, evening_appetite, evening_meds, notes",
        )
        .single();

      if (error) {
        alert(`Failed to save log: ${error.message}`);
        return;
      }

      const savedRecord = data as DailyLogRecord;
      setTodaysLog(savedRecord);
      applyRecordToForm(savedRecord);
      alert("Log Saved!");
    } catch {
      alert("Failed to save log due to a network error.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Yusuf&apos;s Daily Log
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Record key updates from today in one place.
            </p>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            View History Charts
          </Link>
        </div>

        {isLoadingToday && (
          <p className="mt-4 text-sm text-gray-500">Loading today&apos;s saved log...</p>
        )}

        {!isLoadingToday && todaysLog && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Entry exists for {formatTorontoDateLabel(selectedLogDate)}. Leaving
            fields blank will keep the previously saved value.
          </p>
        )}

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDatePicker((prev) => !prev)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              {showDatePicker ? "Hide Date Picker" : "Fill Previous Date"}
            </button>
            {selectedLogDate !== torontoToday && (
              <button
                type="button"
                onClick={() => setSelectedLogDate(torontoToday)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Back to Today
              </button>
            )}
            <span className="text-sm text-gray-600">
              Editing: {formatTorontoDateLabel(selectedLogDate)}
            </span>
          </div>
          {showDatePicker && (
            <div className="mt-3">
              <label
                htmlFor="logDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Select date to edit
              </label>
              <input
                id="logDate"
                type="date"
                value={selectedLogDate}
                max={torontoToday}
                onChange={(event) => setSelectedLogDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <section>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Sleep Quality
              {todaysLog?.sleep_quality != null && <SavedBadge />}
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setSleepQuality(rating)}
                  className="text-2xl leading-none transition hover:scale-105"
                  aria-label={`Rate sleep ${rating} out of 5`}
                >
                  <span
                    className={
                      rating <= sleepQuality ? "text-amber-400" : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600">
                {sleepQuality > 0 ? `${sleepQuality}/5` : "Not rated"}
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Morning</h2>

            <div className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <label
                  htmlFor="morningMood"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Morning Mood
                  {todaysLog?.morning_mood && <SavedBadge />}
                </label>
                <select
                  id="morningMood"
                  value={morningMood}
                  onChange={(event) => setMorningMood(event.target.value as MoodOption)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select mood</option>
                  <option value="Calm">Calm</option>
                  <option value="Happy">Happy</option>
                  <option value="Irritable">Irritable</option>
                  <option value="Energetic">Energetic</option>
                  <option value="Outburst">Outburst</option>
                </select>
              </div>

              {morningMood === "Outburst" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="morningOutburstTime"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Outburst Time (Toronto)
                      {todaysLog?.morning_outburst_time && <SavedBadge />}
                    </label>
                    <select
                      id="morningOutburstTime"
                      value={morningOutburstTime}
                      onChange={(event) => setMorningOutburstTime(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="">Select time</option>
                      {outburstTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Saved in America/Toronto timezone.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="morningOutburstDuration"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Outburst Duration (minutes)
                      {todaysLog?.morning_outburst_minutes != null && <SavedBadge />}
                    </label>
                    <input
                      id="morningOutburstDuration"
                      type="number"
                      min={1}
                      value={morningOutburstDuration}
                      onChange={(event) =>
                        setMorningOutburstDuration(event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="morningAppetite"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Morning Appetite
                  {todaysLog?.morning_appetite && <SavedBadge />}
                </label>
                <select
                  id="morningAppetite"
                  value={morningAppetite}
                  onChange={(event) =>
                    setMorningAppetite(event.target.value as AppetiteOption)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select appetite</option>
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                </select>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-gray-700">
                  Morning Medications
                  {hasAnyMedication(todaysLog?.morning_meds ?? null) && <SavedBadge />}
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { key: "leucovorin", label: "Leucovorin" },
                    { key: "omega3", label: "Omega-3" },
                    { key: "b12", label: "B12" },
                    { key: "nac", label: "NAC" },
                    { key: "atomoxetine", label: "Atomoxetine" },
                  ].map((med) => (
                    <label
                      key={med.key}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={morningMeds[med.key as MorningMedicationKey]}
                        onChange={() =>
                          handleMorningMedicationChange(
                            med.key as MorningMedicationKey,
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
                      />
                      <span className="text-sm text-gray-700">{med.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Evening</h2>

            <div className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <label
                  htmlFor="eveningMood"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Evening Mood
                  {todaysLog?.evening_mood && <SavedBadge />}
                </label>
                <select
                  id="eveningMood"
                  value={eveningMood}
                  onChange={(event) => setEveningMood(event.target.value as MoodOption)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select mood</option>
                  <option value="Calm">Calm</option>
                  <option value="Happy">Happy</option>
                  <option value="Irritable">Irritable</option>
                  <option value="Energetic">Energetic</option>
                  <option value="Outburst">Outburst</option>
                </select>
              </div>

              {eveningMood === "Outburst" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="eveningOutburstTime"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Outburst Time (Toronto)
                      {todaysLog?.evening_outburst_time && <SavedBadge />}
                    </label>
                    <select
                      id="eveningOutburstTime"
                      value={eveningOutburstTime}
                      onChange={(event) => setEveningOutburstTime(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="">Select time</option>
                      {outburstTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Saved in America/Toronto timezone.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="eveningOutburstDuration"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Outburst Duration (minutes)
                      {todaysLog?.evening_outburst_minutes != null && <SavedBadge />}
                    </label>
                    <input
                      id="eveningOutburstDuration"
                      type="number"
                      min={1}
                      value={eveningOutburstDuration}
                      onChange={(event) =>
                        setEveningOutburstDuration(event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="eveningAppetite"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Evening Appetite
                  {todaysLog?.evening_appetite && <SavedBadge />}
                </label>
                <select
                  id="eveningAppetite"
                  value={eveningAppetite}
                  onChange={(event) =>
                    setEveningAppetite(event.target.value as AppetiteOption)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select appetite</option>
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                </select>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-gray-700">
                  Evening Medications
                  {hasAnyMedication(todaysLog?.evening_meds ?? null) && <SavedBadge />}
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { key: "atomoxetine", label: "Atomoxetine" },
                    { key: "leucovorin", label: "Leucovorin" },
                    { key: "nac", label: "NAC" },
                    { key: "magnesium", label: "Magnesium" },
                  ].map((med) => (
                    <label
                      key={med.key}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={eveningMeds[med.key as EveningMedicationKey]}
                        onChange={() =>
                          handleEveningMedicationChange(
                            med.key as EveningMedicationKey,
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
                      />
                      <span className="text-sm text-gray-700">{med.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <section>
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Notes
              {todaysLog?.notes && <SavedBadge />}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Add general observations..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </section>

          <button
            type="submit"
            disabled={isSaving || isLoadingToday}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Daily Log"}
          </button>
        </form>
      </div>
    </main>
  );
}
