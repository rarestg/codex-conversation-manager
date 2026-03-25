import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

interface CatalogSelectOption {
  value: string;
  label: string;
}

interface CatalogSelectProps {
  label: string;
  value: string;
  options: CatalogSelectOption[];
  onValueChange: (value: string) => void;
}

export const CatalogSelect = ({ label, value, options, onValueChange }: CatalogSelectProps) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
    <Select.Root
      value={value}
      onValueChange={(nextValue) => {
        if (typeof nextValue === 'string') {
          onValueChange(nextValue);
        }
      }}
      items={options}
    >
      <Select.Trigger className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200">
        <Select.Value placeholder="Select">
          {(selectedValue) => options.find((option) => option.value === selectedValue)?.label ?? 'Select'}
        </Select.Value>
        <Select.Icon className="text-slate-400">
          <ChevronDown className="h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner align="start" sideOffset={8}>
          <Select.Popup className="z-50 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            <Select.List className="max-h-72 overflow-auto outline-none">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition data-[highlighted]:bg-slate-900 data-[highlighted]:text-white"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="text-teal-500 data-[highlighted]:text-white">
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
);
