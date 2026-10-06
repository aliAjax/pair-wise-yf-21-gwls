import type { DamageZone } from "../types";

const SEV_COLOR: Record<string, string> = { 轻: "#ca8a04", 中: "#ea580c", 重: "#dc2626" };

interface Props {
  zones: DamageZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function MotifMap({ zones, selectedId, onSelect }: Props) {
  return (
    <svg viewBox="0 0 100 70" className="motif" role="img" aria-label="纹样局部标记图">
      <rect x="1" y="1" width="98" height="68" rx="2" fill="#faf5ec" stroke="#7c2d12" strokeWidth="1.2" />
      <rect x="5" y="5" width="90" height="60" fill="none" stroke="#b45309" strokeWidth="0.7" strokeDasharray="2.4 1.6" />
      <rect x="9" y="9" width="82" height="52" fill="none" stroke="#0f766e" strokeWidth="0.4" />
      <ellipse cx="50" cy="35" rx="17" ry="12" fill="none" stroke="#7c2d12" strokeWidth="0.7" />
      <ellipse cx="50" cy="35" rx="8" ry="5.5" fill="none" stroke="#b45309" strokeWidth="0.5" />
      {[[18, 18], [82, 18], [18, 52], [82, 52]].map(([cx, cy]) => (
        <path
          key={`${cx}-${cy}`}
          d={`M ${cx} ${cy - 4} L ${cx + 4} ${cy} L ${cx} ${cy + 4} L ${cx - 4} ${cy} Z`}
          fill="none"
          stroke="#0f766e"
          strokeWidth="0.5"
        />
      ))}
      {zones.map((z, i) => (
        <g key={z.id} onClick={() => onSelect(z.id)} style={{ cursor: "pointer" }}>
          <rect
            x={z.x}
            y={z.y}
            width={z.w}
            height={z.h}
            rx="1"
            fill={SEV_COLOR[z.severity]}
            fillOpacity={selectedId === z.id ? 0.35 : 0.16}
            stroke={SEV_COLOR[z.severity]}
            strokeWidth={selectedId === z.id ? 1 : 0.5}
            strokeDasharray="1.6 1.2"
          />
          <circle cx={z.x + 2.8} cy={z.y + 2.8} r="2.3" fill={SEV_COLOR[z.severity]} />
          <text x={z.x + 2.8} y={z.y + 4} textAnchor="middle" fontSize="3" fill="#ffffff">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
