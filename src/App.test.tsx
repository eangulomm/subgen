import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { estimate: vi.fn().mockResolvedValue({ quota: 1_000_000_000, usage: 0 }) },
  });
});

describe('App', () => {
  it('renders the private local-processing promise and accessible file control', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /Subtítulos para cualquier video/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No se sube a nuestros servidores/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seleccionar archivo/i })).toBeInTheDocument();
  });

  it('has no axe violations on the landing state', async () => {
    const { container } = render(<App />);
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });

  it('shows actual file metadata and generation controls after selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['test'], 'clip.wav', { type: 'audio/wav' }));
    await waitFor(() => expect(screen.getByText('clip.wav')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Generar subtítulos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Idioma hablado/i)).toBeInTheDocument();
  });
});
