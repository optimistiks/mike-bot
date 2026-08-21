"use client";

import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/8bit/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/8bit/select";

const yearItems = [
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
];

const monthItems = [
  { value: "all", label: "Весь год" },
  { value: "01", label: "январь" },
  { value: "02", label: "февраль" },
  { value: "03", label: "март" },
  { value: "04", label: "апрель" },
  { value: "05", label: "май" },
  { value: "06", label: "июнь" },
  { value: "07", label: "июль" },
  { value: "08", label: "август" },
  { value: "09", label: "сентябрь" },
  { value: "10", label: "октябрь" },
  { value: "11", label: "ноябрь" },
  { value: "12", label: "декабрь" },
];

export function SeasonNavigation({
  year,
  month,
}: {
  year: string;
  month?: string;
}) {
  const router = useRouter();

  function openSeason(nextYear: string, nextMonth?: string) {
    router.push(
      `/prototypes/v2-ui/leaderboards/${nextYear}${nextMonth ? `/${nextMonth}` : ""}`,
    );
  }

  return (
    <nav
      aria-label="Выбор сезона"
      className="grid gap-4 border-y-4 border-dashed border-ring/60 py-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="season-year">Год</Label>
        <Select
          items={yearItems}
          value={year}
          onValueChange={(value) => {
            if (value) openSeason(value, month);
          }}
        >
          <SelectTrigger id="season-year" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="season-month">Месяц</Label>
        <Select
          items={monthItems}
          value={month ?? "all"}
          onValueChange={(value) => {
            if (!value) return;
            openSeason(year, value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger id="season-month" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Весь год</SelectItem>
            <SelectItem value="01">январь</SelectItem>
            <SelectItem value="02">февраль</SelectItem>
            <SelectItem value="03">март</SelectItem>
            <SelectItem value="04">апрель</SelectItem>
            <SelectItem value="05">май</SelectItem>
            <SelectItem value="06">июнь</SelectItem>
            <SelectItem value="07">июль</SelectItem>
            <SelectItem value="08">август</SelectItem>
            <SelectItem value="09">сентябрь</SelectItem>
            <SelectItem value="10">октябрь</SelectItem>
            <SelectItem value="11">ноябрь</SelectItem>
            <SelectItem value="12">декабрь</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
