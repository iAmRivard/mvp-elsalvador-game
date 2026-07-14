import { inventoryItemById } from '../../data/items';
import { useGameStore } from '../../store/gameStore';

interface InventoryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InventoryDialog({ open, onClose }: InventoryDialogProps) {
  const inventory = useGameStore((state) => state.inventory);
  if (!open) return null;

  return (
    <div className="settings-backdrop inventory-backdrop">
      <section
        className="inventory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-title"
      >
        <header>
          <div>
            <span>Equipo de campo</span>
            <h2 id="inventory-title">Inventario</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar inventario"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {inventory.length === 0 ? (
          <p className="inventory-dialog__empty">No llevas objetos.</p>
        ) : (
          <ul className="inventory-list">
            {inventory.map((entry) => {
              const item = inventoryItemById.get(entry.itemId);
              if (!item) return null;
              return (
                <li key={entry.itemId}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.type === 'vehicle-part' ? 'Pieza' : item.type}
                    </span>
                  </div>
                  <p>{item.description}</p>
                  <b aria-label={`${entry.quantity} unidades`}>
                    ×{entry.quantity}
                  </b>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
