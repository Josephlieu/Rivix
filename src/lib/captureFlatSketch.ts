/** Rasterize the on-screen tech pack SVG for PDF export (@react-pdf does not render DOM SVG). */
export async function captureSvgToPng(svgElementId: string): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined;

  const svg = document.getElementById(svgElementId);
  if (!svg || !(svg instanceof SVGSVGElement)) return undefined;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', '0 0 700 520');
  }

  const svgData = new XMLSerializer().serializeToString(clone);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 1040;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(undefined);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}
