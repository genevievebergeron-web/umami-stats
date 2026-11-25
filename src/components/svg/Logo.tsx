import type { SVGProps } from 'react';

// Mot-symbole Geneviève Bergeron : « G. » en Fraunces (police chargée par global.css).
const SvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    viewBox="0 0 24 24"
    aria-hidden="true"
    {...props}
  >
    <text x="1" y="19" fill="currentColor" style={{ font: '400 21px var(--font-titre)' }}>
      G.
    </text>
  </svg>
);
export default SvgLogo;
