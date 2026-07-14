import { inventoryItemById } from '../data/items';
import type { InventoryEntry } from '../types/progression';

export function inventoryQuantity(
  inventory: readonly InventoryEntry[],
  itemId: string,
): number {
  return inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

export function hasInventoryItem(
  inventory: readonly InventoryEntry[],
  itemId: string,
  quantity = 1,
): boolean {
  return inventoryQuantity(inventory, itemId) >= Math.max(0, quantity);
}

export function addInventoryItem(
  inventory: readonly InventoryEntry[],
  itemId: string,
  quantity = 1,
): InventoryEntry[] {
  const definition = inventoryItemById.get(itemId);
  if (!definition || quantity <= 0) return [...inventory];
  const current = inventoryQuantity(inventory, itemId);
  const nextQuantity = Math.min(
    definition.maximumQuantity,
    current + Math.floor(quantity),
  );
  const withoutItem = inventory.filter((entry) => entry.itemId !== itemId);
  return nextQuantity > 0
    ? [...withoutItem, { itemId, quantity: nextQuantity }]
    : withoutItem;
}

export function consumeInventoryItem(
  inventory: readonly InventoryEntry[],
  itemId: string,
  quantity = 1,
): InventoryEntry[] | null {
  const requested = Math.floor(quantity);
  if (requested <= 0) return null;
  if (!hasInventoryItem(inventory, itemId, requested)) return null;
  const remaining = inventoryQuantity(inventory, itemId) - requested;
  return inventory.flatMap((entry) => {
    if (entry.itemId !== itemId) return [entry];
    return remaining > 0 ? [{ itemId, quantity: remaining }] : [];
  });
}

export function sanitizeInventory(
  inventory: readonly InventoryEntry[],
): InventoryEntry[] {
  return inventory.reduce<InventoryEntry[]>(
    (current, entry) => addInventoryItem(current, entry.itemId, entry.quantity),
    [],
  );
}
