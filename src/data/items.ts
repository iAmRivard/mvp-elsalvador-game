import type { InventoryItemDefinition } from '../types/progression';

export const inventoryItemDefinitions: readonly InventoryItemDefinition[] = [
  {
    id: 'bidon-combustible',
    name: 'Bidón de combustible',
    description:
      'Reserva sellada para recuperar combustible durante una expedición.',
    type: 'consumable',
    maximumQuantity: 3,
  },
  {
    id: 'rele-encendido',
    name: 'Relé de encendido',
    description: 'Pieza compatible con el sistema eléctrico del vehículo.',
    type: 'vehicle-part',
    maximumQuantity: 1,
  },
  {
    id: 'fusible-radio',
    name: 'Fusible de radio',
    description:
      'Componente recuperado de una estación de transmisión abandonada.',
    type: 'mission',
    maximumQuantity: 1,
  },
  {
    id: 'fragmento-de-caldera',
    name: 'Fragmento de caldera',
    description:
      'Roca alterada por la señal encontrada alrededor de Coatepeque.',
    type: 'artifact',
    maximumQuantity: 1,
  },
] as const;

export const inventoryItemById = new Map(
  inventoryItemDefinitions.map((item) => [item.id, item]),
);
