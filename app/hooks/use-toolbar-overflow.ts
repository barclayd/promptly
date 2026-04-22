import { useCallback, useRef, useState } from 'react';

// Estimated widths in pixels (matching the toolbar's size-7 buttons, etc.)
const ICON_BUTTON_WIDTH = 28; // size-7
const DROPDOWN_TRIGGER_WIDTH = 52; // icon + chevron + padding
const SEPARATOR_WIDTH = 9; // 1px + mx-0.5 margins
const ITEM_GAP = 2; // gap-0.5
const OVERFLOW_BUTTON_WIDTH = 28; // chevron button
const ADD_PROMPT_FULL_WIDTH = 120; // icon + text
const ADD_VARIABLE_FULL_WIDTH = 120; // icon + text
const SPARKLES_MERGED_WIDTH = 28; // icon-only merged button

type ToolbarItemDef = {
  id: string;
  groupId: string;
  overflowPriority: number; // lower = overflows first, Infinity = never
  estimatedWidth: number;
};

type ToolbarOverflowResult = {
  ref: (el: HTMLDivElement | null) => void;
  visibleIds: Set<string>;
  overflowIds: Set<string>;
  hasOverflow: boolean;
  addPromptCollapsed: boolean;
  addVariableCollapsed: boolean;
  insertMerged: boolean;
};

export const useToolbarOverflow = (
  items: ToolbarItemDef[],
): ToolbarOverflowResult => {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const [hasOverflow, setHasOverflow] = useState(false);
  const [addPromptCollapsed, setAddPromptCollapsed] = useState(false);
  const [addVariableCollapsed, setAddVariableCollapsed] = useState(false);
  const [insertMerged, setInsertMerged] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const calculate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const containerWidth = el.clientWidth;
    const currentItems = itemsRef.current;

    // Separate pinned (never overflow) from overflowable items
    const pinned = currentItems.filter(
      (i) => i.overflowPriority === Number.POSITIVE_INFINITY,
    );
    const overflowable = currentItems
      .filter((i) => i.overflowPriority !== Number.POSITIVE_INFINITY)
      // Sort by priority descending — highest priority stays visible longest
      .sort((a, b) => b.overflowPriority - a.overflowPriority);

    // Separate insert items (special merge behavior) from other overflowable items
    const insertItems = overflowable.filter((i) => i.groupId === 'insert');
    const nonInsertItems = overflowable.filter((i) => i.groupId !== 'insert');

    // Calculate pinned width (always visible)
    let pinnedWidth = 0;
    const pinnedGroups = new Set<string>();
    for (const item of pinned) {
      pinnedWidth += item.estimatedWidth + ITEM_GAP;
      pinnedGroups.add(item.groupId);
    }

    // Greedily add non-insert overflowable items (highest priority first)
    const visible = new Set<string>(pinned.map((i) => i.id));
    const overflow = new Set<string>();
    let usedWidth = pinnedWidth;

    // Track groups that have visible items (for separator calculation)
    const visibleGroups = new Set(pinnedGroups);

    for (const item of nonInsertItems) {
      // Would adding this item require a separator?
      const needsSeparator =
        visibleGroups.size > 0 && !visibleGroups.has(item.groupId);
      const separatorCost = needsSeparator ? SEPARATOR_WIDTH + ITEM_GAP : 0;
      const itemCost = item.estimatedWidth + ITEM_GAP + separatorCost;

      // Reserve space for overflow button if we'd overflow anything
      const overflowReserve =
        overflow.size > 0 ? 0 : OVERFLOW_BUTTON_WIDTH + ITEM_GAP;

      if (usedWidth + itemCost + overflowReserve <= containerWidth) {
        visible.add(item.id);
        visibleGroups.add(item.groupId);
        usedWidth += itemCost;
      } else {
        // This item and all remaining lower-priority items overflow
        overflow.add(item.id);
        // Reserve overflow button space on first overflow
        if (overflow.size === 1) {
          usedWidth += OVERFLOW_BUTTON_WIDTH + ITEM_GAP;
        }
      }
    }

    // Push remaining lower-priority non-insert items into overflow after first overflow
    let hitOverflow = false;
    for (const item of nonInsertItems) {
      if (overflow.has(item.id)) {
        hitOverflow = true;
      }
      if (hitOverflow && !overflow.has(item.id)) {
        overflow.add(item.id);
        visible.delete(item.id);
      }
    }

    // Handle insert items with special merge behavior:
    // Full text → merge into single sparkles → overflow
    let merged = false;

    if (insertItems.length > 0) {
      // Calculate separator cost for insert group
      const needsInsertSep = !visibleGroups.has('insert');
      const insertSepCost = needsInsertSep ? SEPARATOR_WIDTH + ITEM_GAP : 0;

      // Calculate full-text width for all insert items
      const insertFullWidth =
        insertItems.reduce(
          (sum, item) => sum + item.estimatedWidth + ITEM_GAP,
          0,
        ) + insertSepCost;

      // Try full text first
      if (usedWidth + insertFullWidth <= containerWidth) {
        // Full text fits
        for (const item of insertItems) {
          visible.add(item.id);
        }
        visibleGroups.add('insert');
      } else {
        // Try merged sparkles button (single icon button replaces both)
        const mergedCost = SPARKLES_MERGED_WIDTH + ITEM_GAP + insertSepCost;
        const overflowReserve =
          overflow.size === 0 ? OVERFLOW_BUTTON_WIDTH + ITEM_GAP : 0;

        if (usedWidth + mergedCost + overflowReserve <= containerWidth) {
          // Merged fits — mark both as visible but merged
          merged = true;
          for (const item of insertItems) {
            visible.add(item.id);
          }
          visibleGroups.add('insert');
        } else {
          // Insert items overflow entirely
          for (const item of insertItems) {
            overflow.add(item.id);
            if (overflow.size === 1) {
              usedWidth += OVERFLOW_BUTTON_WIDTH + ITEM_GAP;
            }
          }
        }
      }
    }

    const hasAnyOverflow = overflow.size > 0;

    setVisibleIds(visible);
    setOverflowIds(overflow);
    setHasOverflow(hasAnyOverflow);
    setAddPromptCollapsed(false);
    setAddVariableCollapsed(false);
    setInsertMerged(merged);
  }, []);

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      containerRef.current = el;
      if (!el) return;

      const observer = new ResizeObserver(calculate);
      observer.observe(el);
      observerRef.current = observer;

      // Initial calculation
      calculate();
    },
    [calculate],
  );

  return {
    ref,
    visibleIds,
    overflowIds,
    hasOverflow,
    addPromptCollapsed,
    addVariableCollapsed,
    insertMerged,
  };
};

export {
  ADD_PROMPT_FULL_WIDTH,
  ADD_VARIABLE_FULL_WIDTH,
  DROPDOWN_TRIGGER_WIDTH,
  ICON_BUTTON_WIDTH,
  SPARKLES_MERGED_WIDTH,
};
