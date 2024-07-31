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
const mail = require("../../services/mail");

const log4js = require("../../log4js");
const logs = log4js.logger;


const signalcircuit = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();
require("expose-gc")

const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const RegisteredSignalCircuit = require("../../models/registeredsignalcircuit");
const RegisteredSignalCircuitLogs = require("../../models/registeredsignalcircuitlogs");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const StationAccess = require("../../models/stationaccess");
const SignalCircuitData = require("../../models/signalcircuitdata");
const SignalCircuitAlert = require("../../models/signalcircuitalert");
const GuiInidcation = require("../../models/guiindication");
const SignalCircuit1AData = require("../../models/signalcircuit1adata");
const NotificationControl = require("../../models/notificationcontrol");
const AlertMessage = require('../../models/alertmessage');
const AlertMode = require("../../models/alertmode");
const SignalAspectType = require("../../models/signalaspecttype");
const excel = require("exceljs");
const reader = require('xlsx');


//register signal circuit
signalcircuit.post("/registersignalcircuit", validuser, async (req, res) => {
  try {
    logs.info("New signal circuit registration started");
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
      const signalname = req.body.signalname,
        stationid = req.body.stationid,    
        aspecttypeid = req.body.aspecttypeid,  
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var signalcircuitcheck = [await RegisteredSignalCircuit.findOne({
        where: { signalname: signalname, stationid: stationid },
      })];
      signalcircuitcheck = signalcircuitcheck[0] !== null ? signalcircuitcheck : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (signalcircuitcheck.length !== 0) {
        if (signalcircuitcheck[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_signalcircuit = await RegisteredSignalCircuit.update(
              {
                manufacture: manufacture,
                aspecttypeid: aspecttypeid,
                serialno: serialno,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: signalcircuitcheck[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("Signal circuit registration inserted");

            const log_insert = await RegisteredSignalCircuitLogs.create(
              {
                signalcircuitid: update_signalcircuit[1].id,
                signalname: update_signalcircuit[1].signalname,
                stationid: update_signalcircuit[1].stationid,
                aspecttypeid: update_signalcircuit[1].aspecttypeid,
                manufacture: update_signalcircuit[1].manufacture,
                serialno: update_signalcircuit[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Signal circuit registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Signalcircuit inserted Successfully" });
            logs.info("Signalcircuit Successfully Registered");
            //console.log("Signalcircuit Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Signalcircuit page error Api (registersignalcircuit)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in signalcircuit page. Api (registersignalcircuit)`, ex);
          }
        }
        else {
          //console.log("Given signal circuit is already registered.");
          logs.info("Given signal circuit is already available.");
          res
            .status(400)
            .json({ issuccess: false, msg: "Given signal circuit is aleady available" });
        }
      }
      else {       
          if (fs.existsSync('railways.xlsx')) {
            let transaction = await db.transaction({ autocommit: false });
            try {
              const register_signalcircuit = await RegisteredSignalCircuit.create({
                signalname,
                stationid,
                aspecttypeid,
                manufacture,
                serialno,
                createddate: current_datetime,
                createdby_id,
                updateddate: current_datetime,
                isdele,
              },
                { transaction: transaction })
              logs.info("Signal circuit registration inserted");

              const log_insert = await RegisteredSignalCircuitLogs.create(
                {
                  signalcircuitid: register_signalcircuit.id,
                  aspecttypeid,
                  signalname,
                  stationid,
                  manufacture,
                  serialno,
                  updateddate: current_datetime,
                  updatedby_id: user_id,
                  isdele,
                },
                { transaction: transaction }
              );
              logs.info("Signal circuit registration log inserted");

              // Reading our railway file
              const file = reader.readFile('railways.xlsx')
              let data = []
              if (file.SheetNames[8] == "Signal Circuit Alerts") {
                const temp = reader.utils.sheet_to_json(
                  file.Sheets[file.SheetNames[8]])
                temp.forEach(async (res) => {
                  var object = {
                    stationid: stationid,
                    assertid: register_signalcircuit.id,
                    assert: "Signal Circuit",
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
                  .json({ issuccess: true, msg: "Signalcircuit inserted Successfully" });
                logs.info("Signalcircuit Successfully Registered");
                //console.log("Signalcircuit Successfully Registered")
              }
              else {
                await transaction.rollback();
                logs.info('Signal Circuit Alerts sheet not found');
                //console.log('Signal Circuit Alerts sheet not found')
                res.status(400).json({ issuccess: false, msg: 'Signal Circuit Alerts sheet not found' });
              }
            }
            catch (ex) {
              await transaction.rollback();
              //console.log(ex.message);
              logs.error('Signalcircuit page error Api (registersignalcircuit)' + ex);
              res.status(400).json({ issuccess: false, msg: ex.message });
              mail.mailSendError(`Error in signalcircuit page. Api (registersignalcircuit)`, ex);
            }
          }
          else
          {
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
    logs.error('Signalcircuit page error Api (registersignalcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in signalcircuit page. Api (registersignalcircuit)`, ex);
  }
});

//edit registered signal circuit
signalcircuit.put("/editsignalcircuit", validuser, async (req, res) => {
  try {
    logs.info("Signal Circuit edit started");
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
          currentsignalname = req.body.currentsignalname,
          newsignalname = req.body.newsignalname,
          stationid = req.body.stationid,
          aspecttypeid = req.body.aspecttypeid
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_signalcircuits = await RegisteredSignalCircuit.findAll(
          { where: { stationid, isdele: false }, raw: true, }
        )

        const check_signalname = await RegisteredSignalCircuit.findOne(
          { where: { id, isdele: false } }
        )

        if (check_signalname == null) {
          logs.info("Signalcircuit not exist in this station.");
          //console.log("Signalcircuit not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Signalcircuit not exists in this station." });
        }
        else {
          let repeat_names = false;

          currentsignalname == newsignalname ? repeat_names = false : station_signalcircuits.find(value => value.signalname == newsignalname) ? repeat_names = true : false

          if (repeat_names == false) {
            const update_signalcircuit = await RegisteredSignalCircuit.update(
              {
                signalname: newsignalname,
                manufacture: manufacture,
                serialno: serialno,
                aspecttypeid: aspecttypeid,
                updateddate: current_datetime
              },
              { where: { id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })

            logs.info("Signal Circuit updated");
            const log_insert = await RegisteredSignalCircuitLogs.create(
              {
                signalcircuitid: update_signalcircuit[1].id,
                signalname: update_signalcircuit[1].signalname,
                stationid: update_signalcircuit[1].stationid,
                manufacture: update_signalcircuit[1].manufacture,
                serialno: update_signalcircuit[1].serialno,
                aspecttypeid: update_signalcircuit[1].aspecttypeid,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Signal Circuit log inserted");
            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Successfully Updated" });
            logs.info("SignalCircuit Successfully Updated");
            //console.log("SignalCircuit  Successfully Updated")  
          }
          else {
            logs.info("Signal Circuit already exist in this station");
            res.status(400).json({ issuccess: false, msg: "Signal Circuit already exists in the station" });
          }

        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Signalcircuit page error Api (editsignalcircuit)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(`Error in signalcircuit page. Api (editsignalcircuit)`, ex);
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
    logs.error('Signalcircuit page error Api (editsignalcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in signalcircuit page. Api (editsignalcircuit)`, ex);
  }
});

//delete signal circuit
signalcircuit.put("/deletesignalcircuit", validuser, async (req, res) => {
  try {
    logs.info("Signal Circuit delete started");
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

        const check_signalcircuit = await RegisteredSignalCircuit.findOne(
          {
            where: { id, isdele: false },
          })

        if (check_signalcircuit != null) {

          const update_signalcircuit = await RegisteredSignalCircuit.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Signal Circuit dele updated");

          const log_insert = await RegisteredSignalCircuitLogs.create(
            {
              signalcircuitid: update_signalcircuit[1].id,
              signalname: update_signalcircuit[1].signalname,
              stationid: update_signalcircuit[1].stationid,
              manufacture: update_signalcircuit[1].manufacture,
              serialno: update_signalcircuit[1].serialno,
              aspecttypeid: update_signalcircuit[1].aspecttypeid,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_signalcircuit[1].isdele_reason,
              isdele: false,
            },
            { transaction: transaction }
          );
          logs.info("signal Circuit dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("SignalCircuit Successfully deleted");
          //console.log("SignalCircuit Successfully deleted")
        }
        else {
          logs.info("SignalCircuit not found");
          //console.log("SignalCircuit not found"");
          res.status(401).json({ issuccess: false, msg: "SignalCircuit not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('SignalCircuit page error Api (deletesignalcircuit)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in signalCircuit page. Api (deletesignalcircuit)`,
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
    logs.error('Signalcircuit page error Api (deletesignalcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in signalcircuit page. Api (deletesignalcircuit)`, ex);
  }
});

//get all signal circuit in a station for signalcircuit list
signalcircuit.get("/getallsignalcircuit", validuser, async (req, res) => {
  try {
    //console.log(`get signalcircuit started`);         
    logs.info(`get signalcircuit started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role == "Station Incharge") {

      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false }, raw: true, })
      if (access.length > 0) {
        
        RegisteredRailwayStations.hasMany(RegisteredSignalCircuit, { foreignKey: 'stationid' });
        RegisteredSignalCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });
        RegisteredSignalCircuit.belongsTo(SignalAspectType, { foreignKey: 'aspecttypeid' })
    
        const datas = await RegisteredSignalCircuit.findAll({
          attributes: [
            'id',
            'stationid',
            'signalname',
            'manufacture',
            'serialno',
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
            [Sequelize.literal('"SignalAspectType"."description"'), 'aspecttype'],
          ],
          include: [
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
                id: access.map(a => a.stationid),
              },
            },
            {
              model: SignalAspectType,
              attributes: [
              ],
            },
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"')],
          ],
        })
        
        //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,A.description,p.signalname,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredSignalCircuits" as p ON s.id = p.stationid JOIN public."SignalAspectType" as A ON A.id = s.aspecttypeid where s.isdele = false and p.isdele = false' + ' and p.stationid=' + access.map(a => a.stationid) + ' order by s.stationname,p.id')
        logs.info(`get signalcircuit end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get signalcircuit end`)
        res.status(200).json({ issuccess: true, data: [] });
      }

    }
    else {
      if (user_role == "Admin") {
        RegisteredRailwayStations.hasMany(RegisteredSignalCircuit, { foreignKey: 'stationid' });
        RegisteredSignalCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });
        RegisteredSignalCircuit.belongsTo(SignalAspectType, { foreignKey: 'aspecttypeid' })
    
        const datas = await RegisteredSignalCircuit.findAll({
          attributes: [
            'id',
            'stationid',
            'signalname',
            'manufacture',
            'serialno',
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
            [Sequelize.literal('"SignalAspectType"."description"'), 'aspecttype'],
          ],
          include: [
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: SignalAspectType,
              attributes: [
              ],
            },
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"')],
          ],
        })
        
        //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,A.description,p.signalname,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredSignalCircuits" as p ON s.id = p.stationid JOIN public."SignalAspectType" as A ON A.id = p.aspecttypeid where s.isdele = false and p.isdele = false order by s.stationname,p.id')
        logs.info(`get signalcircuit end`)
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
    logs.error('SignalCircuit page error Api (getallsignalcircuit)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

//get latest signal circuit details in a station for signalcircuit details
signalcircuit.get("/getstationsignalcircuit", validuser, async (req, res) => {
  logs.info(`get station latest signalcircuit started`);
  try {
    logs.info(req.query)
    
    // RegisteredSignalCircuit.hasMany(SignalCircuitData, { foreignKey: 'signalcircuitid' });
    // SignalCircuitData.belongsTo(RegisteredSignalCircuit, { foreignKey: 'signalcircuitid' });

    // SignalCircuitData.hasMany(SignalCircuitAlert, { foreignKey: 'signalcircuitdataid' });
    // SignalCircuitAlert.belongsTo(SignalCircuitData, { foreignKey: 'signalcircuitdataid' });

    // var datas = 
    // await SignalCircuitData.findAll({
    //   attributes: [
    //     [Sequelize.col('RegisteredSignalCircuit.id'), 'id'],
    //     [Sequelize.col('RegisteredSignalCircuit.signalname'), 'signalname'],
    //     [Sequelize.col('RegisteredSignalCircuit.aspecttypeid'), 'aspecttypeid'],
    //     [Sequelize.col('SignalCircuitAlerts.modeid'), 'modeid'],
    //     ['id', 'signalcircuitdataid'],
    //     'terminal',        
    //     'greenvoltage',
    //     'greencurrent',
    //     'redvoltage',
    //     'redcurrent',
    //     'yellowvoltage',
    //     'yellowcurrent',
    //     'lightyellowvoltage',
    //     'lightyellowcurrent',
    //     'signal_aspect',
    //     'aspect_current',
    //     'aspect_voltage',
    //     'index_score',
    //     'gui', 
    //     'createddate',      
    //     'isdele',
    //   ],
    //   include: [
    //     {
    //       model: RegisteredSignalCircuit,
    //       attributes: [],
    //       where: {
    //         isdele: false,
    //         stationid: parseInt(req.query.stationid),
    //       },
    //     },
    //     {
    //       model: SignalCircuitAlert,
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
    //       [Op.in]: (await SignalCircuitData.findAll({
    //         attributes: [
    //           [Sequelize.fn('max', Sequelize.col('SignalCircuitData.id')), 'id'],
    //         ],
    //         group: ['RegisteredSignalCircuit.id'],
    //         include: [
    //           {
    //             model: RegisteredSignalCircuit,
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
    //     [Sequelize.literal('CASE WHEN "SignalCircuitAlerts"."modeid" IS NULL THEN 0 ELSE 1 END'), 'DESC'],
    //     [Sequelize.col('SignalCircuitAlerts.modeid'), 'DESC'],
    //     [Sequelize.col('RegisteredSignalCircuit.signalname'), 'ASC'],
    //   ],
    //   group: [
    //     'SignalCircuitData.id',
    //     'RegisteredSignalCircuit.id',
    //     'RegisteredSignalCircuit.signalname',
    //     'SignalCircuitAlerts.modeid',
    //     'RegisteredSignalCircuit.aspecttypeid',
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

    // var get_signalcircuits = removeDuplicates(datas);

    ////const data = await db.query('SELECT n.signalname,n.id,a.signal_aspect,a.aspect_current,a.aspect_voltage,a.index_score,g.name,a.createddate from public."RegisteredSignalCircuits" as n JOIN public."SignalCircuitData" as a ON a.signalcircuitid = n.id JOIN public."GuiIndication" as g ON g.id = a.gui JOIN public."RegisteredRailwayStations" as r ON r.id = n.stationid  where n.isdele = false and n.stationid =' + req.query.stationid +' and r.isdele = false  order by n.stationid asc')
        
    var datas = []
    var resgitered_signals = await RegisteredSignalCircuit.findAll({
      where: {       
        stationid: parseInt(req.query.stationid),
        isdele: false
      },
      order: [["signalname", "ASC"]],
      raw: true
    })

    for await(const element of resgitered_signals)
    {
      var signal_data = await SignalCircuitData.findOne({
        where: {       
          signalcircuitid: element.id,
          isdele: false,
        },        
        order: [["id","DESC"]]
      })

      if(signal_data != null)
      {
        var signal_alert_data = await SignalCircuitAlert.findOne({
          where: {       
            signalcircuitid: element.id,
            signalcircuitdataid: signal_data.id,
            isdele: false,
          },
          order: [["modeid","DESC"]]
        })
        datas.push({
          id: element.id,
          signalname: element.signalname,
          modeid: signal_alert_data == null ? null : signal_alert_data.modeid,
          signalcircuitdataid: signal_data.id,
          aspecttypeid: element.aspecttypeid,
          terminal: signal_data.terminal,
          greenvoltage: signal_data.greenvoltage,
          greencurrent: signal_data.greencurrent,
          redvoltage: signal_data.redvoltage,
          redcurrent: signal_data.redcurrent,
          yellowvoltage: signal_data.yellowvoltage,
          yellowcurrent: signal_data.yellowcurrent,
          lightyellowvoltage: signal_data.lightyellowvoltage,
          lightyellowcurrent: signal_data.lightyellowcurrent,
          whitevoltage: signal_data.whitevoltage,
          whitecurrent: signal_data.whitecurrent,
          signal_aspect: signal_data.signal_aspect,
          aspect_voltage: signal_data.aspect_voltage,
          aspect_current: signal_data.aspect_current,
          index_score: signal_data.index_score,
          gui: signal_data.gui,
          createddate: signal_data.createddate,
          isdele: signal_data.isdele,
        })       
      }
    }
    
    res.status(200).json({ issuccess: true, data: datas.sort((a,b) => b.modeid - a.modeid) });
    logs.info(`get station signal circuit  end`);
  } catch (ex) {
    logs.error('Signalcricuit page error Api (getstationsignalcircuit)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//post the signal circui data from http
signalcircuit.post("/signalcircuitdata", validuser, async (resq, res) => {
  logs.info("Signal circuit data started");
  const user_id = JwtDecode(req.token).Userid,
    user_role = JwtDecode(req.token).Roles,
    user_mail = JwtDecode(req.token).Email;

  let transaction = await db.transaction({ autocommit: false })
  try {
    logs.info(req.body);
    const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
      current_Date = moment().format("YYYY-MM-DD");
    const data = {
      signalcircuitid: req.body.id,
      signal_aspect: req.body.feed_current,
      aspect_current: req.body.relay_current,
      index_score: req.body.index_score,
      aspect_voltage: req.body.aspect_voltage,
      gui: req.body.gui,
      createddate: current_datetime,
      isdele: false
    }

    const create_data = await SignalCircuitData.create(
      {
        data
      },
      { transaction: transaction }
    );


    logs.info("Signal Cricuit data inserted");
    await transaction.commit()
    res.status(200).json({ issuccess: true, msg: "Data inserted succesfully" })
  }
  catch (ex) {
    await transaction.rollback()
    logs.error('Signalcircuit page error Api (signalcircuitdata)' + ex);
    res.status(401).json({ issuccess: false, msg: ex.message })
  }
})

//get the selected signal circuit data based on start , end and paginaion
signalcircuit.get("/getstationsignalcircuitdata", validuser, async (req, res) => {
  logs.info(`get station signalcircuit  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    let start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    logs.info(req.query);
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
    where_condition.signalcircuitid = signalcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await SignalCircuitData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await SignalCircuitData.findAll({
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
        var get_list = await SignalCircuitData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitData.findAll({
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
      "get signal circuit data logs ended"
    );
  }
  catch (ex) {
    logs.error('Signalcircuit page error Api (getstationsignalcircuitdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected signal circuit current data based on  paginaion
signalcircuit.get("/getstationsignalcircuitcurrentdata", validuser, async (req, res) => {
  logs.info(`get station signalcircuit current  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    logs.info(req.query);
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
    where_condition.signalcircuitid = signalcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await SignalCircuitData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await SignalCircuitData.findAll({
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
        var get_list = await SignalCircuitData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitData.findAll({
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
      "get signal circuit data logs ended"
    );
  }
  catch (ex) {
    logs.error('Signalcircuit page error Api (getstationsignalcircuitcurrentdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected signal circuit alert logs based on start,end and paginaion
signalcircuit.get("/getstationsignalcircuitalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get signal circuit alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

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
    where_condition.signalcircuitid = signalcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await SignalCircuitAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await SignalCircuitAlert.findAll({
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
        var get_list = await SignalCircuitAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitAlert.findAll({
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
      "get signal circuit alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Signalcircuit page error Api (getstationsignalcircuitalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected signal circuit current alert data based opaginaion
signalcircuit.get("/getstationsignalcircuitcurrentalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get signal circuit current alert started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    // //console.log(req.query);
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
    where_condition.signalcircuitid = signalcircuitid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await SignalCircuitAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await SignalCircuitAlert.findAll({
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
        var get_list = await SignalCircuitAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitAlert.findAll({
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
      "get signal circuit current alert ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Signalcircuit page error Api (getstationsignalcircuitcurrentalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected signal circuit data graph based on start,end and  time
signalcircuit.get("/getstationsignalcircuitdatagraph", validuser, async (req, res) => {
  try {
    logs.info(
      "get signal circuit data graph started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid
    const date = req.query.date
    const from_time = req.query.from_time
    const to_time = req.query.to_time


    logs.info(req.query);
    //console.log(req.query);        

    var from_date = new Date(new Date(date).setHours(parseFloat(from_time.split(':')[0]), parseFloat(from_time.split(':')[1]), 0, 0));
    var to_date = new Date(new Date(date).setHours(parseFloat(to_time.split(':')[0]), parseFloat(to_time.split(':')[1]), 0, 0));

    // from_date = moment(from_date).format("YYYY-MM-DD HH:mm:ss")
    // to_date = moment(to_date).format("YYYY-MM-DD HH:mm:ss")

    if (user_role == "Admin" || user_role == "Super Admin") {
      //Sequelize.fn("date", Sequelize.col("createddate")),
      //[sequelize.fn('date_format', sequelize.col('date_col'), '%Y-%m-%d'), 'date_col_formed']
      //[ Sequelize.fn("date_format", Sequelize.col("createddate"),"%d-%m-%Y %H:%i:%s"), 'username_upper', ],
      var get_list = await SignalCircuitData.findAll({
        //   attributes: ["id", "signalcircuitid", "greenvoltage", "greencurrent", "redvoltage", "redcurrent", "yellowvoltage",
        //   "lightyellowvoltage", "lightyellowcurrent","signal_aspect", "aspect_current", "aspect_voltage", "index_score",
        // "gui",  [ Sequelize.fn('time', Sequelize.col('createddate')), 'updatedAtHour']],
        where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, signalcircuitid: signalcircuitid },
        order: [["id", "ASC"]],
        raw: true,
      });
      global.gc()
      let results = [];
      for await (var element of get_list) {
        results.push({
          id: element.id,
          signalcircuitid: element.signalcircuitid,
          greenvoltage: element.greenvoltage,
          greencurrent: element.greencurrent,
          redvoltage: element.redvoltage,
          redcurrent: element.redcurrent,
          yellowvoltage: element.yellowvoltage,
          yellowcurrent: element.yellowcurrent,
          lightyellowvoltage: element.lightyellowvoltage,
          lightyellowcurrent: element.lightyellowcurrent,
          signal_aspect: element.signal_aspect,
          aspect_current: element.aspect_current,
          aspect_voltage: element.aspect_voltage,
          index_score: element.index_score,
          gui: element.gui,
          time: moment(element.createddate).format("HH:mm")
        })
      }

      res.status(200).json({ issuccess: true, data: results });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitData.findAll({
          where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, signalcircuitid: signalcircuitid },
          order: [["id", "ASC"]],
          raw: true,
        });
        global.gc()
        let results = [];
        for await (var element of get_list) {
          results.push({
            id: element.id,
            signalcircuitid: element.signalcircuitid,
            greenvoltage: element.greenvoltage,
            greencurrent: element.greencurrent,
            redvoltage: element.redvoltage,
            redcurrent: element.redcurrent,
            yellowvoltage: element.yellowvoltage,
            yellowcurrent: element.yellowcurrent,
            lightyellowvoltage: element.lightyellowvoltage,
            lightyellowcurrent: element.lightyellowcurrent,
            signal_aspect: element.signal_aspect,
            aspect_current: element.aspect_current,
            aspect_voltage: element.aspect_voltage,
            index_score: element.index_score,
            gui: element.gui,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitData.findAll({
          where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, signalcircuitid: signalcircuitid },
          order: [["id", "ASC"]],
          raw: true,
        });
        global.gc()
        let results = [];
        for await (var element of get_list) {
          results.push({
            id: element.id,
            signalcircuitid: element.signalcircuitid,
            greenvoltage: element.greenvoltage,
            greencurrent: element.greencurrent,
            redvoltage: element.redvoltage,
            redcurrent: element.redcurrent,
            yellowvoltage: element.yellowvoltage,
            yellowcurrent: element.yellowcurrent,
            lightyellowvoltage: element.lightyellowvoltage,
            lightyellowcurrent: element.lightyellowcurrent,
            signal_aspect: element.signal_aspect,
            aspect_current: element.aspect_current,
            aspect_voltage: element.aspect_voltage,
            index_score: element.index_score,
            gui: element.gui,
            time: moment(element.createddate).format("HH:mm")
          })
        }
        res.status(200).json({ issuccess: true, data: results });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info("get signal circuit data graph ended");
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Signalcircuit page error Api (getstationsignalcircuitdatagraph)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected signal circuit data based on start,end and paginaion
signalcircuit.get("/downloadsignalcircuitdatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get signal circuit data report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    const signalcircuitname = await RegisteredSignalCircuit.findOne({ where: { id: signalcircuitid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("SignalCircuitData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "SignalCircuitDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      // { header: "Station Name", key: "stationname", width: 10 },
      { header: "SignalCircuit Name", key: "signalname", width: 20 },
      { header: "Signal Aspect", key: "signal_aspect", width: 13 },
      { header: "Aspect Current(Iac)(A)", key: "aspect_current", width: 18 },
      { header: "Aspect Voltage(Vac)	", key: "aspect_voltage", width: 14 },
      { header: "Index Score", key: "index_score", width: 11 },
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
    where_condition.signalcircuitid = signalcircuitid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await SignalCircuitData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          signalname: signalcircuitname.signalname + ' @' + stationname.stationname,
          signal_aspect: element.signal_aspect,
          aspect_current: element.aspect_current,
          aspect_voltage: element.aspect_voltage,
          index_score: element.index_score,
          createddate: moment(element.createddate).format("YYYY-MM-DD HH:mm:ss"),
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
        var get_list = await SignalCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            signalname: signalcircuitname.signalname + ' @' + stationname.stationname,
            signal_aspect: element.signal_aspect,
            aspect_current: element.aspect_current,
            aspect_voltage: element.aspect_voltage,
            index_score: element.index_score,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            signalname: signalcircuitname.signalname + ' @' + stationname.stationname,
            signal_aspect: element.signal_aspect,
            aspect_current: element.aspect_current,
            aspect_voltage: element.aspect_voltage,
            index_score: element.index_score,
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
      "get signal circuit data report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Signalcircuit page error Api (downloadsignalcircuitdatareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected signal circuit alert based on start,end and paginaion
signalcircuit.get("/downloadsignalcircuitalertreport", validuser, async (req, res) => {
  try {
    logs.info(
      "get signal circuit alert report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    const signalcircuitname = await RegisteredSignalCircuit.findOne({ where: { id: signalcircuitid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("SignalCircuitAlert");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "SignalCircuitAlertReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      // { header: "Station Name", key: "stationname", width: 10 },
      { header: "SignalCircuit Name", key: "signalname", width: 20 },
      { header: "Message", key: "message", width: 50 },
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
    where_condition.signalcircuitid = signalcircuitid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await SignalCircuitAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          signalname: signalcircuitname.signalname + ' @' + stationname.stationname,
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
        var get_list = await SignalCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            signalname: signalcircuitname.signalname + ' @' + stationname.stationname,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            signalname: signalcircuitname.signalname + ' @' + stationname.stationname,
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
      "get signal circuit alert report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Signalcircuit page error Api (downloadsignalcircuitalertreport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected signal circuit alert logs based on start,end and paginaion  without date for mobile
signalcircuit.get("/getstationsignalcircuitalertmobile", validuser, async (req, res) => {
  try {
    logs.info(
      "get signal circuit alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    let page = 1,
      size = 10;
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }


    logs.info('req.query', req.query);
    //console.log(req.query);

    var total_data_count = await SignalCircuitAlert.count({
      where: { isdele: false, signalcircuitid: signalcircuitid },
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await SignalCircuitAlert.findAll({
        where: { isdele: false, signalcircuitid: signalcircuitid },
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
        var get_list = await SignalCircuitAlert.findAll({
          where: { isdele: false, signalcircuitid: signalcircuitid },
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
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        var get_list = await SignalCircuitAlert.findAll({
          where: { isdele: false, signalcircuitid: signalcircuitid },
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
      "get signal circuit alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Signalcircuit page error Api (getstationsignalcircuitalertmobile)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get signal aspect types
signalcircuit.get("/getsignalaspecttype", validuser, async (req, res) => {
  try {
    //console.log(`get signal aspect type name started`);
    logs.info(`get signal aspect type started`)
    var get_signalaspecttypes = await SignalAspectType.findAll({where: { isdele: false}, raw: true,});
    // console.log(`get  signal aspect type end`);
    logs.info(`get  signal aspect type end`)
    res.status(200).json({ issuccess: true, data: get_signalaspecttypes });
} catch (ex) {
    //console.log(ex);
    logs.error('Signalcircuit page error Api (getsignalaspecttype)' + ex);
    res.status(400).json({
        issuccess: false,
        msg: `Something went wrong. Please try again later.`,
    });
}
});

//get the selected signal circuit latest data 
signalcircuit.get("/getstationsignalcircuitfinaldata", validuser, async (req, res) => {
  logs.info(`get station signalcircuit final data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const signalcircuitid = req.query.signalcircuitid

    logs.info(req.query);
    //console.log(req.query);

    const signalname = await RegisteredSignalCircuit.findOne({ where: { id: signalcircuitid, isdele: false } })
   
    var get_finalsignalcircuitid_datas = await SignalCircuitData.findOne({ limit: 1, where: { isdele: false, signalcircuitid: signalcircuitid }, order: [["id", "DESC"]], raw: true });

    if (get_finalsignalcircuitid_datas != null) {
      get_finalsignalcircuitid_datas.signalname = signalname.signalname    
    }
    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_finalsignalcircuitid_datas });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_finalsignalcircuitid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 3, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_finalsignalcircuitid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get signal circuit data logs ended"
    );
  }
  catch (ex) {
    logs.error('Signalcircuit page error Api (getstationsignalcircuitfinaldata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

module.exports = signalcircuit;
