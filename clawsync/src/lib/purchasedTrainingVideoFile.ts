/** Decode purchased training video base64 into a File for the local trainer API. */
export function base64ToVideoFile(base64: string, mime: string, filename: string): File {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

export function videoFilenameForSkill(skillName: string, videoMime: string): string {
  const base = skillName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'training-data';
  const mime = videoMime.toLowerCase();
  if (mime.includes('webm')) return `${base}.webm`;
  if (mime.includes('quicktime') || mime.includes('mov')) return `${base}.mov`;
  return `${base}.mp4`;
}
