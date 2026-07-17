export const SPEAKER_COLORS = ["#2dd4bf", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa", "#34d399"];

export function colorFor(speakerId, allSpeakerIds) {
  const idx = allSpeakerIds.indexOf(speakerId);
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}
