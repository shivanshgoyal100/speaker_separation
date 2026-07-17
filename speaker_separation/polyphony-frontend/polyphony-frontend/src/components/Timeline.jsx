import { colorFor } from "../colors";

export default function Timeline({ diarization, speakerIds }) {
  let maxTime = 0;
  Object.values(diarization || {}).forEach((segs) =>
    segs.forEach(([, end]) => { if (end > maxTime) maxTime = end; })
  );

  if (maxTime === 0) return null;

  return (
    <div className="timeline">
      {Object.entries(diarization || {}).map(([speaker, segs]) =>
        segs.map(([start, end], i) => (
          <div
            key={`${speaker}-${i}`}
            className="timeline-seg"
            title={`${speaker}: ${start.toFixed(1)}s - ${end.toFixed(1)}s`}
            style={{
              left: `${(start / maxTime) * 100}%`,
              width: `${((end - start) / maxTime) * 100}%`,
              background: colorFor(speaker, speakerIds),
            }}
          />
        ))
      )}
    </div>
  );
}
