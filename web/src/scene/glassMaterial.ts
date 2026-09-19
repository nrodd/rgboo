// Neutral at the centre, with inward displacement near each edge: a rounded
// lens rather than a noisy ripple across the controls.
export const glassLensMap = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="600" viewBox="0 0 360 600">
<defs>
  <linearGradient id="x"><stop stop-color="#f00000"/><stop offset=".08" stop-color="#800000"/><stop offset=".92" stop-color="#800000"/><stop offset="1" stop-color="#100000"/></linearGradient>
  <linearGradient id="y" x2="0" y2="1"><stop stop-color="#00f000"/><stop offset=".05" stop-color="#008000"/><stop offset=".95" stop-color="#008000"/><stop offset="1" stop-color="#001000"/></linearGradient>
</defs>
<rect width="360" height="600" fill="url(#x)"/>
<rect width="360" height="600" fill="url(#y)" style="mix-blend-mode:screen"/>
</svg>`)}`;
