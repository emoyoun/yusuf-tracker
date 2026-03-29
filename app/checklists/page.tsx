"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Checklist = {
  id: string;
  name: string;
  slug: string;
};

type ChecklistItem = {
  id: string;
  checklist_id: string;
  label: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
};

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState<string>("");
  const [isLoadingChecklists, setIsLoadingChecklists] = useState<boolean>(true);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const selectedChecklist = useMemo(
    () => checklists.find((checklist) => checklist.id === selectedChecklistId) ?? null,
    [checklists, selectedChecklistId],
  );

  useEffect(() => {
    const loadChecklists = async () => {
      if (!supabase) {
        setError(
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        setIsLoadingChecklists(false);
        return;
      }

      setIsLoadingChecklists(true);
      const { data, error: queryError } = await supabase
        .from("checklists")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setIsLoadingChecklists(false);
        return;
      }

      const list = (data as Checklist[]) ?? [];
      setChecklists(list);
      setSelectedChecklistId((current) => current || list[0]?.id || "");
      setError(null);
      setIsLoadingChecklists(false);
    };

    void loadChecklists();
  }, []);

  useEffect(() => {
    const loadItems = async () => {
      if (!supabase || !selectedChecklistId) {
        setItems([]);
        return;
      }

      setIsLoadingItems(true);
      const { data, error: queryError } = await supabase
        .from("checklist_items")
        .select("id, checklist_id, label, is_done, sort_order, created_at")
        .eq("checklist_id", selectedChecklistId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setIsLoadingItems(false);
        return;
      }

      setItems((data as ChecklistItem[]) ?? []);
      setError(null);
      setIsLoadingItems(false);
    };

    void loadItems();
  }, [selectedChecklistId]);

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !selectedChecklistId) return;

    const label = newItemLabel.trim();
    if (!label) {
      alert("Enter an item name before adding.");
      return;
    }

    const nextSortOrder =
      items.length > 0 ? Math.max(...items.map((item) => item.sort_order)) + 1 : 0;

    setIsSavingItem(true);
    const { data, error: insertError } = await supabase
      .from("checklist_items")
      .insert({
        checklist_id: selectedChecklistId,
        label,
        sort_order: nextSortOrder,
      })
      .select("id, checklist_id, label, is_done, sort_order, created_at")
      .single();

    if (insertError) {
      alert(`Failed to add item: ${insertError.message}`);
      setIsSavingItem(false);
      return;
    }

    setItems((prev) => [...prev, data as ChecklistItem]);
    setNewItemLabel("");
    setIsSavingItem(false);
  };

  const toggleItemChecked = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const resetCheckedItemsForSelectedChecklist = () => {
    setCheckedItems((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        delete next[item.id];
      });
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Yusuf&apos;s Checklists
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Pick a checklist and manage items directly from here.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to Daily Log
              </Link>
              <Link
                href="/history"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                View History
              </Link>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">Unable to load data: {error}</p>}

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label htmlFor="checklistSelect" className="mb-2 block text-sm font-medium text-gray-700">
                Select Checklist
              </label>
              <select
                id="checklistSelect"
                value={selectedChecklistId}
                onChange={(event) => setSelectedChecklistId(event.target.value)}
                disabled={isLoadingChecklists || checklists.length === 0}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                {isLoadingChecklists && <option value="">Loading checklists...</option>}
                {!isLoadingChecklists && checklists.length === 0 && (
                  <option value="">No checklists found</option>
                )}
                {checklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <form onSubmit={handleAddItem} className="space-y-2">
                <label htmlFor="newItem" className="block text-sm font-medium text-gray-700">
                  Add Item{selectedChecklist ? ` to ${selectedChecklist.name}` : ""}
                </label>
                <div className="flex gap-2">
                  <input
                    id="newItem"
                    type="text"
                    value={newItemLabel}
                    onChange={(event) => setNewItemLabel(event.target.value)}
                    placeholder="e.g. Noise-canceling headphones"
                    disabled={!selectedChecklistId || isSavingItem}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={!selectedChecklistId || isSavingItem}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isSavingItem ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                {selectedChecklist?.name ?? "Checklist Items"}
              </h2>
              <button
                type="button"
                onClick={resetCheckedItemsForSelectedChecklist}
                disabled={items.length === 0}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                Reset Checkmarks
              </button>
            </div>
            {isLoadingItems ? (
              <p className="mt-2 text-sm text-gray-600">Loading items...</p>
            ) : items.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">
                No items yet. Add one above to get started.
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
                        checked={Boolean(checkedItems[item.id])}
                        onChange={() => toggleItemChecked(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
                      />
                      <span
                        className={
                          checkedItems[item.id] ? "text-gray-500 line-through" : "text-gray-800"
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
        </section>
      </div>
    </main>
  );
}
