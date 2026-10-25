"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TrainingPlan = {
  id: string;
  name: string;
  description: string | null;
};

type TrainingPlanItem = {
  id: string;
  plan_id: string;
  section: string;
  title: string;
  instructions: string | null;
  log_prompt: string;
  sort_order: number;
};

type Progress = {
  is_done: boolean;
  log_value: string;
};

type ProgressRow = {
  training_item_id: string;
  is_done: boolean;
  log_value: string | null;
};

type CsvPlanItem = {
  section: string;
  title: string;
  instructions: string;
  log_prompt: string;
};

const getTorontoDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

const formatTorontoDateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeZone: "America/Toronto",
  }).format(new Date(`${date}T00:00:00`));

const normalizeHeader = (header: string) =>
  header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const findHeaderIndex = (headers: string[], candidates: string[]) =>
  headers.findIndex((header) => candidates.includes(header));

const parsePlanCsv = (text: string): CsvPlanItem[] => {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The CSV does not contain any training items.");

  const headers = rows[0].map(normalizeHeader);
  const sectionIndex = findHeaderIndex(headers, ["section", "category"]);
  const titleIndex = findHeaderIndex(headers, ["training item", "item", "title", "activity"]);
  const instructionsIndex = findHeaderIndex(headers, [
    "exactly what to do with example",
    "exactly what to do",
    "instructions",
    "description",
  ]);
  const logPromptIndex = findHeaderIndex(headers, [
    "how to log",
    "log prompt",
    "measurement",
    "tracking",
  ]);

  if (titleIndex < 0) {
    throw new Error('The CSV needs a "Training item", "Item", "Title", or "Activity" column.');
  }

  return rows
    .slice(1)
    .map((values) => ({
      section: sectionIndex >= 0 ? values[sectionIndex]?.trim() || "General" : "General",
      title: values[titleIndex]?.trim() || "",
      instructions: instructionsIndex >= 0 ? values[instructionsIndex]?.trim() || "" : "",
      log_prompt: logPromptIndex >= 0 ? values[logPromptIndex]?.trim() || "Yes/No" : "Yes/No",
    }))
    .filter((item) => item.title);
};

const inputForPrompt = (
  item: TrainingPlanItem,
  progress: Progress,
  updateValue: (value: string) => void,
  saveValue: () => void,
) => {
  const prompt = item.log_prompt.toLowerCase();

  if (prompt === "yes/no") return null;

  if (prompt.includes("help level")) {
    return (
      <select
        value={progress.log_value}
        onChange={(event) => updateValue(event.target.value)}
        onBlur={saveValue}
        aria-label={`${item.title}: ${item.log_prompt}`}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-64"
      >
        <option value="">Select help level</option>
        <option value="1">1 — Full help</option>
        <option value="2">2 — Some help</option>
        <option value="3">3 — Independent</option>
      </select>
    );
  }

  return (
    <input
      type={prompt.includes("count") ? "number" : "text"}
      min={prompt.includes("count") ? 0 : undefined}
      value={progress.log_value}
      onChange={(event) => updateValue(event.target.value)}
      onBlur={saveValue}
      placeholder={item.log_prompt}
      aria-label={`${item.title}: ${item.log_prompt}`}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-64"
    />
  );
};

