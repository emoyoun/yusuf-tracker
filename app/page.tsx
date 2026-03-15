"use client";

import { FormEvent, useState } from "react";
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

export default function Home() {
  const [sleepQuality, setSleepQuality] = useState<number>(0);
  const [morningMood, setMorningMood] = useState<MoodOption>("");
  const [morningOutburstDuration, setMorningOutburstDuration] =
    useState<string>("");
  const [eveningMood, setEveningMood] = useState<MoodOption>("");
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

  const handleMorningMedicationChange = (key: MorningMedicationKey) => {
    setMorningMeds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleEveningMedicationChange = (key: EveningMedicationKey) => {
    setEveningMeds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetForm = () => {
    setSleepQuality(0);
    setMorningMood("");
    setMorningOutburstDuration("");
    setEveningMood("");
    setEveningOutburstDuration("");
    setMorningAppetite("");
    setEveningAppetite("");
    setMorningMeds({ ...initialMorningMeds });
    setEveningMeds({ ...initialEveningMeds });
    setNotes("");
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

    try {
      const { error } = await supabase.from("daily_logs").insert({
        sleep_quality: sleepQuality > 0 ? sleepQuality : null,
        morning_mood: morningMood || null,
        morning_outburst_minutes:
          morningMood === "Outburst" && morningOutburstDuration
            ? Number.parseInt(morningOutburstDuration, 10)
            : null,
        morning_appetite: morningAppetite || null,
        morning_meds: morningMeds,
        evening_mood: eveningMood || null,
        evening_outburst_minutes:
          eveningMood === "Outburst" && eveningOutburstDuration
            ? Number.parseInt(eveningOutburstDuration, 10)
            : null,
        evening_appetite: eveningAppetite || null,
        evening_meds: eveningMeds,
        notes: notes.trim() || null,
      });

      if (error) {
        alert(`Failed to save log: ${error.message}`);
        return;
      }

      alert("Log Saved!");
      resetForm();
    } catch {
      alert("Failed to save log due to a network error.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Yusuf&apos;s Daily Log
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Record key updates from today in one place.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <section>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Sleep Quality
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
                <div>
                  <label
                    htmlFor="morningOutburstDuration"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Outburst Duration (minutes)
                  </label>
                  <input
                    id="morningOutburstDuration"
                    type="number"
                    min={1}
                    value={morningOutburstDuration}
                    onChange={(event) => setMorningOutburstDuration(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="morningAppetite"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Morning Appetite
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
                <div>
                  <label
                    htmlFor="eveningOutburstDuration"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Outburst Duration (minutes)
                  </label>
                  <input
                    id="eveningOutburstDuration"
                    type="number"
                    min={1}
                    value={eveningOutburstDuration}
                    onChange={(event) => setEveningOutburstDuration(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="eveningAppetite"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Evening Appetite
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
            disabled={isSaving}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            {isSaving ? "Saving..." : "Save Daily Log"}
          </button>
        </form>
      </div>
    </main>
  );
}
