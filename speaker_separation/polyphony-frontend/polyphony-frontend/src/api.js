const DEFAULT_ENDPOINT = "http://localhost:8000/separate";

export function loadConfig() {
  return {
    endpoint: localStorage.getItem("polyphony_endpoint") || DEFAULT_ENDPOINT,
    token: localStorage.getItem("polyphony_token") || "",
  };
}

export function saveConfig({ endpoint, token }) {
  localStorage.setItem("polyphony_endpoint", endpoint.trim());
  localStorage.setItem("polyphony_token", token.trim());
}

/**
 * Calls the FastAPI /separate endpoint (see server.py). Returns:
 *   { speaker_count, model_used, stems: [{speaker_id, audio_base64}], diarization }
 */
export async function separateAudio({ endpoint, token, audioBlob, speakers }) {
  const form = new FormData();
  form.append("file", audioBlob, "input_audio");
  form.append("speakers", speakers);

  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(endpoint, { method: "POST", body: form, headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Server returned ${resp.status}: ${text}`);
  }
  return resp.json();
}
