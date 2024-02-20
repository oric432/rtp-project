function mergeBuffers(mixedBuffer, buffer, start, end) {
  console.log(
    `merged -> mixedBufferLength=${mixedBuffer.length}, bufferLength=${buffer.length}, start=${start}, end=${end}`
  );
  for (let i = start, j = 0; i < end && j < buffer.length; i += 2, j += 2) {
    // merge bytes by adding, and clamping them to be in the range of 16-bit signed integers
    let mergedSample = buffer.readInt16LE(j) + mixedBuffer.readInt16LE(i);
    mergedSample = Math.min(
      Math.pow(2, 15) - 1,
      Math.max(-1 * Math.pow(2, 15), mergedSample)
    );

    mixedBuffer.writeInt16LE(mergedSample, i);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeBuffer(audioBuffer) {
  // Get buffer length in samples
  const numSamples = audioBuffer.length / 2;

  // Go through samples and get max
  let max = 0;
  for (let i = 0; i < numSamples; i++) {
    const sample = audioBuffer.readInt16LE(i * 2);
    const absValue = Math.abs(sample);

    if (absValue > -32768 && absValue < 32767 && absValue > max) {
      max = absValue;
    }
  }

  // Calculate normalization factor
  // const normalizationFactor = 1.0 / (32767 / max);
  const offset = 32767 - max;
  console.log(max, offset);

  // Apply normalization
  for (let i = 0; i < numSamples; i++) {
    let sample = audioBuffer.readInt16LE(i * 2);
    sample = clamp(sample + offset, -32768, 32767);
    audioBuffer.writeInt16LE(sample, i * 2);
  }
}

function normalizeLoudness(inputBuffer, targetLoudness = -23) {
  // Measure the input audio loudness
  const currentLoudness = loudnessIntegrated(inputBuffer);
  console.log(currentLoudness);

  // Calculate the gain adjustment needed
  const gainAdjustment = targetLoudness - currentLoudness;
  console.log(gainAdjustment);

  // Adjust the gain using the calculated adjustment
  applyGain(inputBuffer, gainAdjustment);
}

function getCurrentLoudness(inputBuffer) {
  // Assuming inputBuffer is a Buffer of 16-bit PCM audio data
  const samples = new Int16Array(inputBuffer.buffer);
  const numSamples = samples.length;

  let sumSquared = 0;

  for (let i = 0; i < numSamples; i++) {
    const sampleValue = samples[i] / 32768.0; // Normalize to the range [-1, 1]
    sumSquared += sampleValue * sampleValue;
  }

  console.log(sumSquared);

  const rms = Math.sqrt(sumSquared / numSamples);
  const loudness = 20 * Math.log10(rms); // Convert RMS to decibels (dB)

  return loudness;
}

function loudnessIntegrated(buffer, sampleRate = 44100) {
  // Constants for the ITU-R BS.1770-4 algorithm
  const K = 0.691;
  const S = 0.002;
  const alpha = 0.3;

  // Filter coefficients for the RMS filter
  const b = [1.0, -2.0, 1.0];
  const a = [1.0, -2.0 * alpha, alpha ** 2];

  const samples = new Int16Array(buffer.buffer);
  // Apply the RMS filter to the squared samples
  const squaredSamples = samples.map((sample) => sample * sample);
  console.log(squaredSamples);
  const rmsFiltered = new Array(buffer.length).fill(0);
  for (let i = 2; i < samples.length - 1; i++) {
    rmsFiltered[i] =
      b[0] * squaredSamples[i] +
      b[1] * squaredSamples[i - 1] +
      b[2] * squaredSamples[i + 1] -
      a[1] * rmsFiltered[i - 1] -
      a[2] * rmsFiltered[i - 2];
  }
  console.log(rmsFiltered);

  // Apply the K-weighting
  const kWeighting = rmsFiltered.reduce((sum, value) => sum + K * value, 0);
  console.log(Math.abs(kWeighting));

  // Calculate the duration of the audio in seconds
  const durationInSeconds = 5;

  // Calculate the integrated loudness in LUFS
  const integratedLoudness = 10.0 * Math.log10(S + Math.abs(kWeighting));
  console.log(integratedLoudness);

  return integratedLoudness;
}

function applyGain(inputBuffer, gainAdjustment) {
  // Assuming inputBuffer is a Buffer of 16-bit PCM audio data

  const linearGain = Math.pow(10, gainAdjustment / 20);

  for (let i = 0; i < inputBuffer.length; i += 2) {
    let sample = inputBuffer.readInt16LE(i);

    // Apply gain to each 16-bit PCM sample
    sample = Math.round(sample * linearGain);

    // Clamp the sample value to the valid range
    sample = clamp(sample, -32768, 32767);

    // Write the clamped sample back to the buffer
    inputBuffer.writeInt16LE(sample, i);
  }

  console.log("adjusted");
}

module.exports = { mergeBuffers, normalizeBuffer, normalizeLoudness };
