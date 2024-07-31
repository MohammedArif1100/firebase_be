const express = require("express");
//const http = require('http');
const bcrypt = require("bcryptjs");
const fs = require("fs");
const bodyParser = require("body-parser");
const { Sequelize, Op } = require("sequelize");
var cors = require("cors");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
var lodash = require("lodash");
const moment = require("moment");
const db = require("../config/db").db;

const dotenv = require("dotenv");
dotenv.config();

const log4js = require("../log4js");
const logs = log4js.logger;

const privateKey = process.env.JWT_PRIVATEKEY;
const secretKey = process.env.JWT_SECREYKEY;

const SocketIO = require("socket.io");
const { Server, SocketUsers } = require("../index");
const mail = require("../services/mail");
const RegisteredUserDetails = require("../models/registereduserdetails");
const NotificationControl = require("../models/notificationcontrol");
const StationAccess = require("../models/stationaccess");

const io = SocketIO(
  Server,
  {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  },
  {
    maxHttpBufferSize: 1e8,
  }
);
io.on("connection", async (socket) => {
  // console.log(
  //   "A user connected in socket .............................................."
  // );
  logs.info("A user connected in socket")
  //console.log(socket.id);
  //console.log(socket.handshake.auth);
  //console.log(socket);
  //console.log(socket.handshake);
  //console.log(socket.handshake.query);
  // console.log(socket.handshake.query.authorization);

  // let auth = socket.handshake.auth; //auth.token

  let auth = socket.handshake.query.authorization;
  logs.info('auth', auth)
  if (auth != null && auth != "") {
    jwt.verify(auth, privateKey, async (err, data) => {
      if (err) {
        //console.log(err);
        logs.info(err);
        //console.log("Token authentication failed");
        //res.status(401).send("Invalid Token");
      } else {
        const user_id = JwtDecode(auth).Userid
        logs.info('socket data', JwtDecode(auth))
        var data_check = lodash.find(SocketUsers, {
          clientId: socket.id,
        });
        //console.log(data_check);
        if (data_check == null || data_check === undefined) {
          SocketUsers.push({ clientId: socket.id, user_id: user_id });
          //console.log(SocketUsers);
        }
        //next();
      }
    });
  }

  socket.onAny((event, ...args) => {
    console.log(
      `got ${event} ----------------------------- event ---------------------------`
    );
  });
  socket.on("disconnect", async (reason) => {
    //console.log("disconnect 1");
    if (reason === "io server disconnect") {
      var evens = lodash.remove(SocketUsers, function (n) {
        return n.clientId == socket.id;
      });
      logs.info("Socket user disconnected");
      //console.log("disconnect 2");
      // the disconnection was initiated by the server, you need to reconnect manually
      socket.connect();
    } else {
      var delete_socket_id = lodash.remove(SocketUsers, function (n) {
        return n.clientId == socket.id;
      });
      //console.log(`after deleted socket user list is`);
      //console.log(reason);
      //console.log(delete_socket_id);
    }
    //console.log(`after deleted socket user list is`);
    //console.log(reason);
    logs.info(reason);
    //console.log(delete_socket_id);
    // else the socket will automatically try to reconnect
  });
});

var Socket = {
  emit: async (event, data) => {
    logs.info("notification event", event);
    if (event === "Notify") {
      io.sockets.emit(event, data);
      var get_usersList = await getUsers(data.stationid, data.assertsid);
      //console.log(get_usersList);
      //console.log(SocketUsers);
      const get_list = lodash.filter(SocketUsers, (v) =>
        lodash.includes(get_usersList, v.user_id)
      ); //lodash.find(SocketUsers, { 'user_id': `${data.user_id}`});
      //console.log(get_list);

      if (get_list != undefined) {
        get_list.forEach(async (element) => {
          io.sockets.in(element.clientId).emit(data.event, data);

        });
      }
    } else if (event === "Notification") {
      var get_userid = lodash.uniq(await data.map(a => a.userid));

      const get_list = lodash.filter(SocketUsers, (v) =>
        lodash.includes(get_userid, v.user_id)
      );

      if (get_list != undefined) {
        get_list.forEach(async (element) => {
          await io.sockets.in(element.clientId).emit(event, data);
        });
      }
    }
    else if (event === "NotificationToMobile") {
      var get_userid = lodash.uniq(await data.map(a => a.userid));

      const get_list = lodash.filter(SocketUsers, (v) =>
        lodash.includes(get_userid, v.user_id)
      );

      if (get_list != undefined) {
        get_list.forEach(async (element) => {
          await io.sockets.in(element.clientId).emit(event, data);
        });
      }

      //logs.info("Notification", data)
    }
    else {
      io.sockets.emit(event, data);
    }
  },
};

var getUsers = async (stationid, assertsid) => {
  try {
    logs.info(`Socket users list started`);
    //console.log(`Socket users list started ------------------------------`);
    let roles__ = ["Admin", 'Station Incharge']; //["Admin", "Management"];
    var get_notificationSendUsersList = await NotificationControl.findAll({
      attributes: ["userid"],
      where: { isdele: false, stationid, assertsid },
      raw: true,
    });
    let userid = [];

    //console.log(get_notificationSendUsersList);

    get_notificationSendUsersList.forEach((element) => {
      userid.push(element.userid);
    });
    var get_admin = await RegisteredUserDetails.findAll({
      where: { isdele: false, roles: "Admin" },
      raw: true,
    });

    get_admin.forEach((element) => {
      userid.push(element.id);
    });

    RegisteredUserDetails.hasMany(StationAccess, { foreignKey: 'userid' });
    StationAccess.belongsTo(RegisteredUserDetails, { foreignKey: 'userid' });

    const datas = await StationAccess.findAll({
      attributes: ['id'],     
      where: {
        isdele: false,
        stationid: stationid,
      },
      include: [
        {
          model: RegisteredUserDetails,
          attributes: [],
          where: {
            isdele: false,
          },
        },
      ],
      raw: true,
    })

    //const data = await db.query('SELECT p.id from public."RegisteredUserDetails" as s JOIN public."StationAccesses" as p ON s.id = p.userid where s.isdele = false and p.isdele = false and p.stationid =' + stationid)

    datas.forEach((element) => {
      userid.push(element.id);
    });

    userid = lodash.uniq(userid);

    logs.info('notification - stationid=', stationid, ',assertsid=', assertsid, 'userid=', userid)

    //console.log(userid);
    logs.info(`Socket users list end`);
    return userid;
  } catch (ex) {
    // console.log(ex);
    logs.error(ex);
    mail.mailSendError(
      `Error in socketio page get users list function - (getUsers)`,
      ex
    );
  }
};

module.exports = { io: io, Socket: Socket };
