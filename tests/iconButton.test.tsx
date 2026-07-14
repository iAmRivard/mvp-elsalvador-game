// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from '../src/components/ui/IconButton';

describe('botón de icono accesible', () => {
  afterEach(cleanup);

  it('incluye nombre, título, estado activo y tooltip visible', () => {
    render(<IconButton label="Inventario" icon="▤" active onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Inventario' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    expect(button.getAttribute('title')).toBe('Inventario');
    expect(button.classList.contains('icon-button--active')).toBe(true);
    fireEvent.mouseEnter(button);
    expect(tooltip.getAttribute('data-visible')).toBe('true');
    fireEvent.mouseLeave(button);
    expect(tooltip.getAttribute('data-visible')).toBe('false');
  });

  it('muestra con foco y oculta con Escape', () => {
    render(<IconButton label="Configuración" icon="⚙" onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Configuración' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    fireEvent.focus(button);
    expect(tooltip.getAttribute('data-visible')).toBe('true');
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(tooltip.getAttribute('data-visible')).toBe('false');
  });
});
