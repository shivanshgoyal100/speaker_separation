import { useRef, useState } from "react";

export default function UploadPanel({ onSubmit, submitting }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [speakers, setSpeakers] = useState("auto");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [status, setStatus] = useState({ text: "", isError: false });

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  function handleFiles(fileList) {
    const f = fileList?.[0];
    if (f) setFile(f);
  }

  async function toggleRecording() {
    if (!isRecording) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => setRecordedBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } else {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function handleSubmit() {
    setStatus({ text: "", isError: false });
    let audioBlob = null;

    if (activeTab === "upload") {
      if (!file) return setStatus({ text: "Choose a file first.", isError: true });
      audioBlob = file;
    } else if (activeTab === "record") {
      if (!recordedBlob) return setStatus({ text: "Record something first.", isError: true });
      audioBlob = recordedBlob;
    } else {
      if (!url.trim()) return setStatus({ text: "Enter a URL first.", isError: true });
      setStatus({ text: "Fetching audio from URL...", isError: false });
      try {
        const resp = await fetch(url.trim());
        audioBlob = await resp.blob();
      } catch (err) {
        return setStatus({
          text: "Could not fetch that URL (likely CORS-blocked from the browser). Download it and use Upload instead.",
          isError: true,
        });
      }
    }

    setStatus({ text: "Uploading and separating — this can take a while...", isError: false });
    try {
      await onSubmit({ audioBlob, speakers });
      setStatus({ text: "", isError: false });
    } catch (err) {
      setStatus({ text: "Separation failed: " + err.message, isError: true });
    }
  }

  return (
    <div className="panel">
      <div className="tabs">
        <button className={`tab ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>
          Upload file
        </button>
        <button className={`tab ${activeTab === "record" ? "active" : ""}`} onClick={() => setActiveTab("record")}>
          Record
        </button>
        <button className={`tab ${activeTab === "url" ? "active" : ""}`} onClick={() => setActiveTab("url")}>
          URL
        </button>
        <div className="spacer" />
        <select value={speakers} onChange={(e) => setSpeakers(e.target.value)}>
          <option value="auto">Auto</option>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {activeTab === "upload" && (
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <strong>{file ? file.name : "Drop a wav / mp3 / m4a file here"}</strong>
          {!file && "or click to browse"}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {activeTab === "record" && (
        <div className="dropzone" onClick={toggleRecording}>
          <strong>{isRecording ? "Recording... click to stop" : recordedBlob ? "Recorded — click to record again" : "Click to start recording"}</strong>
          Uses your microphone
        </div>
      )}

      {activeTab === "url" && (
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/meeting.wav"
        />
      )}

      <div className="row-bottom">
        <span>Audio is sent directly to your configured endpoint from this browser.</span>
        <button className="btn-cta" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Separating..." : "Separate speakers →"}
        </button>
      </div>

      {status.text && <div className={status.isError ? "error" : "status"}>{status.text}</div>}
    </div>
  );
}
