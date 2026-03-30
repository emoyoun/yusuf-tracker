"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TrainingItem = {
  id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

type TrainingLogRow = {
  training_item_id: string;
  is_done: boolean;
};

const getTorontoDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

const formatTorontoDateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "America/Toronto",
  }).format(new Date(`${date}T00:00:00`));

export default function TrainingPage() {
  const today = useMemo(() => getTorontoDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [doneByItemId, setDoneByItemId] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingItemId, setIsSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrainingForDate = async () => {
      if (!supabase) {
        setError(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const [itemsResult, logsResult] = await Promise.all([
        supabase
          .from("daily_training_items")
          .select("id, label, sort_order, created_at")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("daily_training_item_logs")
          .select("training_item_id, is_done")
          .eq("log_date", selectedDate),
      ]);

      if (itemsResult.error) {
        setError(itemsResult.error.message);
        setItems([]);
        setDoneByItemId({});
        setIsLoading(false);
        return;
      }

      if (logsResult.error) {
        setError(logsResult.error.message);
        setItems([]);
        setDoneByItemId({});
        setIsLoading(false);
        return;
      }

      const nextItems = (itemsResult.data as TrainingItem[]) ?? [];
      const logs = (logsResult.data as TrainingLogRow[]) ?? [];
      const nextDoneByItemId: Record<string, boolean> = {};

      nextItems.forEach((item) => {
        nextDoneByItemId[item.id] = false;
      });
      logs.forEach((log) => {
        if (nextDoneByItemId[log.training_item_id] !== undefined) {
          nextDoneByItemId[log.training_item_id] = log.is_done;
        }
      });

      setItems(nextItems);
      setDoneByItemId(nextDoneByItemId);
      setError(null);
      setIsLoading(false);
    };

    void loadTrainingForDate();
  }, [selectedDate]);

  const completedCount = useMemo(
    () => items.filter((item) => doneByItemId[item.id]).length,
    [items, doneByItemId],
  );

  const toggleDone = async (itemId: string) => {
    if (!supabase) return;

    const nextValue = !doneByItemId[itemId];
    setDoneByItemId((prev) => ({ ...prev, [itemId]: nextValue }));
    setIsSavingItemId(itemId);

    const { error: upsertError } = await supabase.from("daily_training_item_logs").upsert(
      {
        log_date: selectedDate,
        training_item_id: itemId,
        is_done: nextValue,
      },
      { onConflict: "log_date,training_item_id" },
    );

    if (upsertError) {
      setDoneByItemId((prev) => ({ ...prev, [itemId]: !nextValue }));
      alert(`Failed to save training update: ${upsertError.message}`);
    }

    setIsSavingItemId(null);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Daily Training Tracker
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Track what Yusuf completed each day over time.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to Daily Log
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label htmlFor="trainingDate" className="mb-1 block text-sm font-medium text-gray-700">
              Training Date
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="trainingDate"
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {selectedDate !== today && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Back to Today
                </button>
              )}
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">Unable to load training: {error}</p>}

          {!error && (
            <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-base font-semibold text-gray-900">
                Daily Training with Yusuf
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {formatTorontoDateLabel(selectedDate)}: {completedCount}/{items.length} completed
              </p>

              {isLoading ? (
                <p className="mt-3 text-sm text-gray-600">Loading training items...</p>
              ) : items.length === 0 ? (
                <p className="mt-3 text-sm text-gray-600">
                  No training items yet in the daily training table.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(doneByItemId[item.id])}
                          onChange={() => void toggleDone(item.id)}
                          disabled={isSavingItemId === item.id}
                          className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600 disabled:cursor-not-allowed"
                        />
                        <span
                          className={
                            doneByItemId[item.id] ? "text-gray-500 line-through" : "text-gray-800"
                          }
                        >
                          {item.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
