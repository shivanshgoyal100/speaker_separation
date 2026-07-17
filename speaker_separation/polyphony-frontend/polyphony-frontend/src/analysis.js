/**
 * analysis.js — client-side post-separation analysis, same approach as an
 * audio-analysis.ts module: decode each returned stem, frame it at ~40ms,
 * compute per-frame RMS energy, and derive per-speaker metrics (0..1,
 * normalised) for the radar chart. This runs entirely in the browser --
 * the backend never computes these, it only returns raw stems.
 */

export async function decodeStems(stems) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = {};

  for (const stem of stems) {
    try {
      const bytes = atob(stem.audio_base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      decoded[stem.speaker_id] = await audioCtx.decodeAudioData(arr.buffer);
    } catch (e) {
      console.warn(`Could not decode ${stem.speaker_id} for analysis:`, e);
    }
  }

  return decoded;
}

export function computeMetrics(decodedBuffers, speakerIds) {
  const FRAME_MS = 40;
  const sampleRate = Object.values(decodedBuffers)[0]?.sampleRate || 16000;
  const frameLen = Math.floor((sampleRate * FRAME_MS) / 1000);

  const channelData = {};
  let maxFrames = 0;
  speakerIds.forEach((id) => {
    const buf = decodedBuffers[id];
    if (!buf) return;
    channelData[id] = buf.getChannelData(0);
    maxFrames = Math.max(maxFrames, Math.floor(channelData[id].length / frameLen));
  });

  const rms = {};
  speakerIds.forEach((id) => {
    rms[id] = new Array(maxFrames).fill(0);
  });

  for (let f = 0; f < maxFrames; f++) {
    speakerIds.forEach((id) => {
      const data = channelData[id];
      if (!data) return;
      let sumSq = 0;
      const start = f * frameLen;
      for (let i = start; i < start + frameLen && i < data.length; i++) sumSq += data[i] * data[i];
      rms[id][f] = Math.sqrt(sumSq / frameLen);
    });
  }

  const globalMax = Math.max(1e-6, ...speakerIds.flatMap((id) => rms[id] || [0]));
  const silenceThreshold = globalMax * 0.05;

  const metrics = {};
  speakerIds.forEach((id) => {
    let dominantFrames = 0;
    let activeFrames = 0;
    let peak = 0;
    let energySum = 0;
    let dominanceMarginSum = 0;

    for (let f = 0; f < maxFrames; f++) {
      const myRms = rms[id]?.[f] || 0;
      energySum += myRms;
      peak = Math.max(peak, myRms);
      if (myRms > silenceThreshold) activeFrames++;

      const others = speakerIds.filter((o) => o !== id).map((o) => rms[o]?.[f] || 0);
      const maxOther = others.length ? Math.max(...others) : 0;
      if (myRms >= maxOther && myRms > silenceThreshold) {
        dominantFrames++;
        dominanceMarginSum += myRms - maxOther;
      }
    }

    metrics[id] = {
      dominance: maxFrames ? dominantFrames / maxFrames : 0,
      energy: maxFrames ? energySum / maxFrames / globalMax : 0,
      activity: maxFrames ? activeFrames / maxFrames : 0,
      peak: peak / globalMax,
      clarity: dominantFrames ? Math.min(1, dominanceMarginSum / dominantFrames / globalMax) : 0,
    };
  });

  return metrics;
}
