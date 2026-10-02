// Shrinks a phone photo in the browser (longest side 1600 px, JPEG) and attaches it to a help request.
export async function uploadPhoto(file: File, ref: string, token: string): Promise<{ ok: boolean; message?: string }> {
  let blob: Blob = file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej()), 'image/jpeg', 0.82));
  } catch { /* unsupported format: send as is, the server checks type and size */ }
  const r = await fetch(`/api/help/photo?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': blob.type || 'image/jpeg' }, body: blob });
  if (r.ok) return { ok: true };
  const d = await r.json().catch(() => ({}));
  return { ok: false, message: d.message };
}
