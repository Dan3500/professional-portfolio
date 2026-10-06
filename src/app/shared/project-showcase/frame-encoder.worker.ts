interface EncodeRequest {
  id: number;
  bitmap: ImageBitmap;
  quality: number;
}

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

addEventListener('message', async (event: MessageEvent<EncodeRequest>) => {
  const { id, bitmap, quality } = event.data;
  try {
    if (!canvas || canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      ctx = canvas.getContext('2d');
    }
    if (!ctx) throw new Error('Sin contexto 2d');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    postMessage({ id, blob });
  } catch {
    postMessage({ id, blob: null });
  } finally {
    bitmap.close();
  }
});
