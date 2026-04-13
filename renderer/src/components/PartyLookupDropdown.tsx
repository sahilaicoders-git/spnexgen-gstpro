import { Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export type PartyOption = {
  gstin: string;
  name: string;
  state: string;
  favorite?: boolean;
  recentRank?: number;
};

type Props = {
  label: string;
  gstinValue: string;
  query: string;
  placeholder: string;
  options: PartyOption[];
  show: boolean;
  onShowChange: (next: boolean) => void;
  onQueryChange: (next: string) => void;
  onGstinChange: (next: string) => void;
  onSelect: (option: PartyOption) => void;
  onAddNew: () => void;
  addNewLabel: string;
  onToggleFavorite?: (gstin: string, next: boolean) => void;
  onDelete?: (gstin: string) => void;
  onRename?: (option: PartyOption) => void;
};

export default function PartyLookupDropdown({
  label,
  gstinValue,
  query,
  placeholder,
  options,
  show,
  onShowChange,
  onQueryChange,
  onGstinChange,
  onSelect,
  onAddNew,
  addNewLabel,
  onToggleFavorite,
  onDelete,
  onRename,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const listWithAction = useMemo(() => {
    return ["__add_new__", ...options.map((opt) => opt.gstin)];
  }, [options]);

  const handleSelectActive = () => {
    const key = listWithAction[activeIndex];
    if (key === "__add_new__") {
      onAddNew();
      onShowChange(false);
      return;
    }

    const found = options.find((opt) => opt.gstin === key);
    if (!found) return;
    onSelect(found);
    onShowChange(false);
  };

  return (
    <div className="relative">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase"
        value={gstinValue}
        onChange={(e) => {
          const next = e.target.value.toUpperCase();
          onGstinChange(next);
          onQueryChange(next);
        }}
        onFocus={() => {
          setActiveIndex(0);
          onShowChange(true);
        }}
        onBlur={() => setTimeout(() => onShowChange(false), 170)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(listWithAction.length - 1, prev + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(0, prev - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            handleSelectActive();
          } else if (e.key === "Escape") {
            onShowChange(false);
          }
        }}
        placeholder={placeholder}
      />

      {show && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-cyan-700 hover:bg-cyan-50 ${
              activeIndex === 0 ? "bg-cyan-50" : ""
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onGstinChange("");
              onQueryChange("");
              onAddNew();
              onShowChange(false);
            }}
          >
            <Plus size={14} /> {addNewLabel}
          </button>

          {options.length === 0 && (
            <div className="px-3 py-3 text-xs text-slate-500">No saved entries found.</div>
          )}

          {options.map((option, idx) => (
            <button
              type="button"
              key={option.gstin}
              className={`w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                activeIndex === idx + 1 ? "bg-slate-50" : ""
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(option);
                onShowChange(false);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-700">{option.name || "-"} ({option.gstin})</p>
                  <p className="text-slate-500">{option.state || "-"}</p>
                </div>
                <div className="flex items-center gap-1">
                  {onToggleFavorite && (
                    <span
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(option.gstin, !Boolean(option.favorite));
                      }}
                      className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
                    >
                      {option.favorite ? <Pin size={12} /> : <PinOff size={12} />}
                    </span>
                  )}
                  {onRename && (
                    <span
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRename(option);
                      }}
                      className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
                    >
                      <Pencil size={12} />
                    </span>
                  )}
                  {onDelete && (
                    <span
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(option.gstin);
                      }}
                      className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={12} />
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
