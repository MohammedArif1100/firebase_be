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


const battery = express.Router();

const app = new express();
app.use(express.json());

require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const Asserts = require("../../models/asserts");
const RegisteredBattery = require("../../models/registeredbattery");
const RegisteredBatteryLogs = require("../../models/registeredbatterlogs");
const StationAccess = require("../../models/stationaccess");
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const BatteryData = require("../../models/batterydata");
const BatteryAlert = require("../../models/batteryalert");
const AlertMode = require("../../models/alertmode");
const excel = require("exceljs");
const reader = require('xlsx');

//register battery
battery.post("/registerbattery", validuser, async (req, res) => {
  try {
    logs.info("New Battery registration started");
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
      const type = req.body.type,
        batteryname = req.body.batteryname,
        stationid = req.body.stationid,
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var battery_check = [await RegisteredBattery.findOne({
        where: { stationid: stationid, type: type, batteryname: batteryname },
      })];
      battery_check = battery_check[0] !== null ? battery_check : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (battery_check.length !== 0) {
        if (battery_check[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_battery = await RegisteredBattery.update(
              {
                type,
                batteryname,
                stationid,
                manufacture,
                serialno,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: battery_check[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("Battery registration inserted");

            const log_insert = await RegisteredBatteryLogs.create(
              {
                batteryid: update_battery[1].id,
                type: update_battery[1].type,
                batteryname: update_battery[1].batteryname,
                stationid: update_battery[1].stationid,
                manufacture: update_battery[1].manufacture,
                serialno: update_battery[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Battery registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Battery inserted Successfully" });
            logs.info("Battery Successfully Registered");
            //console.log("Battery Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Battery page error Api (registerbattery)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in battery page. Api (registerbattery)`, ex);
          }
        }
        else {
          //console.log("Given details is already registered.");
          logs.info("Given details is already registered.");
          res
            .status(400)
            .json({ issuccess: false, msg: "Given details is aleady registered" });
        }
      }
      else {
        let transaction = await db.transaction({ autocommit: false });
        try {
          const register_battery = await RegisteredBattery.create({
            type,
            batteryname,
            stationid,
            manufacture,
            serialno,
            createddate: current_datetime,
            createdby_id,
            updateddate: current_datetime,
            isdele,
          },
            { transaction: transaction })
          logs.info("Battery registration inserted");

          const log_insert = await RegisteredBatteryLogs.create(
            {
              batteryid: register_battery.id,
              type,
              batteryname,
              stationid,
              manufacture,
              serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele,
            },
            { transaction: transaction }
          );
          logs.info("Battery registration log inserted");

          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Battery inserted Successfully" });
          logs.info("Battery Successfully Registered");
          //console.log("Battery Successfully Registered")
        }
        catch (ex) {
          await transaction.rollback();
          //console.log(ex.message);
          logs.error('Battery page error Api (registerbattery)' + ex);
          res.status(400).json({ issuccess: false, msg: ex.message });
          mail.mailSendError(`Error in Battery page. Api (registerbattery)`, ex);
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
    logs.error('Battery page error Api (registerbattery)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in Battery page. Api (registerbattery)`, ex);
  }
});

//edit registered battery
battery.put("/editbattery", validuser, async (req, res) => {
  try {
    logs.info("Battery edit started");
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
          type = req.body.type,
          currentbatteryname = req.body.currentbatteryname,
          newbatteryname = req.body.newbatteryname,
          stationid = parseInt(req.body.stationid),
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_batteries = await RegisteredBattery.findAll(
          { where: { stationid, isdele: false }, raw: true, }
        )

        var battery_check = lodash.find(station_batteries, { id: id })
        battery_check = battery_check == undefined ? null : battery_check

        if (battery_check == null) {
          logs.info("Battery not exists in this station.");
          //console.log("Battery not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Battery not exists in this station." });
        }
        else {

          let repeat_names = false;

          currentbatteryname == newbatteryname ? repeat_names = false : station_batteries.find(value => value.batteryname == newbatteryname && value.type == type) ? repeat_names = true : false

          let transaction = await db.transaction({ autocommit: false });
          try {
            if (repeat_names == false) {
              const update_battery = await RegisteredBattery.update(
                {
                  batteryname: newbatteryname,
                  manufacture: manufacture,
                  serialno: serialno,
                  updateddate: current_datetime
                },
                { where: { id }, returning: true, plain: true },
                { transaction: transaction }, { raw: true })

              logs.info("Battery updated");
              const log_insert = await RegisteredBatteryLogs.create(
                {
                  batteryid: update_battery[1].id,
                  type: update_battery[1].type,
                  batteryname: update_battery[1].batteryname,
                  stationid: update_battery[1].stationid,
                  manufacture: update_battery[1].manufacture,
                  serialno: update_battery[1].serialno,
                  updateddate: current_datetime,
                  updatedby_id: user_id,
                  isdele,
                },
                { transaction: transaction }
              );
              logs.info("Battery log inserted");
              await transaction.commit();
              res
                .status(200)
                .json({ issuccess: true, msg: "Successfully Updated" });
              logs.info("Battery Successfully Updated");
              //console.log("Battery  Successfully Updated")  
            }
            else {
              logs.info("Battery already exist in this station");
              res.status(400).json({ issuccess: false, msg: "Battery already exists in the station" });
            }
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Battery page error Api (editbattery)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in Battery page. Api (editbattery)`, ex);
          }
        }
      }
      catch (ex) {
        //console.log(ex.message);
        logs.error('Battery page error Api (editbattery)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(`Error in battery page. Api (editbattery)`, ex);
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
    logs.error('Battery page error Api (editbattery)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in battery page. Api (editbattery)`, ex);
  }
});

//delete battery
battery.put("/deletebattery", validuser, async (req, res) => {
  try {
    logs.info("Battery delete started");
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

        const battery_check = await RegisteredBattery.findOne(
          {
            where: { id, isdele: false },
          })

        if (battery_check != null) {

          const update_battery = await RegisteredBattery.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Battery dele updated");

          const log_insert = await RegisteredBatteryLogs.create(
            {
              batteryid: update_battery[1].id,
              stationid: update_battery[1].stationid,
              type: update_battery[1].type,
              batteryname: update_battery[1].batteryname,
              manufacture: update_battery[1].manufacture,
              serialno: update_battery[1].serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_battery[1].isdele_reason,
              isdele: false,
            },
            { transaction: transaction }
          );
          logs.info("Battery dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("Battery Successfully deleted");
          //console.log("Battery Successfully deleted")
        }
        else {
          logs.info("Battery not found");
          //console.log("Battery not found"");
          res.status(401).json({ issuccess: false, msg: "Battery not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Battery page error Api (deletebattery)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in Battery page. Api (deletebattery)`,
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
    logs.error('Battery page error Api (deletebattery)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in battery page. Api (deletebattery)`, ex);
  }
});

//get all battery in a station for battery list
battery.get("/getallbattery", validuser, async (req, res) => {
  try {
    //console.log(`get battery started`);         
    logs.info(`get battery started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role == "Station Incharge") {

      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false }, raw: true, })
      if (access.length > 0) {

        RegisteredRailwayStations.hasMany(RegisteredBattery, { foreignKey: 'stationid' });
        RegisteredBattery.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id', 'stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredBatteries"."id"'), 'id'],
            [Sequelize.literal('"RegisteredBatteries"."type"'), 'type'],
            [Sequelize.literal('"RegisteredBatteries"."batteryname"'), 'batteryname'],
            [Sequelize.literal('"RegisteredBatteries"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredBatteries"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredBattery,
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
            [Sequelize.literal('"RegisteredBatteries"."id"')],
          ],
        })

        logs.info(`get battery end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get battery end`)
        res.status(200).json({ issuccess: true, data: [] });
      }

    }
    else {
      if (user_role == "Admin") {

        RegisteredRailwayStations.hasMany(RegisteredBattery, { foreignKey: 'stationid' });
        RegisteredBattery.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id', 'stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredBatteries"."id"'), 'id'],
            [Sequelize.literal('"RegisteredBatteries"."type"'), 'type'],
            [Sequelize.literal('"RegisteredBatteries"."batteryname"'), 'batteryname'],
            [Sequelize.literal('"RegisteredBatteries"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredBatteries"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredBattery,
              attributes: [],
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
            [Sequelize.literal('"RegisteredBatteries"."id"')],
          ],
        })

        logs.info(`get battery end`)
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
    logs.error('Battery page error Api (getallbattery)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

// get battery data
battery.get("/getstationbattery", validuser, async (req, res) => {
  logs.info("getstationbattery started")
  try {
    logs.info(req.query)

    var get_battery = await RegisteredBattery.findOne({
      where: {
        stationid: parseInt(req.query.stationid),
        type: req.query.type,
        isdele: false,
      },
      raw: true
    })
    var get_list = []
    if (get_battery != null) {
      get_list = await BatteryData.findOne({
        where: { batteryid: get_battery.id, isdele: false },
        order: [["id", "DESC"]],
        limit: 1,
        raw: true,
      })
      if (get_list != null) {
        get_list.batteryname = get_battery.batteryname
      }
      get_list = get_list != null ? [get_list] : []
    }
    res.status(200).json({ issuccess: true, data: get_list });
    logs.info("get battery data ended");
  } catch (ex) {
    logs.error("Battery data error Api (getstationbattery)" + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

//get the selected battery current data based on paginaion
battery.get("/getstationbatterycurrentdata", validuser, async (req, res) => {
  logs.info(`get station battery current  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const batteryid = req.query.batteryid

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
    where_condition.batteryid = batteryid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await BatteryData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await BatteryData.findAll({
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
        var get_list = await BatteryData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 8, isdele: false } })

      if (access_check != null) {
        var get_list = await BatteryData.findAll({
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
      "get battery data logs ended"
    );
  }
  catch (ex) {
    logs.error('Battery page error Api (getstationbatterycurrentdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected current alert data based opaginaion
battery.get("/getstationbatterycurrentalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get battery current alert started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const batteryid = req.query.batteryid

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
    where_condition.batteryid = batteryid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await BatteryAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await BatteryAlert.findAll({
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
        var get_list = await BatteryAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 8, isdele: false } })

      if (access_check != null) {
        var get_list = await BatteryAlert.findAll({
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
      "get battery current alert ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Battery page error Api (getstationbatterycurrentalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected data based on start , end and paginaion
battery.get("/getstationbatterydata", validuser, async (req, res) => {
  logs.info(`get station battery  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const batteryid = req.query.batteryid

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
    where_condition.batteryid = batteryid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await BatteryData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await BatteryData.findAll({
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
        var get_list = await BatteryData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 8, isdele: false } })

      if (access_check != null) {
        var get_list = await BatteryData.findAll({
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
      "get battery data logs ended"
    );
  }
  catch (ex) {
    logs.error('Battery page error Api (getstationbatterydata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected battery alert logs based on start,end and paginaion
battery.get("/getstationbatteryalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get battery alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const batteryid = req.query.batteryid

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
    where_condition.batteryid = batteryid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await BatteryAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await BatteryAlert.findAll({
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
        var get_list = await BatteryAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 8, isdele: false } })

      if (access_check != null) {
        var get_list = await BatteryAlert.findAll({
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
      "get battery alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Battery page error Api (getstationbatteryalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected battery data based on start,end and paginaion
battery.get("/downloadbatterydatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get battery data report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const batteryid = req.query.batteryid

    const batteryname = await RegisteredBattery.findOne({ where: { id: batteryid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("BatteryData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "BatteryDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 5 },
      // { header: "Station Name", key: "stationname", width: 10 },
      { header: "Battery Name", key: "batteryname", width: 20 },
      { header: "Type", key: "type", width: 8 },
      { header: "Charging Current", key: "charging_current", width: 16 },
      { header: "Discharging Current", key: "discharging_current", width: 18 },
      { header: "Bank Voltage", key: "bank_voltage", width: 15 },
      { header: "Battery Cells", key: "battery_cells", width: 150 },
      { header: "Spare Charging Current", key: "spare_charging_current", width: 16 },
      { header: "Spare Discharging Current", key: "spare_discharging_current", width: 18 },
      { header: "Spare Bank Voltage", key: "spare_bank_voltage", width: 15 },
      { header: "Spare Cells", key: "spare_cells", width: 25 },
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
    where_condition.batteryid = batteryid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await BatteryData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          batteryname: batteryname.batteryname + ' @' + stationname.stationname,
          type: batteryname.type,
          battery_cells: Object.keys(element.battery_cells).join(','),
          spare_cells: Object.keys(element.spare_cells).join(','),
          bank_voltage: element.bank_voltage,
          charging_current: element.charging_current,
          discharging_current: element.discharging_current,
          spare_bank_voltage: element.spare_bank_voltage,
          spare_charging_current: element.spare_charging_current,
          spare_discharging_current: element.spare_discharging_current,
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
        var get_list = await BatteryData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            batteryname: batteryname.batteryname + ' @' + stationname.stationname,
            type: batteryname.type,
            battery_cells: Object.keys(element.battery_cells).join(','),
            spare_cells: Object.keys(element.spare_cells).join(','),
            bank_voltage: element.bank_voltage,
            charging_current: element.charging_current,
            discharging_current: element.discharging_current,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 8, isdele: false } })

      if (access_check != null) {
        var get_list = await BatteryData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            batteryname: batteryname.batteryname + ' @' + stationname.stationname,
            type: batteryname.type,
            battery_cells: Object.keys(element.battery_cells).join(','),
            spare_cells: Object.keys(element.spare_cells).join(','),
            bank_voltage: element.bank_voltage,
            charging_current: element.charging_current,
            discharging_current: element.discharging_current,
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
      "get battery data report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Battery page error Api (downloadbatterydatareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected battery alert based on start,end and paginaion
battery.get("/downloadbatteryalertreport", validuser, async (req, res) => {
  try {
    logs.info(
      "get battery alert report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const batteryid = req.query.batteryid

    const batteryname = await RegisteredBattery.findOne({ where: { id: batteryid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("BatteryAlert");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "BatteryAlertReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      // { header: "Station Name", key: "stationname", width: 10 },
      { header: "Battery Name", key: "batteryname", width: 20 },
      { header: "Type", key: "type", width: 17 },
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
    where_condition.batteryid = batteryid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await BatteryAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          batteryname: batteryname.batteryname + ' @' + stationname.stationname,
          type: batteryname.type,
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
        var get_list = await BatteryAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            batteryname: batteryname.batteryname + ' @' + stationname.stationname,
            type: batteryname.type,
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
        var get_list = await BatteryAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            batteryname: batteryname.batteryname + ' @' + stationname.stationname,
            type: batteryname.type,
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
      "get battery alert report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Battery page error Api (downloadbatteryalertreport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

module.exports = battery;