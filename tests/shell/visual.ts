import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function comparePixels(page: Page, original: Buffer, authenticated: Buffer) {
  const changedPixels = await page.evaluate(
    async ([first, second]) => {
      const decode = async (data: string) => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + data;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const a = await decode(first),
        b = await decode(second);
      if (a.width !== b.width || a.height !== b.height) return -1;
      let changed = 0;
      // Allow only small rasterization rounding, not shifted geometry or changed colors.
      for (let i = 0; i < a.data.length; i += 4)
        if ([0, 1, 2, 3].some((channel) => Math.abs(a.data[i + channel] - b.data[i + channel]) > 4))
          changed++;
      return changed;
    },
    [original.toString('base64'), authenticated.toString('base64')],
  );
  expect(changedPixels).toBe(0);
}
