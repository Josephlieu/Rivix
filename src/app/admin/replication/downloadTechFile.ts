import type { ReplicationRequest } from '@/lib/replicationStorage';

// Photos come from short-lived private links. Fetch each one and shrink it (max 1000 px, JPEG) so the PDF
// stays small and the PDF library never has to reach the storage server itself.
async function photoData(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; // transparent PNGs would turn black as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

// The RIVIX logo as a data URL (the PDF library reads it from the file itself, never from a web address).
async function logoData(): Promise<string | undefined> {
  try {
    const blob = await (await fetch('/logo.png')).blob();
    return await new Promise<string | undefined>(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : undefined);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

const slug = (v: string) => v.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'garment';

/** Builds the tech file PDF for a request and saves it through the browser. Throws a readable Error on failure. */
export async function downloadTechFile(rep: ReplicationRequest): Promise<void> {
  const [{ pdf }, { TechPackPDF, buildTechFileData }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/lib/TechPackPDF'),
  ]);
  const photos = (await Promise.all(rep.images.slice(0, 7).map(photoData))).filter((p): p is string => !!p);
  const data = buildTechFileData(rep, photos, await logoData());
  const blob = await pdf(TechPackPDF({ d: data })).toBlob();

  const status = data.approved ? `rev${data.revision}` : 'DRAFT';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${data.requestCode}-${slug(rep.productName)}-tech-file-${status}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
