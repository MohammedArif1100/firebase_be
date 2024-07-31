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

const { Sequelize, Op, where } = require("sequelize");
const mail = require("../../services/mail");

const log4js = require("../../log4js");
const logs = log4js.logger;


const pointmachine = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();
require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const RegisteredPointMachine = require("../../models/registeredpointmachine");
const RegisteredPointMachineLogs = require("../../models/registeredpointmachinelogs");
const StationAccess = require("../../models/stationaccess");
const PointMachineData = require("../../models/pointmachinedata");
const PointmachineAdata = require("../../models/pointmachineAdata");
const PointmachineBdata = require("../../models/pointmachineBdata");
const NotificationControl = require("../../models/notificationcontrol");
const PointMachineAlert = require("../../models/pointmachinealert");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const AlertMessage = require('../../models/alertmessage');
const AlertMode = require("../../models/alertmode");
const excel = require("exceljs");
const reader = require('xlsx')

//register point machine
pointmachine.post("/registerpointmachine", validuser, async (req, res) => {
  try {
    logs.info("New point machine registration started");
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
      const pointmachinename = req.body.pointmachinename,
        stationid = req.body.stationid,
        manufacture = req.body.manufacture,
        serialno = req.body.serialno,
        createdby_id = user_id,
        isdele = false;

      var pointmachine_check = [await RegisteredPointMachine.findOne({
        where: { pointmachinename: pointmachinename, stationid: stationid },
      })];
      pointmachine_check = pointmachine_check[0] !== null ? pointmachine_check : []

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");

      if (pointmachine_check.length !== 0) {
        if (pointmachine_check[0].isdele === true) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const update_pointmachine = await RegisteredPointMachine.update(
              {
                manufacture,
                serialno,
                updateddate: current_datetime,
                isdele: false,
                isdele_reason: null,
              },
              { where: { id: pointmachine_check[0].id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })
            logs.info("Point Machine registration inserted");

            const log_insert = await RegisteredPointMachineLogs.create(
              {
                pointmachineid: update_pointmachine[1].id,
                pointmachinename: update_pointmachine[1].pointmachinename,
                stationid: update_pointmachine[1].stationid,
                manufacture: update_pointmachine[1].manufacture,
                serialno: update_pointmachine[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele_reason: null,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Point Machine registration log inserted");

            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Pointmachine inserted Successfully" });
            logs.info("Pointmachine Successfully Registered");
            //console.log("Pointmachine Successfully Registered")
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Pointmachine page error Api (registerpointmachine)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in pointmachine page. Api (registerpointmachine)`, ex);
          }
        }
        else {
          //console.log("Given point machine is already registered.");
          logs.info("Given point machine is already available.");
          res
            .status(400)
            .json({ issuccess: false, msg: "Given point machine is aleady available" });
        }
      }
      else {
        if (fs.existsSync('railways.xlsx')) {
          let transaction = await db.transaction({ autocommit: false });
          try {
            const register_pointmachine = await RegisteredPointMachine.create({
              pointmachinename,
              stationid,
              manufacture,
              serialno,
              createddate: current_datetime,
              createdby_id,
              updateddate: current_datetime,
              isdele,
            },
              { transaction: transaction })
            logs.info("Point Machine registration inserted");

            const log_insert = await RegisteredPointMachineLogs.create(
              {
                pointmachineid: register_pointmachine.id,
                pointmachinename,
                manufacture,
                serialno,
                stationid,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Point Machine registration log inserted");

            // Reading our railway file
            const file = reader.readFile('railways.xlsx')
            let data = []
            if (file.SheetNames[6] == "Point Machine Alerts") {
              const temp = reader.utils.sheet_to_json(
                file.Sheets[file.SheetNames[6]])
              temp.forEach(async (res) => {
                var object = {
                  stationid: stationid,
                  assertid: register_pointmachine.id,
                  assert: "Point Machine",
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
                .json({ issuccess: true, msg: "Pointmachine inserted Successfully" });
              logs.info("Pointmachine Successfully Registered");
              //console.log("Pointmachine Successfully Registered")
            }
            else {
              await transaction.rollback();
              logs.info('Point Machine Alerts sheet not found');
              //console.log('Point Machine Alerts sheet not found')
              res.status(400).json({ issuccess: false, msg: 'Point Machine Alerts sheet not found' });
            }
          }
          catch (ex) {
            await transaction.rollback();
            //console.log(ex.message);
            logs.error('Pointmachine page error Api (registerpointmachine)' + ex);
            res.status(400).json({ issuccess: false, msg: ex.message });
            mail.mailSendError(`Error in pointmachine page. Api (registerpointmachine)`, ex);
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
    logs.error('Pointmachine page error Api (registerpointmachine)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in pointmachine page. Api (registerpointmachine)`, ex);
  }
});

//edit registered point machine
pointmachine.put("/editpointmachine", validuser, async (req, res) => {
  try {
    logs.info("Point Machine edit started");
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
          currentpointmachinename = req.body.currentpointmachinename,
          newpointmachinename = req.body.newpointmachinename,
          manufacture = req.body.manufacture,
          serialno = req.body.serialno,
          stationid = req.body.stationid,
          isdele = false

        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");

        const station_pointmachines = await RegisteredPointMachine.findAll(
          { where: { stationid, isdele: false } }
        )

        const check_pointmachine = await RegisteredPointMachine.findOne(
          { where: { id, isdele: false } }
        )

        if (check_pointmachine == null) {
          logs.info("Pointmachine not exist in this station.");
          //console.log("Pointmachine not exists in this station.");
          res.status(401).json({ issuccess: false, msg: "Pointmachine not exists in this station." });
        }
        else {
          let repeat_names = false;

          currentpointmachinename == newpointmachinename ? repeat_names = false : station_pointmachines.find(value => value.pointmachinename == newpointmachinename) ? repeat_names = true : false

          if (repeat_names == false) {
            const update_pointmachine = await RegisteredPointMachine.update(
              {
                pointmachinename: newpointmachinename,
                manufacture: manufacture,
                serialno: serialno,
                updateddate: current_datetime,
              },
              { where: { id }, returning: true, plain: true },
              { transaction: transaction }, { raw: true })

            logs.info("Point Machine updated");
            const log_insert = await RegisteredPointMachineLogs.create(
              {
                pointmachineid: update_pointmachine[1].id,
                pointmachinename: update_pointmachine[1].pointmachinename,
                stationid: update_pointmachine[1].stationid,
                manufacture: update_pointmachine[1].manufacture,
                serialno: update_pointmachine[1].serialno,
                updateddate: current_datetime,
                updatedby_id: user_id,
                isdele,
              },
              { transaction: transaction }
            );
            logs.info("Point Machine log inserted");
            await transaction.commit();
            res
              .status(200)
              .json({ issuccess: true, msg: "Successfully Updated" });
            logs.info("Pointmachine Successfully Updated");
            //console.log("Pointmachine  Successfully Updated")  
          }
          else {
            logs.info("Point Machine name already exist in this station");
            res.status(400).json({ issuccess: false, msg: "Point machine name already exists in the station" });
          }
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Pointmachine page error Api (editpointmachine)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(`Error in pointmachine page. Api (editpointmachine)`, ex);
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
    logs.error('Pointmachine page error Api (editpointmachine)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in pointmachine page. Api (editpointmachine)`, ex);
  }
});

//delete registered point machine
pointmachine.put("/deletepointmachine", validuser, async (req, res) => {
  try {
    logs.info("Point machine delete started");
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

        const check_pointmachine = await RegisteredPointMachine.findOne(
          {
            where: { id, isdele: false },
          })

        if (check_pointmachine != null) {

          const update_pointmachine = await RegisteredPointMachine.update(
            {
              isdele: true,
              isdele_reason: isdele_reason,
              updateddate: current_datetime
            },
            { where: { id }, returning: true, plain: true },
            { transaction: transaction }, { raw: true });

          logs.info("Point Machine dele updated");

          const log_insert = await RegisteredPointMachineLogs.create(
            {
              pointmachineid: update_pointmachine[1].id,
              pointmachinename: update_pointmachine[1].pointmachinename,
              stationid: update_pointmachine[1].stationid,
              manufacture: update_pointmachine[1].manufacture,
              serialno: update_pointmachine[1].serialno,
              updateddate: current_datetime,
              updatedby_id: user_id,
              isdele_reason: update_pointmachine[1].isdele_reason,
              isdele: false,
            },
            { transaction: transaction }
          );
          logs.info("Point Machine dele log inserted");
          await transaction.commit();
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully deleted" });
          logs.info("Pointmachine Successfully deleted");
          //console.log("Pointmachine Successfully deleted")
        }
        else {
          logs.info("Pointmachine not found");
          //console.log("Pointmachine not found"");
          res.status(401).json({ issuccess: false, msg: "Pointmachine not found" });
        }
      }
      catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Pointmachine page error Api (deletepointmachine)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in pointmachine page. Api (deletepointmachine)`,
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
    logs.error('Pointmachine page error Api (deletepointmachine)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in pointmachine page. Api (deletepointmachine)`, ex);
  }
});

//get all registered point machine
pointmachine.get("/getallpointmachine", validuser, async (req, res) => {
  try {
    //console.log(`get pointmachine started`);         
    logs.info(`get pointmachine started`)
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    if (user_role === "Station Incharge") {
      const access = await StationAccess.findAll(
        { where: { userid: user_id, isdele: false } }
      )
      if (access.length > 0) {

        RegisteredRailwayStations.hasMany(RegisteredPointMachine, { foreignKey: 'stationid' });
        RegisteredPointMachine.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id', 'stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredPointMachines"."id"'), 'id'],
            [Sequelize.literal('"RegisteredPointMachines"."pointmachinename"'), 'pointmachinename'],
            [Sequelize.literal('"RegisteredPointMachines"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredPointMachines"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredPointMachine,
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
            [Sequelize.literal('"RegisteredPointMachines"."id"')],
          ],
        })

        //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,p.pointmachinename,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredPointMachines" as p ON s.id = p.stationid where s.isdele = false and p.isdele = false' + ' and p.stationid=' + access.map(a => a.stationid) + ' order by s.stationname,p.id')
        logs.info(`get pointmachine end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info(`get pointmachine end`)
        res.status(200).json({ issuccess: true, data: [] });
      }
    }
    else {
      if (user_role == "Admin") {
        RegisteredRailwayStations.hasMany(RegisteredPointMachine, { foreignKey: 'stationid' });
        RegisteredPointMachine.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

        const datas = await RegisteredRailwayStations.findAll({
          attributes: [
            ['id', 'stationid'],
            'stationname',
            'stationcode',
            [Sequelize.literal('"RegisteredPointMachines"."id"'), 'id'],
            [Sequelize.literal('"RegisteredPointMachines"."pointmachinename"'), 'pointmachinename'],
            [Sequelize.literal('"RegisteredPointMachines"."manufacture"'), 'manufacture'],
            [Sequelize.literal('"RegisteredPointMachines"."serialno"'), 'serialno'],
          ],
          include: [
            {
              model: RegisteredPointMachine,
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
            [Sequelize.literal('"RegisteredPointMachines"."id"')],
          ],
        })

        //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,p.pointmachinename,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredPointMachines" as p ON s.id = p.stationid where s.isdele = false and p.isdele = false order by s.stationname,p.id')

        // let query = get_points.asEnumerable().join(get_railwaystations,(p, r)=>({
        //     id:p.id,
        //     stationid:p.stationid,
        //     stationname:r.stationname,
        //     stationcode:r.stationcode,
        //     pointmachinename:p.pointmachinename,
        //     manufacture:p.manufacture,
        //     serialno:p.serialno,
        // }),p=> p.stationid, r=>rol.id)
        // console.log('log', )

        logs.info(`get pointmachine end`)
        res.status(200).json({ issuccess: true, data: datas });
      }
      else {
        logs.info("Admin Only access this page.");
        //console.log("Admin Only access this page.");
        res.status(401).json({ issuccess: false, msg: "Access Denied..." });
      }
    }

    // var get_railwaystations = await RegisteredRailwayStations.findAll(
    //     {where:{isdele:false}},       
    //     { raw: true }
    //   );

    // var get_points = await RegisteredRailwayStations.findAll(
    // {where:{isdele:false}},       
    // { raw: true }
    // );

    //var get_points = await RegisteredPointMachine.findAll({where:{isdele:false}});
    //let result = await get_railwaystations.filter(o1 => get_points.some(o2 => o1.id === o2.stationid));

    // var access = null;
    // var count = 0;
    // if(user_role == "Station Incharge")
    // {
    //     count++;

    //     access = await StationAccess.findOne(
    //         {where : {userid:user_id, stationid: req.body.stationid, isdele:false}}
    //     )  

    //     if(access != null) {
    //         const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,p.pointmachinename,p.manufacture,p.serialno from public."RegisteredRailwayStations" as s JOIN public."RegisteredPointMachines" as p ON s.id = p.stationid where s.isdele = false and p.isdele = false and s.id =' + access.stationid)
    //         logs.info(`get pointmachine end`)
    //         res.status(200).json({ issuccess: true, data: data[0] });       
    //     }
    //     else {
    //         logs.info("Admin Only access this page.");
    //         //console.log("Admin Only access this page.");
    //         res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    //     } 
    // } 


    // var results = await get_railwaystations.filter(async function (o1) {
    //      get_points.some(async function (o2) {
    //          if(o1.id === o2.id){
    //             console.log('-----------------------------')
    //             datas.push({
    //                 staionname : o1.stationname,
    //                 stationcode : o1.stationcode,
    //                 pointmachinename : o2.pointmachinename
    //             })
    //             return o1.id === o2.id;                 
    //         }               
    //    });
    // });

    // console.log('result', results)
    // console.log('datas', datas)


    // await RegisteredPointMachine.findAll({
    //     where:{isdele: false}, 
    //     raw: true
    //         }).then(async function (rowPoint){
    //             await RegisteredRailwayStations.findAll({
    //                 where:{isdele: false,  id: { [Op.in]: rowPoint.map(a=>a.stationid) } }, 
    //                 raw: true
    //                     }).then(async function (rowstation){                                                           
    //                 var data= {
    //                     photoData: rowPoint,
    //                     commentData: rowstation,
    //                 }                     
    //                  await data.photoData.forEach(async  element => {
    //                         await rowstation.some(async function (o2) {
    //                          if(element.station === o2.id){
    //                                 await datas.push({
    //                                     stationame:o2.stationname,
    //                                     stationcode:o2.stationcode,
    //                                     pointmachinename: element.pointmachinename
    //                                 })

    //                             }
    //                         })

    //                     }); 
    //                 console.log(datas)                                   
    //                 })

    //         })  

  } catch (ex) {
    //console.log(ex);
    logs.error('Pointmachine page error Api (getallpointmachine)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

//get all registered point machine
pointmachine.get("/getstationpointmachine", validuser, async (req, res) => {
  logs.info(`get station pointmachine started`);
  try {
    logs.info(req.query)

    // RegisteredPointMachine.hasMany(PointMachineData, { foreignKey: 'pointmachineid' });
    // PointMachineData.belongsTo(RegisteredPointMachine, { foreignKey: 'pointmachineid' });

    // PointMachineData.hasMany(PointMachineAlert, { foreignKey: 'pointmachinedataid' });
    // PointMachineAlert.belongsTo(PointMachineData, { foreignKey: 'pointmachinedataid' });

    // var test4 = await PointMachineData.findAll({
    //   attributes: [   
    //     //[Sequelize.col('PointMachineData.direction'), 'direction'],          
    //     [Sequelize.literal('"RegisteredPointMachine"."id"'),'pointmachineid'],
    //     [Sequelize.literal('"RegisteredPointMachine"."pointmachinename"'),'pointmachinename'],        
    //     [Sequelize.fn('max', Sequelize.col('PointMachineData.id')), 'id'],
    //   ],
    //   group: ['RegisteredPointMachine.id'],
    //   include: [
    //     {
    //       model: RegisteredPointMachine,  
    //       attributes: [],
    //       where: {isdele: false},  
    //     },
    //   ],
    //   where: {isdele: false},  
    //   raw: true,
    // })

    // var test5 = await PointMachineData.findAll({
    //   attributes: [
    //     //['id','pointmachinedataid'],
    //     ['pointmachineid','id'],
    //     'direction',
    //     'pointcyclecount',
    //     'a_direction',
    //     'a_cyclecount',
    //     'a_current_max',
    //     'a_current_avg',
    //     'a_voltage',
    //     'a_indication_voltage',
    //     'a_time',
    //     'a_vibration_x',
    //     'a_vibration_y',
    //     'a_vibration_z',
    //     'b_direction',
    //     'b_cyclecount',
    //     'b_current_max',
    //     'b_current_avg',
    //     'b_voltage',
    //     'b_indication_voltage',
    //     'b_time',
    //     'b_vibration_x',
    //     'b_vibration_y',
    //     'b_vibration_z',
    //     'createddate',
    //     'isdele',
    //     [Sequelize.literal('"RegisteredPointMachine"."pointmachinename"'),'pointmachinename'],
    //     [Sequelize.literal('"PointMachineAlerts"."modeid"'),'modeid'],
    //     [Sequelize.literal('"PointMachineAlerts"."pointmachinedataid"'),'pointmachinedataid'],
    //   ],
    //   include: [
    //     {
    //       model: RegisteredPointMachine, 
    //       attributes:[],
    //       where: {isdele: false},            
    //     },
    //     {
    //       model: PointMachineAlert,          
    //       attributes:[],
    //       where: {
    //         isdele: false,
    //         pointmachinedataid: test4.map(data => data.id),
    //         //pointmachinedataid: Sequelize.literal('"PointMachineData"."id"'),
    //       },  
    //       order: [
    //         ['modeid','DESC'],
    //       ],
    //       required: false,           
    //     },        
    //   ],     
    //   where: {
    //     isdele: false,
    //     id: test4.map(data => data.id),
    //     //id: Sequelize.literal('"PointMachineData"."id"'),        
    //   }, 
    //   order: [
    //     'pointmachinename',
    //   ],
    //   raw: true, 
    // })

    // var test5 = await PointMachineData.findAll({
    //   attributes: [
    //     ['pointmachineid', 'id'],
    //     'direction',
    //     'pointcyclecount',
    //     'a_direction',
    //     'a_cyclecount',
    //     'a_current_max',
    //     'a_current_avg',
    //     'a_voltage',
    //     'a_indication_voltage',
    //     'a_time',
    //     'a_vibration_x',
    //     'a_vibration_y',
    //     'a_vibration_z',
    //     'b_direction',
    //     'b_cyclecount',
    //     'b_current_max',
    //     'b_current_avg',
    //     'b_voltage',
    //     'b_indication_voltage',
    //     'b_time',
    //     'b_vibration_x',
    //     'b_vibration_y',
    //     'b_vibration_z',
    //     'createddate',
    //     'isdele',
    //     [Sequelize.literal('"RegisteredPointMachine"."pointmachinename"'), 'pointmachinename'],
    //     [Sequelize.literal('"PointMachineAlerts"."modeid"'), 'modeid'],
    //   ],
    //   include: [
    //     {
    //       model: RegisteredPointMachine,
    //       attributes: [],
    //       where: { 
    //         isdele: false ,
    //         stationid: parseInt(req.query.stationid)
    //       },
    //     },
    //     {
    //       model: PointMachineAlert,
    //       attributes: [],
    //       where: {
    //         isdele: false,                     
    //       },
    //       required: false,
    //       order: [['modeid', 'DESC']],
    //     },
    //   ],
    //   where: {
    //     isdele: false,
    //     id: {
    //       [Op.in]: (await PointMachineData.findAll({
    //         attributes: [        
    //           [Sequelize.fn('max', Sequelize.col('PointMachineData.id')), 'id'],
    //         ],
    //         group: ['RegisteredPointMachine.id'],
    //         include: [
    //           {
    //             model: RegisteredPointMachine,  
    //             attributes: [],
    //             where: {
    //               isdele: false,
    //               stationid: parseInt(req.query.stationid)
    //             },  
    //           },
    //         ],
    //         where: {isdele: false},  
    //         raw: true,
    //       })).map(data => data.id)
    //     },
    //   },
    //   order: [
    //     [Sequelize.literal('"RegisteredPointMachine"."pointmachinename"'), 'ASC'],
    //     [Sequelize.literal('"PointMachineAlerts"."modeid"'), 'DESC'],
    //   ],
    //   raw: true,
    // });

    // var datas = await PointMachineData.findAll({
    //   attributes: [
    //     [Sequelize.col('RegisteredPointMachine.id'), 'id'],
    //     [Sequelize.col('RegisteredPointMachine.pointmachinename'), 'pointmachinename'],
    //     [Sequelize.col('PointMachineAlerts.modeid'), 'modeid'],
    //     ['id', 'pointmachinedataid'],
    //     'direction',
    //     'pointcyclecount',
    //     'a_direction',
    //     'b_direction',
    //     'log',
    //     'createddate',
    //     'isdele',
    //   ],
    //   include: [
    //     {
    //       model: RegisteredPointMachine,
    //       attributes: [],
    //       where: {
    //         isdele: false,
    //         stationid: parseInt(req.query.stationid),
    //       },
    //     },
    //     {
    //       model: PointMachineAlert,
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
    //       [Op.in]: (await PointMachineData.findAll({
    //         attributes: [
    //           [Sequelize.fn('max', Sequelize.col('PointMachineData.id')), 'id'],
    //         ],
    //         group: ['RegisteredPointMachine.id'],
    //         include: [
    //           {
    //             model: RegisteredPointMachine,
    //             attributes: [],
    //             where: {
    //               isdele: false,
    //               stationid: parseInt(req.query.stationid)
    //             },
    //           },
    //         ],
    //         where: {
    //           isdele: false,
    //           log: 1,
    //         },
    //         raw: true,
    //       })).map(data => data.id)
    //     },
    //     log: 1,
    //   },
    //   order: [
    //     [Sequelize.literal('CASE WHEN "PointMachineAlerts"."modeid" IS NULL THEN 0 ELSE 1 END'), 'DESC'],
    //     [Sequelize.col('PointMachineAlerts.modeid'), 'DESC'],
    //     [Sequelize.col('RegisteredPointMachine.pointmachinename'), 'ASC'],
    //   ],
    //   group: [
    //     'PointMachineData.id',
    //     'RegisteredPointMachine.id',
    //     'RegisteredPointMachine.pointmachinename',
    //     'PointMachineAlerts.modeid',
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

    // var get_pointmachine = removeDuplicates(datas);

    ////var get_pointmachine = await RegisteredPointMachine.findAll({ where: { isdele: false, stationid: req.query.stationid } }, { raw: true });

    var datas = []
    var resgitered_points = await RegisteredPointMachine.findAll({
      where: {
        stationid: parseInt(req.query.stationid),
        isdele: false
      },
      order: [["pointmachinename", "ASC"]],
      raw: true
    })

    for await (const element of resgitered_points) {
      var point_data = await PointMachineData.findOne({
        where: {
          pointmachineid: element.id,
          isdele: false,
          log: 1,
        },
        order: [["id", "DESC"]]
      })

      if (point_data != null) {
        var point_alert_data = await PointMachineAlert.findOne({
          where: {
            pointmachineid: element.id,
            pointmachinedataid: point_data.id,
            isdele: false,
          },
          order: [["modeid", "DESC"]]
        })
        datas.push({
          id: element.id,
          pointmachinename: element.pointmachinename,
          modeid: point_alert_data == null ? null : point_alert_data.modeid,
          pointmachinedataid: point_data.id,
          direction: point_data.direction,
          pointcyclecount: point_data.pointcyclecount,
          a_direction: point_data.a_direction,
          b_direction: point_data.b_direction,
          createddate: point_data.createddate,
          isdele: point_data.isdele,
        })
      }
    }

    res.status(200).json({ issuccess: true, data: datas.sort((a, b) => b.modeid - a.modeid) });
    logs.info(`get station pointmachine end`);
  } catch (ex) {
    logs.error('Pointmachine page error Api (getstationpointmachine)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point machine data based on start , end and paginaion
pointmachine.get("/getstationpointmachinedata", validuser, async (req, res) => {
  logs.info(`get station pointmachine  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid
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
    where_condition.pointmachineid = pointmachineid;
    where_condition.log = 1;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await PointMachineData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await PointMachineData.findAll({
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
        var get_list = await PointMachineData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineData.findAll({
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
      "get point machine data logs ended"
    );
  }
  catch (ex) {
    logs.error('Pointmachine page error Api (getstationpointmachinedata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//get the selected point machine current data based on paginaion
pointmachine.get("/getstationpointmachinecurrentdata", validuser, async (req, res) => {
  logs.info(`get station pointmachine current  data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid
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
    where_condition.pointmachineid = parseInt(pointmachineid);
    where_condition.log = 1;
    logs.info("where condition is : " + where_condition);

    var total_data_count = await PointMachineData.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await PointMachineData.findAll({
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
        var get_list = await PointMachineData.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineData.findAll({
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
      "get point machine current data  ended"
    );
  }
  catch (ex) {
    logs.error('Pointmachine page error Api (getstationpointmachincurrentedata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point machine alert logs based on start,end and paginaion
pointmachine.get("/getstationpointmachinealert", validuser, async (req, res) => {
  try {
    logs.info(
      "get pointmachine alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

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
    where_condition.pointmachineid = pointmachineid;
    logs.info("where condition is : " + where_condition);


    var total_data_count = await PointMachineAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await PointMachineAlert.findAll({
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
        var get_list = await PointMachineAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineAlert.findAll({
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
      "get point machine alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Pointmachine page error Api (getstationpointmachinealert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point machine cureent alert logs based on  paginaion
pointmachine.get("/getstationpointmachinecurrentalert", validuser, async (req, res) => {
  try {
    logs.info(
      "get pointmachine current alert  started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

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
    where_condition.pointmachineid = pointmachineid;
    logs.info("where condition is : " + where_condition);


    var total_data_count = await PointMachineAlert.count({
      where: where_condition,
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await PointMachineAlert.findAll({
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
        var get_list = await PointMachineAlert.findAll({
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
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineAlert.findAll({
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
      "get point machine current alert  ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Pointmachine page error Api (getstationpointmachinecurrentalert)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point machine data graph based on start,end and  time
pointmachine.get("/getstationpointmachinedatagraph", validuser, async (req, res) => {
  try {
    logs.info(`get station pointmachine data graph started`);

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid
    const date = req.query.date
    const from_time = req.query.from_time
    const to_time = req.query.to_time

    var from_date = new Date(new Date(date).setHours(parseFloat(from_time.split(':')[0]), parseFloat(from_time.split(':')[1]), 0, 0));
    var to_date = new Date(new Date(date).setHours(parseFloat(to_time.split(':')[0]), parseFloat(to_time.split(':')[1]), 0, 0));

    logs.info(req.query);
    //console.log(req.query);        

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await PointMachineData.findAll({
        where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, pointmachineid: pointmachineid, log: 1 },
        order: [["id", "ASC"]],
      });
      global.gc()
      let results = []
      for await (var element of get_list) {
        results.push({
          pointmachineid: element.pointmachineid,
          direction: element.direction,
          pointcyclecount: element.pointcyclecount,
          a_direction: element.a_direction,
          a_cyclecount: element.a_cyclecount,
          a_indication_voltage: element.a_indication_voltage,
          a_current_max: element.a_current_max,
          a_current_avg: element.a_current_avg,
          a_voltage: element.a_voltage,
          a_time: element.a_time,
          a_vibration_x: element.a_vibration_x,
          a_vibration_y: element.a_vibration_y,
          a_vibration_z: element.a_vibration_z,
          b_direction: element.b_direction,
          b_cyclecount: element.b_cyclecount,
          b_indication_voltage: element.b_indication_voltage,
          b_current_max: element.b_current_max,
          b_current_avg: element.b_current_avg,
          b_voltage: element.b_voltage,
          b_time: element.b_time,
          b_vibration_x: element.b_vibration_x,
          b_vibration_y: element.b_vibration_y,
          b_vibration_z: element.b_vibration_z,
          time: moment(element.createddate).format("HH:mm")
        })
      }
      res.status(200).json({ issuccess: true, data: results });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineData.findAll({
          where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, pointmachineid: pointmachineid, log: 1 },
          order: [["id", "ASC"]],
        });
        global.gc()
        let results = []
        for await (var element of get_list) {
          results.push({
            pointmachineid: element.pointmachineid,
            direction: element.direction,
            pointcyclecount: element.pointcyclecount,
            a_direction: element.a_direction,
            a_cyclecount: element.a_cyclecount,
            a_indication_voltage: element.a_indication_voltage,
            a_current_max: element.a_current_max,
            a_current_avg: element.a_current_avg,
            a_voltage: element.a_voltage,
            a_time: element.a_time,
            a_vibration_x: element.a_vibration_x,
            a_vibration_y: element.a_vibration_y,
            a_vibration_z: element.a_vibration_z,
            b_direction: element.b_direction,
            b_cyclecount: element.b_cyclecount,
            b_indication_voltage: element.b_indication_voltage,
            b_current_max: element.b_current_max,
            b_current_avg: element.b_current_avg,
            b_voltage: element.b_voltage,
            b_time: element.b_time,
            b_vibration_x: element.b_vibration_x,
            b_vibration_y: element.b_vibration_y,
            b_vibration_z: element.b_vibration_z,
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
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineData.findAll({
          where: { createddate: { [Op.gt]: from_date, [Op.lt]: to_date }, pointmachineid: pointmachineid, log: 1 },
          order: [["id", "ASC"]],
        });
        global.gc()
        let results = []
        for await (var element of get_list) {
          results.push({
            pointmachineid: element.pointmachineid,
            direction: element.direction,
            pointcyclecount: element.pointcyclecount,
            a_direction: element.a_direction,
            a_cyclecount: element.a_cyclecount,
            a_indication_voltage: element.a_indication_voltage,
            a_current_max: element.a_current_max,
            a_current_avg: element.a_current_avg,
            a_voltage: element.a_voltage,
            a_time: element.a_time,
            a_vibration_x: element.a_vibration_x,
            a_vibration_y: element.a_vibration_y,
            a_vibration_z: element.a_vibration_z,
            b_direction: element.b_direction,
            b_cyclecount: element.b_cyclecount,
            b_indication_voltage: element.b_indication_voltage,
            b_current_max: element.b_current_max,
            b_current_avg: element.b_current_avg,
            b_voltage: element.b_voltage,
            b_time: element.b_time,
            b_vibration_x: element.b_vibration_x,
            b_vibration_y: element.b_vibration_y,
            b_vibration_z: element.b_vibration_z,
            time: moment(element.createddate).format("HH:mm")
          })
        }
        res.status(200).json({ issuccess: true, data: results });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get point machine data graph ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Pointmachine page error Api (getstationpointmachinedatagraph)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point machine latest data 
pointmachine.get("/getfinaldata", validuser, async (req, res) => {
  logs.info(`get station pointmachine  final data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

    logs.info(req.query);
    //console.log(req.query);

    var get_finalpointmachine_datas = await PointMachineData.findOne({ limit: 1, where: { isdele: false, pointmachineid: pointmachineid }, order: [["id", "DESC"]], raw: true });
    get_finalpointmachine_datas = get_finalpointmachine_datas !== null ? [get_finalpointmachine_datas] : []

    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_finalpointmachine_datas });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_finalpointmachine_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_finalpointmachine_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get point machine data logs ended"
    );
  }
  catch (ex) {
    logs.error('Pointmachine page error Api (getfinaldata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});

//post point machine data from http
pointmachine.post("/pointmachinedatas", validuser, async (req, res) => {
  logs.info("Point Machine data started");
  logs.info(req.body);

  let transaction = await db.transaction({ autocommit: false })
  try {
    logs.info(req.body);
    const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
      current_Date = moment().format("YYYY-MM-DD");

    const data = {
      pointmachineid: req.body.id,
      direction: req.body.direction,
      pointcyclecount: req.body.pointcyclecount,
      a_direction: req.body.a_direction,
      a_current_max: req.body.a_current_max,
      a_current_avg: req.body.a_current_avg,
      a_time: req.body.a_time,
      a_dc_voltage: req.body.a_dc_voltage,
      a_vibration_x: req.body.a_vibrationx,
      a_vibration_y: req.body.a_vibrationy,
      a_vibration_z: req.body.a_vibrationz,
      b_direction: req.body.b_direction,
      b_current_max: req.body.b_current_max,
      b_current_avg: req.body.b_current_avg,
      b_time: req.body.b_time,
      b_dc_voltage: req.body.b_dc_voltage,
      b_vibration_x: req.body.b_vibration_x,
      b_vibration_y: req.body.b_vibration_y,
      b_vibration_z: req.body.b_vibration_z,
      createddate: current_datetime,
      isdele: false
    }

    const create_data = await PointMachineData.create(
      {
        data
      },
      { transaction: transaction }
    );

    logs.info("Point Machine data inserted");
    await transaction.commit()
    res.status(200).json({ issuccess: true, msg: "Data inserted succesfully" })
  }
  catch (ex) {
    // await transaction.rollback()
    logs.error('Pointmachine page error Api (pointmachinedatas)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//download the selected point machine data based on start,end and paginaion
pointmachine.get("/downloadpointmachinedatareport", validuser, async (req, res) => {
  try {
    logs.info(
      "get point machine data report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

    const pointmachinename = await RegisteredPointMachine.findOne({ where: { id: pointmachineid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("PointMachineData");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "PointMachineDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 7 },
      // { header: "Station Name", key: "stationname", width: 14 },
      { header: "PointMachine Name", key: "pointmachinename", width: 20 },
      { header: "A Indication", key: "a_direction", width: 12 },
      // { header: "A Cycle Count", key: "a_cyclecount", width: 14 },
      { header: "A Current Max/Avg(A)", key: "a_current_max", width: 18 },
      // { header: "A Current Avg (ma)", key: "a_current_avg", width: 12 },
      { header: "A Vdc", key: "a_voltage", width: 7 },
      { header: "A Indication(Vdc)", key: "a_indication_voltage", width: 18 },
      { header: "A Operation Time(sec)", key: "a_time", width: 20 },
      { header: "A Vibration-X(ma)", key: "a_vibration_x", width: 17 },
      { header: "A Vibration-Y(ma)", key: "a_vibration_y", width: 17 },
      { header: "A Vibration-Z(ma)", key: "a_vibration_z", width: 17 },

      //Currently we are showing only one pointmachine data so no need to display B point in this table //
      { header: "B Indication", key: "b_direction", width: 12 },
      // { header: "B Cycle Count", key: "b_cyclecount", width: 14 },
      { header: "B Current Max/Avg(A)", key: "b_current_max", width: 18 },
      // { header: "B Current Avg", key: "b_current_avg", width: 12 },
      { header: "B Vdc", key: "b_voltage", width: 7 },
      { header: "B Indication(Vdc)", key: "b_indication_voltage", width: 18 },
      { header: "B peration Time(sec)", key: "b_time", width: 20 },
      { header: "B vibration-X", key: "b_vibration_x", width: 17 },
      { header: "B vibration-Y", key: "b_vibration_y", width: 17 },
      { header: "B vibration-Z", key: "b_vibration_z", width: 17 },
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
    where_condition.pointmachineid = pointmachineid;
    where_condition.log = 1;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await PointMachineData.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          // stationname: stationname.stationname,
          pointmachinename: pointmachinename.pointmachinename + ' @' + stationname.stationname,
          a_direction: element.a_direction,
          // a_cyclecount: element.a_cyclecount,
          a_indication_voltage: element.a_indication_voltage,
          a_current_max: element.a_current_max + '/' + element.a_current_avg,
          // a_current_avg: element.a_current_avg,
          a_voltage: element.a_voltage,
          a_time: element.a_time,
          a_vibration_x: element.a_vibration_x,
          a_vibration_y: element.a_vibration_y,
          a_vibration_z: element.a_vibration_z,
          b_direction: element.b_direction,
          //b_cyclecount: element.b_cyclecount,
          b_indication_voltage: element.b_indication_voltage,
          b_current_max: element.b_current_max + '/' + element.b_current_avg,
          //b_current_avg: element.b_current_avg,
          b_voltage: element.b_voltage,
          b_time: element.b_time,
          b_vibration_x: element.b_vibration_x,
          b_vibration_y: element.b_vibration_y,
          b_vibration_z: element.b_vibration_z,
          createddate: moment(element.createddate).format(
            "YYYY-MM-DD HH:mm:ss"
          ),
        });
        sno++;
      }

      // Add Array Rows
      if (list.length > 0) {
        worksheet.addRows(list);

        //console.log(list.length);
        await workbook.xlsx.write(res).then(function () {
          res.status(200).end();
          //console.log(`sent successfully`);
        });
      } else {
        res.status(201).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
      }
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })
      if (access_check != null) {
        var get_list = await PointMachineData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            pointmachinename: pointmachinename.pointmachinename + ' @' + stationname.stationname,
            a_direction: element.a_direction,
            // a_cyclecount: element.a_cyclecount,
            a_indication_voltage: element.a_indication_voltage,
            a_current_max: element.a_current_max + '/' + element.a_current_avg,
            // a_current_avg: element.a_current_avg,
            a_voltage: element.a_voltage,
            a_time: element.a_time,
            a_vibration_x: element.a_vibration_x,
            a_vibration_y: element.a_vibration_y,
            a_vibration_z: element.a_vibration_z,
            b_direction: element.b_direction,
            //b_cyclecount: element.b_cyclecount,
            b_indication_voltage: element.b_indication_voltage,
            b_current_max: element.b_current_max + '/' + element.b_current_avg,
            //b_current_avg: element.b_current_avg,
            b_voltage: element.b_voltage,
            b_time: element.b_time,
            b_vibration_x: element.b_vibration_x,
            b_vibration_y: element.b_vibration_y,
            b_vibration_z: element.b_vibration_z,
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        if (list.length > 0) {
          worksheet.addRows(list);

          //console.log(list.length);
          await workbook.xlsx.write(res).then(function () {
            res.status(200).end();
            //console.log(`sent successfully`);
          });
        } else {
          res.status(201).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
        }
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    else if (user_role == "Employee") {
      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineData.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            // stationname: stationname.stationname,
            pointmachinename: pointmachinename.pointmachinename + ' @' + stationname.stationname,
            a_direction: element.a_direction,
            // a_cyclecount: element.a_cyclecount,
            a_indication_voltage: element.a_indication_voltage,
            a_current_max: element.a_current_max + '/' + element.a_current_avg,
            // a_current_avg: element.a_current_avg,
            a_voltage: element.a_voltage,
            a_time: element.a_time,
            a_vibration_x: element.a_vibration_x,
            a_vibration_y: element.a_vibration_y,
            a_vibration_z: element.a_vibration_z,
            b_direction: element.b_direction,
            //b_cyclecount: element.b_cyclecount,
            b_indication_voltage: element.b_indication_voltage,
            b_current_max: element.b_current_max + '/' + element.b_current_avg,
            //b_current_avg: element.b_current_avg,
            b_voltage: element.b_voltage,
            b_time: element.b_time,
            b_vibration_x: element.b_vibration_x,
            b_vibration_y: element.b_vibration_y,
            b_vibration_z: element.b_vibration_z,
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        if (list.length > 0) {
          worksheet.addRows(list);

          //console.log(list.length);
          await workbook.xlsx.write(res).then(function () {
            res.status(200).end();
            //console.log(`sent successfully`);
          });
        } else {
          res.status(201).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
        }
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    logs.info(
      "get point machine report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Pointmachine page error Api (downloadpointmachinedatareport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

// //download the selected point machine data based on start,end and paginaion
// pointmachine.get("/downloadpointmachinedatareport", validuser, async (req, res) => {
//   try {
//     logs.info("get point machine data report started");

//     const user_id = JwtDecode(req.token).Userid;
//     const user_role = JwtDecode(req.token).Roles;
//     const stationid = req.query.stationid;
//     const pointmachineid = req.query.pointmachineid;
//     const start_date = req.query.start_date ? moment(req.query.start_date).format("YYYY-MM-DD") : moment().startOf('month').format('YYYY-MM-DD');
//     const end_Date = req.query.end_date ? moment(req.query.end_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
//     const page = req.query.page ? parseInt(req.query.page) : 1;
//     const size = req.query.size ? parseInt(req.query.size) : 10;

//     logs.info(`${start_date} - start date //// ${end_Date} - end date`);
//     logs.info(req.query);

//     const where_condition = {
//       createddate: {
//         [Op.between]: [start_date, end_Date]
//       },
//       isdele: false,
//       pointmachineid,
//       log: 1
//     };

//     // Add role-specific conditions
//     if (user_role === "Station Incharge") {
//       const access_check = await StationAccess.findOne({
//         where: { stationid, userid: user_id, isdele: false }
//       });
//       if (!access_check) {
//         return res.status(400).json({ issuccess: false, msg: "You don't have access to download logs" });
//       }
//     } else if (user_role === "Employee") {
//       const access_check = await NotificationControl.findOne({
//         where: { stationid, userid: user_id, assertsid: 1, isdele: false }
//       });
//       if (!access_check) {
//         return res.status(400).json({ issuccess: false, msg: "You don't have access to download logs" });
//       }
//     }

//     const options = {
//       where: where_condition,
//       order: [["id", "DESC"]],
//       raw: true
//     };

//     const { count, rows } = await PointMachineData.findAndCountAll(options);

//     if (count === 0) {
//       return res.status(201).json({ issuccess: false, msg: "No data available" });
//     }

//     // Fetch related data
//     const pointmachinename = await RegisteredPointMachine.findOne({ where: { id: pointmachineid, isdele: false } });
//     const stationname = await RegisteredRailwayStations.findOne({ where: { id: stationid, isdele: false } });

//     const rowData = rows.map((element, index) => ({
//       Id: index + 1,
//       pointmachinename: `${pointmachinename.pointmachinename} @ ${stationname.stationname}`,
//       a_direction: element.a_direction,
//       a_indication_voltage: element.a_indication_voltage,
//       a_current_max: `${element.a_current_max}/${element.a_current_avg}`,
//       a_voltage: element.a_voltage,
//       a_time: element.a_time,
//       a_vibration_x: element.a_vibration_x,
//       a_vibration_y: element.a_vibration_y,
//       a_vibration_z: element.a_vibration_z,
//       b_direction: element.b_direction,
//       b_indication_voltage: element.b_indication_voltage,
//       b_current_max: `${element.b_current_max}/${element.b_current_avg}`,
//       b_voltage: element.b_voltage,
//       b_time: element.b_time,
//       b_vibration_x: element.b_vibration_x,
//       b_vibration_y: element.b_vibration_y,
//       b_vibration_z: element.b_vibration_z,
//       createddate: moment(element.createddate).format("YYYY-MM-DD HH:mm:ss")
//     }));

//     // Create Excel workbook and worksheet
//     const workbook = new excel.Workbook();
//     const worksheet = workbook.addWorksheet("PointMachineData");

//     // Set columns
//     worksheet.columns = [
//       { header: "S.No", key: "Id", width: 7 },
//       { header: "PointMachine Name", key: "pointmachinename", width: 20 },
//       { header: "A Indication", key: "a_direction", width: 12 },
//       { header: "A Current Max/Avg(A)", key: "a_current_max", width: 18 },
//       { header: "A Vdc", key: "a_voltage", width: 7 },
//       { header: "A Indication(Vdc)", key: "a_indication_voltage", width: 18 },
//       { header: "A Operation Time(sec)", key: "a_time", width: 20 },
//       { header: "A Vibration-X(ma)", key: "a_vibration_x", width: 17 },
//       { header: "A Vibration-Y(ma)", key: "a_vibration_y", width: 17 },
//       { header: "A Vibration-Z(ma)", key: "a_vibration_z", width: 17 },
//       { header: "B Indication", key: "b_direction", width: 12 },
//       { header: "B Current Max/Avg(A)", key: "b_current_max", width: 18 },
//       { header: "B Vdc", key: "b_voltage", width: 7 },
//       { header: "B Indication(Vdc)", key: "b_indication_voltage", width: 18 },
//       { header: "B peration Time(sec)", key: "b_time", width: 20 },
//       { header: "B vibration-X", key: "b_vibration_x", width: 17 },
//       { header: "B vibration-Y", key: "b_vibration_y", width: 17 },
//       { header: "B vibration-Z", key: "b_vibration_z", width: 17 },
//       { header: "CreatedDate", key: "createddate", width: 20 }
//     ];

//     worksheet.properties.defaultRowHeight = 20;
//     worksheet.addRows(rowData);

//     // Stream Excel file to response
//     res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
//     res.setHeader("Content-Disposition", "attachment; filename=PointMachineDataReport.xlsx");
//     await workbook.xlsx.write(res);

//     logs.info("get point machine report ended");
//   } catch (ex) {
//     logs.error(`Pointmachine page error Api (downloadpointmachinedatareport): ${ex}`);
//     res.status(400).json({ issuccess: false, msg: "Something went wrong. Please try again later." });
//   }  
// });

//download the selected point machine alert based on start,end and paginaion
pointmachine.get("/downloadpointmachinealertreport", validuser, async (req, res) => {
  try {
    logs.info(
      "get point machine alert report started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email;    
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

    const pointmachinename = await RegisteredPointMachine.findOne({ where: { id: pointmachineid, isdele: false } })

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
    let worksheet = workbook.addWorksheet("PointMachineAlert");

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "PointMachineAlertReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
    );

    //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

    worksheet.columns = [
      { header: "S.No", key: "Id", width: 5 },
      { header: "PointMachine Name", key: "pointmachinename", width: 20 },
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
    where_condition.pointmachineid = pointmachineid;
    logs.info("where condition is : " + where_condition);

    if (user_role == "Admin" || user_role == "Super Admin") {

      var get_list = await PointMachineAlert.findAll({
        where: where_condition,
        order: [["id", "DESC"]],
        raw: true,
      });
      global.gc()
      for await (const element of get_list) {
        list.push({
          Id: sno, //element.id,
          pointmachinename: pointmachinename.pointmachinename + ' @' + stationname.stationname,
          message: element.message,
          mode: lodash.result(lodash.find(alertmodes, { 'id': element.modeid }), 'mode'),
          createddate: moment(element.createddate).format(
            "YYYY-MM-DD HH:mm:ss"
          ),
        });
        sno++;
      }
      // Add Array Rows
      if (list.length > 0) {
        worksheet.addRows(list);

        //console.log(list.length);
        await workbook.xlsx.write(res).then(function () {
          res.status(200).end();
          //console.log(`sent successfully`);
        });
      } else {
        res.status(201).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
      }
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })
      if (access_check != null) {
        var get_list = await PointMachineAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            pointmachinename: pointmachinename.pointmachinename + ' @' + stationname.stationname,
            message: element.message,
            mode: lodash.result(lodash.find(alertmodes, { 'id': element.modeid }), 'mode'),
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        if (list.length > 0) {
          worksheet.addRows(list);

          //console.log(list.length);
          await workbook.xlsx.write(res).then(function () {
            res.status(200).end();
            //console.log(`sent successfully`);
          });
        } else {
          res.status(201).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
        }
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    else if (user_role == "Employee") {
      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineAlert.findAll({
          where: where_condition,
          order: [["id", "DESC"]],
          raw: true,
        });
        global.gc()
        for await (const element of get_list) {
          list.push({
            Id: sno, //element.id,
            pointmachinename: pointmachinename.pointmachinename + ' @' + stationname.stationname,
            message: element.message,
            mode: lodash.result(lodash.find(alertmodes, { 'id': element.modeid }), 'mode'),
            createddate: moment(element.createddate).format(
              "YYYY-MM-DD HH:mm:ss"
            ),
          });
          sno++;
        }
        // Add Array Rows
        if (list.length > 0) {
          worksheet.addRows(list);

          //console.log(list.length);
          await workbook.xlsx.write(res).then(function () {
            res.status(200).end();
            //console.log(`sent successfully`);
          });
        } else {
          res.status(201).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
        }
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to download logs" });
      }
    }
    logs.info(
      "get point machine alert report ended"
    );
  } catch (ex) {
    //console.log(ex);
    logs.error('Pointmachine page error Api (downloadpointmachinealertreport)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point machine alert logs based on start,end and paginaion for mobile without data
pointmachine.get("/getstationpointmachinealertmobile", validuser, async (req, res) => {
  try {
    logs.info(
      "get pointmachine alert logs started"
    );

    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

    let page = 1,
      size = 10;
    if (req.query.page != "") {
      (page = parseInt(req.query.page)), (size = parseInt(req.query.size));
    }

    logs.info(req.query);
    //console.log(req.query);


    var total_data_count = await PointMachineAlert.count({
      where: { isdele: false, pointmachineid: pointmachineid },
      order: [["id", "DESC"]],
    });

    if (user_role == "Admin" || user_role == "Super Admin") {
      var get_list = await PointMachineAlert.findAll({
        where: { isdele: false, pointmachineid: pointmachineid },
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
        var get_list = await PointMachineAlert.findAll({
          where: { isdele: false, pointmachineid: pointmachineid },
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
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        var get_list = await PointMachineAlert.findAll({
          where: { isdele: false, pointmachineid: pointmachineid },
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
      "get point machine alert logs ended"
    );
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Pointmachine page error Api (getstationpointmachinealertmobile)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }
});

//get the selected point circuit latest data 
pointmachine.get("/getstationpointmachinefinaldata", validuser, async (req, res) => {
  logs.info(`get station pointmachine final data started`);
  try {
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    //user_mail = JwtDecode(req.token).Email; 
    const stationid = req.query.stationid
    const pointmachineid = req.query.pointmachineid

    logs.info(req.query);
    //console.log(req.query);

    const pointmachinename = await RegisteredPointMachine.findOne({ where: { id: pointmachineid, isdele: false } })   

    var get_finalpointmachineid_datas = await PointMachineData.findOne({ limit: 1, where: { isdele: false, pointmachineid: pointmachineid }, order: [["id", "DESC"]], raw: true });

    if (get_finalpointmachineid_datas != null) {
      get_finalpointmachineid_datas.pointmachinename = pointmachinename.pointmachinename     
    }
    if (user_role == "Admin" || user_role == "Super Admin") {
      res.status(200).json({ issuccess: true, data: get_finalpointmachineid_datas });
    }
    else if (user_role == "Station Incharge") {

      const access_check = await StationAccess.findOne(
        { where: { stationid: stationid, userid: user_id, isdele: false } })

      if (access_check != null) {

        res.status(200).json({ issuccess: true, data: get_finalpointmachineid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    else if (user_role == "Employee") {

      const access_check = await NotificationControl.findOne(
        { where: { stationid: stationid, userid: user_id, assertsid: 1, isdele: false } })

      if (access_check != null) {
        res.status(200).json({ issuccess: true, data: get_finalpointmachineid_datas });
      }
      else {
        res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
      }
    }
    logs.info(
      "get point machine data logs ended"
    );
  }
  catch (ex) {
    logs.error('Pointmachine page error Api (getstationpointmachinefinaldata)' + ex);
    res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
  }

});


module.exports = pointmachine;