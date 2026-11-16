// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import { useId } from "react";

// The Solis mark: an S inside a broken ring, crossed by an orbit, with a flame on the right.
// Colours are tuned for the dark sidebar. Gradient ids are made unique per instance.
// The logo comes from an SI-generated image, so Space Apps rules require a visible watermark:
// the "SI" badge travels with the mark wherever it is used.
export default function SolisMark({ size = 32 }: { size?: number }) {
  return (
    <span className="solis-mark" title="Logo generated with Super Intelligence (SI)">
      <MarkSvg size={size} />
      <span className="si-watermark">SI</span>
    </span>
  );
}

function MarkSvg({ size }: { size: number }) {
  const id = useId().replace(/:/g, "");
  const ring = `${id}-ring`;
  const s = `${id}-s`;
  const flame = `${id}-flame`;
  const orbit = `${id}-orbit`;
  const dot = `${id}-dot`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={ring} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2f86e0" />
          <stop offset="1" stopColor="#33d0f5" />
        </linearGradient>
        <linearGradient id={s} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4aa8f5" />
          <stop offset="1" stopColor="#1f74d6" />
        </linearGradient>
        <linearGradient id={flame} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff3a12" />
          <stop offset="0.6" stopColor="#ff7016" />
          <stop offset="1" stopColor="#ffa81f" />
        </linearGradient>
        <linearGradient id={orbit} gradientUnits="userSpaceOnUse" x1="4" y1="104" x2="196" y2="104">
          <stop offset="0" stopColor="#22d3f7" />
          <stop offset="0.45" stopColor="#2f96ea" />
          <stop offset="0.58" stopColor="#ff8a1f" />
          <stop offset="1" stopColor="#ffb020" />
        </linearGradient>
        <radialGradient id={dot} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffc828" />
          <stop offset="1" stopColor="#ff6a12" />
        </radialGradient>
      </defs>
      <g fill="none" stroke={`url(#${ring})`} strokeWidth="13" strokeLinecap="round">
        <path d="M26.7 126.7A78 78 0 0 1 26.7 73.3" />
        <path d="M33.9 58.7A78 78 0 0 1 38.5 52" />
        <path d="M52 38.5A78 78 0 0 1 139 32.4" />
      </g>
      <g transform="rotate(-27 100 104)">
        <ellipse
          cx="100"
          cy="104"
          rx="96"
          ry="24"
          fill="none"
          stroke={`url(#${orbit})`}
          strokeWidth="7"
        />
      </g>
      <path fill={`url(#${flame})`} d="M85.4 182.7A84 84 0 0 0 176.1 64.5Q150 140 85.4 182.7Z" />
      <path fill={`url(#${flame})`} d="M140 132C128 118 130 104 140 92C139 107 146 117 154 122Z" />
      <path fill={`url(#${flame})`} d="M118 160C108 148 110 136 118 126C118 139 125 147 134 150Z" />
      <path
        fill="none"
        stroke={`url(#${s})`}
        strokeWidth="19"
        strokeLinecap="round"
        d="M126 66C116 54 78 52 72 76C66 100 128 100 128 130C128 158 86 164 70 146"
      />
      <g transform="rotate(-27 100 104)">
        <path
          fill="none"
          stroke={`url(#${orbit})`}
          strokeWidth="7"
          strokeLinecap="round"
          d="M4 104A96 24 0 0 0 100 128"
        />
      </g>
      <circle cx="130" cy="62" r="11" fill={`url(#${dot})`} />
      <circle cx="152" cy="84" r="7.5" fill={`url(#${dot})`} />
    </svg>
  );
}
