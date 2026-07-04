"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MoodOption = "" | "Calm" | "Happy" | "Irritable" | "Energetic";
type StoredMoodOption = Exclude<MoodOption, ""> | "Outburst";
type AppetiteOption = "" | "Low" | "Normal" | "High";
type OutburstTriggerOption =
  | ""
  | "Brother"
  | "TV"
  | "iPad"
  | "Hunger"
  | "Fatigue"
  | "Sensory overload"
  | "Communication"
  | "Atomoxetine";
type MorningMedicationKey =
  | "leucovorin"
  | "speakd_omega3"
  | "nutrasea_omega3"
  | "b12"
  | "nac"
  | "atomoxetine"
  | "intuniv"
  | "allkidz_probiotic";
type EveningMedicationKey =
  | "atomoxetine"
  | "intuniv"
  | "leucovorin"
  | "nac"
  | "magnesium"
  | "speakd_omega3"
  | "nutrasea_omega3"
  | "allkidz_probiotic";
type MedicationKey =
  | "leucovorin"
  | "speakd_omega3"
  | "nutrasea_omega3"
  | "b12"
  | "nac"
  | "atomoxetine"
  | "intuniv"
  | "magnesium"
  | "allkidz_probiotic";
type DoseTimeOfDay = "morning" | "evening";
type DoseUnit = "mg" | "ml" | "mcg" | "gummies";

type DoseSnapshotEntry = {
  taken: boolean;
  dose_value: number | null;
  dose_unit: DoseUnit | null;
  change_id: string | null;
};
type MorningDoseSnapshot = Record<MorningMedicationKey, DoseSnapshotEntry>;
type EveningDoseSnapshot = Record<EveningMedicationKey, DoseSnapshotEntry>;

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

type ActiveDoseMap = Partial<
  Record<
    `${DoseTimeOfDay}:${MedicationKey}`,
    Pick<DoseChangeRecord, "id" | "dose_value" | "dose_unit" | "effective_date">
  >
>;

type DailyLogRecord = {
  log_date: string;
  sleep_quality: number | null;
  morning_mood: StoredMoodOption | null;
  morning_had_outburst: boolean;
  morning_outburst_minutes: number | null;
  morning_outburst_time: string | null;
  morning_outburst_trigger: Exclude<OutburstTriggerOption, ""> | null;
  morning_appetite: Exclude<AppetiteOption, ""> | null;
  morning_meds: Record<MorningMedicationKey, boolean> | null;
  morning_doses: MorningDoseSnapshot | null;
  evening_mood: StoredMoodOption | null;
  evening_had_outburst: boolean;
  evening_outburst_minutes: number | null;
  evening_outburst_time: string | null;
  evening_outburst_trigger: Exclude<OutburstTriggerOption, ""> | null;
  evening_appetite: Exclude<AppetiteOption, ""> | null;
  evening_meds: Record<EveningMedicationKey, boolean> | null;
  evening_doses: EveningDoseSnapshot | null;
  notes: string | null;
};

type DailyOutburstRow = {
  id: string;
  log_date: string;
  period: "morning" | "evening";
  occurrence_order: number;
  outburst_time: string | null;
  outburst_minutes: number | null;
  outburst_trigger: Exclude<OutburstTriggerOption, ""> | null;
};

type OutburstEntry = {
  localId: string;
  time: string;
  duration: string;
  trigger: OutburstTriggerOption;
};

const initialMorningMeds: Record<MorningMedicationKey, boolean> = {
  leucovorin: false,
  speakd_omega3: false,
  nutrasea_omega3: false,
  b12: false,
  nac: false,
  atomoxetine: false,
  intuniv: false,
  allkidz_probiotic: false,
};

const initialEveningMeds: Record<EveningMedicationKey, boolean> = {
  atomoxetine: false,
  intuniv: false,
  leucovorin: false,
  nac: false,
  magnesium: false,
  speakd_omega3: false,
  nutrasea_omega3: false,
  allkidz_probiotic: false,
};

const morningMedicationOptions: { key: MorningMedicationKey; label: string }[] = [
  { key: "leucovorin", label: "Leucovorin" },
  { key: "speakd_omega3", label: "Speak+D Omega-3" },
  { key: "nutrasea_omega3", label: "NutraSea Omega-3" },
  { key: "b12", label: "B12" },
  { key: "nac", label: "NAC" },
  { key: "atomoxetine", label: "Atomoxetine" },
  { key: "intuniv", label: "Intuniv" },
  { key: "allkidz_probiotic", label: "AllKiDz Probiotic" },
];

