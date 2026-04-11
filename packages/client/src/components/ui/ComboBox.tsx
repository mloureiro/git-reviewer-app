import { useState, useRef, useEffect, useCallback } from 'react';
import './ComboBox.css';

interface ComboBoxOption {
  value: string;
  label: string;
  group?: string;
}

interface ComboBoxProps {
  id?: string;
  options: ComboBoxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  groupOrder?: string[];
}

function getFilteredAndSorted(
  options: ComboBoxOption[],
  filter: string,
  groupOrder: string[],
): ComboBoxOption[] {
  const lowerFilter = filter.toLowerCase();

  const filtered = lowerFilter
    ? options.filter((o) => o.value.toLowerCase().includes(lowerFilter))
    : options;

  const groupRank = new Map(groupOrder.map((g, i) => [g, i]));

  const sorted = [...filtered].sort((a, b) => {
    const ga = groupRank.get(a.group ?? '') ?? groupOrder.length;
    const gb = groupRank.get(b.group ?? '') ?? groupOrder.length;
    if (ga !== gb) return ga - gb;

    if (lowerFilter) {
      const posA = a.value.toLowerCase().indexOf(lowerFilter);
      const posB = b.value.toLowerCase().indexOf(lowerFilter);
      if (posA !== posB) return posA - posB;
      if (a.value.length !== b.value.length) return a.value.length - b.value.length;
    }

    return a.label.localeCompare(b.label);
  });

  return sorted;
}

function groupOptions(
  options: ComboBoxOption[],
  groupOrder: string[],
): { group: string; items: ComboBoxOption[] }[] {
  const groups: { group: string; items: ComboBoxOption[] }[] = [];
  const groupMap = new Map<string, ComboBoxOption[]>();

  for (const opt of options) {
    const g = opt.group ?? '';
    let arr = groupMap.get(g);
    if (!arr) {
      arr = [];
      groupMap.set(g, arr);
    }
    arr.push(opt);
  }

  // Maintain groupOrder ordering
  for (const g of groupOrder) {
    const items = groupMap.get(g);
    if (items && items.length > 0) {
      groups.push({ group: g, items });
    }
  }

  // Append any groups not in groupOrder
  for (const [g, items] of groupMap) {
    if (!groupOrder.includes(g) && items.length > 0) {
      groups.push({ group: g, items });
    }
  }

  return groups;
}

function ComboBox({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  groupOrder = [],
}: ComboBoxProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sorted = getFilteredAndSorted(options, value, groupOrder);
  const grouped = groupOptions(sorted, groupOrder);
  const flatOptions = sorted;

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        e.target instanceof Node &&
        !wrapperRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const highlighted = listRef.current.querySelector('.ds-combobox__option--highlighted');
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setOpen(true);
      setHighlightIndex(-1);
    },
    [onChange],
  );

  const handleFocus = useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);

  const selectOption = useCallback(
    (optValue: string) => {
      onChange(optValue);
      setOpen(false);
      setHighlightIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setOpen(true);
          setHighlightIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) => (prev < flatOptions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter': {
          e.preventDefault();
          const selected = flatOptions[highlightIndex];
          if (highlightIndex >= 0 && selected) {
            selectOption(selected.value);
          }
          break;
        }
        case 'Escape':
          setOpen(false);
          setHighlightIndex(-1);
          break;
      }
    },
    [open, flatOptions, highlightIndex, selectOption],
  );

  const showDropdown = open && flatOptions.length > 0;

  return (
    <div className="ds-combobox" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        className="ds-combobox__input"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <div className="ds-combobox__dropdown" ref={listRef} role="listbox">
          {grouped.map(({ group, items }) => {
            return (
              <div key={group}>
                {group && <div className="ds-combobox__group-header">{group}</div>}
                {items.map((opt) => {
                  const idx = flatOptions.indexOf(opt);
                  const highlighted = idx === highlightIndex;
                  return (
                    <div
                      key={`${opt.group ?? ''}-${opt.value}`}
                      className={`ds-combobox__option${highlighted ? ' ds-combobox__option--highlighted' : ''}`}
                      role="option"
                      aria-selected={highlighted}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent input blur
                        selectOption(opt.value);
                      }}
                    >
                      {opt.value}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { ComboBox };
export type { ComboBoxProps, ComboBoxOption };
