const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const bodyParser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
var lodash = require("lodash");
var LINQ = require('node-linq').LINQ;
const Enumerable = require('linq')

const { Sequelize, Op } = require("sequelize");
const mail = require("../../services/mail");

const log4js = require("../../log4js");
const logs = log4js.logger;


const relay = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();
require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const RegisteredSignalCircuit = require("../../models/registeredsignalcircuit");
const RegisteredPointMachine = require("../../models/registeredpointmachine");
const RegisteredTrackCircuit = require("../../models/registeredtrackcircuit");
const Asserts = require("../../models/asserts");
const RegisteredRelay = require("../../models/registeredrelay");
const RegisteredRelayLogs = require("../../models/registeredrelaylogs");
const RelayData = require("../../models/relaydata");
const StationAccess = require("../../models/stationaccess");
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const RegisteredLCGate = require("../../models/registeredlcgate");
const RegisteredAxleCounter = require("../../models/registeredaxlecounter");
const AlertMessage = require("../../models/alertmessage");
const excel = require("exceljs");
const reader = require('xlsx');

//register relay
relay.post("/registerrelay", validuser, async (req, res) => {
  try {
    logs.info("New relay registration started");
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
      const relayname = req.body.relayname,
        stationid = req.body.stationid,
        assertsid = (await Asserts.findOne({ where: { assertname: req.body.assertsid } })).id,
        assertid = req.body.assertid,
        wordlocation = req.body.wordlocation,
        bitlocation = req.body.bitlocation,
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var relay_check = [await RegisteredRelay.findOne({
        where: { stationid: stationid, assertsid: assertsid, assertid: assertid, wordlocation: wordlocation, bitlocation: bitlocation },
      })];
      relay_check = relay_check[0] !== null ? relay_check : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (relay_check.length !== 0) {
        if (relay_check[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_relay = await RegisteredRelay.update(
              {
                relayname,
                stationid,
                assertsid,
                assertid,
                wordlocation,
                bitlocation,
                manufacture,
                serialno,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: relay_check[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("Relay registration inserted");

            const log_insert = await RegisteredRelayLogs.create(
              {
                relayid: update_relay[1].id,
                relayname: update_relay[1].relayname,
                stationid: update_relay[1].stationid,
                assertsid: update_relay[1].assertsid,
                assertid: update_relay[1].assertid,
                wordlocation: update_relay[1].wordlocation,
                bitlocation: update_relay[1].bitlocation,
                manufacture: update_relay[1].manufacture,
                serialno: update_relay[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Relay registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Relay inserted Successfully" });
            logs.info("Relay Successfully Registered");
            //console.log("Relay Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Relay page error Api (registerrelay)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in relay page. Api (registerrelay)`, ex);
          }
        }
        else {
          //console.log("Given location details is already registered.");
          logs.info("Given location details is already registered.");
          res
            .status(400)
            .json({ issuccess: false, msg: "Given location details is aleady registered" });
        }
      }
      else {
        var relay_check = [await RegisteredRelay.findOne({
          where: { stationid: stationid, relayname: relayname, assertsid: assertsid, assertid: assertid },
        })];
        relay_check = relay_check[0] !== null ? relay_check : []
        var create_relay = true;
        if (relay_check.length > 0) {
          if (relay_check[0].relayname == relayname) {
            create_relay = false
            //console.log("Given relay name is already registered.");
            logs.info("Given relay name is is already registered.");
            res
              .status(400)
              .json({ issuccess: false, msg: "Given relay name is is aleady registered" });
          }
        }
        if (create_relay) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const register_relay = await RegisteredRelay.create({
              relayname,
              stationid,
              assertsid,
              assertid,
              wordlocation,
              bitlocation,
              manufacture,
              serialno,
              createddate: current_datetime,
              createdby_id,
              updateddate: current_datetime,
              isdele,
            },
              { transaction: transaction })
            logs.info("Relay registration inserted");

            const log_insert = await RegisteredRelayLogs.create(
              {
                relayid: register_relay.id,
                relayname,
                stationid,
                assertsid,
                assertid,
                wordlocation,
                bitlocation,
                manufacture, serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Relay registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Relay inserted Successfully" });
            logs.info("Relay Successfully Registered");
            //console.log("Relay Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Relay page error Api (registerrelay)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in relay page. Api (registerrelay)`, ex);
          }
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
    logs.error('Relay page error Api (registerrelay)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in relay page. Api (registerrelay)`, ex);
  }
});

//edit registered relay
relay.put("/editrelay", validuser, async (req, res) => {
  try {
    logs.info("Relay edit started");
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
      try {
        //console.log(req.body);
        logs.info(req.body);
        const id = req.body.id,
          currentrelayname = req.body.currentrelayname,
          newrelayname = req.body.newrelayname,
          stationid = parseInt(req.body.stationid),
          assertsid = parseInt(req.body.assertsid),
          assertid = parseInt(req.body.assertid),
          wordlocation = parseInt(req.body.wordlocation),
          bitlocation = parseInt(req.body.bitlocation),
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_relays = await RegisteredRelay.findAll(
          { where: { stationid, assertsid, assertid, isdele: false }, raw: true, }
        )

        var check_relay = lodash.find(station_relays, { id: id })
        check_relay = check_relay == undefined ? null : check_relay

        if (check_relay == null) {
          logs.info("Relay not exists in this station.");
          //console.log("Relay not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Relay not exists in this station." });
        }
        else {
          lodash.remove(station_relays, function (n) { return n.id == id; });
          var final_result = true
          var repeat_location = lodash.find(station_relays, { stationid: stationid, wordlocation: wordlocation, bitlocation: bitlocation })
          var repeat_names = lodash.find(station_relays, { stationid: stationid, assertsid: assertsid, assertid: assertid, relayname: newrelayname })
          final_result = repeat_location == undefined && repeat_names == undefined ? true : false

          if (final_result) {
            let transaction = await db.transaction({ autocommit: false });
            try {
              const update_relay = await RegisteredRelay.update(
                {
                  relayname: newrelayname,
                  wordlocation: wordlocation,
                  bitlocation: bitlocation,
                  manufacture: manufacture,
                  serialno: serialno,
                  updateddate: current_datetime
                },
                { where: { id }, returning: true, plain: true },
                { transaction: transaction }, { raw: true })

              logs.info("Relay updated");
              const log_insert = await RegisteredRelayLogs.create(
                {
                  relayid: update_relay[1].id,
                  stationid: update_relay[1].stationid,
                  relayname: update_relay[1].relayname,
                  assertsid: update_relay[1].assertsid,
                  assertid: update_relay[1].assertid,
                  assertsid: update_relay[1].assertsid,
                  wordlocation: update_relay[1].wordlocation,
                  bitlocation: update_relay[1].bitlocation,
                  serialno: update_relay[1].serialno,
                  updateddate: current_datetime,
                  updatedby_id: user_id,
                  isdele,
                },
                { transaction: transaction }
              );
              logs.info("Relay log inserted");
              await transaction.commit();
              res
                .status(200)
                .json({ issuccess: true, msg: "Successfully Updated" });
              logs.info("Relay Successfully Updated");
              //console.log("Relay  Successfully Updated")  
            }
            catch (ex) {
              await transaction.rollback();
              //console.log(ex.message);
              logs.error('Relay page error Api (edirelay)' + ex);
              res.status(400).json({ issuccess: false, msg: ex.message });
              mail.mailSendError(`Error in relay page. Api (edirelay)`, ex);
            }
          }
          else {
            logs.info("Relay details already exists in the assert");
            res.status(400).json({ issuccess: false, msg: "Relay details already exists in the assert" });
          }
        }
      }
      catch (ex) {
        //console.log(ex.message);
        logs.error('Relay page error Api (edirelay)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(`Error in relay page. Api (edirelay)`, ex);
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
    logs.error('Relay page error Api (edirelay)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in relay page. Api (edirelay)`, ex);
  }
});

//delete relay
relay.put("/deleterelay", validuser, async (req, res) => {
  try {
    logs.info("Relay delete started");
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

        const check_relay = await RegisteredRelay.findOne(
          {
            where: { id, isdele: false },
          })

        if (check_relay != null) {

          const update_relay = await RegisteredRelay.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Relay dele updated");

          const log_insert = await RegisteredRelayLogs.create(
            {
              relayid: update_relay[1].id,
              stationid: update_relay[1].stationid,
              relayname: update_relay[1].relayname,
              assertsid: update_relay[1].assertsid,
              assertid: update_relay[1].assertid,
              assertsid: update_relay[1].assertsid,
              wordlocation: update_relay[1].wordlocation,
              bitlocation: update_relay[1].bitlocation,
              manufacture: update_relay[1].manufacture,
              serialno: update_relay[1].serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_relay[1].isdele_reason,
              isdele: false,
            },
            { transaction: transaction }
          );
          logs.info("Relay dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("Relay Successfully deleted");
          //console.log("Relay Successfully deleted")
        }
        else {
          logs.info("Relay not found");
          //console.log("Relay not found"");
          res.status(401).json({ issuccess: false, msg: "Relay not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Relay page error Api (deleterelay)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in Relay page. Api (deleterelay)`,
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
    logs.error('Relay page error Api (deleterelay)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in relay page. Api (deleterelay)`, ex);
  }
});

//get all relay in a station for relay list
relay.get("/getallrelay", validuser, async (req, res) => {
  try {
    //console.log(`get relay started`);         
    logs.info(`get relay started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role == "Station Incharge") {

      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false }, raw: true, })
      if (access.length > 0) {

        RegisteredRailwayStations.hasMany(RegisteredPointMachine, { foreignKey: 'stationid' });
        RegisteredPointMachine.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredTrackCircuit, { foreignKey: 'stationid' });
        RegisteredTrackCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredSignalCircuit, { foreignKey: 'stationid' });
        RegisteredSignalCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredAxleCounter, { foreignKey: 'stationid' });
        RegisteredAxleCounter.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredRelay, { foreignKey: 'stationid' });
        RegisteredRelay.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        Asserts.hasMany(RegisteredRelay, { foreignKey: 'assertsid' });
        RegisteredRelay.belongsTo(Asserts, { foreignKey: 'assertsid' });

        RegisteredRelay.belongsTo(RegisteredPointMachine, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredTrackCircuit, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredSignalCircuit, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredLCGate, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredAxleCounter, { foreignKey: 'assertid' });

        var datas = []

        const pointdatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredPointMachine"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredPointMachine"."pointmachinename"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredPointMachine,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
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
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Point Machine' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...pointdatas)

        const trackdatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredTrackCircuit"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredTrackCircuit"."trackname"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredTrackCircuit,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
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
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Track Circuit' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...trackdatas)

        const signaldatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredSignalCircuit"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredSignalCircuit"."signalname"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredSignalCircuit,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
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
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Signal Circuit' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...signaldatas)

        const lcgatedatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredLCGate"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredLCGate"."lcgatename"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredLCGate,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'LC Gate' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...lcgatedatas)

        const axlecounterdatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredAxleCounter"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredAxleCounter"."axlecountername"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredAxleCounter,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Axle Counter' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...axlecounterdatas)

        logs.info(`get relay end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get relay end`)
        res.status(200).json({ issuccess: true, data: [] });
      }

    }
    else {
      if (user_role == "Admin") {

        RegisteredRailwayStations.hasMany(RegisteredPointMachine, { foreignKey: 'stationid' });
        RegisteredPointMachine.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredTrackCircuit, { foreignKey: 'stationid' });
        RegisteredTrackCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredSignalCircuit, { foreignKey: 'stationid' });
        RegisteredSignalCircuit.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredAxleCounter, { foreignKey: 'stationid' });
        RegisteredAxleCounter.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        RegisteredRailwayStations.hasMany(RegisteredRelay, { foreignKey: 'stationid' });
        RegisteredRelay.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        Asserts.hasMany(RegisteredRelay, { foreignKey: 'assertsid' });
        RegisteredRelay.belongsTo(Asserts, { foreignKey: 'assertsid' });

        RegisteredRelay.belongsTo(RegisteredPointMachine, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredTrackCircuit, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredSignalCircuit, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredLCGate, { foreignKey: 'assertid' });
        RegisteredRelay.belongsTo(RegisteredAxleCounter, { foreignKey: 'assertid' });

        var datas = []

        const pointdatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredPointMachine"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredPointMachine"."pointmachinename"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredPointMachine,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Point Machine' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...pointdatas)

        const trackdatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredTrackCircuit"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredTrackCircuit"."trackname"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredTrackCircuit,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Track Circuit' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...trackdatas)

        const signaldatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredSignalCircuit"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredSignalCircuit"."signalname"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredSignalCircuit,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Signal Circuit' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...signaldatas)

        const lcgatedatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredLCGate"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredLCGate"."lcgatename"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredLCGate,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'LC Gate' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...lcgatedatas)

        const axlecounterdatas = await RegisteredRelay.findAll({
          attributes: [
            'id',
            'relayname',
            'wordlocation',
            'bitlocation',
            'manufacture',
            'serialno',
            [Sequelize.literal('"Assert"."id"'), 'assertsid'],
            [Sequelize.literal('"Assert"."assertname"'), 'assertsname'],
            [Sequelize.literal('"RegisteredAxleCounter"."id"'), 'assertid'],
            [Sequelize.literal('"RegisteredAxleCounter"."axlecountername"'), 'assertname'],
            [Sequelize.literal('"RegisteredRailwayStation"."id"'), 'stationid'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
            [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
          ],
          include: [
            {
              model: RegisteredAxleCounter,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: RegisteredRailwayStations,
              attributes: [
              ],
              where: {
                isdele: false,
              },
            },
            {
              model: Asserts,
              attributes: [
              ],
              where: {
                isdele: false,
                id: (await Asserts.findOne({ where: { assertname: 'Axle Counter' } })).id,
              },
            }
          ],
          where: {
            isdele: false,
          },
          raw: true,
          order: [
            ['id'],
          ],
        })
        datas.push(...axlecounterdatas)

        logs.info(`get relay end`)
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
    logs.error('Relay page error Api (getallrelay)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

// get relay in a station
relay.get("/getrelayassertslistByStation", validuser, async (req, res) => {
  try {
    //console.log(`get asserts list started`);         
    logs.info(`getassertslistByStation started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email,
      stationid = parseInt(req.query.stationid);
    if (user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge") {

      var assertslist = await Asserts.findAll({ attributes: ["assertname"], order: [["id", "ASC"]], raw: true });
      assertslist = assertslist.map((obj) => obj.assertname);
      var assertsinalerts = lodash.uniqBy(await AlertMessage.findAll({ attributes: ["assert"], where: { stationid: stationid }, raw: true }), 'assert');
      assertsinalerts = assertsinalerts.filter(name => !["Relay", "IPS", "Battery"].includes(name.assert));

      // Sorting namesToSort based on assertslist
      assertsinalerts.sort((a, b) => {

        const indexA = assertslist.indexOf(a.assert);
        const indexB = assertslist.indexOf(b.assert);

        return indexA - indexB;
      });

      if (assertsinalerts.length > 0) {
        res.status(200).json({ issuccess: true, data: assertsinalerts });
        logs.info(`getassertslistByStation ended`)

      } else {
        res.status(201).json({ issuccess: true, data: [], msg: "No asserts list for selected station" });
      }
    }
    else {
      logs.info("Admin Only access this page.");
      //console.log("Admin Only access this page.")
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('Railwaystation page error Api (getassertslistByStation)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
})

//get latest relay details in a station for relay details
relay.get("/getstationrelay", validuser, async (req, res) => {
  logs.info(`get station latest relay started`);
  try {
    logs.info(req.query)

    RegisteredRelay.hasMany(RelayData, { foreignKey: 'relayid' });
    RelayData.belongsTo(RegisteredRelay, { foreignKey: 'relayid' });

    var datas =
      await RelayData.findAll({
        attributes: [
          [Sequelize.col('RegisteredRelay.id'), 'id'],
          [Sequelize.col('RegisteredRelay.relayname'), 'relayname'],
          [Sequelize.col('RegisteredRelay.assertsid'), 'assertsid'],
          [Sequelize.col('RegisteredRelay.assertid'), 'assertid'],
          ['id', 'relaydataid'],
          'value',
          'createddate',
          'isdele',
        ],
        include: [
          {
            model: RegisteredRelay,
            attributes: [],
            where: {
              isdele: false,
              stationid: parseInt(req.query.stationid),
            },
          },
        ],
        where: {
          isdele: false,
          id: {
            [Op.in]: (await RelayData.findAll({
              attributes: [
                [Sequelize.fn('max', Sequelize.col('RelayData.id')), 'id'],
              ],
              group: ['RegisteredRelay.id'],
              include: [
                {
                  model: RegisteredRelay,
                  attributes: [],
                  where: {
                    isdele: false,
                    stationid: parseInt(req.query.stationid)
                  },
                },
              ],
              where: {
                isdele: false,
              },
              raw: true,
            })).map(data => data.id)
          },
        },
        order: [
          [Sequelize.col('RegisteredRelay.assertsid'), 'ASC'],
          ['value', 'DESC'],
          [Sequelize.col('RegisteredRelay.relayname'), 'ASC'],
        ],
        group: [
          'RelayData.id',
          'RegisteredRelay.id',
          'RegisteredRelay.relayname',
        ],
        raw: true,
      });

    const removeDuplicates = (array) => {
      const idCount = new Map();
      const indexes = [];

      array.forEach((item, index) => {
        const { id } = item;
        if (idCount.has(id)) {
          indexes.push(index);
        } else {
          idCount.set(id, true);
        }
      });

      indexes.reverse().forEach(index => {
        array.splice(index, 1);
      });

      return array;
    };

    var get_relays = removeDuplicates(datas);

    res.status(200).json({ issuccess: true, data: get_relays });
    logs.info(`get station relay end`);
  } catch (ex) {
    logs.error('Relay page error Api (getstationrelay)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get individual assert relay details
relay.get("/getstationassertrelay", validuser, async (req, res) => {
  logs.info(`get station assert relay started`);
  try {
    logs.info(req.query)

    var datas = [];
    var registered_relays = await RegisteredRelay.findAll({
      where: {
        assertsid: parseInt(req.query.assertsid),
        assertid: parseInt(req.query.assertid),
        stationid: parseInt(req.query.stationid),
        isdele: false
      },
      raw: true
    })

    for await (const element of registered_relays) {
      var relay_data = await RelayData.findOne({
        where: {
          relayid: element.id,
          isdele: false,
        },
        order: [["id", "DESC"]],
        limit: 1,
        raw: true
      })

      if (relay_data != null) {
        datas.push({
          id: element.id,
          relayname: element.relayname,
          assertsid: element.assertsid,
          assertid: element.assertid,
          relaydataid: relay_data.id,
          value: relay_data.value,
          createddate: relay_data.createddate,
          isdele: relay_data.isdele,
        })
      }
    }

    res.status(200).json({ issuccess: true, data: datas.sort((a,b) => b.value - a.value).sort((a,b) => b.relayname - a.relayname) });
    logs.info(`get station relay end`);  

  } catch (ex) {
    logs.error('Relay page error Api (getstationrelay)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected relay data based on start , end and paginaion
relay.get("/getstationrelaydata", validuser, async (req, res) => {
  logs.info(`get station relay data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const relayid = req.query.relayid

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
    where_condition.relayid = relayid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await RelayData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await RelayData.findAll({
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
        var get_list = await RelayData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 6, isdele: false } })

      if (access_check != null) {
        var get_list = await RelayData.findAll({
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
      "get relay data logs ended"
    );
  }
  catch (ex) {
    logs.error('Relay page error Api (getstationrelaydata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected relay current data based on paginaion
relay.get("/getstationrelaycurrentdata", validuser, async (req, res) => {``
  logs.info(`get station relay current  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const relayid = req.query.relayid

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
    where_condition.relayid = relayid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await RelayData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await RelayData.findAll({
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
        var get_list = await RelayData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 6, isdele: false } })

      if (access_check != null) {
        var get_list = await RelayData.findAll({
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
      "get relay data logs ended"
    );
  }
  catch (ex) {
    logs.error('Relay page error Api (getstationrelaycurrentdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//download the selected relay data based on start,end and paginaion
relay.get("/downloadrelaydatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get relay data report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const relayid = req.query.relayid

    const relayname = await RegisteredRelay.findOne({ where: { id: relayid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("RelayData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "RelayDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      // { header: "Station Name", key: "stationname", width: 10 },
      { header: "Relay Name", key: "relayname", width: 20 },
      { header: "Value", key: "value", width: 10 },
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
    where_condition.relayid = relayid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await RelayData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          relayname: relayname.relayname + ' @' + stationname.stationname,
          value: element.value == 1 ? "ON" : "OFF",         
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
        var get_list = await RelayData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            relayname: relayname.relayname + ' @' + stationname.stationname,
            value: element.value == 1 ? "ON" : "OFF",            
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
        { where: { stationid: stationid, userid: user_id, assertsid: 6, isdele: false } })

      if (access_check != null) {
        var get_list = await RelayData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            relayname: relayname.relayname + ' @' + stationname.stationname,
            value: element.value == 1 ? "ON" : "OFF",                
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
      "get relay circuit data report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Relay page error Api (downloadrelaydatareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});


module.exports = relay;