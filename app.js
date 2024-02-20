const httpServer = require("./tcpServer");


httpServer.listen(3005, "127.0.0.1", () => {
    console.log("server is listening");
});