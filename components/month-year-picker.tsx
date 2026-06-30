"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MonthYearPickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
}

const MIN_YEAR = 2025;
const MAX_YEAR = 2036;

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "Select month & year",
  className,
}: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-input bg-background text-sm font-normal hover:bg-muted transition-colors w-full text-left",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          {value ? format(value, "MMMM yyyy") : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={new Date(MIN_YEAR, 0)}
          endMonth={new Date(MAX_YEAR, 11)}
          defaultMonth={value ?? new Date()}
          selected={value ?? undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(new Date(date.getFullYear(), date.getMonth(), 1));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
