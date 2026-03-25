import { Checkbox } from '@base-ui/react/checkbox';
import { Popover } from '@base-ui/react/popover';
import { Check, ChevronDown } from 'lucide-react';
import type { SessionCatalogFacetValue } from '../../../../shared/sessionCatalogTypes';

interface FacetFilterPopoverProps {
  label: string;
  options: SessionCatalogFacetValue[];
  selectedValues: string[];
  loading: boolean;
  emptyLabel: string;
  onToggle: (value: string) => void;
  onClear: () => void;
  renderValue?: (value: string) => string;
}

export const FacetFilterPopover = ({
  label,
  options,
  selectedValues,
  loading,
  emptyLabel,
  onToggle,
  onClear,
  renderValue,
}: FacetFilterPopoverProps) => (
  <Popover.Root modal={false}>
    <Popover.Trigger className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200">
      <span>{label}</span>
      {selectedValues.length > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {selectedValues.length}
        </span>
      ) : null}
      <ChevronDown className="h-4 w-4 text-slate-400" />
    </Popover.Trigger>

    <Popover.Portal>
      <Popover.Positioner align="start" sideOffset={8}>
        <Popover.Popup className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl outline-none">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="text-xs text-slate-500">
                {selectedValues.length > 0 ? `${selectedValues.length} selected` : 'No active selections'}
              </p>
            </div>
            {selectedValues.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:text-slate-900"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="max-h-72 overflow-auto p-2">
            {loading ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">Loading {label.toLowerCase()} filters…</p>
            ) : options.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
            ) : (
              <div className="space-y-1">
                {options.map((option) => {
                  const optionValue = option.value;
                  const selected = selectedValues.includes(optionValue);
                  return (
                    <Checkbox.Root
                      key={optionValue}
                      checked={selected}
                      onCheckedChange={() => {
                        onToggle(optionValue);
                      }}
                      className={[
                        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition',
                        'hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-white',
                          selected ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white',
                        ].join(' ')}
                      >
                        <Checkbox.Indicator>
                          <Check className="h-3 w-3" />
                        </Checkbox.Indicator>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-700">
                          {renderValue ? renderValue(optionValue) : option.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-slate-500">
                        {option.count.toLocaleString()}
                      </span>
                    </Checkbox.Root>
                  );
                })}
              </div>
            )}
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);
