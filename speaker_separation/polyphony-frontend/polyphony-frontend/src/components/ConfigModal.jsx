import { useState } from "react";

export default function ConfigModal({ initialConfig, onSave, onClose }) {
  const [endpoint, setEndpoint] = useState(initialConfig.endpoint);
  const [token, setToken] = useState(initialConfig.token);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Model settings</h3>

        <label>Endpoint URL</label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="http://localhost:8000/separate"
        />

        <label>Auth token (optional)</label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token, if your endpoint needs one"
        />

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-accent" onClick={() => onSave({ endpoint, token })}>Save</button>
        </div>
      </div>
    </div>
  );
}
