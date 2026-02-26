"use client";

import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import type { FlightRecord } from "@/lib/types";
import { exportFlightRecordsAsCsv } from "@/lib/csv-export";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "aborted", label: "Aborted" },
  { value: "emergency", label: "Emergency" },
];

const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
  { value: "duration-desc", label: "Longest" },
  { value: "distance-desc", label: "Farthest" },
];

const SUITE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Suites" },
  { value: "sentry", label: "Sentry" },
  { value: "survey", label: "Survey" },
  { value: "agriculture", label: "Agriculture" },
  { value: "cargo", label: "Cargo" },
  { value: "sar", label: "SAR" },
  { value: "inspection", label: "Inspection" },
];

interface HistoryToolbarProps {
  dateFrom: string;
  dateTo: string;
  status: string;
  droneFilter: string;
  suiteFilter: string;
  sort: string;
  droneNames: { value: string; label: string }[];
  records: FlightRecord[];
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onDroneFilterChange: (v: string) => void;
  onSuiteFilterChange: (v: string) => void;
  onSortChange: (v: string) => void;
}

export function HistoryToolbar({
  dateFrom,
  dateTo,
  status,
  droneFilter,
  suiteFilter,
  sort,
  droneNames,
  records,
  onDateFromChange,
  onDateToChange,
  onStatusChange,
  onDroneFilterChange,
  onSuiteFilterChange,
  onSortChange,
}: HistoryToolbarProps) {

  const allDroneOptions = [{ value: "all", label: "All Drones" }, ...droneNames];

  return (
    <div className="flex items-end gap-3 px-4 py-3 border-b border-border-default flex-wrap shrink-0">
      <Input
        label="From"
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="w-[130px]"
      />
      <Input
        label="To"
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="w-[130px]"
      />
      <Select
        label="Status"
        options={STATUS_OPTIONS}
        value={status}
        onChange={onStatusChange}
      />
      <Select
        label="Drone"
        options={allDroneOptions}
        value={droneFilter}
        onChange={onDroneFilterChange}
      />
      <Select
        label="Suite"
        options={SUITE_OPTIONS}
        value={suiteFilter}
        onChange={onSuiteFilterChange}
      />
      <Select
        label="Sort"
        options={SORT_OPTIONS}
        value={sort}
        onChange={onSortChange}
      />
      <Button
        variant="secondary"
        size="md"
        icon={<Download size={14} />}
        onClick={() => exportFlightRecordsAsCsv(records)}
      >
        Export
      </Button>
    </div>
  );
}
