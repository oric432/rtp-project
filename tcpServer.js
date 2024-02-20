const http = require("http");
const socketIO = require("socket.io");
const { AudioRecorder } = require("./server2");

const httpServer = http.createServer();
const ioServer = socketIO(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const recordings = new Map();

ioServer.on("connection", (socket) => {
  console.log(`new client has connected, id: ${socket.id}`);

  socket.on("startRecording", (recordingData) => {
    const { multicastAddress, port, id } = recordingData;
    const audioRecorder = new AudioRecorder(multicastAddress, port, id);
    recordings.set(id, audioRecorder);

    // add recording to temporary running recroding table 
    ioServer.emit("saveTemporaryRecording", {id, MCAdress: `${multicastAddress}:${port}`});
  });

  socket.on("stopRecording", async (recordingData) => {
    const { id } = recordingData;
    const audioRecorder = recordings.get(id);

    const data = await audioRecorder.handleDisconnect();

    ioServer.emit("deleteTemporaryRecording", data);
    recordings.delete(id);

    // remove recording from temporary running recroding table 

  });
});

module.exports = httpServer;
