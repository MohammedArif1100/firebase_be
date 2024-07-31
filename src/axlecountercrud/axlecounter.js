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


const axlecounter = express.Router();

const app = new express();
app.use(express.json());

require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const Asserts = require("../../models/asserts");
const RegisteredAxleCounter = require("../../models/registeredaxlecounter");
const RegisteredAxleCounterLogs = require("../../models/registeredaxlecounterlogs");
const StationAccess = require("../../models/stationaccess");
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const AxleCounterData = require("../../models/axlecounterdata");
const AxleCounterAlert = require("../../models/axlecounteralert");
const AlertMode = require("../../models/alertmode");
const excel = require("exceljs");
const reader = require('xlsx');

//register axle counter
axlecounter.post("/registeraxlecounter", validuser, async (req, res) => {
  try {
    logs.info("New axle counter registration started");
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
      const axlecountername = req.body.axlecountername,
        stationid = req.body.stationid,       
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var axlecounter_check = [await RegisteredAxleCounter.findOne({
        where: { stationid: stationid, axlecountername: axlecountername },
      })];
      axlecounter_check = axlecounter_check[0] !== null ? axlecounter_check : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (axlecounter_check.length !== 0) {
        if (axlecounter_check[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_axlecounter = await RegisteredAxleCounter.update(
              {
                axlecountername,
                stationid,               
                manufacture,
                serialno,
                createddate: current_datetime,
                createdby_id,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: axlecounter_check[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("Axle counter registration inserted");

            const log_insert = await RegisteredAxleCounterLogs.create(
              {
                axlecounterid: update_axlecounter[1].id,
                axlecountername: update_axlecounter[1].axlecountername,
                stationid: update_axlecounter[1].stationid,              
                manufacture: update_axlecounter[1].manufacture,
                serialno: update_axlecounter[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Axle counter registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Axle counter inserted Successfully" });
            logs.info("Axle counter Successfully Registered");
            //console.log("Axle counter Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Axle counter page error Api (registeraxlecounter)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in axlecounter page. Api (registeraxlecounter)`, ex);
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
              const register_axlecounter = await RegisteredAxleCounter.create({
                  axlecountername,
                  stationid,                 
                  manufacture,
                  serialno,
                  createddate: current_datetime,
                  createdby_id : user_id,
                  updateddate: current_datetime,
                  isdele: false,
              },
                  { transaction: transaction })
              logs.info("Axle counter registration inserted");

              const log_insert = await RegisteredAxleCounterLogs.create(
                  {
                      axlecounterid: register_axlecounter.id,
                      axlecountername,
                      stationid,                     
                      manufacture, 
                      serialno,
                      updateddate: current_datetime,
                      updatedby_id: user_id,
                      isdele,
                  },
                  { transaction: transaction }
              );
              logs.info("Axle counter registration log inserted");

              await transaction.commit();
              res
                  .status(200)
                  .json({ issuccess: true, msg: "Axle counter inserted Successfully" });
              logs.info("Axle counter Successfully Registered");
              //console.log("axle counter Successfully Registered")
          }
          catch (ex) {
              await transaction.rollback();
              //console.log(ex.message);
              logs.error('Axle counter page error Api (registeraxlecounter)' + ex);
              res.status(400).json({ issuccess: false, msg: ex.message });
              mail.mailSendError(`Error in axle counter page. Api (registeraxlecounter)`, ex);
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
    logs.error('Axle counter page error Api (registeraxlecounter)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in axle counter page. Api (registeraxlecounter)`, ex);
  }
});

//edit registered axlecounter
axlecounter.put("/editaxlecounter", validuser, async (req, res) => {
  try {
    logs.info("axle counter edit started");
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
          currentaxlecountername = req.body.currentaxlecountername,
          newaxlecountername = req.body.newaxlecountername,
          stationid = parseInt(req.body.stationid),          
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_axlecounters = await RegisteredAxleCounter.findAll(
          { where: { stationid, isdele: false}, raw: true, }
        )

        var check_axlecounter = lodash.find(station_axlecounters, {id: id })
        check_axlecounter = check_axlecounter == undefined ? null : check_axlecounter

        if (check_axlecounter == null) {
          logs.info("Axle counter not exists in this station.");
          //console.log("Axle counter not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Axle counter not exists in this station." });
        }
        else {
            let repeat_names = false;

            currentaxlecountername == newaxlecountername ? repeat_names = false : station_axlecounters.find(value => value.axlecountername == newaxlecountername) ? repeat_names = true : false
  
            let transaction = await db.transaction({ autocommit: false });
            try {
                if (repeat_names == false) {
                    const update_axlecounter = await RegisteredAxleCounter.update(
                        {
                            axlecountername: newaxlecountername,
                            manufacture: manufacture,
                            serialno: serialno,
                            updateddate: current_datetime
                        },
                        { where: { id }, returning: true, plain: true },
                        { transaction: transaction }, { raw: true })

                    logs.info("Axle counter updated");
                    const log_insert = await RegisteredAxleCounterLogs.create(
                        {
                            axlecounterid: update_axlecounter[1].id,
                            axlecountername: update_axlecounter[1].axlecountername,
                            stationid: update_axlecounter[1].stationid,
                            manufacture: update_axlecounter[1].manufacture,
                            serialno: update_axlecounter[1].serialno,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele,
                        },
                        { transaction: transaction }
                    );
                    logs.info("Axle counter log inserted");
                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Successfully Updated" });
                    logs.info("Axle counter Successfully Updated");
                    //console.log("Axle counter  Successfully Updated")  
                }
                else {
                    logs.info("Axle counter already exist in this station");
                    res.status(400).json({ issuccess: false, msg: "Axle counter already exists in the station" });
                }
            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('Axle counter page error Api (editaxlecounter)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(`Error in axle counter page. Api (editaxlecounter)`, ex);
            }                
        }
      }
      catch (ex) {
        //console.log(ex.message);
        logs.error('Axle counter page error Api (editaxlecounter)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(`Error in axle counter page. Api (editaxlecounter)`, ex);
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
    logs.error('Axle counter page error Api (editaxlecounter)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in axle counter page. Api (editaxlecounter)`, ex);
  }
});

//delete axlecounter
axlecounter.put("/deleteaxlecounter", validuser, async (req, res) => {
  try {
    logs.info("Axle counter delete started");
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

        const check_axlecounter = await RegisteredAxleCounter.findOne(
          {
            where: { id, isdele: false },
          })

        if (check_axlecounter != null) {

          const update_axlecounter = await RegisteredAxleCounter.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Axle Counter dele updated");

          const log_insert = await RegisteredAxleCounterLogs.create(
            {
              axlecounterid: update_axlecounter[1].id,
              axlecountername: update_axlecounter[1].axlecountername,
              stationid: update_axlecounter[1].stationid,
              manufacture: update_axlecounter[1].manufacture,
              serialno: update_axlecounter[1].serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_axlecounter[1].isdele_reason,
              isdele: false,
            },
            { transaction: transaction }
          );
          logs.info("Axle Counter dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("Axle Counter Successfully deleted");
          //console.log("Axle Counter Successfully deleted")
        }
        else {
          logs.info("Axle Counter not found");
          //console.log("Axle Counter not found"");
          res.status(401).json({ issuccess: false, msg: "Axle Counter not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Axle Counter page error Api (deleteaxlecounter)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in Axle Counter page. Api (deleteaxlecounter)`,
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
    logs.error('Axle counter page error Api (deleteaxlecounter)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in axle counter page. Api (deleteaxlecounter)`, ex);
  }
});

//get all axl counter in a station for axle counter list
axlecounter.get("/getallaxlecounter", validuser, async (req, res) => {
  try {
    //console.log(`get axle counter started`);         
    logs.info(`get axle counter started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role == "Station Incharge") {

      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false }, raw: true, })
      if (access.length > 0) {
        
        RegisteredRailwayStations.hasMany(RegisteredAxleCounter, { foreignKey: 'stationid' });
        RegisteredAxleCounter.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id','stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredAxleCounters"."id"'), 'id'],
            [Sequelize.literal('"RegisteredAxleCounters"."axlecountername"'), 'axlecountername'],
            [Sequelize.literal('"RegisteredAxleCounters"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredAxleCounters"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredAxleCounter,
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
            [Sequelize.literal('"RegisteredAxleCounters"."id"')],
          ],
        })
                
        logs.info(`get axle counter end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get axle counter end`)
        res.status(200).json({ issuccess: true, data: [] });
      }

    }
    else {
      if (user_role == "Admin") {

        RegisteredRailwayStations.hasMany(RegisteredAxleCounter, { foreignKey: 'stationid' });
        RegisteredAxleCounter.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id','stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredAxleCounters"."id"'), 'id'],
            [Sequelize.literal('"RegisteredAxleCounters"."axlecountername"'), 'axlecountername'],
            [Sequelize.literal('"RegisteredAxleCounters"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredAxleCounters"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredAxleCounter,
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
            [Sequelize.literal('"RegisteredAxleCounters"."id"')],
          ],
        })
                
        logs.info(`get axle counter end`)
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
    logs.error('Axle counter te page error Api (gellaxlecounter)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

//get latest axle counter details in a station for axlecounter details
axlecounter.get("/getstationaxlecounter", validuser, async (req, res) => {
  logs.info(`get station latest axlecounter started`);
  try {
    logs.info(req.query)
    
    // RegisteredAxleCounter.hasMany(AxleCounterData, { foreignKey: 'axlecounterid' });
    // AxleCounterData.belongsTo(RegisteredAxleCounter, { foreignKey: 'axlecounterid' });

    // AxleCounterData.hasMany(AxleCounterAlert, { foreignKey: 'axlecounterdataid' });
    // AxleCounterAlert.belongsTo(AxleCounterData, { foreignKey: 'axlecounterdataid' });

    // var datas = 
    // await AxleCounterData.findAll({
    //   attributes: [
    //     [Sequelize.col('RegisteredAxleCounter.id'), 'id'],
    //     [Sequelize.col('RegisteredAxleCounter.axlecountername'), 'axlecountername'],
    //     [Sequelize.col('AxleCounterAlerts.modeid'), 'modeid'],
    //     ['id', 'axlecounterdataid'],
    //     'dc_converter_voltage_1',
    //     'dc_converter_voltage_2',
    //     'preparatory_relay_voltage_1',
    //     'preparatory_relay_voltage_2',
    //     'vital_relay_voltage_1',
    //     'vital_relay_voltage_2',
    //     'reset_relay_voltage',
    //     'createddate',      
    //     'isdele',
    //   ],
    //   include: [
    //     {
    //       model: RegisteredAxleCounter,
    //       attributes: [],
    //       where: {
    //         isdele: false,
    //         stationid: parseInt(req.query.stationid),
    //       },
    //     },
    //     {
    //       model: AxleCounterAlert,
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
    //       [Op.in]: (await AxleCounterData.findAll({
    //         attributes: [
    //           [Sequelize.fn('max', Sequelize.col('AxleCounterData.id')), 'id'],
    //         ],
    //         group: ['RegisteredAxleCounter.id'],
    //         include: [
    //           {
    //             model: RegisteredAxleCounter,
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
    //     [Sequelize.literal('CASE WHEN "AxleCounterAlerts"."modeid" IS NULL THEN 0 ELSE 1 END'), 'DESC'],
    //     [Sequelize.col('AxleCounterAlerts.modeid'), 'DESC'],
    //     [Sequelize.col('RegisteredAxleCounter.axlecountername'), 'ASC'],
    //   ],
    //   group: [
    //     'AxleCounterData.id',
    //     'RegisteredAxleCounter.id',
    //     'RegisteredAxleCounter.axlecountername',
    //     'AxleCounterAlerts.modeid'
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

    // var get_axlecounters = removeDuplicates(datas);

    var datas = []
    var resgitered_axlecounters = await RegisteredAxleCounter.findAll({
      where: {       
        stationid: parseInt(req.query.stationid),
        isdele: false
      },
      order: [["axlecountername", "ASC"]],
      raw: true
    })

    for await(const element of resgitered_axlecounters)
    {
      var axle_data = await AxleCounterData.findOne({
        where: {       
          axlecounterid: element.id,
          isdele: false,
        },        
        order: [["id","DESC"]]
      })

      if(axle_data != null)
      {
        var axlecounter_alert_data = await AxleCounterAlert.findOne({
          where: {       
            axlecounterid: element.id,
            axlecounterdataid: axle_data.id,
            isdele: false,
          },
          order: [["modeid","DESC"]]
        })
        datas.push({
          id: element.id,
          axlecountername: element.axlecountername,
          modeid: axlecounter_alert_data == null ? null : axlecounter_alert_data.modeid,
          axlecounterdataid: axle_data.id,
          dc_converter_voltage_1: axle_data.dc_converter_voltage_1,
          dc_converter_voltage_2: axle_data.dc_converter_voltage_2,
          preparatory_relay_voltage_1: axle_data.preparatory_relay_voltage_1,
          preparatory_relay_voltage_2: axle_data.preparatory_relay_voltage_2,
          vital_relay_voltage_1: axle_data.vital_relay_voltage_1,
          vital_relay_voltage_2: axle_data.vital_relay_voltage_2,
          reset_relay_voltage: axle_data.reset_relay_voltage,         
          createddate: axle_data.createddate,
          isdele: axle_data.isdele,
        })       
      }
    }
    
    res.status(200).json({ issuccess: true, data: datas.sort((a,b) => b.modeid - a.modeid) });
    logs.info(`get station axle counter end`);
  } catch (ex) {
    logs.error('Axlecounter page error Api (getstationaxlecounter)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected axle counter data based on start , end and paginaion
axlecounter.get("/getstationaxlecounterdata", validuser, async (req, res) => {
  logs.info(`get station axlecounter  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid
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
    where_condition.axlecounterid = axlecounterid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await AxleCounterData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await AxleCounterData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get axle counter data logs ended"
    );
  }
  catch (ex) {
    logs.error('Axle counter page error Api (getstationaxlecounterdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected axle punter current data based on paginaion
axlecounter.get("/getstationaxlecountercurrentdata", validuser, async (req, res) => {
  logs.info(`get station axlecounter current  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid
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

    where_condition.isdele = false;
    where_condition.axlecounterid = parseInt(axlecounterid);
    logs.info("where condition is : " + where_condition);

    var total_data_count = await AxleCounterData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await AxleCounterData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
      });
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get axle counter current data  ended"
    );
  }
  catch (ex) {
    logs.error('Axlecounter page error Api (getstationaxlecountercurrentdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected axlecounter alert logs based on start,end and paginaion
axlecounter.get("/getstationaxlecounteralert", validuser, async (req, res) => {
  try {
    logs.info(
      "get axlecounter alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid

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
    where_condition.axlecounterid = axlecounterid;
    logs.info("where condition is : " + where_condition);


    var total_data_count = await AxleCounterAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await AxleCounterAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
      });
      //logs.info("get_list", get_list)
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get axlecounter alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Axlecounter page error Api (getstationaxlecounteralert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected axlecounter cureent alert logs based on  paginaion
axlecounter.get("/getstationaxlecountercurrentalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get axlecounter current alert  started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid;

    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    //console.log(req.query);
    // if (req.query.start_date != "") {
    //   start_date = moment().format("YYYY-MM-DD");
    //   end_Date = moment().format("YYYY-MM-DD");
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

    where_condition.isdele = false;
    where_condition.axlecounterid = axlecounterid;
    logs.info("where condition is : " + where_condition);


    var total_data_count = await AxleCounterAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await AxleCounterAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        offset: (page - 1) * size,
        limit: size,
      });
      //logs.info("get_list", get_list)
      res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          offset: (page - 1) * size,
          limit: size,
        });
        res.status(200).json({ issuccess: true, page: page, size: size, totaldatacount: total_data_count, data: get_list });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get axlecounter current alert  ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Axlecounter page error Api (getstationaxlecountercurrentalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected axlecounter data based on start,end and paginaion
axlecounter.get("/downloadaxlecounterdatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get axle counter data report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid

    const axlecountername = await RegisteredAxleCounter.findOne({ where: { id: axlecounterid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("AxleCounterData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "AxleCounterDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );


    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      { header: "AxleCounter Name", key: "axlecountername", width: 20 },
      { header: "DCV1", key: "dc_converter_voltage_1", width: 13 },
      { header: "DCV2", key: "dc_converter_voltage_2", width: 18 },
      { header: "PRV1	", key: "preparatory_relay_voltage_1", width: 14 },
      { header: "PRV2", key: "preparatory_relay_voltage_2", width: 15 },
      { header: "VRV1", key: "vital_relay_voltage_1", width: 15 },
      { header: "VRV2", key: "vital_relay_voltage_2", width: 15 },
      { header: "RESET", key: "reset_relay_voltage", width: 15 },
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
    where_condition.axlecounterid = axlecounterid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await AxleCounterData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno,
          axlecountername: axlecountername.axlecountername + ' @' + stationname.stationname,
          dc_converter_voltage_1: element.dc_converter_voltage_1,
          dc_converter_voltage_2: element.dc_converter_voltage_2,
          preparatory_relay_voltage_1: element.preparatory_relay_voltage_1,
          preparatory_relay_voltage_2: element.preparatory_relay_voltage_2,
          vital_relay_voltage_1: element.vital_relay_voltage_1,
          vital_relay_voltage_2: element.vital_relay_voltage_2,
          reset_relay_voltage: element.reset_relay_voltage,
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
        var get_list = await AxleCounterData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno,
            axlecountername: axlecountername.axlecountername + ' @' + stationname.stationname,
            dc_converter_voltage_1: element.dc_converter_voltage_1,
            dc_converter_voltage_2: element.dc_converter_voltage_2,
            preparatory_relay_voltage_1: element.preparatory_relay_voltage_1,
            preparatory_relay_voltage_2: element.preparatory_relay_voltage_2,
            vital_relay_voltage_1: element.vital_relay_voltage_1,
            vital_relay_voltage_2: element.vital_relay_voltage_2,
            reset_relay_voltage: element.reset_relay_voltage,
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
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    else if (user_role == "Employee") {
      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno,
            axlecountername: axlecountername.axlecountername + ' @' + stationname.stationname,
            dc_converter_voltage_1: element.dc_converter_voltage_1,
            dc_converter_voltage_2: element.dc_converter_voltage_2,
            preparatory_relay_voltage_1: element.preparatory_relay_voltage_1,
            preparatory_relay_voltage_2: element.preparatory_relay_voltage_2,
            vital_relay_voltage_1: element.vital_relay_voltage_1,
            vital_relay_voltage_2: element.vital_relay_voltage_2,
            reset_relay_voltage: element.reset_relay_voltage,
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
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    logs.info(
      "get axle counter data report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('axlecounter page error Api (downloadaxlecounteratareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected axlecounter alert based on start,end and paginaion
axlecounter.get("/downloadaxlecounteralertreport", validuser, async (req, res) => {
  try {
    logs.info(
      "get axle counter alert report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid

    const axlecountername = await RegisteredAxleCounter.findOne({ where: { id: axlecounterid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("AXleCounterAlert");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "AxleCounterReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      { header: "Axle Counter Name", key: "axlecountername", width: 20 },
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
    where_condition.axlecounterid = axlecounterid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await AxleCounterAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          axlecountername: axlecountername.axlecountername + ' @' + stationname.stationname,
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
        var get_list = await AxleCounterAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,         
            axlecountername: axlecountername.axlecountername + ' @' + stationname.stationname,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        var get_list = await AxleCounterAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            axlecountername: axlecountername.axlecountername + ' @' + stationname.stationname,
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
      "get axle counter alert report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Axlecounter page error Api (downloadaxlecounteralertreport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected axle counter latest data 
axlecounter.get("/getstationaxlecounterfinaldata", validuser, async (req, res) => {
  logs.info(`get station axlecounter final data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const axlecounterid = req.query.axlecounterid

    logs.info(req.query);
    //console.log(req.query);

    const axlecountername = await RegisteredAxleCounter.findOne({ where: { id: axlecounterid, isdele: false } })    

    var get_finalaxlecounterid_datas = await AxleCounterData.findOne({ limit: 1, where: { isdele: false, axlecounterid: axlecounterid }, order: [["id", "DESC"]], raw: true });

    if (get_finalaxlecounterid_datas != null) {
      get_finalaxlecounterid_datas.axlecountername = axlecountername.axlecountername     
    }
    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_finalaxlecounterid_datas });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_finalaxlecounterid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 4, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_finalaxlecounterid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get axle counter data logs ended"
    );
  }
  catch (ex) {
    logs.error('Axlecounter page error Api (getstationaxlecounterfinaldata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});


module.exports = axlecounter;