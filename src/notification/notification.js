const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const bparser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
const lodash = require("lodash");
const { Sequelize, Op } = require("sequelize");
const log4js = require("../../log4js");
const logs = log4js.logger;
const excel = require("exceljs");


const notification = express.Router();

const app = new express();
app.use(express.json());

const db = require("../../config/db").db;
const notificationcontrol = require("../../models/notificationcontrol");
const NotificationSend = require("../../models/notificationsend");
const { validuser } = require("../../login/verifytoken");
const mail = require("../../services/mail");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const Asserts = require("../../models/asserts");
const PointMachineAlert = require("../../models/pointmachinealert");
const TrackCircuitAlert = require("../../models/trackcircuitalert");
const SignalCircuitAlert = require("../../models/signalcircuitalert");
const AxleCounterAlert = require("../../models/axlecounteralert");
const LCGateAlert = require("../../models/lcgatealert");
const RegisteredPointMachine = require("../../models/registeredpointmachine");
const RegisteredSignalCircuit = require("../../models/registeredsignalcircuit");
const RegisteredTrackCircuit = require("../../models/registeredtrackcircuit");
const RegisteredAxleCounter = require("../../models/registeredaxlecounter");
const RegisteredLCGate = require("../../models/registeredlcgate");
const AlertMode = require("../../models/alertmode");
const axlecounter = require("../axlecountercrud/axlecounter");


//get the notification count
notification.get("/getNotificationcount", validuser, async (req, res) => {
  try {
    logs.info("get user notifications count started");
    //console.log("get user notifications count started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    // console.log(`userid is  : ${user_id}`);
    var get_notificationCount = await NotificationSend.findAll({
      where: { userid: user_id, isdele: false },
      order: [["id", "DESC"]],
      raw: true,
    });
    //console.log(get_notificationCount.length);
    const count = lodash.filter(get_notificationCount, { issend: false });
    const readcount = lodash.filter(get_notificationCount, {
      isdele: false,
      isseen: false,
    });

    // console.log(lists_);
    res.status(200).json({
      issuccess: true,
      newMSG: count.length,
      unseencount: readcount.length,
      //data: lists_,
    });
    logs.info("get user notification count end");
    //console.log("get user notifications count end");
  } catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (getNotificationcount)`,
      ex
    );
  }
});

//updat the notification if it is seen by specific id
notification.put("/updateIsseenById", validuser, async (req, res) => {
  try {
    logs.info("update notification isseen status by id started");
    //console.log("update notification isseen status by id started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    const id = req.body.id;
    //console.log(`userid is  : ${user_id} user role is : ${user_role}`);
    let transaction = await db.transaction({ autocommit: false });
    try {
      const updateIssendStatus = await NotificationSend.update(
        { isseen: true },
        { where: { id: id } },
        { transaction: transaction }
      );
      await transaction.commit();
      res.status(200).json({ issuccess: true, data: `success` });
    } catch (ex) {
      await transaction.rollback();
      //console.log(ex.message);
      logs.error(ex);
      res.status(400).json({ issuccess: false, msg: ex.message });
      mail.mailSendError(
        `Error in notification page. Api - (updateIsseenById)`,
        ex
      );
    }
    logs.info("update notification isseen status by id end");
    //console.log("update notification isseen status by id end");
  } catch (ex) {
    // console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (updateIsseenById)`,
      ex
    );
  }
});

