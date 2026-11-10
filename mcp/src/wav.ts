/** Duration of a PCM WAV file from its header (no ffprobe needed). Returns seconds. */
export function wavDurationSeconds(buf: Buffer): number {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let pos = 12;
  let byteRate = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      byteRate = buf.readUInt32LE(body + 8);
    } else if (id === "data") {
      if (!byteRate) throw new Error("WAV data chunk before fmt chunk");
      // streamed files may carry 0 or 0xFFFFFFFF as size: use what is actually there
      const avail = buf.length - body;
      const bytes = size === 0 || size === 0xffffffff || size > avail ? avail : size;
      return bytes / byteRate;
    }
    pos = body + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}
