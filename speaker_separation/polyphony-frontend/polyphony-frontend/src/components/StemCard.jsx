import { colorFor } from "../colors";

export default function StemCard({ stem, speakerIds }) {
  const audioUrl = `data:audio/wav;base64,${stem.audio_base64}`;

  return (
    <div className="stem-card">
      <div className="stem-header">
        <span className="stem-dot" style={{ background: colorFor(stem.speaker_id, speakerIds) }} />
        <span className="stem-name">{stem.speaker_id}</span>
      </div>
      <audio controls src={audioUrl} />
    </div>
  );
}