//updat the notification if it is seen by All read
notification.put("/updateIsseenStatus", validuser, async (req, res) => {
  try {
    logs.info("update notification isseen status started");
    //console.log("update notification isseen status started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;

    //console.log(`userid is  : ${user_id} user role is : ${user_role}`);
    let transaction = await db.transaction({ autocommit: false });

    try {
      const updateIssendStatus = await NotificationSend.update(
        { isseen: true, issend: true },
        { where: { isdele: false, userid: user_id } },
        { transaction: transaction }
      );
      await transaction.commit();
      res.status(200).json({ issuccess: true, data: `sucess` });
    } catch (ex) {
      await transaction.rollback();
      //console.log(ex.message);
      logs.error(ex);
      res.status(400).json({ issuccess: false, msg: ex.message });
      mail.mailSendError(
        `Error in notification page. Api - (updateIsseenStatus)`,
        ex
      );
    }
    logs.info("update notification isseen status end");
    // console.log("update notification isseen status end");
  } catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (updateIsseenStatus)`,
      ex
    );
  }
});

//get all the notification details 
notification.get("/getNotificationDetails", validuser, async (req, res) => {
  try {
    logs.info("get user notifications details started");
    //console.log("get user notifications details started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //console.log(`userid is  : ${user_id}`);
    let page = parseInt(req.query.page),
      size = parseInt(req.query.size),
      status = req.query.status;

    const AlertModes = await AlertMode.findAll({
      where: { isdele: false },
      raw: true,
    });

    var count = []
    var readcount = []
    var get_each_last_five_count = []
    var count_list = []

    for await (const element of AlertModes) {
      var mode_get_notificationCount = []
      if (status === 'all') {
        mode_get_notificationCount = await NotificationSend.findAll({
          where: { userid: user_id, modeid: element.id, isdele: false },
          raw: true,
          order: [["id", "DESC"]],
        });
      }
      else if (status === 'unread') {
        mode_get_notificationCount = await NotificationSend.findAll({
          where: { userid: user_id, modeid: element.id, isseen: false, isdele: false },
          raw: true,
          order: [["id", "DESC"]],
        });
      }

      var mode_count = lodash.filter(mode_get_notificationCount, { issend: false });
      var mode_readcount = lodash.filter(mode_get_notificationCount, {
        isdele: false,
        isseen: false,
      });
      count = lodash.concat(count, mode_count)
      readcount = lodash.concat(readcount, mode_readcount)

      count_list.push({ count: mode_count.length, readcount: mode_readcount.length, mode: element.mode })

      var mode_get_each_last_five_count = lodash(mode_get_notificationCount)
        .slice((page - 1) * size)
        .take(size)
        .value();
      get_each_last_five_count = lodash.concat(get_each_last_five_count, mode_get_each_last_five_count)

    }

    let lists_ = [];

    const assertslist = await Asserts.findAll({
      where: { isdele: false },
      raw: true,
    });
   
    for await (const element of get_each_last_five_count) {
      var get_stations = await RegisteredRailwayStations.findOne({
        where: { isdele: false, id: element.stationid },
      });
      var get_asserts = lodash.find(assertslist, { id: element.assertsid })
      let mode = lodash.result(lodash.find(AlertModes, { 'id': element.modeid }), 'mode')

      if (get_stations != null) {
        var get_alerts = [];
        if (element.assertsid == (lodash.find(assertslist, { assertname: "Point Machine" })).id) {
          get_alerts = await PointMachineAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var pointmachine = await RegisteredPointMachine.findOne({
              where: { isdele: false, id: get_alerts.pointmachineid },
            });
            if (pointmachine != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: pointmachine.pointmachinename,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Track Circuit" })).id) {
          get_alerts = await TrackCircuitAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var trackcircuit = await RegisteredTrackCircuit.findOne({
              where: { isdele: false, id: get_alerts.trackcircuitid },
            });
            if (trackcircuit != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: trackcircuit.trackname,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Signal Circuit" })).id) {
          get_alerts = await SignalCircuitAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var signalcircuit = await RegisteredSignalCircuit.findOne({
              where: { isdele: false, id: get_alerts.signalcircuitid },
            });
            if (signalcircuit != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: signalcircuit.signalname,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Axle Counter" })).id) {
          get_alerts = await AxleCounterAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });

          if (get_alerts != null) {
            var axlecounter = await RegisteredAxleCounter.findOne({
              where: { isdele: false, id: get_alerts.axlecounterid },
            });
            if (axlecounter != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: axlecounter.axlecountername,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "LC Gate" })).id) {
          get_alerts = await LCGateAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });

          if (get_alerts != null) {
            var lcgate = await RegisteredLCGate.findOne({
              where: { isdele: false, id: get_alerts.lcgateid },
            });
            if (lcgate != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: lcgate.lcgatename,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
      }    
    }

    res.status(200).json({
      issuccess: true,
      newMSG: count.length,
      unseencount: readcount.length,
      page: page,
      size: size,
      data: lists_,
      count: count_list,
    });
    logs.info("get user notifications list end");
    //console.log("get user notifications list end");
  }
  catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (getNotificationDetails)`,
      ex
    );
  }
});

