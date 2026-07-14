import { describe, expect, it } from 'vitest';
import {
  addInventoryItem,
  consumeInventoryItem,
  hasInventoryItem,
  inventoryQuantity,
  sanitizeInventory,
} from '../src/game/inventory';

describe('inventario', () => {
  it('agrega objetos y respeta la cantidad máxima', () => {
    let inventory = addInventoryItem([], 'bidon-combustible', 2);
    inventory = addInventoryItem(inventory, 'bidon-combustible', 5);

    expect(inventoryQuantity(inventory, 'bidon-combustible')).toBe(3);
    expect(hasInventoryItem(inventory, 'bidon-combustible', 3)).toBe(true);
  });

  it('consume únicamente cuando existe la cantidad completa', () => {
    const inventory = addInventoryItem([], 'bidon-combustible', 2);

    expect(consumeInventoryItem(inventory, 'bidon-combustible', 3)).toBeNull();
    expect(consumeInventoryItem(inventory, 'bidon-combustible', 0)).toBeNull();
    expect(consumeInventoryItem(inventory, 'bidon-combustible', 1)).toEqual([
      { itemId: 'bidon-combustible', quantity: 1 },
    ]);
  });

  it('descarta objetos desconocidos y combina duplicados al sanear', () => {
    expect(
      sanitizeInventory([
        { itemId: 'rele-encendido', quantity: 1 },
        { itemId: 'rele-encendido', quantity: 4 },
        { itemId: 'objeto-desconocido', quantity: 10 },
      ]),
    ).toEqual([{ itemId: 'rele-encendido', quantity: 1 }]);
  });
});