export default function TrainingPlans() {
  const today = useMemo(() => getTorontoDate(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [items, setItems] = useState<TrainingPlanItem[]>([]);
  const [progressByItemId, setProgressByItemId] = useState<Record<string, Progress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [planName, setPlanName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      if (!supabase) {
        setError(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        setIsLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("training_plans")
        .select("id, name, description")
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      const loadedPlans = (data as TrainingPlan[]) ?? [];
      setPlans(loadedPlans);
      setSelectedPlanId((current) => current || loadedPlans[0]?.id || "");
      setError(null);
      if (loadedPlans.length === 0) setIsLoading(false);
    };

    void loadPlans();
  }, []);

  useEffect(() => {
    const loadPlanForDate = async () => {
      if (!supabase || !selectedPlanId) {
        setItems([]);
        setProgressByItemId({});
        return;
      }

      setIsLoading(true);
      const [itemsResult, progressResult] = await Promise.all([
        supabase
          .from("training_plan_items")
          .select("id, plan_id, section, title, instructions, log_prompt, sort_order")
          .eq("plan_id", selectedPlanId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("training_plan_progress")
          .select("training_item_id, is_done, log_value, training_plan_items!inner(plan_id)")
          .eq("log_date", selectedDate)
          .eq("training_plan_items.plan_id", selectedPlanId),
      ]);

      if (itemsResult.error || progressResult.error) {
        setError(itemsResult.error?.message ?? progressResult.error?.message ?? "Unable to load.");
        setIsLoading(false);
        return;
      }

      const loadedItems = (itemsResult.data as TrainingPlanItem[]) ?? [];
      const loadedProgress = (progressResult.data as unknown as ProgressRow[]) ?? [];
      const nextProgress: Record<string, Progress> = Object.fromEntries(
        loadedItems.map((item) => [item.id, { is_done: false, log_value: "" }]),
      );

      loadedProgress.forEach((progress) => {
        if (nextProgress[progress.training_item_id]) {
          nextProgress[progress.training_item_id] = {
            is_done: progress.is_done,
            log_value: progress.log_value ?? "",
          };
        }
      });

      setItems(loadedItems);
      setProgressByItemId(nextProgress);
      setError(null);
      setIsLoading(false);
    };

    void loadPlanForDate();
  }, [selectedDate, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const completedCount = items.filter((item) => progressByItemId[item.id]?.is_done).length;
  const percentComplete = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const groupedItems = useMemo(() => {
    const groups = new Map<string, TrainingPlanItem[]>();
    items.forEach((item) => {
      const sectionItems = groups.get(item.section) ?? [];
      sectionItems.push(item);
      groups.set(item.section, sectionItems);
    });
    return Array.from(groups.entries());
  }, [items]);

  const saveProgress = async (itemId: string, progress: Progress) => {
    if (!supabase) return;
    setSavingItemId(itemId);

    const { error: saveError } = await supabase.from("training_plan_progress").upsert(
      {
        training_item_id: itemId,
        log_date: selectedDate,
        is_done: progress.is_done,
        log_value: progress.log_value.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "log_date,training_item_id" },
    );

    if (saveError) {
      setError(`Unable to save progress: ${saveError.message}`);
    } else {
      setError(null);
    }
    setSavingItemId(null);
  };

  const toggleDone = (itemId: string) => {
    const current = progressByItemId[itemId] ?? { is_done: false, log_value: "" };
    const next = { ...current, is_done: !current.is_done };
    setProgressByItemId((previous) => ({ ...previous, [itemId]: next }));
    void saveProgress(itemId, next);
  };

  const updateLogValue = (itemId: string, value: string) => {
    setProgressByItemId((previous) => ({
      ...previous,
      [itemId]: {
        is_done: previous[itemId]?.is_done ?? false,
        log_value: value,
      },
    }));
  };

  const importPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !csvFile || !planName.trim()) return;

    setIsImporting(true);
    setError(null);
    let createdPlanId: string | null = null;

    try {
      const parsedItems = parsePlanCsv(await csvFile.text());
      if (parsedItems.length === 0) throw new Error("The CSV does not contain any valid items.");

      const { data: planData, error: planError } = await supabase
        .from("training_plans")
        .insert({
          name: planName.trim(),
          source_filename: csvFile.name,
        })
        .select("id, name, description")
        .single();

      if (planError) throw planError;
      const newPlan = planData as TrainingPlan;
      createdPlanId = newPlan.id;

      const { error: itemError } = await supabase.from("training_plan_items").insert(
        parsedItems.map((item, index) => ({
          plan_id: newPlan.id,
          ...item,
          sort_order: index,
        })),
      );
      if (itemError) throw itemError;

      setPlans((previous) => [...previous, newPlan]);
      setSelectedPlanId(newPlan.id);
      setPlanName("");
      setCsvFile(null);
      setShowImporter(false);
    } catch (caughtError) {
      if (createdPlanId) {
        await supabase.from("training_plans").delete().eq("id", createdPlanId);
      }
      const message = caughtError instanceof Error ? caughtError.message : "Import failed.";
      setError(`Unable to import plan: ${message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Training Plans</h1>
              <p className="mt-1 text-sm text-gray-600">
                Follow a plan and record Yusuf&apos;s progress each day.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowImporter((current) => !current)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {showImporter ? "Cancel Import" : "Add Plan from CSV"}
              </button>
              <Link
                href="/"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to Daily Log
              </Link>
            </div>
          </div>

          {showImporter && (
            <form
              onSubmit={importPlan}
              className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <label className="text-sm font-medium text-gray-700">
                Plan name
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  placeholder="e.g. Speech Plan - November"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 shadow-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                CSV file
                <input
                  type="file"
                  required
                  accept=".csv,text/csv"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm font-normal text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-medium file:text-gray-700 file:ring-1 file:ring-gray-300"
                />
              </label>
              <button
                type="submit"
                disabled={isImporting || !csvFile || !planName.trim()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isImporting ? "Importing..." : "Import Plan"}
              </button>
              <p className="text-xs text-gray-500 sm:col-span-3">
                Use columns named Section, Training item, Exactly what to do (with example), and
                How to log. Item/Title, Instructions, and Measurement are also accepted.
              </p>
            </form>
          )}
        </header>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Training plan
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                disabled={plans.length === 0}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm disabled:bg-gray-100"
              >
                {plans.length === 0 && <option value="">No plans yet</option>}
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Progress date
              <div className="mt-1 flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
                />
                {selectedDate !== today && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(today)}
                    className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Today
                  </button>
                )}
              </div>
            </label>
          </div>

          {selectedPlan && (
            <div className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedPlan.name}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatTorontoDateLabel(selectedDate)} · {completedCount}/{items.length} complete
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{percentComplete}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="mt-6 text-sm text-gray-600">Loading training plan...</p>
          ) : items.length === 0 ? (
            <p className="mt-6 text-sm text-gray-600">
              No items in this plan. Add a plan from a CSV to get started.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {groupedItems.map(([section, sectionItems]) => (
                <section key={section}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                    {section}
                  </h3>
                  <ul className="space-y-3">
                    {sectionItems.map((item) => {
                      const progress = progressByItemId[item.id] ?? {
                        is_done: false,
                        log_value: "",
                      };
                      return (
                        <li
                          key={item.id}
                          className={`rounded-xl border p-4 transition ${
                            progress.is_done
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={progress.is_done}
                              onChange={() => toggleDone(item.id)}
                              disabled={savingItemId === item.id}
                              aria-label={`Mark ${item.title} complete`}
                              className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`font-semibold ${
                                  progress.is_done ? "text-emerald-900" : "text-gray-900"
                                }`}
                              >
                                {item.title}
                              </p>
                              {item.instructions && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-sm font-medium text-slate-600">
                                    Instructions and example
                                  </summary>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                    {item.instructions}
                                  </p>
                                </details>
                              )}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {inputForPrompt(
                                  item,
                                  progress,
                                  (value) => updateLogValue(item.id, value),
                                  () => void saveProgress(item.id, progressByItemId[item.id]),
                                )}
                                <span className="text-xs text-gray-500">
                                  {savingItemId === item.id
                                    ? "Saving..."
                                    : `Log: ${item.log_prompt}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
