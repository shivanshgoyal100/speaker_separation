import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SPEAKER_COLORS } from "../colors";

const METRIC_LABELS = [
  { key: "dominance", label: "Dominance" },
  { key: "energy", label: "Energy" },
  { key: "activity", label: "Activity" },
  { key: "peak", label: "Peak" },
  { key: "clarity", label: "Clarity" },
];

export default function SpeakerRadarChart({ metrics, speakerIds }) {
  // recharts wants one row per axis (metric), with each speaker as a key on that row
  const data = METRIC_LABELS.map(({ key, label }) => {
    const row = { metric: label };
    speakerIds.forEach((id) => {
      row[id] = metrics[id]?.[key] ?? 0;
    });
    return row;
  });

  return (
    <div className="radar-wrap">
      <h3>Per-speaker confidence (client-side analysis)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RechartsRadar data={data}>
          <PolarGrid stroke="#223039" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#7d8f99", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
          {speakerIds.map((id, i) => (
            <Radar
              key={id}
              name={id}
              dataKey={id}
              stroke={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}
              fill={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}
              fillOpacity={0.2}
            />
          ))}
          <Legend wrapperStyle={{ color: "#e6edf0", fontSize: 12 }} />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}
