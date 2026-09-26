/**
 * Ofrece un archivo generado para descargar. Dentro de claude.ai usa la
 * capacidad `downloads` (el visor pide confirmación); fuera, un enlace normal.
 * Devuelve true si se ha entregado el archivo.
 */
type Downloads = { save(r: { filename: string; data: string }): Promise<unknown> };

export async function downloadFile(name: string, content: string, type = 'application/json'): Promise<boolean> {
  if (typeof window.claude?.use === 'function') {
    let dl: Downloads | null;
    try {
      dl = (await window.claude.use('downloads')) as Downloads | null;
    } catch {
      dl = null;
    }
    if (dl) {
      try {
        await dl.save({ filename: name, data: content });
        return true;
      } catch {
        return false;
      }
    }
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Lee un archivo elegido por el usuario como texto. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
