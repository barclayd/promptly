import { useCallback, useRef, useState } from 'react';

// Estimated widths in pixels (matching the toolbar's size-7 buttons, etc.)
const ICON_BUTTON_WIDTH = 28; // size-7
const DROPDOWN_TRIGGER_WIDTH = 52; // icon + chevron + padding
const SEPARATOR_WIDTH = 9; // 1px + mx-0.5 margins
const ITEM_GAP = 2; // gap-0.5
const OVERFLOW_BUTTON_WIDTH = 28; // chevron button
const ADD_PROMPT_FULL_WIDTH = 120; // icon + text
const ADD_PROMPT_COLLAPSED_WIDTH = 28; // icon only

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

    // Calculate pinned width (always visible)
    let pinnedWidth = 0;
    const pinnedGroups = new Set<string>();
    for (const item of pinned) {
      pinnedWidth += item.estimatedWidth + ITEM_GAP;
      pinnedGroups.add(item.groupId);
    }

    // Account for the add-prompt button in collapsed form for overflow check
    // The add-prompt button is part of the pinned items but we need to handle
    // its width change separately
    const addPromptItem = pinned.find((i) => i.id === 'add-prompt');
    if (addPromptItem) {
      // Remove its full width and add collapsed width for the overflow check
      pinnedWidth =
        pinnedWidth -
        addPromptItem.estimatedWidth -
        ITEM_GAP +
        ADD_PROMPT_COLLAPSED_WIDTH +
        ITEM_GAP;
    }

    // Greedily add overflowable items (highest priority first)
    const visible = new Set<string>(pinned.map((i) => i.id));
    const overflow = new Set<string>();
    let usedWidth = pinnedWidth;

    // Track groups that have visible items (for separator calculation)
    const visibleGroups = new Set(pinnedGroups);

    for (const item of overflowable) {
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

    // Once we've determined overflow, also push remaining items into overflow
    let hitOverflow = false;
    for (const item of overflowable) {
      if (overflow.has(item.id)) {
        hitOverflow = true;
      }
      if (hitOverflow && !overflow.has(item.id)) {
        // This shouldn't happen with sorted priority, but safety net
        overflow.add(item.id);
        visible.delete(item.id);
      }
    }

    const hasAnyOverflow = overflow.size > 0;

    // Determine if add-prompt should be collapsed
    // Only show full width when everything fits
    let promptCollapsed = hasAnyOverflow;
    if (!hasAnyOverflow && addPromptItem) {
      // Check if using full width still fits
      const fullPromptWidth =
        usedWidth - ADD_PROMPT_COLLAPSED_WIDTH + ADD_PROMPT_FULL_WIDTH;
      promptCollapsed = fullPromptWidth > containerWidth;
    }

    setVisibleIds(visible);
    setOverflowIds(overflow);
    setHasOverflow(hasAnyOverflow);
    setAddPromptCollapsed(promptCollapsed);
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

  return { ref, visibleIds, overflowIds, hasOverflow, addPromptCollapsed };
};

export { ICON_BUTTON_WIDTH, DROPDOWN_TRIGGER_WIDTH, ADD_PROMPT_FULL_WIDTH };