//get all the notification details 
notification.get("/getNotificationDetails1", validuser, async (req, res) => {
  try {
    logs.info("get user notifications details started");
    //console.log("get user notifications details started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //console.log(`userid is  : ${user_id}`);
    let page = parseInt(req.query.page),
      size = parseInt(req.query.size),
      status = req.query.status;
   
    const [AlertModes, stationslist, assertslist, NotificationList] = await Promise.all([
        AlertMode.findAll({ where: { isdele: false }, raw: true }),
        RegisteredRailwayStations.findAll({ where: { isdele: false }, raw: true }),
        Asserts.findAll({ where: { isdele: false }, raw: true }),
        NotificationSend.findAll({ where: {userid: user_id, isdele: false }, raw: true , order: [["id", "DESC"]],}),
      ]);
    
    var count = []
    var readcount = []
    var get_each_last_five_count = []
    var count_list = []

    for await (const element of AlertModes) {
      var mode_get_notificationCount = []
      if (status === 'all') {       
        mode_get_notificationCount = NotificationList.filter(data => data.modeid == element.id).sort((a,b)=> b.id - a.id)
      }
      else if (status === 'unread') {
        mode_get_notificationCount = NotificationList.filter(data => data.modeid == element.id && data.isseen == false).sort((a,b)=> b.id - a.id)
      }

      var mode_count = lodash.filter(mode_get_notificationCount, { issend: false });
      var mode_readcount = lodash.filter(mode_get_notificationCount, {
        isdele: false,
        isseen: false,
      });
      count = lodash.concat(count, mode_count)
      readcount = lodash.concat(readcount, mode_readcount)

      count_list.push({ count: mode_count.length, readcount: mode_readcount.length, mode: element.mode })

      var mode_get_each_last_five_count = lodash(mode_get_notificationCount)
        .slice((page - 1) * size)
        .take(size)
        .value();
      get_each_last_five_count = lodash.concat(get_each_last_five_count, mode_get_each_last_five_count)

    }   
   
    const [pointalertslist,trackalertslist,signalalertslist,axlealertslist,lcgatealertslist] = await Promise.all([
      PointMachineAlert.findAll({
        where: {
          isdele: false,
          id: { [Op.in]: get_each_last_five_count.filter(a => a.assertsid == (lodash.find(assertslist, { assertname: "Point Machine" })).id).map(a => a.alertid) }
        },
        raw: true,
      }),
      TrackCircuitAlert.findAll({
        where: {
          isdele: false,
          id: { [Op.in]: get_each_last_five_count.filter(a => a.assertsid == (lodash.find(assertslist, { assertname: "Track Circuit" })).id).map(a => a.alertid) }
        },
        raw: true,
      }),
      SignalCircuitAlert.findAll({
        where: {
          isdele: false,
          id: { [Op.in]: get_each_last_five_count.filter(a => a.assertsid == (lodash.find(assertslist, { assertname: "Signal Circuit" })).id).map(a => a.alertid) }
        },
        raw: true,
      }),
      AxleCounterAlert.findAll({
        where: {
          isdele: false,
          id: { [Op.in]: get_each_last_five_count.filter(a => a.assertsid == (lodash.find(assertslist, { assertname: "Axle Counter" })).id).map(a => a.alertid) }
        },
        raw: true,
      }),
      LCGateAlert.findAll({
        where: {
          isdele: false,
          id: { [Op.in]: get_each_last_five_count.filter(a => a.assertsid == (lodash.find(assertslist, { assertname: "LC Gate" })).id).map(a => a.alertid) }
        },
        raw: true,
      })
    ]);

    const [pointmachinelist,trackcircuitlist,signalcircuitlist,axlecounterlist,lcgatelist] = await Promise.all([
      RegisteredPointMachine.findAll({where: { isdele: false }, raw: true,}),
      RegisteredTrackCircuit.findAll({where: { isdele: false }, raw: true,}),
      RegisteredSignalCircuit.findAll({where: { isdele: false }, raw: true,}),
      RegisteredAxleCounter.findAll({where: { isdele: false }, raw: true,}),
      RegisteredLCGate.findAll({where: { isdele: false }, raw: true,}),
    ]);

    let lists_ = [];

    for await (const element of get_each_last_five_count) {

      var get_stations = lodash.find(stationslist, { id: element.stationid });
      var get_asserts = lodash.find(assertslist, { id: element.assertsid })
      let mode = lodash.result(lodash.find(AlertModes, { 'id': element.modeid }), 'mode')

      if (get_stations != null) {
        var get_alerts = [];
        if (element.assertsid == (lodash.find(assertslist, { assertname: "Point Machine" })).id) {
          get_alerts = lodash.find(pointalertslist, { id: element.alertid })
          if (get_alerts != null) {
            var pointmachine = lodash.find(pointmachinelist, { id: get_alerts.pointmachineid });
            if(pointmachine != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: pointmachine.pointmachinename,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }            
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Track Circuit" })).id) {
          get_alerts = lodash.find(trackalertslist, { id: element.alertid });
          if (get_alerts != null) {
            var trackcircuit = lodash.find(trackcircuitlist, { id: get_alerts.trackcircuitid });
            if(trackcircuit != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: trackcircuit.trackname,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Signal Circuit" })).id) {
          get_alerts = lodash.find(signalalertslist, { id: element.alertid });
          if (get_alerts != null) {
            var signalcircuit = lodash.find(signalcircuitlist, { id: get_alerts.signalcircuitid })
            if(signalcircuit != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: signalcircuit.signalname,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Axle Counter" })).id) {
          get_alerts = lodash.find(axlealertslist, { id: element.alertid });
          if (get_alerts != null) {
            var axlecounter = lodash.find(axlecounterlist, { id: get_alerts.axlecounterid })
            if(axlecounter != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: axlecounter.axlecountername,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "LC Gate" })).id) {
          get_alerts = lodash.find(lcgatealertslist, { id: element.alertid });
          if (get_alerts != null) {
            var lcgate = lodash.find(lcgatelist, { id: get_alerts.lcgateid })
            if(lcgate != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: lcgate.lcgatename,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
      }
    }
  
    res.status(200).json({
      issuccess: true,
      newMSG: count.length,
      unseencount: readcount.length,
      page: page,
      size: size,
      data: lists_,
      count: count_list,
    });
    logs.info("get user notifications list end");
    //console.log("get user notifications list end");
  }
  catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (getNotificationDetails)`,
      ex
    );
  }
});

//get all the notification details based on start , end and paginaion
notification.get("/getNotificationDetailsList", validuser, async (req, res) => {
  try {
    logs.info("get user notifications details list started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    let page = parseInt(req.query.page),
      size = parseInt(req.query.size);

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    logs.info('query for notification details list', req.query);
    //console.log(req.query);
    if (req.query.start_date != "") {
      start_date = moment(req.query.start_date).format("YYYY-MM-DD");
      end_Date = moment(req.query.end_date).format("YYYY-MM-DD");
    }
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }
    logs.info(`${start_date} - start date //// ${end_Date} - end date`);

    var where_condition = {
      [Op.and]: [
        Sequelize.where(
          Sequelize.fn("date", Sequelize.col("createddate")),
          ">=",
          start_date
        ),
        Sequelize.where(
          Sequelize.fn("date", Sequelize.col("createddate")),
          "<=",
          end_Date
        ),
      ],
    };

    if (req.query.start_date != "") {
      where_condition = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("date", Sequelize.col("createddate")),
            ">=",
            start_date
          ),
          Sequelize.where(
            Sequelize.fn("date", Sequelize.col("createddate")),
            "<=",
            end_Date
          ),
        ],
      };
      logs.info("with date" + where_condition);
    }

    where_condition.isdele = false;
    where_condition.userid = user_id;
    logs.info("where condition is : " + where_condition);

    var get_notificationCount = await NotificationSend.findAll({
      where: where_condition,
      order: [["id", "DESC"]],
      raw: true,
    });
    const count = lodash.filter(get_notificationCount, { issend: false });
    const readcount = lodash.filter(get_notificationCount, {
      isdele: false,
      isseen: false,
    });

    let lists_ = [];

    var total_data = await NotificationSend.findAll({
      where: where_condition,
      order: [["id", "DESC"]],
      raw: true,
    });   

    const assertslist = await Asserts.findAll({
      where: { isdele: false },
      raw: true,
    });
   
    const AlertModes = await AlertMode.findAll({
      where: { isdele: false },
      raw: true,
    });

    for await (const element of total_data) {
      var get_stations = await RegisteredRailwayStations.findOne({
        where: { isdele: false, id: element.stationid },
      });
      var get_asserts = lodash.find(assertslist, { id: element.assertsid });
      let mode = lodash.result(lodash.find(AlertModes, { 'id': element.modeid }), 'mode')

      if (get_stations != null) {
        var get_alerts = [];
        if (element.assertsid == (lodash.find(assertslist, { assertname: "Point Machine" })).id) {
          get_alerts = await PointMachineAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var pointmachine = await RegisteredPointMachine.findOne({
              where: { isdele: false, id: get_alerts.pointmachineid },
            });
            if(pointmachine != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: pointmachine.pointmachinename,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Track Circuit" })).id) {
          get_alerts = await TrackCircuitAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var trackcircuit = await RegisteredTrackCircuit.findOne({
              where: { isdele: false, id: get_alerts.trackcircuitid },
            })
            if(trackcircuit != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: trackcircuit.trackname,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }           
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Signal Circuit" })).id) {
          get_alerts = await SignalCircuitAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var signalcircuit = await RegisteredSignalCircuit.findOne({
              where: { isdele: false, id: get_alerts.signalcircuitid },
            })
            if(signalcircuit != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: signalcircuit.signalname,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }           
          }
        } 
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Axle Counter" })).id) {
          get_alerts = await AxleCounterAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var axlecounter = await RegisteredAxleCounter.findOne({
              where: { isdele: false, id: get_alerts.axlecounterid },
            })
            if(axlecounter != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: axlecounter.axlecountername,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }           
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "LC Gate" })).id) {
          get_alerts = await LCGateAlert.findOne({
            where: { isdele: false,  id: element.alertid},           
          });
          if (get_alerts != null) {
            var lcgate = await RegisteredLCGate.findOne({
              where: { isdele: false, id: get_alerts.lcgateid },
            })
            if(lcgate != null)
            {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: lcgate.lcgatename,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }           
          }
        }
      }
    }

    res.status(200).json({
      issuccess: true,
      newMSG: count.length,
      unseencount: readcount.length,
      page: page,
      size: size,
      totaldatacount: total_data.length,
      data: lists_,
    });
    logs.info("get user notifications details list end");
    //console.log("get user notifications details list end");

  }
  catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (getNotificationDetailsList)`,
      ex
    );
  }
});

//download the notification details based on start , end and paginaion
notification.get("/downloadNotificationDetailsReport", validuser, async (req, res) => {
  try {
    logs.info("get notification details list report started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");
    if (req.query.start_date != "") {
      start_date = moment(req.query.start_date).format("YYYY-MM-DD");
      end_Date = moment(req.query.end_date).format("YYYY-MM-DD");
    }
    let page = 1,
      size = 10;
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }
    logs.info(`${start_date} - start date //// ${end_Date} - end date`);

    logs.info('req query for notification details report', req.query);

    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("NotificationReport");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "NotificationReport" + ".xlsx"
    );

    worksheet.columns = [
      { header: "Sno", key: "id", width: 5 },
      { header: "Alert", key: "stationname", width: 30 },
      // { header: "Assert" ,key: "assertname", width: 10},
      // { header: "Assert Name" ,key: "assertidname", width: 25},
      { header: "IsSeen", key: "isseen", width: 8 },
      { header: "Mode", key: "mode", width: 10 },
      { header: "Message", key: "message", wrapText: true, width: 70, height: 40 },
      { header: "CreatedDate", key: "createddate", width: 20 },

    ];
    worksheet.properties.defaultRowHeight = 20;
    let sno = 1, lists_ = [];

    var where_condition = {
      [Op.and]: [
        Sequelize.where(
          Sequelize.fn("date", Sequelize.col("createddate")),
          ">=",
          start_date
        ),
        Sequelize.where(
          Sequelize.fn("date", Sequelize.col("createddate")),
          "<=",
          end_Date
        ),
      ],
    };

    if (req.query.start_date != "") {
      where_condition = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("date", Sequelize.col("createddate")),
            ">=",
            start_date
          ),
          Sequelize.where(
            Sequelize.fn("date", Sequelize.col("createddate")),
            "<=",
            end_Date
          ),
        ],
      };
      logs.info("with date" + where_condition);
    }

    where_condition.isdele = false;
    where_condition.userid = user_id;
    logs.info("where condition is : " + where_condition);

    var total_data = await NotificationSend.findAll({
      where: where_condition,
      order: [["id", "DESC"]],
      raw: true,
    });
    
    const assertslist = await Asserts.findAll({
      where: { isdele: false },
      raw: true,
    });         

    const AlertModes = await AlertMode.findAll({
      where: { isdele: false },
      raw: true,
    });

    for await (const element of total_data) {
      var get_stations = await RegisteredRailwayStations.findOne({
        where: { isdele: false, id: element.stationid },
      });
      var get_asserts = lodash.find(assertslist, { id: element.assertsid });
      let mode = lodash.result(lodash.find(AlertModes, { 'id': element.modeid }), 'mode')

      if (get_stations != null) {
        var get_alerts = [];
        if (element.assertsid == (lodash.find(assertslist, { assertname: "Point Machine" })).id)  {
          get_alerts = await PointMachineAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var pointmachine = await RegisteredPointMachine.findOne({
              where: { isdele: false, id: get_alerts.pointmachineid },
            });
            if(pointmachine != null)
            {
              lists_.push({
                id: sno,
                stationname: get_asserts.assertname + '(' + pointmachine.pointmachinename + ')' + ' @' + get_stations.stationname,
                // assertname : get_asserts.assertname,
                // assertidname  : pointmachine.pointmachinename,
                mode: mode,
                isseen: element.isseen == 1 ? 'True' : 'False',
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Track Circuit" })).id)  {
          get_alerts = await TrackCircuitAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var trackcircuit = await RegisteredTrackCircuit.findOne({
              where: { isdele: false, id: get_alerts.trackcircuitid },
            });
            if(trackcircuit != null)
            {
              lists_.push({
                id: sno,
                stationname: get_asserts.assertname + '(' + trackcircuit.trackname + ')' + ' @' + get_stations.stationname,
                // assertname : get_asserts.assertname,
                // assertidname  : trackcircuit.trackname,
                mode: mode,
                isseen: element.isseen == 1 ? 'True' : 'False',
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Signal Circuit" })).id)  {
          get_alerts = await SignalCircuitAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var signalcircuit = await RegisteredSignalCircuit.findOne({
              where: { isdele: false, id: get_alerts.signalcircuitid },
            });
            if(signalcircuit != null)
            {
              lists_.push({
                id: sno,
                stationname: get_asserts.assertname + '(' + signalcircuit.signalname + ')' + ' @' + get_stations.stationname,
                // assertname : get_asserts.assertname,
                // assertidname  : signalcircuit.signalname,
                mode: mode,
                isseen: element.isseen == 1 ? 'True' : 'False',
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        } 
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Axle Counter" })).id)  {
          get_alerts = await AxleCounterAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var axlecounter = await RegisteredAxleCounter.findOne({
              where: { isdele: false, id: get_alerts.axlecounterid },
            });
            if(axlecounter != null)
            {
              lists_.push({
                id: sno,
                stationname: get_asserts.assertname + '(' + axlecounter.axlecountername + ')' + ' @' + get_stations.stationname,
                // assertname : get_asserts.assertname,
                // assertidname  : axlecounter.axlecountername,
                mode: mode,
                isseen: element.isseen == 1 ? 'True' : 'False',
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "LC Gate" })).id)  {
          get_alerts = await LCGateAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var lcgate = await RegisteredLCGate.findOne({
              where: { isdele: false, id: get_alerts.lcgateid },
            });
            if(lcgate != null)
            {
              lists_.push({
                id: sno,
                stationname: get_asserts.assertname + '(' + lcgate.lcgatename + ')' + ' @' + get_stations.stationname,
                // assertname : get_asserts.assertname,
                // assertidname  : lcgate.lcgatename,
                mode: mode,
                isseen: element.isseen == 1 ? 'True' : 'False',
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }          
          }
        }
      }
      sno++
    }

    // Add Array Rows
    worksheet.addRows(lists_);

    await workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });

    logs.info("get notification details report ended");

  } catch (ex) {
    logs.error('Notification details report page error Api (getNotificationDetailsReport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get all the notification details based on alertmode
notification.get("/getNotificationDetailsByMode", validuser, async (req, res) => {
  try {
    logs.info("get user notifications details by mode started");
    //console.log("get user notifications details by mode started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //console.log(`userid is  : ${user_id}`);
    let page = parseInt(req.query.page),
      size = parseInt(req.query.size),
      modeid = parseInt(req.query.modeid),
      status = req.query.status;

    var get_notificationCount = []

    if (status === 'all') {
      get_notificationCount = await NotificationSend.findAll({
        where: { userid: user_id, modeid: modeid, isdele: false },
        order: [["id", "DESC"]],
        raw: true,
      });
    }
    else if (status === 'unread') {
      get_notificationCount = await NotificationSend.findAll({
        where: { userid: user_id, modeid: modeid, isseen: false, isdele: false },
        order: [["id", "DESC"]],
        raw: true,
      });
    }

    const count = lodash.filter(get_notificationCount, { issend: false });
    const readcount = lodash.filter(get_notificationCount, {
      isdele: false,
      isseen: false,
    });

    var get_each_last_five_count = lodash(get_notificationCount)
      .slice((page - 1) * size)
      .take(size)
      .value();

    let lists_ = [];

    const assertslist = await Asserts.findAll({
      where: { isdele: false },
      raw: true,
    });

    const AlertModes = await AlertMode.findAll({
      where: { isdele: false },
      raw: true,
    });

    for await (const element of get_each_last_five_count) {
      var get_stations = await RegisteredRailwayStations.findOne({
        where: { isdele: false, id: element.stationid },
      });
      var get_asserts = lodash.find(assertslist, { id: element.assertsid })
      let mode = lodash.result(lodash.find(AlertModes, { 'id': element.modeid }), 'mode')

      if (get_stations != null) {
        var get_alerts = [];
        if (element.assertsid == (lodash.find(assertslist, { assertname: "Point Machine" })).id) {
          get_alerts = await PointMachineAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var pointmachine = await RegisteredPointMachine.findOne({
              where: { isdele: false, id: get_alerts.pointmachineid },
            });
            if (pointmachine != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: pointmachine.pointmachinename,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Track Circuit" })).id) {
          get_alerts = await TrackCircuitAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var trackcircuit = await RegisteredTrackCircuit.findOne({
              where: { isdele: false, id: get_alerts.trackcircuitid },
            });
            if (trackcircuit != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: trackcircuit.trackname,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Signal Circuit" })).id) {
          get_alerts = await SignalCircuitAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });
          if (get_alerts != null) {
            var signalcircuit = await RegisteredSignalCircuit.findOne({
              where: { isdele: false, id: get_alerts.signalcircuitid },
            });
            if (signalcircuit != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                mode: mode,
                modeid: element.modeid,
                assertname: get_asserts.assertname,
                assertidname: signalcircuit.signalname,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "Axle Counter" })).id) {
          get_alerts = await AxleCounterAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });

          if (get_alerts != null) {
            var axlecounter = await RegisteredAxleCounter.findOne({
              where: { isdele: false, id: get_alerts.axlecounterid },
            });
            if (axlecounter != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: axlecounter.axlecountername,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
        else if (element.assertsid == (lodash.find(assertslist, { assertname: "LC Gate" })).id) {
          get_alerts = await LCGateAlert.findOne({
            where: { isdele: false,id: element.alertid },
          });

          if (get_alerts != null) {
            var lcgate = await RegisteredLCGate.findOne({
              where: { isdele: false, id: get_alerts.lcgateid },
            });
            if (lcgate != null) {
              lists_.push({
                notificationid: element.id,
                stationid: element.stationid,
                stationcode: get_stations.stationcode,
                stationname: get_stations.stationname,
                assertname: get_asserts.assertname,
                assertidname: lcgate.lcgatename,
                mode: mode,
                isseen: element.isseen,
                issend: element.issend,
                message: get_alerts.message,
                createddate: element.createddate,
              })
            }
          }
        }
      }
    }

    res.status(200).json({
      issuccess: true,
      newMSG: count.length,
      unseencount: readcount.length,
      page: page,
      size: size,
      data: lists_,
    });
    logs.info("get user notifications list end");
    //console.log("get user notifications by mode list end");

  }
  catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification page. Api - (getNotificationDetailsByMode)`,
      ex
    );
  }
});

module.exports = notification;
