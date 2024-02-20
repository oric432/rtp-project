const dgram = require("dgram");
const { mergeBuffers } = require("./merge");
const { parseRtpPacket, saveRecordingsToDB, formatBytes } = require("./utils");
const { saveRecording } = require("./minioClient");

class AudioRecorder {
  // TODO Consider using event emitter to decouple DB/Minio dependency

  constructor(multicastAddress, port, id) {
    // Constants
    this.MULTICAST_ADDR = multicastAddress;
    this.PORT = port;
    this.SAMPLE_RATE = 44100;
    this.BIT_PER_SAMPLE = 16;
    this.DURATION = 5 * 1000; // 5 seconds in ms
    this.BPMS = (this.SAMPLE_RATE * this.BIT_PER_SAMPLE) / 8 / 1000; // 88.2
    this.SESSION_ID = id;

    // Server variables
    this.recordingCount = 0;
    this.udpServer = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.buffer = Buffer.alloc(this.BPMS * this.DURATION); // 882000 bytes
    this.startedDate = new Date();
    this.count = 0;
    this.clients = new Map();

    this.setupServer();
  }

  setupServer() {
    this.udpServer.on("error", (err) => {
      console.log(`Server error:\n${err.stack}`);
      // TODO Check if socket needs to be closed after error
      this.udpServer.close();
    });

    this.udpServer.on("message", (msg) => {
      this.handleMessage(msg);
    });

    this.udpServer.bind(this.PORT, this.MULTICAST_ADDR);

    // TODO Handle on a global app level
    process.on("SIGINT", () => {
      this.handleDisconnect();
    });
  }

  handleMessage(msg) {
    ///// TODO Include rtp payload in rtpPacket and avoid subarry call in processData()
    const rtpPacket = parseRtpPacket(msg);

    if (rtpPacket) {
      this.updateClient(rtpPacket);
      this.processData(rtpPacket);
    } else {
      console.log("Received non-RTP packet");
    }
  }

  updateClient(rtpPacket) {
    const client = this.clients.get(rtpPacket.ssrc);

    if (!client) {
      this.clients.set(rtpPacket.ssrc, {
        timestamp: 0,
        startedDate: new Date(),
      });
    } else {
      this.clients.set(rtpPacket.ssrc, {
        timestamp: rtpPacket.timestamp,
        startedDate: client.startedDate,
      });
    }
  }

  async processData(rtpPacket) {
    const client = this.clients.get(rtpPacket.ssrc);
    console.log("ssrc: ", rtpPacket.ssrc);
    console.log("sequence number: ", rtpPacket.sequenceNumber);
    console.log("timestamp: ", rtpPacket.timestamp);

    // remove header to get only the required data
    let data = rtpPacket.payload;
    // calculate how much time it took for the data to move : (data[bytes] / BPMS[bytes/ms] = transfer-rate[ms])
    const bpmsg = Math.round(data.length / this.BPMS);

    if (this.count === 0) {
      // TODO Better variable names will make processes clearer without comments
      this.count = Math.round(
        ((new Date() - this.startedDate) / bpmsg) * data.length
      );
    } else {
      this.count += data.length;
    }

    // calculate the time that has passed since the recording was up : (client-joined[date] - recording-started[date] = ms-offset[ms])
    const currentTime = client.startedDate - this.startedDate;
    console.log("time offset: ", currentTime);

    let start = Math.round(
      ((currentTime + rtpPacket.timestamp) / bpmsg) * data.length -
        this.buffer.length * this.recordingCount
    );

    if (start < 0) {
      return;
    }

    if (start + data.length > this.buffer.length) {
      let left = this.buffer.length - start;
      left = left % 2 !== 0 ? left - 1 : left;
      mergeBuffers(this.buffer, data.subarray(0, left), start, start + left);

      data = data.subarray(left, data.length);
      start = 0;

      const recordingBuffer = Buffer.from(this.buffer);
      // normalizeLoudness(recordingBuffer);

      this.count = data.length;
      // write to minio
      await saveRecording(
        this.SESSION_ID,
        this.recordingCount++,
        recordingBuffer
      );

      this.buffer.fill(0);
    }

    mergeBuffers(this.buffer, data, start, start + data.length);
  }

  async handleDisconnect() {
    this.udpServer.close();

    console.log(`${this.MULTICAST_ADDR}:${this.PORT} audio session has closed`);

    const cutBuffer = this.buffer.subarray(0, this.count);
    // normalizeLoudness(cutBuffer);

    await saveRecording(this.SESSION_ID, this.recordingCount, cutBuffer);
    
    return {
      id: this.SESSION_ID,
      MCAddress: `${this.MULTICAST_ADDR}:${this.PORT}`,
      name: `${this.SESSION_ID}`,
      date: this.startedDate,
      recordingLength:
        this.DURATION * this.recordingCount +
        parseInt(cutBuffer.length / this.BPMS),
      filePath: this.SESSION_ID,
      fileSize: formatBytes(
        this.buffer.length * this.recordingCount + cutBuffer.length
      ),
      recordingCount: this.recordingCount,
    } 
  }

  getServerData() {
    return {
      id: this.SESSION_ID,
      multicastAddress: this.MULTICAST_ADDR,
      port: this.PORT,
      started: this.startedDate,
    };
  }
}

module.exports = { AudioRecorder };
