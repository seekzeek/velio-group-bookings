import type { Activity } from "./api";

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Builds a small .ics file in the browser. Two hours is a guess; activities carry no duration. */
export function downloadCalendar(activity: Pick<Activity, "id" | "title" | "startsAt" | "location" | "description">) {
  const end = new Date(new Date(activity.startsAt).getTime() + 2 * 3_600_000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Velio//EN",
    "BEGIN:VEVENT",
    `UID:${activity.id}@velio`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(activity.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${activity.title}`,
    `LOCATION:${activity.location}`,
    `DESCRIPTION:${activity.description.replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${activity.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
