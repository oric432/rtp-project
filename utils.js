const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const parseRtpPacket = (packet) => {
  // Basic RTP header structure (assumes 12-byte header)
  if (packet.length < 12) {
    return null; // Not a complete RTP packet
  }

  const version = (packet[0] >> 6) & 0x03;
  const padding = (packet[0] >> 5) & 0x01;
  const extension = (packet[0] >> 4) & 0x01;
  const csrcCount = packet[0] & 0x0f;
  const marker = (packet[1] >> 7) & 0x01;
  const payloadType = packet[1] & 0x7f;
  const sequenceNumber = (packet[2] << 8) | packet[3];
  const timestamp =
    (packet[4] << 24) | (packet[5] << 16) | (packet[6] << 8) | packet[7];
  const ssrc =
    (packet[8] << 24) | (packet[9] << 16) | (packet[10] << 8) | packet[11];
  const payload = packet.subarray(12, packet.length);

  return {
    version,
    padding,
    extension,
    csrcCount,
    marker,
    payloadType,
    sequenceNumber,
    timestamp,
    ssrc,
    payload,
  };
};

const saveRecordingsToDB = async (body) => {
  try {
    const response = await fetch("http://localhost:3000/api/v1/recordings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    console.log(data);
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  formatBytes,
  parseRtpPacket,
  saveRecordingsToDB,
};
