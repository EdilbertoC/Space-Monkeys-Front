import { matchesSensor, type SensorSelection } from "../../sensors/sensors.ts";
import { isDateRange } from "../date-selection/date-range.ts";

const recentActivityRecords = [
  {
    region: "Amazonas, Brazil",
    continent: "South America",
    flag: "BR",
    date: "Aug 24, 2026",
    time: "14:32 UTC",
    sensor: "VIIRS",
    count: 1842,
    level: "Critical",
  },
  {
    region: "Central Africa",
    continent: "Africa",
    flag: "CD",
    date: "Aug 24, 2026",
    time: "14:18 UTC",
    sensor: "MODIS",
    count: 1256,
    level: "High",
  },
  {
    region: "British Columbia, Canada",
    continent: "North America",
    flag: "CA",
    date: "Aug 24, 2026",
    time: "13:56 UTC",
    sensor: "VIIRS",
    count: 684,
    level: "High",
  },
  {
    region: "Siberia, Russia",
    continent: "Asia",
    flag: "RU",
    date: "Aug 24, 2026",
    time: "13:41 UTC",
    sensor: "VIIRS",
    count: 428,
    level: "Moderate",
  },
  {
    region: "Queensland, Australia",
    continent: "Oceania",
    flag: "AU",
    date: "Aug 24, 2026",
    time: "13:24 UTC",
    sensor: "MODIS",
    count: 312,
    level: "Moderate",
  },
  {
    region: "Attica, Greece",
    continent: "Europe",
    flag: "GR",
    date: "Aug 24, 2026",
    time: "12:52 UTC",
    sensor: "VIIRS",
    count: 96,
    level: "Low",
  },
  {
    region: "Mato Grosso, Brazil",
    continent: "South America",
    flag: "BR",
    date: "Aug 24, 2026",
    time: "12:36 UTC",
    sensor: "MODIS",
    count: 723,
    level: "High",
  },
  {
    region: "Zambia",
    continent: "Africa",
    flag: "ZM",
    date: "Aug 24, 2026",
    time: "12:15 UTC",
    sensor: "VIIRS",
    count: 516,
    level: "Moderate",
  },
];

const RECENT_ACTIVITY_DATE = "2026-08-24";

export function filterRecentActivity(region: string, period: string, sensor: SensorSelection) {
  return recentActivityRecords.filter(
    (record) =>
      (region === "Global" || record.continent === region) &&
      matchesSensor(sensor, record.sensor) &&
      (!isDateRange(period) ||
        (period.slice(0, 10) <= RECENT_ACTIVITY_DATE && period.slice(-10) >= RECENT_ACTIVITY_DATE)),
  );
}
