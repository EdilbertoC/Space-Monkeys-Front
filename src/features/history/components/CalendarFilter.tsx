import { type ReactNode } from "react";
import SelectControl from "../../../shared/ui/SelectControl";
import { type IconName } from "../../../shared/ui/ui";

export default function CalendarFilter({
  label,
  value,
  onChange,
  children,
  icon = "calendar",
  caption = label,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  icon?: IconName;
  caption?: string;
}) {
  return (
    <label className="burn-filter">
      <span>{caption}</span>
      <SelectControl label={label} value={value} onChange={onChange} icon={icon}>
        {children}
      </SelectControl>
    </label>
  );
}
