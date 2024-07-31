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


const lcgate = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();
require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const Asserts = require("../../models/asserts");
const RegisteredLCGate = require("../../models/registeredlcgate");
const RegisteredLCGateLogs = require("../../models/registeredlcgatelogs");
const StationAccess = require("../../models/stationaccess");
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const LCGateData = require("../../models/lcgatedata");
const LCGateAlert = require("../../models/lcgatealert");
const AlertMode = require("../../models/alertmode");
const excel = require("exceljs");
const reader = require('xlsx');

//register lcgate
lcgate.post("/registerlcgate", validuser, async (req, res) => {
  try {
    logs.info("New lcgate registration started");
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
      const lcgatename = req.body.lcgatename,
        stationid = req.body.stationid,       
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var lcgate_check = [await RegisteredLCGate.findOne({
        where: { stationid: stationid, lcgatename: lcgatename },
      })];
      lcgate_check = lcgate_check[0] !== null ? lcgate_check : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (lcgate_check.length !== 0) {
        if (lcgate_check[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_lcgate = await RegisteredLCGate.update(
              {
                lcgatename,
                stationid,               
                manufacture,
                serialno,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: lcgate_check[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("LC gate registration inserted");

            const log_insert = await RegisteredLCGateLogs.create(
              {
                lcgateid: update_lcgate[1].id,
                lcgatename: update_lcgate[1].lcgatename,
                stationid: update_lcgate[1].stationid,              
                manufacture: update_lcgate[1].manufacture,
                serialno: update_lcgate[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Lc gate registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Lc gate inserted Successfully" });
            logs.info("Lc gate Successfully Registered");
            //console.log("Lc gate Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Lc gate page error Api (registerlcgate)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in lc gate page. Api (registerlcgate)`, ex);
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
              const register_lcgate = await RegisteredLCGate.create({
                  lcgatename,
                  stationid,                 
                  manufacture,
                  serialno,
                  createddate: current_datetime,
                  createdby_id,
                  updateddate: current_datetime,
                  isdele,
              },
                  { transaction: transaction })
              logs.info("Lc gate registration inserted");

              const log_insert = await RegisteredLCGateLogs.create(
                  {
                      lcgateid: register_lcgate.id,
                      lcgatename,
                      stationid,                     
                      manufacture, 
                      serialno,
                      updateddate: current_datetime,
                      updatedby_id: user_id,
                      isdele,
                  },
                  { transaction: transaction }
              );
              logs.info("Lc gate registration log inserted");

              await transaction.commit();
              res
                  .status(200)
                  .json({ issuccess: true, msg: "Lc gate inserted Successfully" });
              logs.info("Lc gate Successfully Registered");
              //console.log("Lc gate Successfully Registered")
          }
          catch (ex) {
              await transaction.rollback();
              //console.log(ex.message);
              logs.error('Lc gate page error Api (registerlcgate)' + ex);
              res.status(400).json({ issuccess: false, msg: ex.message });
              mail.mailSendError(`Error in Lc gate page. Api (registerlcgate)`, ex);
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
    logs.error('Lc gate page error Api (registerlcgate)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in Lc gate page. Api (registerlcgate)`, ex);
  }
});

//edit registered lcgate
lcgate.put("/editlcgate", validuser, async (req, res) => {
  try {
    logs.info("Lc gate edit started");
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
          currentlcgatename = req.body.currentlcgatename,
          newlcgatename = req.body.newlcgatename,
          stationid = parseInt(req.body.stationid),          
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_lcgates = await RegisteredLCGate.findAll(
          { where: { stationid, isdele: false}, raw: true, }
        )

        var check_lcgate = lodash.find(station_lcgates, {id: id })
        check_lcgate = check_lcgate == undefined ? null : check_lcgate

        if (check_lcgate == null) {
          logs.info("Lc gate not exists in this station.");
          //console.log("Lc gate not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Lc gate not exists in this station." });
        }
        else {
            let repeat_names = false;

            currentlcgatename == newlcgatename ? repeat_names = false : station_lcgates.find(value => value.lcgatename == newlcgatename) ? repeat_names = true : false
  
            let transaction = await db.transaction({ autocommit: false });
            try {
                if (repeat_names == false) {
                    const update_lcgate = await RegisteredLCGate.update(
                        {
                            lcgatename: newlcgatename,
                            manufacture: manufacture,
                            serialno: serialno,
                            updateddate: current_datetime
                        },
                        { where: { id }, returning: true, plain: true },
                        { transaction: transaction }, { raw: true })

                    logs.info("Lc gate updated");
                    const log_insert = await RegisteredLCGateLogs.create(
                        {
                            lcgateid: update_lcgate[1].id,
                            lcgatename: update_lcgate[1].lcgatename,
                            stationid: update_lcgate[1].stationid,
                            manufacture: update_lcgate[1].manufacture,
                            serialno: update_lcgate[1].serialno,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele,
                        },
                        { transaction: transaction }
                    );
                    logs.info("Lc gate log inserted");
                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Successfully Updated" });
                    logs.info("Lc gate Successfully Updated");
                    //console.log("Lc gate  Successfully Updated")  
                }
                else {
                    logs.info("Lc gate already exist in this station");
                    res.status(400).json({ issuccess: false, msg: "Lc gate already exists in the station" });
                }
            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('Lc gate page error Api (editlcgate)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(`Error in lc gate page. Api (editlcgate)`, ex);
            }                
        }
      }
      catch (ex) {
        //console.log(ex.message);
        logs.error('Lc gate page error Api (editlcgate)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(`Error in lc gate page. Api (editlcgate)`, ex);
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
    logs.error('Lc gate page error Api (editlcgate)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in lc gate page. Api (editlcgate)`, ex);
  }
});

//delete lcgate
lcgate.put("/deletelcgate", validuser, async (req, res) => {
  try {
    logs.info("Lc gate delete started");
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

        const check_lcgate = await RegisteredLCGate.findOne(
          {
            where: { id, isdele: false },
          })

        if (check_lcgate != null) {

          const update_lcgate = await RegisteredLCGate.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Lc gate dele updated");

          const log_insert = await RegisteredLCGateLogs.create(
            {
              lcgateid: update_lcgate[1].id,
              stationid: update_lcgate[1].stationid,
              lcgatename: update_lcgate[1].lcgatename,  
              manufacture: update_lcgate[1].manufacture,            
              serialno: update_lcgate[1].serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_lcgate[1].isdele_reason,
              isdele : false,
            },
            { transaction: transaction }
          );
          logs.info("Lc gate dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("Lc gate Successfully deleted");
          //console.log("Lc gate Successfully deleted")
        }
        else {
          logs.info("Lc gate not found");
          //console.log("Lc gate not found"");
          res.status(401).json({ issuccess: false, msg: "Lc gate not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Lc gate page error Api (deletelcgate)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in lc gate page. Api (deletelcgate)`,
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
    logs.error('Lc gate page error Api (deletelcgate)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in lc gate page. Api (deletelcgate)`, ex);
  }
});

//get all lcgate in a station for lcgate list
lcgate.get("/getalllcgate", validuser, async (req, res) => {
  try {
    //console.log(`get lc gate started`);         
    logs.info(`get lc gate started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role == "Station Incharge") {

      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false }, raw: true, })
      if (access.length > 0) {
        
        RegisteredRailwayStations.hasMany(RegisteredLCGate, { foreignKey: 'stationid' });
        RegisteredLCGate.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id','stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredLCGates"."id"'), 'id'],
            [Sequelize.literal('"RegisteredLCGates"."lcgatename"'), 'lcgatename'],
            [Sequelize.literal('"RegisteredLCGates"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredLCGates"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredLCGate,
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
            [Sequelize.literal('"RegisteredLCGates"."id"')],
          ],
        })
                
        logs.info(`get lc gate end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get lc gate end`)
        res.status(200).json({ issuccess: true, data: [] });
      }

    }
    else {
      if (user_role == "Admin") {

        RegisteredRailwayStations.hasMany(RegisteredLCGate, { foreignKey: 'stationid' });
        RegisteredLCGate.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id','stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredLCGates"."id"'), 'id'],
            [Sequelize.literal('"RegisteredLCGates"."lcgatename"'), 'lcgatename'],
            [Sequelize.literal('"RegisteredLCGates"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredLCGates"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredLCGate,
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
            [Sequelize.literal('"RegisteredLCGates"."id"')],
          ],
        })
                
        logs.info(`get lc gate end`)
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
    logs.error('Lc gate page error Api (getalllcgate)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

//get latest lcgate details in a station for lcgate details
lcgate.get("/getstationlcgate", validuser, async (req, res) => {
  logs.info(`get station latest lcgate started`);
  try {
    logs.info(req.query)
    
    // RegisteredLCGate.hasMany(LCGateData, { foreignKey: 'lcgateid' });
    // LCGateData.belongsTo(RegisteredLCGate, { foreignKey: 'lcgateid' });

    // LCGateData.hasMany(LCGateAlert, { foreignKey: 'lcgateid' });
    // LCGateAlert.belongsTo(LCGateData, { foreignKey: 'lcgateid' });

    // var datas = 
    // await LCGateData.findAll({
    //   attributes: [
    //     [Sequelize.col('RegisteredLCGate.id'), 'id'],
    //     [Sequelize.col('RegisteredLCGate.lcgatename'), 'lcgatename'],
    //     [Sequelize.col('LCGateAlerts.modeid'), 'modeid'],
    //     ['id', 'lcgatedataid'],
    //     'announciator_relay_voltage',
    //     'proving_relay_voltage',
    //     'createddate',      
    //     'isdele',
    //   ],
    //   include: [
    //     {
    //       model: RegisteredLCGate,
    //       attributes: [],
    //       where: {
    //         isdele: false,
    //         stationid: parseInt(req.query.stationid),
    //       },
    //     },
    //     {
    //       model: LCGateAlert,
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
    //       [Op.in]: (await LCGateData.findAll({
    //         attributes: [
    //           [Sequelize.fn('max', Sequelize.col('LCGateData.id')), 'id'],
    //         ],
    //         group: ['RegisteredLCGate.id'],
    //         include: [
    //           {
    //             model: RegisteredLCGate,
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
    //     [Sequelize.literal('CASE WHEN "LCGateAlerts"."modeid" IS NULL THEN 0 ELSE 1 END'), 'DESC'],
    //     [Sequelize.col('LCGateAlerts.modeid'), 'DESC'],
    //     [Sequelize.col('RegisteredLCGate.lcgatename'), 'ASC'],
    //   ],
    //   group: [
    //     'LCGateData.id',
    //     'RegisteredLCGate.id',
    //     'RegisteredLCGate.lcgatename',
    //     'LCGateAlerts.modeid',
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

    // var get_lcgates = removeDuplicates(datas);


    var datas = []
    var resgitered_lcgates = await RegisteredLCGate.findAll({
      where: {       
        stationid: parseInt(req.query.stationid),
        isdele: false
      },
      order: [["lcgatename", "ASC"]],
      raw: true
    })

    for await(const element of resgitered_lcgates)
    {
      var lcgate_data = await LCGateData.findOne({
        where: {       
          lcgateid: element.id,
          isdele: false,
        },        
        order: [["id","DESC"]]
      })

      if(lcgate_data != null)
      {
        var lcgate_alert_data = await LCGateAlert.findOne({
          where: {       
            lcgateid: element.id,
            lcgatedataid: lcgate_data.id,
            isdele: false,
          },
          order: [["modeid","DESC"]]
        })
        datas.push({
          id: element.id,
          lcgatename: element.lcgatename,
          modeid: lcgate_alert_data == null ? null : lcgate_alert_data.modeid,
          lcgatedataid: lcgate_data.id,
          announciator_relay_voltage: lcgate_data.announciator_relay_voltage,
          proving_relay_voltage: lcgate_data.proving_relay_voltage,          
          createddate: lcgate_data.createddate,
          isdele: lcgate_data.isdele,
        })       
      }
    }
    
    res.status(200).json({ issuccess: true, data: datas.sort((a,b) => b.modeid - a.modeid) });
    logs.info(`get station lcgate end`);
  } catch (ex) {
    logs.error('LCGate page error Api (getstationlcgate)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected lcgate data based on start , end and paginaion
lcgate.get("/getstationlcgatedata", validuser, async (req, res) => {
  logs.info(`get station lcagte  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid
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
    where_condition.lcgateid = lcgateid;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await LCGateData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await LCGateData.findAll({
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
        var get_list = await LCGateData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        var get_list = await LCGateData.findAll({
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
      "get lcgate data logs ended"
    );
  }
  catch (ex) {
    logs.error('LCGate page error Api (getstationlcgatedata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected lcgate current data based on paginaion
lcgate.get("/getstationlcgatecurrentdata", validuser, async (req, res) => {
  logs.info(`get station lcgate current  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid
    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

    logs.info(req.query);

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
    where_condition.lcgateid = parseInt(lcgateid);
    logs.info("where condition is : " + where_condition);

    var total_data_count = await LCGateData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await LCGateData.findAll({
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
        var get_list = await LCGateData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        var get_list = await LCGateData.findAll({
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
      "get lcgate current data  ended"
    );
  }
  catch (ex) {
    logs.error('Lcgate page error Api (getstationlcgatecurrentdata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected lcgate alert logs based on start,end and paginaion
lcgate.get("/getstationlcgatealert", validuser, async (req, res) => {
  try {
    logs.info(
      "get lcgate alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid

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
    where_condition.lcgateid = lcgateid;
    logs.info("where condition is : " + where_condition);


    var total_data_count = await LCGateAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await LCGateAlert.findAll({
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
        var get_list = await LCGateAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        var get_list = await LCGateAlert.findAll({
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
      "get lcgate alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Lcgate page error Api (getstationlcgatealert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected lcgate cureent alert logs based on  paginaion
lcgate.get("/getstationlcgatecurrentalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get lcgate current alert  started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid;

    let start_date = moment().format('YYYY-MM-DD'),
      end_Date = moment().format("YYYY-MM-DD");

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
    where_condition.lcgateid = lcgateid;
    logs.info("where condition is : " + where_condition);


    var total_data_count = await LCGateAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await LCGateAlert.findAll({
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
        var get_list = await LCGateAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        var get_list = await LCGateAlert.findAll({
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
      "get lcgate current alert  ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Lcgate page error Api (getstationlcgatecurrentalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected lcgate data based on start,end and paginaion
lcgate.get("/downloadlcgatedatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get lcgate data report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid

    const lcgatename = await RegisteredLCGate.findOne({ where: { id: lcgateid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("LCGateData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "LCGateDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );


    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      { header: "LCGate Name", key: "lcgatename", width: 20 },
      { header: "ARV", key: "announciator_relay_voltage", width: 50 },
      { header: "PRV", key: "proving_relay_voltage", width: 50 },
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
    where_condition.lcgateid = lcgateid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await LCGateData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno,
          lcgatename: lcgatename.lcgatename + ' @' + stationname.stationname,
          announciator_relay_voltage: element.announciator_relay_voltage,
          proving_relay_voltage: element.proving_relay_voltage,
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
        var get_list = await LCGateData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno,
            lcgatename: lcgatename.lcgatename + ' @' + stationname.stationname,
            announciator_relay_voltage: element.announciator_relay_voltage,
            proving_relay_voltage: element.proving_relay_voltage,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        var get_list = await LCGateData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno,
            lcgatename: lcgatename.lcgatename + ' @' + stationname.stationname,
            announciator_relay_voltage: element.announciator_relay_voltage,
            proving_relay_voltage: element.proving_relay_voltage,
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
      "get lc gate data report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('lcgate page error Api (downloadlcgatedatareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected lcgate alert based on start,end and paginaion
lcgate.get("/downloadlcgatealertreport", validuser, async (req, res) => {
  try {
    logs.info(
      "get lc gate alert report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid

    const lcgatename = await RegisteredLCGate.findOne({ where: { id: lcgateid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("LCGateAlert");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "LCGateAlertReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      { header: "LC Gate Name", key: "lcgatename", width: 20 },
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
    where_condition.lcgateid = lcgateid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await LCGateAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          lcgatename: lcgatename.lcgatename + ' @' + stationname.stationname,
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
        var get_list = await LCGateAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            lcgatename: lcgatename.lcgatename + ' @' + stationname.stationname,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        var get_list = await LCGateAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            lcgatename: lcgatename.lcgatename + ' @' + stationname.stationname,
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
      "get lc gate alert report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('LCGate page error Api (downloadlcgatealertreport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected lcgate latest data 
lcgate.get("/getstationlcgatefinaldata", validuser, async (req, res) => {
  logs.info(`get station lcgate final data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const lcgateid = req.query.lcgateid

    logs.info(req.query);
    //console.log(req.query);

    const lcgatename = await RegisteredLCGate.findOne({ where: { id: lcgateid, isdele: false } })   

    var get_finallcgateid_datas = await LCGateData.findOne({ limit: 1, where: { isdele: false, lcgateid: lcgateid }, order: [["id", "DESC"]], raw: true });

    if (get_finallcgateid_datas != lcgatename) {
      get_finallcgateid_datas.lcgatename = lcgatename.lcgatename    
    }
    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_finallcgateid_datas });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_finallcgateid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 5, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_finallcgateid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get lc gate data logs ended"
    );
  }
  catch (ex) {
    logs.error('LCgate page error Api (getstationlcgatefinaldata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});



module.exports = lcgate;