const eveningMedicationOptions: { key: EveningMedicationKey; label: string }[] = [
  { key: "atomoxetine", label: "Atomoxetine" },
  { key: "intuniv", label: "Intuniv" },
  { key: "leucovorin", label: "Leucovorin" },
  { key: "nac", label: "NAC" },
  { key: "magnesium", label: "Magnesium" },
  { key: "speakd_omega3", label: "Speak+D Omega-3" },
  { key: "nutrasea_omega3", label: "NutraSea Omega-3" },
  { key: "allkidz_probiotic", label: "AllKiDz Probiotic" },
];

const outburstTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

const outburstTriggerOptions: Exclude<OutburstTriggerOption, "">[] = [
  "Brother",
  "TV",
  "iPad",
  "Hunger",
  "Fatigue",
  "Sensory overload",
  "Communication",
  "Atomoxetine",
];

const createOutburstEntry = (): OutburstEntry => ({
  localId:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  time: "",
  duration: "",
  trigger: "",
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

const parseMinutesFromTime = (time: string) => {
  const [hour, minute] = time.split(":");
  if (!hour || !minute) return Number.POSITIVE_INFINITY;
  return Number.parseInt(hour, 10) * 60 + Number.parseInt(minute, 10);
};

const aggregateOutburstsForLegacyFields = (entries: OutburstEntry[]) => {
  const filledEntries = entries.filter(
    (entry) => entry.time || entry.duration || entry.trigger,
  );

  if (filledEntries.length === 0) {
    return {
      hadOutburst: false,
      minutes: null as number | null,
      time: null as string | null,
      trigger: null as Exclude<OutburstTriggerOption, ""> | null,
    };
  }

  const durationSum = filledEntries.reduce((sum, entry) => {
    const minutes = Number.parseInt(entry.duration, 10);
    return Number.isFinite(minutes) ? sum + minutes : sum;
  }, 0);

  const earliestWithTime = [...filledEntries]
    .filter((entry) => entry.time)
    .sort((a, b) => parseMinutesFromTime(a.time) - parseMinutesFromTime(b.time))[0];

  const firstTrigger = filledEntries.find((entry) => entry.trigger)?.trigger ?? null;

  return {
    hadOutburst: true,
    minutes: durationSum > 0 ? durationSum : null,
    time: earliestWithTime?.time ? toTorontoTimeWithOffset(earliestWithTime.time) : null,
    trigger: firstTrigger ? (firstTrigger as Exclude<OutburstTriggerOption, "">) : null,
  };
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

const sanitizeStoredMood = (value: StoredMoodOption | null): Exclude<MoodOption, ""> | "" =>
  !value || value === "Outburst" ? "" : value;

const normalizeMorningMeds = (
  value: DailyLogRecord["morning_meds"],
): Record<MorningMedicationKey, boolean> => {
  const legacyMeds = value as Record<string, boolean> | null;

  return {
  leucovorin: Boolean(value?.leucovorin),
  speakd_omega3: Boolean(value?.speakd_omega3 ?? legacyMeds?.omega3),
  nutrasea_omega3: Boolean(value?.nutrasea_omega3),
  b12: Boolean(value?.b12),
  nac: Boolean(value?.nac),
  atomoxetine: Boolean(value?.atomoxetine),
  intuniv: Boolean(value?.intuniv),
  allkidz_probiotic: Boolean(value?.allkidz_probiotic),
  };
};

const normalizeEveningMeds = (
  value: DailyLogRecord["evening_meds"],
): Record<EveningMedicationKey, boolean> => {
  const legacyMeds = value as Record<string, boolean> | null;

  return {
  atomoxetine: Boolean(value?.atomoxetine),
  intuniv: Boolean(value?.intuniv),
  leucovorin: Boolean(value?.leucovorin),
  nac: Boolean(value?.nac),
  magnesium: Boolean(value?.magnesium),
  speakd_omega3: Boolean(value?.speakd_omega3 ?? legacyMeds?.omega3),
  nutrasea_omega3: Boolean(value?.nutrasea_omega3),
  allkidz_probiotic: Boolean(value?.allkidz_probiotic),
  };
};

const hasAnyMedication = (meds: Record<string, boolean> | null) =>
  !!meds && Object.values(meds).some(Boolean);

const getActiveDose = (
  activeDoses: ActiveDoseMap,
  timeOfDay: DoseTimeOfDay,
  medKey: MedicationKey,
) => activeDoses[`${timeOfDay}:${medKey}`];

const pruneMedsByActiveDose = <T extends MedicationKey>(
  meds: Record<T, boolean> | null,
  timeOfDay: DoseTimeOfDay,
  activeDoses: ActiveDoseMap,
): Record<T, boolean> | null => {
  if (!meds) return null;

  const entries = Object.entries(meds).map(([medKey, taken]) => [
    medKey,
    getActiveDose(activeDoses, timeOfDay, medKey as MedicationKey)?.dose_value != null
      ? taken
      : false,
  ]);

  return Object.fromEntries(entries) as Record<T, boolean>;
};

const buildDoseSnapshot = <T extends MedicationKey>(
  meds: Record<T, boolean>,
  timeOfDay: DoseTimeOfDay,
  activeDoses: ActiveDoseMap,
): Record<T, DoseSnapshotEntry> => {
  const entries = Object.entries(meds).map(([medKey, taken]) => {
    const activeDose = getActiveDose(activeDoses, timeOfDay, medKey as MedicationKey);
    return [
      medKey,
      {
        taken,
        dose_value: activeDose?.dose_value ?? null,
        dose_unit: activeDose?.dose_unit ?? null,
        change_id: activeDose?.id ?? null,
      },
    ];
  });

  return Object.fromEntries(entries) as Record<T, DoseSnapshotEntry>;
};

const SavedBadge = () => (
  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
    Saved for this date
  </span>
);

export default function Home() {
  const torontoToday = getTorontoDate();
  const [sleepQuality, setSleepQuality] = useState<number>(0);
  const [morningMood, setMorningMood] = useState<MoodOption>("");
  const [morningHadOutburst, setMorningHadOutburst] = useState<boolean>(false);
  const [morningOutbursts, setMorningOutbursts] = useState<OutburstEntry[]>([]);
  const [eveningMood, setEveningMood] = useState<MoodOption>("");
  const [eveningHadOutburst, setEveningHadOutburst] = useState<boolean>(false);
  const [eveningOutbursts, setEveningOutbursts] = useState<OutburstEntry[]>([]);
  const [morningAppetite, setMorningAppetite] = useState<AppetiteOption>("");
  const [eveningAppetite, setEveningAppetite] = useState<AppetiteOption>("");
  const [morningMeds, setMorningMeds] =
    useState<Record<MorningMedicationKey, boolean>>(initialMorningMeds);
  const [eveningMeds, setEveningMeds] =
    useState<Record<EveningMedicationKey, boolean>>(initialEveningMeds);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingToday, setIsLoadingToday] = useState<boolean>(true);
  const [activeDoses, setActiveDoses] = useState<ActiveDoseMap>({});
  const [selectedLogDate, setSelectedLogDate] = useState<string>(torontoToday);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [todaysLog, setTodaysLog] = useState<DailyLogRecord | null>(null);
  const [morningMedsTouched, setMorningMedsTouched] = useState<boolean>(false);
  const [eveningMedsTouched, setEveningMedsTouched] = useState<boolean>(false);
  const filteredMorningMedicationOptions = useMemo(
    () =>
      morningMedicationOptions.filter(
        (med) => getActiveDose(activeDoses, "morning", med.key)?.dose_value != null,
      ),
    [activeDoses],
  );
  const filteredEveningMedicationOptions = useMemo(
    () =>
      eveningMedicationOptions.filter(
        (med) => getActiveDose(activeDoses, "evening", med.key)?.dose_value != null,
      ),
    [activeDoses],
  );

  const applyRecordToForm = (
    record: DailyLogRecord | null,
    outburstRows: DailyOutburstRow[] = [],
  ) => {
    if (!record) {
      setSleepQuality(0);
      setMorningMood("");
      setMorningHadOutburst(false);
      setMorningOutbursts([]);
      setEveningMood("");
      setEveningHadOutburst(false);
      setEveningOutbursts([]);
      setMorningAppetite("");
      setEveningAppetite("");
      setMorningMeds({ ...initialMorningMeds });
      setEveningMeds({ ...initialEveningMeds });
      setNotes("");
      setMorningMedsTouched(false);
      setEveningMedsTouched(false);
      return;
    }

    const morningRows = outburstRows
      .filter((row) => row.period === "morning")
      .sort((a, b) => a.occurrence_order - b.occurrence_order)
      .map((row) => ({
        localId: row.id,
        time: fromStoredTimeToDropdown(row.outburst_time),
        duration: row.outburst_minutes != null ? String(row.outburst_minutes) : "",
        trigger: (row.outburst_trigger ?? "") as OutburstTriggerOption,
      }));
    const eveningRows = outburstRows
      .filter((row) => row.period === "evening")
      .sort((a, b) => a.occurrence_order - b.occurrence_order)
      .map((row) => ({
        localId: row.id,
        time: fromStoredTimeToDropdown(row.outburst_time),
        duration: row.outburst_minutes != null ? String(row.outburst_minutes) : "",
        trigger: (row.outburst_trigger ?? "") as OutburstTriggerOption,
      }));

    const legacyMorningEntry =
      record.morning_outburst_time || record.morning_outburst_minutes || record.morning_outburst_trigger
        ? [
            {
              localId: "legacy-morning",
              time: fromStoredTimeToDropdown(record.morning_outburst_time),
              duration:
                record.morning_outburst_minutes != null
                  ? String(record.morning_outburst_minutes)
                  : "",
              trigger: (record.morning_outburst_trigger ?? "") as OutburstTriggerOption,
            } satisfies OutburstEntry,
          ]
        : [];
    const legacyEveningEntry =
      record.evening_outburst_time || record.evening_outburst_minutes || record.evening_outburst_trigger
        ? [
            {
              localId: "legacy-evening",
              time: fromStoredTimeToDropdown(record.evening_outburst_time),
              duration:
                record.evening_outburst_minutes != null
                  ? String(record.evening_outburst_minutes)
                  : "",
              trigger: (record.evening_outburst_trigger ?? "") as OutburstTriggerOption,
            } satisfies OutburstEntry,
          ]
        : [];

    const resolvedMorningOutbursts =
      morningRows.length > 0 ? morningRows : legacyMorningEntry;
    const resolvedEveningOutbursts =
      eveningRows.length > 0 ? eveningRows : legacyEveningEntry;

    setSleepQuality(record.sleep_quality ?? 0);
    setMorningMood(sanitizeStoredMood(record.morning_mood));
    setMorningHadOutburst(
      record.morning_had_outburst ||
      record.morning_mood === "Outburst" ||
        resolvedMorningOutbursts.length > 0,
    );
    setMorningOutbursts(resolvedMorningOutbursts);
    setEveningMood(sanitizeStoredMood(record.evening_mood));
    setEveningHadOutburst(
      record.evening_had_outburst ||
      record.evening_mood === "Outburst" ||
        resolvedEveningOutbursts.length > 0,
    );
    setEveningOutbursts(resolvedEveningOutbursts);
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
      setActiveDoses({});
      applyRecordToForm(null);

      if (!supabase) {
        setIsLoadingToday(false);
        return;
      }

      const [dailyLogResult, doseChangesResult, outburstsResult] = await Promise.all([
        supabase
          .from("daily_logs")
          .select(
            "log_date, sleep_quality, morning_mood, morning_had_outburst, morning_outburst_minutes, morning_outburst_time, morning_outburst_trigger, morning_appetite, morning_meds, morning_doses, evening_mood, evening_had_outburst, evening_outburst_minutes, evening_outburst_time, evening_outburst_trigger, evening_appetite, evening_meds, evening_doses, notes",
          )
          .eq("log_date", selectedLogDate)
          .maybeSingle(),
        supabase
          .from("medication_dose_changes")
          .select(
            "id, med_key, time_of_day, is_active, dose_value, dose_unit, effective_date, changed_at, notes",
          )
          .lte("effective_date", selectedLogDate)
          .order("effective_date", { ascending: false })
          .order("changed_at", { ascending: false }),
        supabase
          .from("daily_log_outbursts")
          .select(
            "id, log_date, period, occurrence_order, outburst_time, outburst_minutes, outburst_trigger",
          )
          .eq("log_date", selectedLogDate)
          .order("period", { ascending: true })
          .order("occurrence_order", { ascending: true }),
      ]);

      if (!dailyLogResult.error && dailyLogResult.data) {
        const record = dailyLogResult.data as DailyLogRecord;
        setTodaysLog(record);
        applyRecordToForm(
          record,
          ((outburstsResult.data as DailyOutburstRow[] | null) ?? []),
        );
      } else if (!dailyLogResult.error && !dailyLogResult.data) {
        applyRecordToForm(null);
      }

      if (!doseChangesResult.error && doseChangesResult.data) {
        const sortedChanges = doseChangesResult.data as DoseChangeRecord[];
        const active: ActiveDoseMap = {};
        const seen = new Set<`${DoseTimeOfDay}:${MedicationKey}`>();

        sortedChanges.forEach((change) => {
          const key = `${change.time_of_day}:${change.med_key}` as const;
          if (!seen.has(key)) {
            seen.add(key);
            if (!change.is_active) return;
            active[key] = {
              id: change.id,
              dose_value: Number(change.dose_value),
              dose_unit: change.dose_unit,
              effective_date: change.effective_date,
            };
          }
        });

        setActiveDoses(active);
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

  const handleToggleMorningOutburst = (checked: boolean) => {
    setMorningHadOutburst(checked);
    if (checked) {
      setMorningOutbursts((prev) => (prev.length > 0 ? prev : [createOutburstEntry()]));
      return;
    }
    setMorningOutbursts([]);
  };

  const handleToggleEveningOutburst = (checked: boolean) => {
    setEveningHadOutburst(checked);
    if (checked) {
      setEveningOutbursts((prev) => (prev.length > 0 ? prev : [createOutburstEntry()]));
      return;
    }
    setEveningOutbursts([]);
  };

  const updateMorningOutburstEntry = (
    localId: string,
    field: keyof Omit<OutburstEntry, "localId">,
    value: string,
  ) => {
    setMorningOutbursts((prev) =>
      prev.map((entry) =>
        entry.localId === localId ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  const updateEveningOutburstEntry = (
    localId: string,
    field: keyof Omit<OutburstEntry, "localId">,
    value: string,
  ) => {
    setEveningOutbursts((prev) =>
      prev.map((entry) =>
        entry.localId === localId ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  const addMorningOutburstEntry = () =>
    setMorningOutbursts((prev) => [...prev, createOutburstEntry()]);

  const addEveningOutburstEntry = () =>
    setEveningOutbursts((prev) => [...prev, createOutburstEntry()]);

  const removeMorningOutburstEntry = (localId: string) => {
    setMorningOutbursts((prev) => {
      const next = prev.filter((entry) => entry.localId !== localId);
      if (next.length === 0) setMorningHadOutburst(false);
      return next;
    });
  };

  const removeEveningOutburstEntry = (localId: string) => {
    setEveningOutbursts((prev) => {
      const next = prev.filter((entry) => entry.localId !== localId);
      if (next.length === 0) setEveningHadOutburst(false);
      return next;
    });
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

    const existingMorningMood = sanitizeStoredMood(todaysLog?.morning_mood ?? null);
    const existingEveningMood = sanitizeStoredMood(todaysLog?.evening_mood ?? null);
    const resolvedMorningMood = morningMood || existingMorningMood || null;
    const resolvedEveningMood = eveningMood || existingEveningMood || null;
    const baseMorningMeds = morningMedsTouched
      ? morningMeds
      : (todaysLog?.morning_meds ?? null);
    const baseEveningMeds = eveningMedsTouched
      ? eveningMeds
      : (todaysLog?.evening_meds ?? null);
    const resolvedMorningMeds = pruneMedsByActiveDose(
      baseMorningMeds,
      "morning",
      activeDoses,
    );
    const resolvedEveningMeds = pruneMedsByActiveDose(
      baseEveningMeds,
      "evening",
      activeDoses,
    );
    const resolvedMorningDoses =
      morningMedsTouched && resolvedMorningMeds
        ? buildDoseSnapshot(resolvedMorningMeds, "morning", activeDoses)
        : (todaysLog?.morning_doses ?? null);
    const resolvedEveningDoses =
      eveningMedsTouched && resolvedEveningMeds
        ? buildDoseSnapshot(resolvedEveningMeds, "evening", activeDoses)
        : (todaysLog?.evening_doses ?? null);
    const morningEntriesForSave = morningHadOutburst ? morningOutbursts : [];
    const eveningEntriesForSave = eveningHadOutburst ? eveningOutbursts : [];
    const morningOutburstAggregate =
      aggregateOutburstsForLegacyFields(morningEntriesForSave);
    const eveningOutburstAggregate =
      aggregateOutburstsForLegacyFields(eveningEntriesForSave);

    const payload: DailyLogRecord = {
      log_date: selectedLogDate,
      sleep_quality: sleepQuality > 0 ? sleepQuality : (todaysLog?.sleep_quality ?? null),
      morning_mood: resolvedMorningMood,
      morning_had_outburst: morningOutburstAggregate.hadOutburst,
      morning_outburst_minutes: morningOutburstAggregate.minutes,
      morning_outburst_time: morningOutburstAggregate.time,
      morning_outburst_trigger: morningOutburstAggregate.trigger,
      morning_appetite: morningAppetite || todaysLog?.morning_appetite || null,
      morning_meds: resolvedMorningMeds,
      morning_doses: resolvedMorningDoses,
      evening_mood: resolvedEveningMood,
      evening_had_outburst: eveningOutburstAggregate.hadOutburst,
      evening_outburst_minutes: eveningOutburstAggregate.minutes,
      evening_outburst_time: eveningOutburstAggregate.time,
      evening_outburst_trigger: eveningOutburstAggregate.trigger,
      evening_appetite: eveningAppetite || todaysLog?.evening_appetite || null,
      evening_meds: resolvedEveningMeds,
      evening_doses: resolvedEveningDoses,
      notes: notes.trim() || todaysLog?.notes || null,
    };

    try {
      const { error, data } = await supabase
        .from("daily_logs")
        .upsert(payload, { onConflict: "log_date" })
        .select(
          "log_date, sleep_quality, morning_mood, morning_had_outburst, morning_outburst_minutes, morning_outburst_time, morning_outburst_trigger, morning_appetite, morning_meds, morning_doses, evening_mood, evening_had_outburst, evening_outburst_minutes, evening_outburst_time, evening_outburst_trigger, evening_appetite, evening_meds, evening_doses, notes",
        )
        .single();

      if (error) {
        alert(`Failed to save log: ${error.message}`);
        return;
      }

      const outburstRowsPayload = [
        ...morningEntriesForSave.map((entry, index) => ({
          log_date: selectedLogDate,
          period: "morning" as const,
          occurrence_order: index,
          outburst_time: entry.time ? toTorontoTimeWithOffset(entry.time) : null,
          outburst_minutes: entry.duration ? Number.parseInt(entry.duration, 10) : null,
          outburst_trigger: entry.trigger || null,
        })),
        ...eveningEntriesForSave.map((entry, index) => ({
          log_date: selectedLogDate,
          period: "evening" as const,
          occurrence_order: index,
          outburst_time: entry.time ? toTorontoTimeWithOffset(entry.time) : null,
          outburst_minutes: entry.duration ? Number.parseInt(entry.duration, 10) : null,
          outburst_trigger: entry.trigger || null,
        })),
      ].filter(
        (entry) =>
          entry.outburst_time != null ||
          entry.outburst_minutes != null ||
          entry.outburst_trigger != null,
      );

      const { error: deleteOutburstsError } = await supabase
        .from("daily_log_outbursts")
        .delete()
        .eq("log_date", selectedLogDate);

      if (deleteOutburstsError) {
        alert(`Saved log, but failed to refresh outbursts: ${deleteOutburstsError.message}`);
      } else if (outburstRowsPayload.length > 0) {
        const { error: insertOutburstsError } = await supabase
          .from("daily_log_outbursts")
          .insert(outburstRowsPayload);
        if (insertOutburstsError) {
          alert(`Saved log, but failed to save outbursts: ${insertOutburstsError.message}`);
        }
      }

      const savedRecord = data as DailyLogRecord;
      setTodaysLog(savedRecord);
      const { data: refreshedOutbursts } = await supabase
        .from("daily_log_outbursts")
        .select(
          "id, log_date, period, occurrence_order, outburst_time, outburst_minutes, outburst_trigger",
        )
        .eq("log_date", selectedLogDate)
        .order("period", { ascending: true })
        .order("occurrence_order", { ascending: true });
      applyRecordToForm(savedRecord, (refreshedOutbursts as DailyOutburstRow[] | null) ?? []);
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
          <div className="flex flex-wrap gap-2">
            <Link
              href="/training"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Daily Training
            </Link>
            <Link
              href="/checklists"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Checklists
            </Link>
            <Link
              href="/doses"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Manage Doses
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              View History Charts
            </Link>
          </div>
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
                </select>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={morningHadOutburst}
                    onChange={(event) =>
                      handleToggleMorningOutburst(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
                  />
                  Yusuf had outburst?
                  {todaysLog?.morning_had_outburst && <SavedBadge />}
                </label>
              </div>

              {morningHadOutburst && (
                <div className="space-y-3">
                  {morningOutbursts.map((entry, index) => (
                    <div
                      key={entry.localId}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          Morning Outburst #{index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeMorningOutburstEntry(entry.localId)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Outburst Time (Toronto)
                            {todaysLog?.morning_outburst_time && index === 0 && <SavedBadge />}
                          </label>
                          <select
                            value={entry.time}
                            onChange={(event) =>
                              updateMorningOutburstEntry(
                                entry.localId,
                                "time",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select time</option>
                            {outburstTimeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Potential Trigger
                            {todaysLog?.morning_outburst_trigger && index === 0 && <SavedBadge />}
                          </label>
                          <select
                            value={entry.trigger}
                            onChange={(event) =>
                              updateMorningOutburstEntry(
                                entry.localId,
                                "trigger",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select trigger</option>
                            {outburstTriggerOptions.map((trigger) => (
                              <option key={trigger} value={trigger}>
                                {trigger}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Outburst Duration (minutes)
                            {todaysLog?.morning_outburst_minutes != null && index === 0 && (
                              <SavedBadge />
                            )}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={entry.duration}
                            onChange={(event) =>
                              updateMorningOutburstEntry(
                                entry.localId,
                                "duration",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      onClick={addMorningOutburstEntry}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Add Morning Outburst
                    </button>
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
                {filteredMorningMedicationOptions.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No active morning medications with a dose.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredMorningMedicationOptions.map((med) => (
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
                        <span className="text-sm text-gray-700">
                          {med.label}
                          {getActiveDose(activeDoses, "morning", med.key) && (
                            <span className="text-gray-500">
                              {" "}
                              - {getActiveDose(activeDoses, "morning", med.key)?.dose_value}{" "}
                              {getActiveDose(activeDoses, "morning", med.key)?.dose_unit}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
                </select>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={eveningHadOutburst}
                    onChange={(event) =>
                      handleToggleEveningOutburst(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
                  />
                  Yusuf had outburst?
                  {todaysLog?.evening_had_outburst && <SavedBadge />}
                </label>
              </div>

              {eveningHadOutburst && (
                <div className="space-y-3">
                  {eveningOutbursts.map((entry, index) => (
                    <div
                      key={entry.localId}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          Evening Outburst #{index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeEveningOutburstEntry(entry.localId)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Outburst Time (Toronto)
                            {todaysLog?.evening_outburst_time && index === 0 && <SavedBadge />}
                          </label>
                          <select
                            value={entry.time}
                            onChange={(event) =>
                              updateEveningOutburstEntry(
                                entry.localId,
                                "time",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select time</option>
                            {outburstTimeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Potential Trigger
                            {todaysLog?.evening_outburst_trigger && index === 0 && <SavedBadge />}
                          </label>
                          <select
                            value={entry.trigger}
                            onChange={(event) =>
                              updateEveningOutburstEntry(
                                entry.localId,
                                "trigger",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select trigger</option>
                            {outburstTriggerOptions.map((trigger) => (
                              <option key={trigger} value={trigger}>
                                {trigger}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Outburst Duration (minutes)
                            {todaysLog?.evening_outburst_minutes != null && index === 0 && (
                              <SavedBadge />
                            )}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={entry.duration}
                            onChange={(event) =>
                              updateEveningOutburstEntry(
                                entry.localId,
                                "duration",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      onClick={addEveningOutburstEntry}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Add Evening Outburst
                    </button>
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
                {filteredEveningMedicationOptions.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No active evening medications with a dose.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredEveningMedicationOptions.map((med) => (
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
                        <span className="text-sm text-gray-700">
                          {med.label}
                          {getActiveDose(activeDoses, "evening", med.key) && (
                            <span className="text-gray-500">
                              {" "}
                              - {getActiveDose(activeDoses, "evening", med.key)?.dose_value}{" "}
                              {getActiveDose(activeDoses, "evening", med.key)?.dose_unit}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
