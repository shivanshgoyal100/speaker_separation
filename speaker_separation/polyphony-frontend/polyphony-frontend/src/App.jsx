import { useState } from "react";
import UploadPanel from "./components/UploadPanel";
import ConfigModal from "./components/ConfigModal";
import Timeline from "./components/Timeline";
import StemCard from "./components/StemCard";
import SpeakerRadarChart from "./components/RadarChart";
import { loadConfig, saveConfig, separateAudio } from "./api";
import { decodeStems, computeMetrics } from "./analysis";

export default function App() {
  const [config, setConfig] = useState(loadConfig());
  const [showConfig, setShowConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { speaker_count, model_used, stems, diarization }
  const [metrics, setMetrics] = useState(null);

  function handleSaveConfig(newConfig) {
    saveConfig(newConfig);
    setConfig(newConfig);
    setShowConfig(false);
  }

  async function handleSubmit({ audioBlob, speakers }) {
    setSubmitting(true);
    try {
      const data = await separateAudio({
        endpoint: config.endpoint,
        token: config.token,
        audioBlob,
        speakers,
      });
      setResult(data);

      const speakerIds = data.stems.map((s) => s.speaker_id);
      const decoded = await decodeStems(data.stems);
      setMetrics(computeMetrics(decoded, speakerIds));
    } finally {
      setSubmitting(false);
    }
  }

  const speakerIds = result?.stems.map((s) => s.speaker_id) || [];

  return (
    <div className="container">
      <div className="brand">
        <div className="brand-icon">🎙️</div>
        <div>
          <div className="brand-name">Polyphony</div>
          <div className="brand-sub">Overlapping-speech separation</div>
        </div>
        <div className="spacer" />
        <button className="btn-ghost" onClick={() => setShowConfig(true)}>Model settings</button>
      </div>

      <div className="badge-row">
        <div className="badge">
          <span className="badge-dot" />
          Inspired by Google's "Looking to Listen"
        </div>
      </div>

      <div className="hero">
        <h1>
          Untangle <span className="accent">every voice</span>
          <br />
          from a single track.
        </h1>
        <p>
          Upload audio with 2+ people talking simultaneously. Get one clean stem per speaker,
          ready to play, transcribe, and download.
        </p>
      </div>

      <div className="config-banner">
        <strong>Point Polyphony at your separation model to start.</strong>
        <span>Any HTTP endpoint that returns base64 WAV stems works — MossFormer2, TSE, your own service.</span>
        <button className="btn-accent" onClick={() => setShowConfig(true)}>Configure</button>
      </div>

      <UploadPanel onSubmit={handleSubmit} submitting={submitting} />

      {result && (
        <div className="results">
          <h2>Separated speakers</h2>
          <div className="meta">
            {result.speaker_count} speaker(s) detected — separated with {result.model_used}
          </div>

          <Timeline diarization={result.diarization} speakerIds={speakerIds} />

          {result.stems.map((stem) => (
            <StemCard key={stem.speaker_id} stem={stem} speakerIds={speakerIds} />
          ))}

          {metrics && <SpeakerRadarChart metrics={metrics} speakerIds={speakerIds} />}
        </div>
      )}

      {showConfig && (
        <ConfigModal
          initialConfig={config}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
