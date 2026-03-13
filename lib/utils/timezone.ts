type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getValidatedTimeZone(timeZone?: string | null) {
  if (!timeZone) return null;

  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return null;
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

function splitIsoFallback(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return { date: "", time: "" };
  }

  return {
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 16),
  };
}

export function splitUtcTimestampInTimeZone(
  isoString: string,
  timeZone?: string | null,
) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return { date: "", time: "" };
  }

  const safeTimeZone = getValidatedTimeZone(timeZone);
  if (!safeTimeZone) {
    return splitIsoFallback(isoString);
  }

  const parts = getZonedParts(date, safeTimeZone);

  return {
    date: `${parts.year.toString().padStart(4, "0")}-${parts.month
      .toString()
      .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`,
    time: `${parts.hour.toString().padStart(2, "0")}:${parts.minute
      .toString()
      .padStart(2, "0")}`,
  };
}

export function buildUtcTimestamp(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone?: string | null,
) {
  if (!date || !time) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const safeTimeZone = getValidatedTimeZone(timeZone);

  if (!safeTimeZone) {
    return new Date(`${date}T${time}`).toISOString();
  }

  const desiredUtcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  let utcMs = desiredUtcMs;

  for (let i = 0; i < 3; i += 1) {
    const nextUtcMs =
      desiredUtcMs - getTimeZoneOffsetMs(new Date(utcMs), safeTimeZone);
    if (nextUtcMs === utcMs) {
      break;
    }
    utcMs = nextUtcMs;
  }

  return new Date(utcMs).toISOString();
}
