const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const bparser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
const lodash = require("lodash");
//const nodemailer = require("nodemailer");
const { Sequelize, Op } = require("sequelize");
const log4js = require("../../log4js");
const logs = log4js.logger;

const notification_ = express.Router();

const app = new express();
app.use(express.json());

const db = require("../../config/db").db;
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredUserDetails = require("../../models/registereduserdetails");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const Asserts = require("../../models/asserts");
const { validuser } = require("../../login/verifytoken");
const mail = require("../../services/mail");
const notification = require("./notification");

//add notification to users based on asserts
notification_.post("/addNotificationSendToUsers", validuser, async (req, res) => {
  try {
    logs.info("Add Asserts notifications to users started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (user_role == "Admin" || user_role == "Station Incharge") {
      let transaction = await db.transaction({ autocommit: false });
      try {
        //console.log(req.body);
        logs.info(req.body)
        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");
        const assertids = req.body.assertsids,
          stationids = req.body.stationids,
        userids = req.body.userids

        const notification_list = [];

        const value = await NotificationControl.findAll({
          where: { stationid: { [Op.in]: stationids }, assertsid: { [Op.in]: assertids }, isdele: false,},
          raw: true,
        });

        for await (const stationelement of stationids) {

          for await (const assertelemnent of assertids) {

            const get_existing_list = await NotificationControl.findAll({
              where: { stationid: stationelement, assertsid: assertelemnent, isdele: false, },
              raw: true,
            });

            for await (const userelement of userids) {

              var check_existing = lodash.filter(get_existing_list, {
                userid: userelement,
              });

              if (check_existing.length == 0) {
                notification_list.push({
                  stationid: stationelement,
                  assertsid: assertelemnent,
                  userid: userelement,
                  deletedby_id: null,
                  deleteddate: null,
                  createdby_id: user_id,
                  createddate: current_datetime,
                  isdele: false,
                });
              }

            }
          }
        }

        // await stationids.forEach(async (stationelement) => {
        //   console.log('test1')
        //   await assertids.forEach(async (assertelemnent) => {
        //     console.log('test2')
        //     const get_existing_list = await NotificationControl.findAll({
        //       where: { stationid: stationelement,assertsid: assertelemnent, isdele: false,},
        //       raw: true,
        //     });    
        //     await userids.forEach(async (userelement) => {
        //       console.log('test3')
        //       var check_existing = lodash.filter(get_existing_list, {
        //         userid: userelement,
        //       });

        //       if (check_existing.length == 0) {
        //         console.log('test4')

        //         await notification_list.push({
        //           stationid: stationelement,
        //           assertsid: assertelemnent,
        //           userid: userelement,
        //           deletedby_id:null,
        //           deleteddate:null,
        //           createdby_id: user_id,
        //           createddate: current_datetime,
        //           isdele: false,
        //         });
        //         let datass = {
        //           stationid: stationelement,
        //           assertsid: assertelemnent,
        //           userid: userelement,
        //           deletedby_id:null,
        //           deleteddate:null,
        //           createdby_id: user_id,
        //           createddate: current_datetime,
        //           isdele: false,
        //         }
        //         const add_notification = await NotificationControl
        //           .create(datass, { transaction: transaction })
        //           .then((datas) => {
        //             console.log('success',datas);
        //           }).catch((ex) => {
        //             console.log('error',datas);
        //           });
        //         await transaction.commit()
        //       }         
        //     });
        //   })
        // });

        if (notification_list.length > 0) {
          const add_notification = await NotificationControl
            .bulkCreate(notification_list, { transaction: transaction })
            .then((datas) => {
              //console.log('success');
            }).catch((err) => {
              //console.log('failure')
            });
          await transaction.commit()
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully Added" });
          logs.info("Add assert notifications to users ended");
        } else {
          //console.log(`Given assert is already assigned for these Users`);
          logs.error(`Given assert is already assigned for this user`);
          res.status(400).json({
            issuccess: false,
            msg: `Given assert is already assigned for this user`,
          });
        }
      } catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error(ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in notification control page. Api - (addNotificationSendToUsers)`,
          ex
        );
      }
    } else {
      //console.log(`Admin only access this page`);
      logs.error(`Admin only access this page`);
      res
        .status(400)
        .json({ issuccess: false, msg: `Admin only access this page.` });
    }
  } catch (er) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification control page. Api - (addNotificationSendToUsers)`,
      ex
    );
  }
}
);

//delete notification to users based on asserts
notification_.put("/deleteNotificationTOUsers", validuser, async (req, res) => {
  try {
    logs.info("Delete assert notifications to users started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (user_role == "Admin" || user_role == "Station Incharge") {
      let transaction = await db.transaction({ autocommit: false });

      try {
        //console.log(req.body);
        logs.info(req.body);
        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");
        const id = req.body.id;

        const delete_notification = await NotificationControl.update(
          {
            deletedby_id: user_id,
            deleteddate: current_datetime,
            isdele: true,
          },
          { where: { id } },
          { transaction: transaction }
        );

        logs.info("Successfully Deleted");
        res.status(200).json({ issuccess: true, msg: "Successfully Deleted" });
        logs.info("Delete assert notifications to users end");
        //console.log(`Delete assert notifications to users end`);
        await transaction.commit();
      } catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error(ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in notification control page. Api - (deleteNotificationTOUsers)`,
          ex
        );
      }
    } else {
      logs.info("Admin Only access this page.");
      //console.log("Admin Only access this page.");
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  } catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in notification control page. Api - (deleteNotificationTOUsers)`,
      ex
    );
  }
});

//get notification of users based on asserts
notification_.get("/getNotificationUsersDetails", validuser, async (req, res) => {
  try {
    logs.info("get Notification table list page started");
    //console.log("get Notification table list page started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles;
    user_mail = JwtDecode(req.token).Email;

    // var email_list = [];
    // var assert_list = [];
    // var station_list = [];
    // var user_list = [];

    //console.log(req.query);
    logs.info(req.body);
    if (user_role == "Admin") {

      // const get_notification_list = await NotificationControl.findAll({
      //   attributes :["id","stationid","assertsid","userid"],
      //   where: { isdele: false },
      //   order: [["id", "DESC"]],
      //   raw: true,
      // });

      // const get_users = await RegisteredUserDetails.findAll();     
      // var get_asserts = await Asserts.findAll();       
      // var get_stations = await RegisteredRailwayStations.findAll({where: { isdele: false },raw: true,});


      // let list = [];
      // await get_notification_list.forEach(async (element) => {
      //   var users = lodash.filter(get_users, {
      //     id: element.dataValues.userid,
      //   });

      //   var asserts = lodash.filter(get_asserts, {
      //     id: element.dataValues.assertsid,
      //   });  
      //   var stations = lodash.filter(get_stations, {
      //     id: element.dataValues.stationid,
      //   });   
      //   if (users.length > 0 && asserts.length > 0 && stations.length > 0) {   
      //     await list.push({
      //       sno: element.dataValues.id,
      //       assertid: element.dataValues.assertsid,
      //       assertname: asserts[0].dataValues.assertname,
      //       stationname: stations[0].dataValues.stationname,
      //       username: users[0].dataValues.username,
      //       email: users[0].dataValues.email,              
      //     });
      //   }
      // });   

      //const data = await db.query('SELECT n.id,n.assertsid,a.assertname,r.stationname,u.username,u.email  from public."NotificationControl" as n JOIN public."RegisteredUserDetails" as u ON u.id = n.userid   JOIN public."Asserts" as a ON a.id = n.assertsid   JOIN public."RegisteredRailwayStations" as r ON r.id = n.stationid  where n.isdele = false order by r.id, a.id, u.id')

      // data[0].map(item => {
      //   let stationdata = {
      //     text : item.stationname,
      //     value : item.stationname 
      //   } 
      //   let assertdata = {
      //     text : item.assertname,
      //     value : item.assertname 
      //   } 
      //   let userdata = {
      //     text : item.username,
      //     value : item.username 
      //   } 
      //   let emaildata = {
      //     text : item.email,
      //     value : item.email 
      //   } 
      //   var stationcheck = lodash.find(station_list, stationdata);
      //   if(stationcheck === undefined || stationcheck === null)
      //   {
      //     station_list.push(stationdata)
      //   } 
      //   var assertscheck = lodash.find(assert_list, assertdata);   
      //   if(assertscheck === undefined || assertscheck === null)
      //   {
      //     assert_list.push(assertdata)
      //   }  
      //   var usercheck = lodash.find(user_list, userdata);   
      //   if(usercheck === undefined || usercheck === null)
      //   {
      //     user_list.push(userdata)
      //   }   
      //   var emailcheck = lodash.find(email_list, emaildata);     
      //   if(emailcheck === undefined || emailcheck === null)
      //   {
      //     email_list.push(emaildata)
      //   }           
      // })

      NotificationControl.belongsTo(RegisteredUserDetails, { foreignKey: 'userid' });
      NotificationControl.belongsTo(Asserts, { foreignKey: 'assertsid' });
      NotificationControl.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

      // Sequelize query
      const datas = await NotificationControl.findAll({
        attributes: [
          'id',
          'assertsid',
          [Sequelize.literal('"Assert"."assertname"'), 'assertname'],
          [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
          [Sequelize.literal('"RegisteredUserDetail"."username"'), 'username'],
          [Sequelize.literal('"RegisteredUserDetail"."email"'), 'email'],
        ],
        include: [
          {
            model: RegisteredUserDetails,
            attributes: [],
            where: { isdele: false }
          },
          {
            model: Asserts,
            attributes: [],
            where: { isdele: false }
          },
          {
            model: RegisteredRailwayStations,
            attributes: [],
            where: { isdele: false }
          },
        ],
        where: {
          isdele: false,
        },
        raw: true,
        order: [
          [Sequelize.literal('"RegisteredRailwayStation"."id"')],
          [Sequelize.literal('"Assert"."id"')],
          [Sequelize.literal('"RegisteredUserDetail"."id"')],
        ],
      })

      logs.info("get Notification table list page ended")
      //console.log(list);
      //res.status(200).json({ issuccess: true, data: data[0], stationlist: station_list, assertlist: assert_list, userlist: user_list, emaillist: email_list});
      res.status(200).json({ issuccess: true, data: datas });
    } else if (user_role == "Station Incharge") {

      NotificationControl.belongsTo(RegisteredUserDetails, { foreignKey: 'userid' });
      NotificationControl.belongsTo(Asserts, { foreignKey: 'assertsid' });
      NotificationControl.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

      // Sequelize query
      const datas = await NotificationControl.findAll({
        attributes: [
          'id',
          'assertsid',
          [Sequelize.literal('"Assert"."assertname"'), 'assertname'],
          [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
          [Sequelize.literal('"RegisteredUserDetail"."username"'), 'username'],
          [Sequelize.literal('"RegisteredUserDetail"."email"'), 'email'],
        ],
        include: [
          {
            model: RegisteredUserDetails,
            attributes: [],
            where: { 'roles': user_role, isdele: false }
          },
          {
            model: Asserts,
            attributes: [],
            where: { isdele: false }
          },
          {
            model: RegisteredRailwayStations,
            attributes: [],
            where: { isdele: false }
          },
        ],
        where: {
          isdele: false,
        },
        raw: true,
        order: [
          [Sequelize.literal('"RegisteredRailwayStation"."id"')],
          [Sequelize.literal('"Assert"."id"')],
          [Sequelize.literal('"RegisteredUserDetail"."id"')],
        ],
      })

      logs.info("get Notification table list page ended")
      //console.log(list);
      //res.status(200).json({ issuccess: true, data: data[0], stationlist: station_list, assertlist: assert_list, userlist: user_list, emaillist: email_list});
      res.status(200).json({ issuccess: true, data: datas });
    }
    else {
      logs.info("Admin Only access this page.");
      // console.log("Admin Only access this page.");
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  } catch (ex) {
    //console.log(ex);
    logs.error(ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
  }
}
);

module.exports = notification_;
