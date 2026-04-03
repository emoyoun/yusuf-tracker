"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MedicationKey =
  | "leucovorin"
  | "speakd_omega3"
  | "nutrasea_omega3"
  | "b12"
  | "nac"
  | "atomoxetine"
  | "magnesium"
  | "allkidz_probiotic";
type DoseTimeOfDay = "morning" | "evening";
type DoseUnit = "mg" | "ml" | "mcg" | "gummies";

type DoseChangeRecord = {
  id: string;
  med_key: MedicationKey;
  time_of_day: DoseTimeOfDay;
  is_active: boolean;
  dose_value: number | null;
  dose_unit: DoseUnit | null;
  effective_date: string;
  changed_at: string;
  notes: string | null;
};

const medicationOptions: { key: MedicationKey; label: string }[] = [
  { key: "leucovorin", label: "Leucovorin" },
  { key: "speakd_omega3", label: "Speak+D Omega-3" },
  { key: "nutrasea_omega3", label: "NutraSea Omega-3" },
  { key: "b12", label: "B12" },
  { key: "nac", label: "NAC" },
  { key: "atomoxetine", label: "Atomoxetine" },
  { key: "magnesium", label: "Magnesium" },
  { key: "allkidz_probiotic", label: "AllKiDz Probiotic" },
];

const getTorontoDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
  }).format(new Date());

const getDoseUnitForMedication = (medKey: MedicationKey): DoseUnit =>
  medKey === "speakd_omega3" || medKey === "nutrasea_omega3"
    ? "ml"
    : medKey === "b12"
      ? "mcg"
      : medKey === "allkidz_probiotic"
        ? "gummies"
        : "mg";

export default function DosesPage() {
  const [medKey, setMedKey] = useState<MedicationKey>("leucovorin");
  const [timeOfDay, setTimeOfDay] = useState<DoseTimeOfDay>("morning");
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [doseValue, setDoseValue] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>(getTorontoDate());
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<DoseChangeRecord[]>([]);
  const selectedUnit = getDoseUnitForMedication(medKey);

  const loadChanges = async () => {
    if (!supabase) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error: queryError } = await supabase
      .from("medication_dose_changes")
      .select(
        "id, med_key, time_of_day, is_active, dose_value, dose_unit, effective_date, changed_at, notes",
      )
      .order("effective_date", { ascending: false })
      .order("changed_at", { ascending: false })
      .limit(200);

    if (queryError) {
      setError(queryError.message);
      setIsLoading(false);
      return;
    }

    setError(null);
    setChanges((data as DoseChangeRecord[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadChanges();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const parsedDose = Number.parseFloat(doseValue);
    if (!isStopped && (!Number.isFinite(parsedDose) || parsedDose <= 0)) {
      alert("Dose must be a number greater than 0.");
      return;
    }

    setIsSaving(true);
    const { error: insertError } = await supabase.from("medication_dose_changes").insert({
      med_key: medKey,
      time_of_day: timeOfDay,
      is_active: !isStopped,
      dose_value: isStopped ? null : parsedDose,
      dose_unit: isStopped ? null : selectedUnit,
      effective_date: effectiveDate,
      notes: notes.trim() || null,
    });

    if (insertError) {
      alert(`Failed to save dose change: ${insertError.message}`);
      setIsSaving(false);
      return;
    }

    setDoseValue("");
    setIsStopped(false);
    setNotes("");
    await loadChanges();
    setIsSaving(false);
    alert("Dose change saved.");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Manage Dose Changes
            </h1>
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

          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="medKey" className="mb-1 block text-sm font-medium text-gray-700">
                Medication
              </label>
              <select
                id="medKey"
                value={medKey}
                onChange={(event) => setMedKey(event.target.value as MedicationKey)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {medicationOptions.map((medication) => (
                  <option key={medication.key} value={medication.key}>
                    {medication.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="timeOfDay"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Time of Day
              </label>
              <select
                id="timeOfDay"
                value={timeOfDay}
                onChange={(event) => setTimeOfDay(event.target.value as DoseTimeOfDay)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>

            <div>
              <label htmlFor="doseValue" className="mb-1 block text-sm font-medium text-gray-700">
                Dose ({selectedUnit})
              </label>
              <input
                id="doseValue"
                type="number"
                min="0.01"
                step="0.01"
                value={doseValue}
                onChange={(event) => setDoseValue(event.target.value)}
                disabled={isStopped}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="e.g. 10"
              />
              <p className="mt-1 text-xs text-gray-500">
                Speak+D Omega-3 and NutraSea Omega-3 use ml, B12 uses mcg, AllKiDz Probiotic uses gummies,
                all other medications use mg.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isStopped}
                  onChange={(event) => setIsStopped(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
                />
                Medication stopped (clear dose)
              </label>
            </div>

            <div>
              <label
                htmlFor="effectiveDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Effective Date
              </label>
              <input
                id="effectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Reason for change, doctor update, etc."
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Save Dose Change"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">Dose Change History</h2>
          {isLoading && <p className="mt-2 text-sm text-gray-600">Loading...</p>}
          {!isLoading && error && (
            <p className="mt-2 text-sm text-red-600">Unable to load dose changes: {error}</p>
          )}
          {!isLoading && !error && changes.length === 0 && (
            <p className="mt-2 text-sm text-gray-600">No dose changes logged yet.</p>
          )}
          {!isLoading && !error && changes.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600">
                    <th className="px-2 py-2 font-medium">Effective Date</th>
                    <th className="px-2 py-2 font-medium">Medication</th>
                    <th className="px-2 py-2 font-medium">Time</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Dose</th>
                    <th className="px-2 py-2 font-medium">Changed At</th>
                    <th className="px-2 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.id} className="border-b border-gray-100 text-gray-800">
                      <td className="px-2 py-2">{change.effective_date}</td>
                      <td className="px-2 py-2">
                        {medicationOptions.find((med) => med.key === change.med_key)?.label ??
                          change.med_key}
                      </td>
                      <td className="px-2 py-2 capitalize">{change.time_of_day}</td>
                      <td className="px-2 py-2">
                        {change.is_active ? "Active" : "Stopped"}
                      </td>
                      <td className="px-2 py-2">
                        {change.is_active && change.dose_value != null && change.dose_unit
                          ? `${change.dose_value} ${change.dose_unit}`
                          : "-"}
                      </td>
                      <td className="px-2 py-2">
                        {new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(change.changed_at))}
                      </td>
                      <td className="px-2 py-2">{change.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
