"use client";

import { useMemo } from "react";
import { Portal, Select, createListCollection } from "@chakra-ui/react";
import "./select-field.css";

export interface SelectOption {
  value: string;
  label: string;
}

/** Chakra Select shared by the editor and sharing controls. */
export function SelectField({
  options,
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  className = "",
  id,
  insideDialog = false,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  insideDialog?: boolean;
}) {
  const collection = useMemo(
    () => createListCollection({ items: options }),
    [options],
  );
  const popup = (
    <Select.Positioner>
      <Select.Content className="folio-select__content">
        {collection.items.map((item) => (
          <Select.Item
            key={item.value}
            item={item}
            title={item.label}
            className="folio-select__item"
          >
            <Select.ItemText>{item.label}</Select.ItemText>
            <Select.ItemIndicator />
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Positioner>
  );

  return (
    <Select.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => onChange(details.value[0] ?? "")}
      disabled={disabled}
      ids={id ? { trigger: id } : undefined}
      size="sm"
      className={`folio-select ${className}`}
      positioning={{
        strategy: "fixed",
        hideWhenDetached: true,
        sameWidth: true,
      }}
      lazyMount
      unmountOnExit
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger
          className="field folio-select__trigger"
          aria-label={label}
        >
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      {insideDialog ? popup : <Portal>{popup}</Portal>}
    </Select.Root>
  );
}
