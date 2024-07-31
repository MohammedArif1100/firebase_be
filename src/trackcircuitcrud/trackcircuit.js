const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const bodyParser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
var lodash = require("lodash");
var LINQ = require('node-linq').LINQ;

const { Sequelize, Op } = require("sequelize");
const errormail = require("../../services/mail");

const log4js = require("../../log4js");
const logs = log4js.logger;


const trackcircuit = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();
require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const RegisteredTrackCircuit = require("../../models/registeredtrackcircuit");
const RegisteredTrackCircuitLogs = require("../../models/registeredtrackcircuitlogs");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const StationAccess = require("../../models/stationaccess");
const TrackCircuitData = require("../../models/trackcircuitdata");
const TrackCircuitAlert = require("../../models/trackcircuitalert");
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredRailwayStationLogs = require("../../models/registeredrailwaystationlogs");
const AlertMessage = require('../../models/alertmessage');
const AlertMode = require("../../models/alertmode");
const excel = require("exceljs");
const reader = require('xlsx');
const { Where } = require("sequelize/lib/utils");
const { log } = require("console");

//register track ciircuit
trackcircuit.post("/registertrackcircuit", validuser, async (req, res) => {
  try {
    logs.info("New track circuit registration started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    var access = null;
    var count = 0;
    if (user_role == "Station Incharge") {
      count++;
      access = await StationAccess.findOne(
        { where: { userid: user_id, stationid: req.body.stationid, isdele: false } }
      )
    }
    if (user_role == "Admin" || (count == 1 && access != null)) {

      logs.info(req.body);
      const trackname = req.body.trackname,
        stationid = req.body.stationid,
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var trackcircuitcheck = [await RegisteredTrackCircuit.findOne({
        where: { trackname: trackname, stationid: stationid },
      })];
      trackcircuitcheck = trackcircuitcheck[0] !== null ? trackcircuitcheck : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (trackcircuitcheck.length !== 0) {
        if (trackcircuitcheck[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_trackcircuit = await RegisteredTrackCircuit.update(
              {
                manufacture,
                serialno,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: trackcircuitcheck[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("Track circuit registration inserted");

            const log_insert = await RegisteredTrackCircuitLogs.create(
              {
                trackcircuitid: update_trackcircuit[1].id,
                trackname: update_trackcircuit[1].trackname,
                stationid: update_trackcircuit[1].stationid,
                manufacture: update_trackcircuit[1].manufacture,
                serialno: update_trackcircuit[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Track Circuit log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Trackcircuit inserted Successfully" });
            logs.info("Trackcircuit Successfully Registered");
            //console.log("Trackcircuit Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Trackcircuit page error Api (registertrackcircuit)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
          }
        }
        else {
          //console.log("Given track circuit is already registered.");
          logs.info("Given track circuit is already available.");
          res
            .status(400)
            .json({ issuccess: false, msg: "Given track circuit is aleady available" });
        }
      }
      else {
        if (fs.existsSync('railways.xlsx')) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const register_trackcircuit = await RegisteredTrackCircuit.create({
              trackname,
              stationid,
              manufacture,
              serialno,
              createddate: current_datetime,
              createdby_id,
              updateddate: current_datetime,
              isdele,
            },
              { transaction: transaction })
            logs.info("Track circuit registration inserted");

            const log_insert = await RegisteredTrackCircuitLogs.create(
              {
                trackcircuitid: register_trackcircuit.id,
                trackname,
                stationid,
                manufacture,
                serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Track circuit registration log inserted");

            // Reading our railway file
            const file = reader.readFile('railways.xlsx')
            let data = []
            if (file.SheetNames[7] == "Track Circuit Alerts") {
              const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[7]])
              temp.forEach(async (res) => {
                var object = {
                  stationid: stationid,
                  assertid: register_trackcircuit.id,
                  assert: "Track Circuit",
                  alertname: res.Alertname,
                  value: res.Value,
                  unit: res.Unit,
                  message: res.Message,
                  mode: res.Mode,
                  email: res.Email,
                  sms: res.SMS,
                  voice: res.Voice,
                  isactive: res.IsActive,
                  iseditable: res.IsEditable,
                  view: res.View,
                  description: res.Description,
                  createddate: current_datetime,
                  createdby_id: user_id,
                  updateddate: current_datetime,
                  isdele: false,
                }
                data.push(object)

              })

              let alert_message_ids = [];
              await AlertMessage.bulkCreate(data, { transaction: transaction }, { returning: true }, { raw: true }).then(data => alert_message_ids = data)

              alert_message_ids.forEach((element) => {
                require("../../mqtt/alertvalue").addvalues(`${element.stationid}@${element.assertid}@${element.assert}@${element.alertname}`, element.id, element.value, element.unit, element.message, element.mode, element.email, element.sms, element.voice, element.isactive, element.iseditable, element.view, element.description, element.assert)
              })

              await transaction.commit();
              res
                .status(200)
                .json({ issuccess: true, msg: "Trackcircuit inserted Successfully" });
              logs.info("Trackcircuit Successfully Registered");
              //console.log("Trackcircuit Successfully Registered")
            }
            else {
              await transaction.rollback();
              logs.info('Track Circuit Alerts sheet not found');
              //console.log('Track Circuit Alerts sheet not found')
              res.status(400).json({ issuccess: false, msg: 'Track Circuit Alerts sheet not found' });
            }
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Trackcircuit page error Api (registertrackcircuit)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
          }
        }
        else {
          //console.log('railways file not found');
          logs.error('Railways file not found');
          res.status(400).json({ issuccess: false, msg: 'Railways file not found' });
        }
      }
    }
    else {
      logs.info("Admin Only access this page.");
      //console.log("Admin Only access this page.");
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  }
  catch (ex) {
    //console.log(ex);
    logs.error('Trackcircuit page error Api (registertrackcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    errormail.mailSendError(
      `Error in trackcircuit page. Api (registertrackcircuit)`, ex);
  }
});

//edit registered track ciircuit
trackcircuit.put("/edittrackcircuit", validuser, async (req, res) => {
  try {
    logs.info("Track Circuit edit started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    var access = null;
    var count = 0;
    if (user_role == "Station Incharge") {
      count++;
      access = await StationAccess.findOne(
        { where: { userid: user_id, stationid: req.body.stationid, isdele: false } }
      )
    }

    if (user_role == "Admin" || (count == 1 && access != null) || user_role == "Super Admin") {
      let transaction = await db.transaction({ autocommit: false });
      try {
        //console.log(req.body);
        logs.info(req.body);
        const id = req.body.id,
          currenttrackname = req.body.currenttrackname,
          newtrackname = req.body.newtrackname,
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          stationid = req.body.stationid,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_trackcircuits = await RegisteredTrackCircuit.findAll(
          { where: { stationid, isdele: false }, raw: true, }
        )

        const check_trackname = await RegisteredTrackCircuit.findOne(
          { where: { id, isdele: false } }
        )

        if (check_trackname == null) {
          logs.info("Trackcircuit not exist in this station.");
          //console.log("Trackcircuit not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Trackcircuit not exists in this station." });
        }
        else {
          let repeat_names = false;

          currenttrackname == newtrackname ? repeat_names = false : station_trackcircuits.find(value => value.trackname == newtrackname) ? repeat_names = true : false

          if (se) {
            const update_trackcircuit = await RegisteredTrackCircuit.update(
              {
                trackname: newtrackname,
                manufacture: manufacture,
                serialno: serialno,
                updateddate: current_datetime,
              },
              { where: { id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })

            logs.info("Track Circuit updated");
            const log_insert = await RegisteredTrackCircuitLogs.create(
              {
                trackcircuitid: update_trackcircuit[1].id,
                trackname: update_trackcircuit[1].trackname,
                stationid: update_trackcircuit[1].stationid,
                manufacture: update_trackcircuit[1].manufacture,
                serialno: update_trackcircuit[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Track Circuit log inserted");
            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Successfully Updated" });
            logs.info("Trackcircuit Successfully Updated");
            //console.log("Trackciruit  Successfully Updated")  
          }
          else {
            logs.info("Track Circuit already exist in this station");
            res.status(400).json({ issuccess: false, msg: "Track Circuit already exists in the station" });
          }

        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Trackcircuit page error Api (edittrackcircuit)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        errormail.mailSendError(`Error in trackcircuit page. Api (edittrackcircuit)`, ex);
      }

    }
    else {
      logs.info("Admin Only access this page.");
      //console.log("Admin Only access this page.");
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  }
  catch (ex) {
    //console.log(ex);
    logs.error('Trackcircuit page error Api (edittrackcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    errormail.mailSendError(
      `Error in trackcircuit page. Api (edittrackcircuit)`, ex);
  }
});

//delete registered track ciircuit
trackcircuit.put("/deletetrackcircuit", validuser, async (req, res) => {
  try {
    logs.info("Track Circuit delete started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    var access = null;
    var count = 0;
    if (user_role == "Station Incharge") {
      count++;

      access = await StationAccess.findOne(
        { where: { userid: user_id, stationid: req.body.stationid, isdele: false } }
      )
    }

    if (user_role == "Admin" || (count == 1 && access != null)) {
      let transaction = await db.transaction({ autocommit: false });
      try {
        logs.info(req.body);
        const id = req.body.id,
          isdele_reason = req.body.reason

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const check_trackcircuit = await RegisteredTrackCircuit.findOne(
          {
            where: { id, isdele: false },
          })

        if (check_trackcircuit != null) {

          const update_trackcircuit = await RegisteredTrackCircuit.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Track Circuit dele updated");

          const log_insert = await RegisteredTrackCircuitLogs.create(
            {
              trackcircuitid: update_trackcircuit[1].id,
              trackname: update_trackcircuit[1].trackname,
              stationid: update_trackcircuit[1].stationid,
              manufacture: update_trackcircuit[1].manufacture,
              serialno: update_trackcircuit[1].serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_trackcircuit[1].isdele_reason,
              isdele: false,
            },
            { transaction: transaction }
          );
          logs.info("Track Circuit dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("TrackCircuit Successfully deleted");
          //console.log("TrackCircuit Successfully deleted")
        }
        else {
          logs.info("TrackCircuit not found");
          //console.log("TrackCircuit not found"");
          res.status(401).json({ issuccess: false, msg: "TrackCircuit not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('TrackCircuit page error Api (deletetrackcircuit)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        errormail.mailSendError(
          `Error in trackCircuit page. Api (deletetrackcircuit)`,
          ex
        );
      }
    }
    else {
      logs.info("Admin Only access this page.");
      //console.log("Admin Only access this page.");
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  }
  catch (ex) {
    //console.log(ex);
    logs.error('Trackcircuit page error Api (deletetrackcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    errormail.mailSendError(
      `Error in trackcircuit page. Api (deletetrackcircuit)`, ex);
  }
});

//get all track circuit from a station for trackcircuitlist
trackcircuit.get("/getalltrackcircuit", validuser, async (req, res) => {
  try {
    //console.log(`get trackcircuit started`);         
    logs.info(`get trackcircuit started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role == "Station Incharge") {

      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false }, raw: true, })

      if (access.length > 0) {

        RegisteredRailwayStations.hasMany(RegisteredTrackCircuit, { foreignKey: 'stationid' });
        RegisteredTrackCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id', 'stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredTrackCircuits"."id"'), 'id'],
            [Sequelize.literal('"RegisteredTrackCircuits"."trackname"'), 'trackname'],
            [Sequelize.literal('"RegisteredTrackCircuits"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredTrackCircuits"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredTrackCircuit,
              attributes: [],
              where: {
                isdele: false,
              },
            }
          ],
          where: {
            isdele: false,
            id: access.map(a => a.stationid),
          },
          raw: true,
          order: [
            ['stationname'],
            [Sequelize.literal('"RegisteredTrackCircuits"."id"')],
          ],
        })

        //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,p.trackname,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredTrackCircuits" as p ON s.id = p.stationid where s.isdele = false and p.isdele = false' + ' and p.stationid=' + access.map(a => a.stationid) + ' order by s.stationname,p.id')
        logs.info(`get trackcircuit end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get trackcircuit end`)
        res.status(200).json({ issuccess: true, data: [] });
      }
    }
    else {
      if (user_role == "Admin") {

        RegisteredRailwayStations.hasMany(RegisteredTrackCircuit, { foreignKey: 'stationid' });
        RegisteredTrackCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id', 'stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredTrackCircuits"."id"'), 'id'],
            [Sequelize.literal('"RegisteredTrackCircuits"."trackname"'), 'trackname'],
            [Sequelize.literal('"RegisteredTrackCircuits"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredTrackCircuits"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredTrackCircuit,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['stationname'],
            [Sequelize.literal('"RegisteredTrackCircuits"."id"')],
          ],
        })

        //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,p.trackname,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredTrackCircuits" as p ON s.id = p.stationid where s.isdele = false and p.isdele = false order by s.stationname,p.id')
        logs.info(`get trackcircuit end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info("Admin Only access this page.");
        //console.log("Admin Only access this page.");
        res.status(401).json({ issuccess: false, msg: "Access Denied..." });
      }
    }

  } catch (ex) {
    //console.log(ex);
    logs.error('TrackCircuit page error Api (getalltrackcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

// //get all track circuit from a station for track circuit details
trackcircuit.get("/getstationtrackcircuit", validuser, async (req, res) => {
  logs.info(`get station trackcircuit started`);
  try {
    logs.info(req.query)

    // RegisteredTrackCircuit.hasMany(TrackCircuitData, { foreignKey: 'trackcircuitid' });
    // TrackCircuitData.belongsTo(RegisteredTrackCircuit, { foreignKey: 'trackcircuitid' });

    // TrackCircuitData.hasMany(TrackCircuitAlert, { foreignKey: 'trackcircuitdataid' });
    // TrackCircuitAlert.belongsTo(TrackCircuitData, { foreignKey: 'trackcircuitdataid' });

    // var datas = await TrackCircuitData.findAll({
    //   attributes: [
    //     [Sequelize.col('RegisteredTrackCircuit.id'), 'id'],
    //     [Sequelize.col('RegisteredTrackCircuit.trackname'), 'trackname'],
    //     [Sequelize.col('TrackCircuitAlerts.modeid'), 'modeid'],
    //     ['id', 'trackcircuitdataid'],
    //     'feed_count',
    //     'feed_current',
    //     'feed_voltage',
    //     'choke_voltage',
    //     'battery_charger_dc_voltage',
    //     'battery_charger_dc_current',
    //     'battery_charger_ac_voltage',
    //     'battery_charger_ac_current',
    //     'relay_count',
    //     'relay_current',
    //     'relay_voltage',
    //     'trv',
    //     'index_score',
    //     'leakage_current',
    //     'health',
    //     'track_OC',
    //     'createddate',
    //     'isdele',
    //   ],
    //   include: [
    //     {
    //       model: RegisteredTrackCircuit,
    //       attributes: [],
    //       where: {
    //         isdele: false,
    //         stationid: parseInt(req.query.stationid),
    //       },
    //     },
    //     {
    //       model: TrackCircuitAlert,
    //       attributes: [],
    //       where: {
    //         isdele: false,
    //       },
    //       required: false,
    //     },
    //   ],
    //   where: {
    //     isdele: false,
    //     id: {
    //       [Op.in]: (await TrackCircuitData.findAll({
    //         attributes: [
    //           [Sequelize.fn('max', Sequelize.col('TrackCircuitData.id')), 'id'],
    //         ],
    //         group: ['RegisteredTrackCircuit.id'],
    //         include: [
    //           {
    //             model: RegisteredTrackCircuit,
    //             attributes: [],
    //             where: {
    //               isdele: false,
    //               stationid: parseInt(req.query.stationid)
    //             },
    //           },
    //         ],
    //         where: {
    //           isdele: false,
    //         },
    //         raw: true,
    //       })).map(data => data.id)
    //     },
    //   },
    //   order: [
    //     [Sequelize.literal('CASE WHEN "TrackCircuitAlerts"."modeid" IS NULL THEN 0 ELSE 1 END'), 'DESC'],
    //     [Sequelize.col('TrackCircuitAlerts.modeid'), 'DESC'],
    //     [Sequelize.col('RegisteredTrackCircuit.trackname'), 'ASC'],
    //   ],
    //   group: [
    //     'TrackCircuitData.id',
    //     'RegisteredTrackCircuit.id',
    //     'RegisteredTrackCircuit.trackname',
    //     'TrackCircuitAlerts.modeid',
    //   ],
    //   raw: true,
    // });

    // const removeDuplicates = (array) => {
    //   const idCount = new Map();
    //   const indexes = [];

    //   array.forEach((item, index) => {
    //     const { id } = item;
    //     if (idCount.has(id)) {
    //       indexes.push(index);
    //     } else {
    //       idCount.set(id, true);
    //     }
    //   });

    //   indexes.reverse().forEach(index => {
    //     array.splice(index, 1);
    //   });

    //   return array;
    // };

    // var get_trackcircuits = removeDuplicates(datas);

    var datas = []
    var resgitered_tracks = await RegisteredTrackCircuit.findAll({
      where: {
        stationid: parseInt(req.query.stationid),
        isdele: false
      },
      order: [["trackname", "ASC"]],
      raw: true
    })

    for await (const element of resgitered_tracks) {
      var track_data = await TrackCircuitData.findOne({
        where: {
          trackcircuitid: element.id,
          isdele: false,
        },
        order: [["id", "DESC"]]
      })

      if (track_data != null) {
        var track_alert_data = await TrackCircuitAlert.findOne({
          where: {
            trackcircuitid: element.id,
            trackcircuitdataid: track_data.id,
            isdele: false,
          },
          order: [["modeid", "DESC"]]
        })
        datas.push({
          id: element.id,
          trackname: element.trackname,
          modeid: track_alert_data == null ? null : track_alert_data.modeid,
          trackcircuitdataid: track_data.id,
          feed_count: track_data.feed_count,
          feed_current: track_data.feed_current,
          feed_voltage: track_data.feed_voltage,
          choke_voltage: track_data.choke_voltage,
          battery_charger_dc_voltage: track_data.battery_charger_dc_voltage,
          battery_charger_dc_current: track_data.battery_charger_dc_current,
          battery_charger_ac_voltage: track_data.battery_charger_ac_voltage,
          battery_charger_ac_current: track_data.battery_charger_ac_current,
          relay_count: track_data.relay_count,
          relay_current: track_data.relay_current,
          relay_voltage: track_data.relay_voltage,
          trv: track_data.trv,
          index_score: track_data.index_score,
          leakage_current: track_data.leakage_current,
          health: track_data.health,
          track_OC: track_data.track_OC,
          createddate: track_data.createddate,
          isdele: track_data.isdele,
        })
      }
    }

    res.status(200).json({ issuccess: true, data: datas.sort((a, b) => b.modeid - a.modeid) });
    logs.info(`get station trackcircuit end`);
  } catch (ex) {
    logs.error('Trackcircuit page error Api (getstationtrackcircuit)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit data based on start,end and paginaion
trackcircuit.get("/getstationtrackcircuitdata", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit data logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
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

    logs.info(req.query);
    //console.log(req.query);

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
    where_condition.trackcircuitid = trackcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await TrackCircuitData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });


    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await TrackCircuitData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
        raw: true,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get track circuit data logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Trackcircuit page error Api (getstationtrackcircuit)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit current data based on paginaion
trackcircuit.get("/getstationtrackcircuitcurrentdata", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit current data  started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
    // if (req.query.start_date != "") {
    //     start_date = moment(req.query.start_date).format("YYYY-MM-DD");
    //     end_Date = moment(req.query.end_date).format("YYYY-MM-DD");
    // }
    let page = 1,
      size = 10;
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }
    logs.info(`${start_date} - start date //// ${end_Date} - end date`);

    logs.info(req.query);
    //console.log(req.query);

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

    // if(req.query.start_date != "")
    // {
    //   where_condition = {                         
    //     [Op.and]: [
    //       Sequelize.where(
    //         Sequelize.fn("date", Sequelize.col("createddate")),
    //         ">=",
    //         start_date
    //       ),
    //       Sequelize.where(
    //         Sequelize.fn("date", Sequelize.col("createddate")),
    //         "<=",
    //         end_Date
    //       ),
    //     ],
    //   };
    //   logs.info("with date" + where_condition);
    // }     

    where_condition.isdele = false;
    where_condition.trackcircuitid = trackcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await TrackCircuitData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });
    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await TrackCircuitData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
        raw: true,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get track circuit current data  ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Trackcircuit page error Api (getstationtrackcircuitcurrentdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit alert logs based on start,end and paginaion
trackcircuit.get("/getstationtrackcircuitalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
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

    logs.info(req.query);
    //console.log(req.query);

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
    where_condition.trackcircuitid = trackcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await TrackCircuitAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });


    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await TrackCircuitAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
        raw: true,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get track circuit alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Trackcircuit page error Api (getstationtrackcircuitalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit current alert logs based on  paginaion
trackcircuit.get("/getstationtrackcircuitcurrentalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit current  alert log started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
    // if (req.query.start_date != "") {
    //   start_date = moment(req.query.start_date).format("YYYY-MM-DD");
    //   end_Date = moment(req.query.end_date).format("YYYY-MM-DD");
    // }
    let page = 1,
      size = 10;
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }
    logs.info(`${start_date} - start date //// ${end_Date} - end date`);

    logs.info(req.query);
    //console.log(req.query);

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

    // if(req.query.start_date != "")
    // {
    //   where_condition = {                         
    //     [Op.and]: [
    //       Sequelize.where(
    //         Sequelize.fn("date", Sequelize.col("createddate")),
    //         ">=",
    //         start_date
    //       ),
    //       Sequelize.where(
    //         Sequelize.fn("date", Sequelize.col("createddate")),
    //         "<=",
    //         end_Date
    //       ),
    //     ],
    //   };
    //   logs.info("with date" + where_condition);
    // }     

    where_condition.isdele = false;
    where_condition.trackcircuitid = trackcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await TrackCircuitAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });


    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await TrackCircuitAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
        raw: true,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get track circuit alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Trackcircuit page error Api (getstationtrackcircuitcurrentalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit data graph based on start,end and  time
trackcircuit.get("/getstationtrackcircuitdatagraph", validuser, async (req, res) => {
  try {
    logs.info(`get station track circuit data graph started`);

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid
    const date = req.query.date
    const from_time = req.query.from_time
    const to_time = req.query.to_time


    logs.info(req.query);
    //console.log(req.query);  

    var from_date = new Date(new Date(date).setHours(parseFloat(from_time.split(':')[0]), parseFloat(from_time.split(':')[1]), 0, 0));
    var to_date = new Date(new Date(date).setHours(parseFloat(to_time.split(':')[0]), parseFloat(to_time.split(':')[1]), 0, 0));


    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await TrackCircuitData.findAll({
        where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, trackcircuitid: trackcircuitid },
        order: [["id", "ASC"]],
        raw: true,
      });
      global.gc()
      let results = []
      for await (var element of get_list) {
        results.push({
          trackcircuitid: element.trackcircuitid,
          feed_count: element.feed_count,
          feed_current: element.feed_current,
          feed_voltage: element.feed_voltage,
          choke_voltage: element.choke_voltage,
          battery_charger_dc_voltage: element.battery_charger_dc_voltage,
          battery_charger_dc_current: element.battery_charger_dc_current,
          battery_charger_ac_voltage: element.battery_charger_ac_voltage,
          battery_charger_ac_current: element.battery_charger_ac_current,
          relay_count: element.relay_count,
          relay_current: element.relay_current,
          relay_voltage: element.relay_voltage,
          trv: element.trv,
          index_score: element.index_score,
          leakage_current: element.leakage_current,
          health: element.health,
          track_OC: element.track_OC,
          time: moment(element.createddate).format("HH:mm")
        })
      }
      res.status(200).json({ issuccess: true, data: results });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, trackcircuitid: trackcircuitid },
          order: [["id", "ASC"]],
          raw: true,
        });
        global.gc()
        let results = []
        for await (var element of get_list) {
          results.push({
            trackcircuitid: element.trackcircuitid,
            feed_count: element.feed_count,
            feed_current: element.feed_current,
            feed_voltage: element.feed_voltage,
            choke_voltage: element.choke_voltage,
            battery_charger_dc_voltage: element.battery_charger_dc_voltage,
            battery_charger_dc_current: element.battery_charger_dc_current,
            battery_charger_ac_voltage: element.battery_charger_ac_voltage,
            battery_charger_ac_current: element.battery_charger_ac_current,
            relay_count: element.relay_count,
            relay_current: element.relay_current,
            relay_voltage: element.relay_voltage,
            trv: element.trv,
            index_score: element.index_score,
            leakage_current: element.leakage_current,
            health: element.health,
            track_OC: element.track_OC,
            time: moment(element.createddate).format("HH:mm")
          })
        }
        res.status(200).json({ issuccess: true, data: results });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, trackcircuitid: trackcircuitid },
          order: [["id", "ASC"]],
          raw: true,
        });
        global.gc()
        let results = []
        for await (var element of get_list) {
          results.push({
            trackcircuitid: element.trackcircuitid,
            feed_count: element.feed_count,
            feed_current: element.feed_current,
            feed_voltage: element.feed_voltage,
            choke_voltage: element.choke_voltage,
            battery_charger_dc_voltage: element.battery_charger_dc_voltage,
            battery_charger_dc_current: element.battery_charger_dc_current,
            battery_charger_ac_voltage: element.battery_charger_ac_voltage,
            battery_charger_ac_current: element.battery_charger_ac_current,
            relay_count: element.relay_count,
            relay_current: element.relay_current,
            relay_voltage: element.relay_voltage,
            trv: element.trv,
            index_score: element.index_score,
            leakage_current: element.leakage_current,
            health: element.health,
            track_OC: element.track_OC,
            time: moment(element.createddate).format("HH:mm")
          })
        }
        res.status(200).json({ issuccess: true, data: results });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info("get track circuit data graph ended");
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Signlacircuit page error Api (getstationtrackcircuitdatagraph)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

// //download the selected track circuit data based on start,end and paginaion
trackcircuit.get("/downloadtrackcircuitdatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    const trackname = await RegisteredTrackCircuit.findOne({ where: { id: trackcircuitid, isdele: false } })

    const stationname = await RegisteredRailwayStations.findOne({ where: { id: stationid, isdele: false } })

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
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

    logs.info(req.query);
    //console.log(req.query);

    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("TrackCirciutData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "TrackCirciutData" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 5 },
      // { header: "Station Name", key: "stationname", width: 10 },
      { header: "TrackCircuitName", key: "trackname", width: 16 },
      { header: "TF(Idc) (A)", key: "feedcurrent", width: 11 },
      { header: "TR(Idc) (A)", key: "relaycurrent", width: 11 },
      { header: "TF(Vdc)", key: "feedvoltage", width: 7 },
      { header: "TR(Vdc)", key: "relayvoltage", width: 7 },
      { header: "TF Choke(Vdc)", key: "chokevoltage", width: 13 },
      { header: "Charger(Idc) (A)", key: "battery_charger_dc_current", width: 16 },
      { header: "Charger(Vdc)", key: "battery_charger_dc_voltage", width: 12 },
      { header: "Charger I/P(Iac) (A)", key: "battery_charger_ac_current", width: 16 },
      { header: "Charger I/P(Vac)", key: "battery_charger_ac_voltage", width: 14 },
      { header: "TRV(Vdc)", key: "trv", width: 8 },
      { header: "Index Score", key: "indexscore", width: 10 },
      { header: "Leakage Current(ma)", key: "leakagecurrent", width: 15 },
      { header: "Health", key: "health", width: 7 },
      { header: "Track O/C", key: "trackoc", width: 9 },
      { header: "CreatedDate", key: "createddate", width: 20 },
    ];
    worksheet.properties.defaultRowHeight = 20;
    var list = [], sno = 1;

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
    where_condition.trackcircuitid = trackcircuitid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await TrackCircuitData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      // var list = new LINQ(get_list)
      // .Select(function(element) {
      //   return {Id: sno++, 
      //     trackname: trackname.trackname + ' @' + stationname.stationname,
      //       feedcurrent: element.feed_current,
      //       relaycurrent: element.relay_current,
      //       feedvoltage: element.feed_voltage,
      //       relayvoltage: element.relay_voltage,
      //       chokevoltage: element.choke_voltage,
      //       battery_charger_dc_voltage : element.battery_charger_dc_voltage,
      //       battery_charger_dc_current : element.battery_charger_dc_current, 
      //       battery_charger_ac_voltage : element.battery_charger_ac_voltage,
      //       battery_charger_ac_current : element.battery_charger_ac_current, 
      //       trv:  element.trv,
      //       indexscore: element.index_score,
      //       leakagecurrent: element.leakage_current,
      //       health: element.health,  
      //       trackoc: element.track_OC,
      //       createddate: moment(element.createddate).format(
      //         "YYYY-MM-DD HH:mm:ss"
      //       ),}})
      // .ToArray();

      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          trackname: trackname.trackname + ' @' + stationname.stationname,
          feedcurrent: element.feed_current,
          relaycurrent: element.relay_current,
          feedvoltage: element.feed_voltage,
          relayvoltage: element.relay_voltage,
          chokevoltage: element.choke_voltage,
          battery_charger_dc_voltage: element.battery_charger_dc_voltage,
          battery_charger_dc_current: element.battery_charger_dc_current,
          battery_charger_ac_voltage: element.battery_charger_ac_voltage,
          battery_charger_ac_current: element.battery_charger_ac_current,
          trv: element.trv,
          indexscore: element.index_score,
          leakagecurrent: element.leakage_current,
          health: element.health,
          trackoc: element.track_OC,
          createddate: moment(element.createddate).format(
            "YYYY-MM-DD HH:mm:ss"
          ),
        });
        sno++;
      }

      // Add Array Rows
      worksheet.addRows(list);

      //console.log(list.length);
      await workbook.xlsx.write(res).then(function () {
        res.status(200).end();
        //console.log(`sent successfully`);
      });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })
      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            trackname: trackname.trackname + ' @' + stationname.stationname,
            feedcurrent: element.feed_current,
            relaycurrent: element.relay_current,
            feedvoltage: element.feed_voltage,
            relayvoltage: element.relay_voltage,
            chokevoltage: element.choke_voltage,
            battery_charger_dc_voltage: element.battery_charger_dc_voltage,
            battery_charger_dc_current: element.battery_charger_dc_current,
            battery_charger_ac_voltage: element.battery_charger_ac_voltage,
            battery_charger_ac_current: element.battery_charger_ac_current,
            trv: element.trv,
            indexscore: element.index_score,
            leakagecurrent: element.leakage_current,
            health: element.health,
            trackoc: element.track_OC,
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        worksheet.addRows(list);

        //console.log(list.length);
        await workbook.xlsx.write(res).then(function () {
          res.status(200).end();
          //console.log(`sent successfully`);
        });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    else if (user_role == "Employee") {
      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            trackname: trackname.trackname + ' @' + stationname.stationname,
            feedcurrent: element.feed_current,
            relaycurrent: element.relay_current,
            feedvoltage: element.feed_voltage,
            relayvoltage: element.relay_voltage,
            chokevoltage: element.choke_voltage,
            battery_charger_dc_voltage: element.battery_charger_dc_voltage,
            battery_charger_dc_current: element.battery_charger_dc_current,
            battery_charger_ac_voltage: element.battery_charger_ac_voltage,
            battery_charger_ac_current: element.battery_charger_ac_current,
            trv: element.trv,
            indexscore: element.index_score,
            leakagecurrent: element.leakage_current,
            health: element.health,
            trackoc: element.track_OC,
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        worksheet.addRows(list);

        //console.log(list.length);
        await workbook.xlsx.write(res).then(function () {
          res.status(200).end();
          //console.log(`sent successfully`);
        });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    logs.info(
      "get track circuit report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Trackcircuit page error Api (downloadtrackcircuitdatareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected track circuit data based on start,end and paginaion
trackcircuit.get("/downloadtrackcircuitalertreport", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit alert report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    const trackname = await RegisteredTrackCircuit.findOne({ where: { id: trackcircuitid, isdele: false } })

    const stationname = await RegisteredRailwayStations.findOne({ where: { id: stationid, isdele: false } })

    const alertmodes = await AlertMode.findOne({ where: { isdele: false } }, { raw: true })

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
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

    logs.info(req.query);
    //console.log(req.query);

    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("TrackCirciutAlert");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "TrackCirciutAlert" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "Id", key: "Id", width: 5 },
      //{ header: "Station Name", key: "stationname", width: 10 },
      { header: "TrackCircuit Name", key: "trackname", width: 20 },
      { header: "Message", key: "message", width: 50 },
      { header: "Mode", Key: "mode", width: 15 },
      { header: "CreatedDate", key: "createddate", width: 20 },
    ];
    worksheet.properties.defaultRowHeight = 20;
    let list = [], sno = 1;

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
    where_condition.trackcircuitid = trackcircuitid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await TrackCircuitAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          //stationname: stationname.stationname,
          trackname: trackname.trackname + ' @' + stationname.stationname,
          message: element.message,
          mode: lodash.result(lodash.find(alertmodes, { 'id': element.modeid }), 'mode'),
          createddate: moment(element.createddate).format(
            "YYYY-MM-DD HH:mm:ss"
          ),
        });
        sno++;
      }

      // Add Array Rows
      worksheet.addRows(list);

      //console.log(list.length);
      await workbook.xlsx.write(res).then(function () {
        res.status(200).end();
        //console.log(`sent successfully`);
      });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })
      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            //stationname: stationname.stationname,
            trackname: trackname.trackname + ' @' + stationname.stationname,
            message: element.message,
            mode: lodash.result(lodash.find(alertmodes, { 'id': element.modeid }), 'mode'),
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        worksheet.addRows(list);

        //console.log(list.length);
        await workbook.xlsx.write(res).then(function () {
          res.status(200).end();
          //console.log(`sent successfully`);
        });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    else if (user_role == "Employee") {
      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            //stationname: stationname.stationname,
            trackname: trackname.trackname + ' @' + stationname.stationname,
            message: element.message,
            mode: lodash.result(lodash.find(alertmodes, { 'id': element.modeid }), 'mode'),
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        worksheet.addRows(list);

        //console.log(list.length);
        await workbook.xlsx.write(res).then(function () {
          res.status(200).end();
          //console.log(`sent successfully`);
        });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    logs.info(
      "get track circuit alert report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Trackcircuit page error Api (downloadtrackcircuitalertreport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit alert logs based on start,end and paginaion without date for mobile
trackcircuit.get("/getstationtrackcircuitalertmobile", validuser, async (req, res) => {
  try {
    logs.info(
      "get track circuit alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    let page = 1,
      size = 10;
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }

    logs.info("req.query", req.query);
    //console.log(req.query);

    var total_data_count = await TrackCircuitAlert.count({
      where: { isdele: false, trackcircuitid: trackcircuitid },
      order: [["id", "DESC"]],
    });


    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await TrackCircuitAlert.findAll({
        where: { isdele: false, trackcircuitid: trackcircuitid },
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
        raw: true,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: { isdele: false, trackcircuitid: trackcircuitid },
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        var get_list = await TrackCircuitAlert.findAll({
          where: { isdele: false, trackcircuitid: trackcircuitid },
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
          raw: true,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get track circuit alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Trackcircuit page error Api (getstationtrackcircuitalertmobile)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get latest track circuit details in a station for trackcircuit details for mobile
trackcircuit.get("/getfinaldataMobile", validuser, async (req, res) => {
  try {

    logs.info(`get final trackcircuit for mobile started`);
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid
    logs.info('getFinalTrack ==> req.query', req.query);

    var get_final_trackcircuit_data = [await TrackCircuitData.findOne({ limit: 1, where: { isdele: false, trackcircuitid: trackcircuitid }, order: [["id", "DESC"]] })];
    get_final_trackcircuit_data = get_final_trackcircuit_data[0] !== null ? get_final_trackcircuit_data : []

    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_final_trackcircuit_data });
    } else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_final_trackcircuit_data });
      }
      else {

        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });

      }
    } else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_final_trackcircuit_data });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }

    logs.info(`get station track circuit  end`);
  } catch (ex) {
    logs.error('Trackcircuit page error Api (getfinaldataMobile)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected track circuit latest data 
trackcircuit.get("/getstationtrackcircuitfinaldata", validuser, async (req, res) => {
  logs.info(`get station trackcircuit final data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const trackcircuitid = req.query.trackcircuitid

    logs.info(req.query);
    //console.log(req.query);

    const trackname = await RegisteredTrackCircuit.findOne({ where: { id: trackcircuitid, isdele: false } })    

    var get_finaltrackcircuit_datas = await TrackCircuitData.findOne({ limit: 1, where: { isdele: false, trackcircuitid: trackcircuitid }, order: [["id", "DESC"]], raw: true });

    if (get_finaltrackcircuit_datas != null) {
      get_finaltrackcircuit_datas.trackname = trackname.trackname      
    }
    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_finaltrackcircuit_datas });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_finaltrackcircuit_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 2, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_finaltrackcircuit_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get track circuit data logs ended"
    );
  }
  catch (ex) {
    logs.error('Trackcircuit page error Api (getstationtrackcircuitfinaldata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});


module.exports = trackcircuit;
