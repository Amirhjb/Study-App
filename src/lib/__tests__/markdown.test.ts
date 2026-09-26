import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('escapa HTML peligroso', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1))');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href="javascript');
  });

  it('formatea títulos, listas y tareas', () => {
    const html = renderMarkdown('# Tema\n- uno\n- [x] hecho\n\n**negrita**');
    expect(html).toContain('<h1>Tema</h1>');
    expect(html).toContain('<li>uno</li>');
    expect(html).toContain('☑');
    expect(html).toContain('<strong>negrita</strong>');
  });
});
