const Minio = require("minio");
const { Buffer } = require("buffer");
require('dotenv').config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  useSSL: false,
});

function createWavHeader(dataLength, numChannels, sampleRate, bitsPerSample) {
  const header = Buffer.alloc(44);

  // RIFF identifier
  header.write("RIFF", 0);

  // File size
  header.writeUInt32LE(36 + dataLength, 4);

  // WAVE identifier
  header.write("WAVE", 8);

  // Format chunk identifier
  header.write("fmt ", 12);

  // Format chunk size
  header.writeUInt32LE(16, 16);

  // Audio format (1 for PCM)
  header.writeUInt16LE(1, 20);

  // Number of channels
  header.writeUInt16LE(numChannels, 22);

  // Sample rate
  header.writeUInt32LE(sampleRate, 24);

  // Byte rate
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);

  // Block align
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);

  // Bits per sample
  header.writeUInt16LE(bitsPerSample, 34);

  // Data chunk identifier
  header.write("data", 36);

  // Data chunk size
  header.writeUInt32LE(dataLength, 40);

  return header;
}

const saveRecording = async (sessionId, recordingCount, audioBuffer) => {
  const objectName = `${sessionId}_${recordingCount}.wav`;
  const bucketName = "recordings-bucket";

  try {
    const header = createWavHeader(audioBuffer.length, 1, 44100, 16);
    const wavBuffer = Buffer.concat([header, audioBuffer]);
    await minioClient.putObject(bucketName, objectName, wavBuffer, {
      "Content-Type": "audio/wav",
    });

    return { success: true, name: objectName };
  } catch (error) {
    return { success: false, name: error };
  }
};

module.exports = {
  minioClient,
  saveRecording,
};
