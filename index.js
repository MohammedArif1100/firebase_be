const express = require("express");
var useragent = require("express-useragent");
const http = require("http");
const bodyParser = require("body-parser");
var cors = require("cors");
const process = require("process");
const moment = require("moment");
const mail = require("./services/mail");
const SocketIO = require("socket.io");
const fs = require("fs");
const lodash = require("lodash");
//const schedule = require("./taskscheduler/scheduler")
const log4js = require("./log4js");
const logs = log4js.logger;
const cluster = require("cluster")
const os = require('os');
//const numCPUs = os.cpus().length;
const numCPUs = 1
// require('expose-gc');

if (cluster.isMaster) {
  logs.info(`Number of CPUs is ${numCPUs}`);
  logs.info(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logs.info(`worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  try {
    //database creation
    (async () => {
      const DbCreation = await require('./config/db').DbCreations;
    })();


    //Database Connection
    const db = require('./config/db').db;
    db.authenticate().then(() => {
      //console.log('Database connected...');
    }).catch(err => {
      //console.log(`Error: ${err}`);
    });


    //express and middleware
    const app = express();
    app.use(useragent.express());
    app.use(express.json({ limit: "500mb", extended: true }));
    app.use(express.urlencoded({ limit: "500mb", extended: true }));

    const dotenv = require("dotenv");
    dotenv.config();

    const port = process.env.SERVER_PORT || 4001;
    logs.info("Ports", port);

    // app.use(express.json());
    app.use(bodyParser.json({ limit: "500mb", extended: true }));
    app.use(bodyParser.urlencoded({ limit: "500mb", extended: true }));
    app.use(cors());
    // Load the self-signed certificate
    const options = {
      key: fs.readFileSync('server.key'),
      cert: fs.readFileSync('server.cert')
    };
    logs.info("options", options);

    const server = http.createServer(options, app);

    module.exports.Server = server;

    require("events").EventEmitter.defaultMaxListeners = Infinity;
    var socketID = "";
    let SocketUsers = [];
    module.exports.SocketUsers = SocketUsers;

    const io = require("./socket/socketio").io;

    app.get("/", (req, res) => {
      res.status(200).json("Successfully working");
    });


    // const { io } = require(process.cwd() + "/socket/socketio");


    io.on("connection", (socket) => {
      //console.log(`Socket started: ${socket.id}`);
      logs.info(`Socket started: ${socket.id}`)
      socketID = socket.id;
      //console.log(SocketUsers);
      socket.emit("newClient", { msg: "hi client" });

      socket.on("new", (elem1) => {
        //console.log(elem1);
      });
      socket.on("disconnect", (reason) => {
        //console.log("disconnect 1");
        if (reason === "io server disconnect") {
          //console.log("disconnect 2");
          logs.info(`disconnect`)
          var evens = lodash.remove(SocketUsers, function (n) {
            return n.clientId == socket.id;
          });
          // the disconnection was initiated by the server, you need to reconnect manually
          socket.connect();
        } else {
          var delete_socket_id = lodash.remove(SocketUsers, function (n) {
            return n.clientId == socket.id;
          });
          logs.info(reason);
          //console.log(reason);
        }
        // else the socket will automatically try to reconnect
      });

    });


    app.use("/railways/userlogin", require("./login/userlogin"));
    app.use("/railways/registration", require("./login/registration"));
    app.use("/railways/password", require("./login/forgotpassword"));
    app.use("/railways/railwaystation", require("./src/railwaystationcrud/railwaystation"));
    app.use("/railways/pointmachine", require("./src/pointmachinecrud/pointmachine"));
    app.use("/railways/trackcircuit", require("./src/trackcircuitcrud/trackcircuit"));
    app.use("/railways/signalcircuit", require("./src/signalcircuitcrud/signalcircuit"));
    app.use("/railways/axlecounter", require("./src/axlecountercrud/axlecounter"));
    app.use("/railways/lcgate", require("./src/lcgatecrud/lcgate"));
    app.use("/railways/relay", require("./src/relaycrud/relay"));
    app.use("/railways/ips", require("./src/ipscrud/ips"));
    app.use("/railways/battery", require("./src/batterycrud/battery"));
    app.use("/railways/notification", require("./src/notification/notification"));
    app.use("/railways/notificationcontrol", require("./src/notification/notificationcontrol"));
    app.use("/railways/pushnotification", require("./pushnotification/pushnotification"));

    server.listen(port, async (req, res) => {
      try {
        logs.info(`Listening on ${port}`);
        //console.log(`Listening on ${port}`);
        //console.log(`worker process ${process.pid} is listening on port ${port}`);   
        let To = process.env.ERROR_MAILID,
          Cc = "",
          Subject = `RDPMS App is started`,
          body = `Dear Team <br> RDPMS App have started in ${process.env.COMPANY_NAME}`;
        mail.mailSend(To, Cc, Subject, body);
      } catch (ex) {
        logs.error(`server port error-${ex}`);
        //console.log(ex.message);
      }
    });

    process.on("uncaughtException", (err, origin) => {
      fs.writeSync(
        process.stderr.fd,
        `Caught exception: ${err}\n` + `Exception origin: ${origin}`
      );
      logs.error(err);
      logs.info(origin);
      //console.log(err);
      //console.log(origin);
      mail.mailSendError(`${origin}`, `${err}`);
    });

    process.on("unhandledRejection", (reason, promise) => {
      //console.log("----- Unhandled Rejection at -----");
      //console.log(promise);
      logs.info(promise);
      logs.info("----- Reason -----");
      //console.log(reason);
      logs.info(reason);
      mail.mailSendError(
        `unhandledRejection`,
        `Caught exception promise: ${promise}\n` +
        `Exception origin reason: ${reason}`
      );
    });

    // setInterval(() => {
    //   global.gc();
    // }, (60*1000));

    require("./models/registereduserdetails");

    require("./models/alertmessage");

    require("./models/stationdetails");

    //require("./mqtt/mqtt"); 
  }
  catch (ex) {
    logs.error(`Index error-${ex}`);
    //console.log(`Index error-${ex}`)
  }
}


// try {
//   //database creation
//   (async () => {
//     const DbCreation = await require('./config/db').DbCreations;
//   })();


//   //Database Connection
//   const db = require('./config/db').db;
//   db.authenticate().then(() => {
//     //console.log('Database connected...');
//   }).catch(err => {
//     //console.log(`Error: ${err}`);
//   });


//   //express and middleware
//   const app = express();
//   app.use(useragent.express());
//   app.use(express.json({ limit: "500mb", extended: true }));
//   app.use(express.urlencoded({ limit: "500mb", extended: true }));

//   const dotenv = require("dotenv");
//   dotenv.config();

//   const port = process.env.SERVER_PORT || 4001;
//   logs.info("Ports", port);

//   // app.use(express.json());
//   app.use(bodyParser.json({ limit: "500mb", extended: true }));
//   app.use(bodyParser.urlencoded({ limit: "500mb", extended: true }));
//   app.use(cors());
//   const server = http.createServer(app);

//   module.exports.Server = server;

//   require("events").EventEmitter.defaultMaxListeners = Infinity;
//   var socketID = "";
//   let SocketUsers = [];
//   module.exports.SocketUsers = SocketUsers;

//   const io = require("./socket/socketio").io;

//   app.get("/", (req, res) => {
//     res.status(200).json("Successfully working");
//   });


//   // const { io } = require(process.cwd() + "/socket/socketio");


//   io.on("connection", (socket) => {
//     //console.log(`Socket started: ${socket.id}`);
//     logs.info(`Socket started: ${socket.id}`)
//     socketID = socket.id;
//     //console.log(SocketUsers);
//     socket.emit("newClient", { msg: "hi client" });

//     socket.on("new", (elem1) => {
//       //console.log(elem1);
//     });
//     socket.on("disconnect", (reason) => {
//       //console.log("disconnect 1");
//       if (reason === "io server disconnect") {
//         //console.log("disconnect 2");
//         logs.info(`disconnect`)
//         var evens = lodash.remove(SocketUsers, function (n) {
//           return n.clientId == socket.id;
//         });
//         // the disconnection was initiated by the server, you need to reconnect manually
//         socket.connect();
//       } else {
//         var delete_socket_id = lodash.remove(SocketUsers, function (n) {
//           return n.clientId == socket.id;
//         });
//         logs.info(reason);
//         //console.log(reason);
//       }
//       // else the socket will automatically try to reconnect
//     });

//   });


//   app.use("/railways/userlogin", require("./login/userlogin"));
//   app.use("/railways/registration", require("./login/registration"));
//   app.use("/railways/password", require("./login/forgotpassword"));
//   app.use("/railways/railwaystation", require("./src/railwaystationcrud/railwaystation"));
//   app.use("/railways/pointmachine", require("./src/pointmachinecrud/pointmachine"));
//   app.use("/railways/trackcircuit", require("./src/trackcircuitcrud/trackcircuit"));
//   app.use("/railways/signalcircuit", require("./src/signalcircuitcrud/signalcircuit"));
//   app.use("/railways/relay", require("./src/relaycrud/relay"));
//   app.use("/railways/lcgate", require("./src/lcgatecrud/lcgate"));
//   app.use("/railways/axlecounter", require("./src/axlecountercrud/axlecounter"));
//   app.use("/railways/notification", require("./src/notification/notification"));
//   app.use("/railways/notificationcontrol", require("./src/notification/notificationcontrol"));

//   server.listen(port, async (req, res) => {
//     try {
//       logs.info(`Listening on ${port}`);
//       //console.log(`Listening on ${port}`);
//       //console.log(`worker process ${process.pid} is listening on port ${port}`);   
//       let To = process.env.ERROR_MAILID,
//         Cc = "",
//         Subject = `RDPMS App is started`,
//         body = `Dear Team <br> RDPMS App have started in ${process.env.COMPANY_NAME}`;
//       mail.mailSend(To, Cc, Subject, body);
//     } catch (ex) {
//       logs.error(`server port error-${ex}`);
//       //console.log(ex.message);
//     }
//   });

//   process.on("uncaughtException", (err, origin) => {
//     fs.writeSync(
//       process.stderr.fd,
//       `Caught exception: ${err}\n` + `Exception origin: ${origin}`
//     );
//     logs.error(err);
//     logs.info(origin);
//     //console.log(err);
//     //console.log(origin);
//     mail.mailSendError(`${origin}`, `${err}`);
//   });

//   process.on("unhandledRejection", (reason, promise) => {
//     //console.log("----- Unhandled Rejection at -----");
//     //console.log(promise);
//     logs.info(promise);
//     logs.info("----- Reason -----");
//     //console.log(reason);
//     logs.info(reason);
//     mail.mailSendError(
//       `unhandledRejection`,
//       `Caught exception promise: ${promise}\n` +
//       `Exception origin reason: ${reason}`
//     );
//   });

//   // setInterval(() => {
//   //   global.gc();
//   // }, (60*1000));

//   require("./models/registereduserdetails");

//   require("./models/alertmessage");

//   require("./models/stationdetails");

//   //require("./mqtt/mqtt"); 
// }
// catch (ex) {
//   logs.error(`Index error-${ex}`);
//   //console.log(`Index error-${ex}`)
// }


