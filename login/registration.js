const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const bparser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
const { Sequelize, Op } = require("sequelize");
const mail = require("../services/mail");
const log4js = require("../log4js");
const logs = log4js.logger;

const privateKey = process.env.JWT_SECREYKEY; //'INTELENSECIS@!#1';
//const encrypt_content = `#@!InteLensE07&#! ${moment().format("YYYYMMDD")}`;
const registeruser = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();

const Request_Url = process.env.DEFAULT_URL;
const encrypt_content = process.env.EMAIL_CHECK;

const db = require("../config/db").db;
const RegisteredUserDetails = require("../models/registereduserdetails");
const RegisteredUserDetailsLog = require("../models/registereduserdetailslog");
const UserRoles = require("../models/userrole");
const user_details = require("../models/user_details");
const { validuser } = require("./verifytoken");
const { log } = require("console");
// const notificationcontrol = require("../models/notificationcontrol");

//register user
registeruser.post("/registerUsers", validuser, async (req, res) => {
  try {
    logs.info("New user registration started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (user_role == "Admin" || user_role == "Station Incharge") {
      //console.log(req.body);
      logs.info(req.body);
      const username = req.body.name,
        id = user_id, //req.body.id,
        email = req.body.email.trim(),
        password = req.body.password,
        mobile_number = req.body.mobile_number,
        isdele = false,
        dob = req.body.Dob == null ? null : moment(req.body.Dob).format("YYYY-MM-DD"),
        roles = req.body.roles,
        gender = req.body.gender,
        VerificationCode = req.body.VerificationCode,
        mobile_access = req.body.mobile_access,
        isreadonly = req.body.isreadonly;

      //console.log(req.body.gender + " //// " + dob);

      const user_details_check = await RegisteredUserDetails.findAll({
        where: { email },
        raw: true,
      });
      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");
      if (user_details_check.length !== 0) {
        //console.log("Given email is already available.");
        logs.info("Given email is already available.");
        res
          .status(400)
          .json({ issuccess: false, msg: "Given email is aleady available" });
      } else {
        const { userstatus, ismobile_active } = "true",
          { ismail_verified, islock } = "false";
        const incorrect_password_attempt = 0;
        const password_hash = await bcrypt.hashSync(password, Number((process.env.saltRounds)));
        //console.log(password_hash);
        let transaction = await db.transaction({ autocommit: false });

        try {
          const register_user = await RegisteredUserDetails.create(
            {
              username,
              email,
              password: password_hash,
              userstatus,
              islock,
              ismail_verified,
              createddate: current_datetime,
              incorrect_password_attempt,
              isdele,
              mobile_access,
              mobile_number,
              ismobile_active,
              updateddate: current_datetime,
              roles,
              isreadonly,
            },
            { transaction: transaction }
          ); //updateddate:current_datetime,
          //console.log(register_user.id);
          const log_insert = await RegisteredUserDetailsLog.create(
            {
              username,
              userid: register_user.id,
              email: register_user.email,
              ismail_verified: register_user.ismail_verified,
              user_status: register_user.userstatus,
              islock: register_user.islock,
              incorrect_password_attempt: "false",
              mobile_access,
              mobile_number: register_user.mobile_number,
              ismobile_active: register_user.ismobile_active,
              updatedby_id: user_id,
              updateddate: current_datetime,
              isdele,
              roles, isreadonly,
            },
            { transaction: transaction }
          );
          //username,email,registrationdate,    VerificationCode,    createddate,    createdby_id,    gender,    user_registration_id,    dateofbirth,    isdele
          const create_user = await user_details.user_details.create(
            {
              gender,
              dateofbirth: dob,
              user_registration_id: register_user.id,
              VerificationCode,
              createdby_id: user_id,
              createddate: current_datetime,
              username,
              email,
              registrationdate: current_datetime,
              isdele,
            },
            { transaction: transaction }
          );

          const create_user_log = await user_details.user_detailslog.create(
            {
              email,
              VerificationCode,
              username,
              registrationdate: current_datetime,
              createddate: current_datetime,
              createdby_id: user_id,
              isdele: "false",
              gender,
              dateofbirth: dob,
              user_registration_id: register_user.id,
            },
            { transaction: transaction }
          );
          await transaction.commit();
          const email_hash = await bcrypt.hashSync(email, Number((process.env.saltRounds)));
          var subject = "Mail Verification";
          var to = email; //"aravindha.rajan@caliberinterconnect.net"; //email; //["aravindha.rajan@caliberinterconnect.net"],
          var cc = "";//process.env.MYGMAIL  //aravindharajan.j@gmail.com
          var link = `${Request_Url}account/activate?email=${email}&&enc1=${email_hash}`;
          //console.log(link);
          //     twitter_link = 'https://www.w3schools.com', facebook_link = 'https://www.w3schools.com';
          var mail_body = `<p>Please  <a href="${link}"> Click here</a> to activate the mail.</p> 
          <p> Kindly ues this password to Login ${password}. You can reset your password later.</p>`;
          // var hide_mail_id =
          //   to.split("@")[0].replace(/./gi, "X") + to.split("@")[1];

          //mail_body = `Hi Kindly veryfiy this mail id <br> testing`;
          logs.info(subject);
          logs.info(to);
          logs.info(to);
          logs.info(link);
          logs.info(mail_body);
          const status = await mail.mailSend(to, cc, subject, mail_body);
          res
            .status(200)
            .json({ issuccess: true, msg: "Registered Successfully" });
          logs.info("Successfully Registered");
        } catch (ex) {
          await transaction.rollback();
          //console.log(ex.message);
          logs.error('Registration page error Api (registerUsers)' + ex);
          res.status(400).json({ issuccess: false, msg: ex.message });
          mail.mailSendError(
            `Error in registration page. Api (registerUsers)`,
            ex
          );
        }
      }
    } else {
      logs.info("Admin Only access this page.");
      //console.log("Admin Only access this page.");
      res.status(401).json({ issuccess: false, msg: "Access Denied..." });
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('Registration page error Api (registerUsers)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
    mail.mailSendError(
      `Error in registration page. Api (registerUsers)`,
      ex
    );
  }
});

//edit the registered user
registeruser.put("/editUser", validuser, async (req, res) => {
  try {
    logs.info("User Edit started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (
      user_role == "Admin" ||
      user_role == "Super Admin" ||
      user_role == "Station Incharge"
    ) {
      let transaction = await db.transaction({ autocommit: false });
      try {
        const islock = req.body.islock,
          locked_reason = req.body.locked_reason,
          mobile_access = req.body.mobile_access,
          mobile_accessReson = req.body.mobile_accessReson,
          username = req.body.username,
          mobile_number = req.body.mobile_number,
          roles = req.body.roles,
          id = req.body.id,
          isreadonly = req.body.isreadonly;
        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");
        const get_user = await RegisteredUserDetails.findOne({ where: { id } });

        if (get_user != null) {
          const locked_period =
            get_user.islock == islock ? get_user.locked_period : current_Date;
          let incorrect_password_attempt;
          if (!islock) {
            incorrect_password_attempt =
              get_user.incorrect_password_attempt >= Number((process.env.LOGIN_ATTEMPT))
                ? 0
                : get_user.incorrect_password_attempt;
          }
          const update_registeruser = await RegisteredUserDetails.update(
            {
              username,
              mobile_number,
              islock,
              locked_reason,
              locked_period,
              mobile_access,
              mobile_accessReson,
              roles,
              isreadonly,
            },
            { where: { id } },
            { transaction: transaction }
          );

          //var locked_period = islock == true ?
          const log_insert = await RegisteredUserDetailsLog.create(
            {
              userid: id,
              username,
              email: get_user.email,
              ismail_verified: get_user.ismail_verified,
              user_status: get_user.userstatus,
              islock,
              locked_reason,
              locked_period,
              incorrect_password_attempt: "false",
              mobile_access,
              mobile_accessReson,
              mobile_number,
              ismobile_active: get_user.ismobile_active,
              updatedby_id: user_id,
              updateddate: current_datetime,
              isdele: get_user.isdele,
              roles: roles, isreadonly,
            },
            { transaction: transaction }
          );

          if (get_user.username != username) {
            const get_user_details = await user_details.user_details.findOne(
              { where: { user_registration_id: id } },
              { transaction: transaction }
            );
            const update_user = await user_details.user_details.update(
              {
                username,
              },
              { where: { user_registration_id: id } },
              { transaction: transaction }
            );

            const create_user_log = await user_details.user_detailslog.create(
              {
                email: get_user_details.email,
                VerificationCode: get_user_details.VerificationCode,
                username,
                registrationdate: get_user_details.registrationdate,
                createddate: current_datetime,
                createdby_id: user_id,
                isdele: "false",
                gender: get_user_details.gender,
                dateofbirth: get_user_details.dob,
                user_registration_id: id,
              },
              { transaction: transaction }
            );
          }

          logs.info("Successfully Updated");
          //console.log("Successfully Updated");
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully Updated" });
          await transaction.commit();
        } else {
          logs.info(`User Details not found`);
          // console.log(`User Details not found`);
          res
            .status(400)
            .json({ issuccess: false, msg: `User Details not found` });
        }
      } catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Registration page error Api (editUser)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in registration page. Api (editUser)`,
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
    logs.error('Registration page error Api (editUser)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(`Error in registration page. Api (editUser)`, ex);
  }
});

//edit the registered user from mobile
registeruser.put("/editUserFromMobile", validuser, async (req, res) => {
  try {
    logs.info("User Edit from mobile started");
    //console.log("User Edit from mobile started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (
      user_role == "Admin" ||
      user_role == "Super Admin" ||
      user_role == "Station Incharge"
    ) {
      let transaction = await db.transaction({ autocommit: false });
      try {
        //console.log(req.body);
        const islock = req.body.isLocked,
          locked_reason = req.body.locked_reason,
          id = req.body.id;
        // mobile_access = req.body.mobile_access,
        // mobile_accessReson = req.body.mobile_accessReson,
        // username = req.body.username,
        // mobile_number = req.body.mobile_number,
        // roles = req.body.roles,
        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
          current_Date = moment().format("YYYY-MM-DD");
        const get_user = await RegisteredUserDetails.findOne({ where: { id } });

        if (get_user != null) {
          const locked_period =
            get_user.islock == islock ? get_user.locked_period : current_Date;

          const update_registeruser = await RegisteredUserDetails.update(
            {
              islock,
              locked_reason,
              locked_period,
            },
            { where: { id } },
            { transaction: transaction }
          );

          //var locked_period = islock == true ?
          const log_insert = await RegisteredUserDetailsLog.create(
            {
              userid: id,
              username: get_user.username,
              email: get_user.email,
              ismail_verified: get_user.ismail_verified,
              user_status: get_user.userstatus,
              islock,
              locked_reason,
              locked_period,
              incorrect_password_attempt: "false",
              mobile_access: get_user.mobile_access,
              mobile_accessReson: get_user.mobile_accessReson,
              mobile_number: get_user.mobile_number,
              ismobile_active: get_user.ismobile_active,
              updatedby_id: user_id,
              updateddate: current_datetime,
              isdele: get_user.isdele,
              roles: get_user.roles,
            },
            { transaction: transaction }
          );

          if (get_user.username != username) {
            const get_user_details = await user_details.user_details.findOne(
              { where: { user_registration_id: id } },
              { transaction: transaction }
            );
            const update_user = await user_details.user_details.update(
              {
                username,
              },
              { where: { user_registration_id: id } },
              { transaction: transaction }
            );

            const create_user_log = await user_details.user_detailslog.create(
              {
                email: get_user_details.email,
                VerificationCode: get_user_details.VerificationCode,
                username,
                registrationdate: get_user_details.registrationdate,
                createddate: current_datetime,
                createdby_id: user_id,
                isdele: "false",
                gender: get_user_details.gender,
                dateofbirth: get_user_details.dob,
                user_registration_id: id,
              },
              { transaction: transaction }
            );
          }

          logs.info("Successfully Updated");
          //console.log("Successfully Updated");
          res
            .status(200)
            .json({ issuccess: true, msg: "Successfully Updated" });
          await transaction.commit();
        } else {
          logs.info(`User Details not found`);
          //console.log(`User Details not found`);
          res
            .status(400)
            .json({ issuccess: false, msg: `User Details not found` });
        }
      } catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Registration page error Api (editUserFromMobile)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in registration page. Api (editUserFromMobile)`,
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
    logs.error('Registration error Api (editUserFromMobile)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in registration page. Api (editUserFromMobile)`,
      ex
    );
  }
});

//delete the registered user
registeruser.put("/deleteUser", validuser, async (req, res) => {
  try {
    logs.info("User delete started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (user_role == "Admin" || user_role == "Station Incharge") {
      let transaction = await db.transaction({ autocommit: false });

      //console.log(req.body);
      const id = req.body.id,
        isdele_reason = req.body.reason;
      const get_user = await RegisteredUserDetails.findOne(
        { where: { id } },
        { transaction: transaction }
      );
      const get_userdetails = await user_details.user_details.findOne(
        { where: { user_registration_id: id } },
        { transaction: transaction }
      );

      const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
        current_Date = moment().format("YYYY-MM-DD");
      try {
        const update_registeruser = await RegisteredUserDetails.update(
          {
            isdele: true,
            isdele_reason,
          },
          { where: { id } },
          { transaction: transaction }
        );

        //var locked_period = islock == true ?
        const log_insert = await RegisteredUserDetailsLog.create(
          {
            userid: id,
            username: get_user.username,
            email: get_user.email,
            ismail_verified: get_user.ismail_verified,
            user_status: get_user.userstatus,
            islock: get_user.islock,
            locked_reason: get_user.locked_reason,
            locked_period: get_user.locked_period,
            incorrect_password_attempt: get_user.incorrect_password_attempt,
            mobile_access: get_user.mobile_access,
            mobile_accessReson: get_user.mobile_accessReson,
            mobile_number: get_user.mobile_number,
            ismobile_active: get_user.ismobile_active,
            updatedby_id: user_id,
            updateddate: current_datetime,
            isdele: true,
            isdele_reason,
            roles: get_user.roles, isreadonly: get_user.isreadonly,
          },
          { transaction: transaction }
        );

        const update_user = await user_details.user_details.update(
          {
            isdele: true,
          },
          { where: { user_registration_id: id } },
          { transaction: transaction }
        );

        const create_user_log = await user_details.user_detailslog.create(
          {
            email: get_user.email,
            VerificationCode: get_userdetails.VerificationCode,
            username: get_user.username,
            registrationdate: get_userdetails.registrationdate,
            createddate: current_datetime,
            createdby_id: user_id,
            isdele: true,
            gender: get_userdetails.gender,
            dateofbirth: get_userdetails.dob,
            user_registration_id: id,
          },
          { transaction: transaction }
        );

        // var delete_notificationControl = await notificationcontrol.update(
        //   {
        //     isdele: true,
        //     deleteddate: current_datetime,
        //     deletedby_id: user_id,
        //   },
        //   { where: { userid: id, isdele: false } }
        // );

        logs.info("Successfully Deleted");
        //console.log("Successfully Deleted");
        res.status(200).json({ issuccess: true, msg: "Successfully Deleted" });
        await transaction.commit();
      } catch (ex) {
        await transaction.rollback();
        //console.log(ex.message);
        logs.error('Registration page error Api (deleteUser)' + ex);
        res.status(400).json({ issuccess: false, msg: ex.message });
        mail.mailSendError(
          `Error in registration page. Api (deleteUser)`,
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
    logs.error('Registration page error Api (deleteUser)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(`Error in registration page. Api (deleteUser)`, ex);
  }
});

//get all registered roles
registeruser.get("/getRoles", validuser, async (req, res) => {
  try {
    let transaction = await db.transaction({ autocommit: false });
    try {
      let ids = ["Super Admin", "Admin"];
      //console.log(`get user roles started`);
      var get_userRoles = await UserRoles.findAll(
        {
          attributes: ["id", "userrole"],
          where: { userrole: { [Op.notIn]: ids } },
          raw: true,
        },
        { transaction: transaction }
      );
      //console.log(get_userRoels);
      res.status(200).json({ issuccess: true, data: get_userRoles });
      await transaction.commit();
      // console.log(`get user roles end`);
    } catch (ex) {
      await transaction.rollback();
      //console.log(ex);
      logs.error('Registration page error Api (getRoles)' + ex);
      res.status(400).json({
        issuccess: false,
        msg: `Something went wrong. Please try again later.`,
      });
      mail.mailSendError(`Error in registration page. Api (getRoles)`, ex);
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('Registration page error Api (getRoles)' + ex);
    res.status(400).json({
      issuccess: false,
      msg: `Something went wrong. Please try again later.`,
    });
  }
});

//get all registered user details based on roles
registeruser.get("/userDetails", validuser, async (req, res) => {
  try {
    logs.info("get userDetails started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (user_role == "Station Incharge") {
      const get_userList = await RegisteredUserDetails.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "ismail_verified",
          "userstatus",
          "islock",
          "mobile_number",
          "mobile_access",
          "roles",
          "mobile_accessReson",
          "locked_reason",
          "isreadonly",
        ],
        where: {
          isdele: false,
          roles: { [Op.notIn]: ["Admin", "Super Admin"] },
        },
        order: [["id", "DESC"]],
        raw: true,
      });
      //, roles: { [Op.ne]: "Admin" }, roles: { [Op.ne]: "Super Admin"}
      //console.table(get_userList);
      //console.log(`get userDetails end`);
      res.status(200).send({ issuccess: true, data: get_userList });
    } else if (user_role == "Super Admin") {
      const get_userList = await RegisteredUserDetails.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "ismail_verified",
          "userstatus",
          "islock",
          "mobile_number",
          "mobile_access",
          "roles",
          "mobile_accessReson",
          "locked_reason",
          "isreadonly",
        ],
        where: { isdele: false },
        order: [["id", "DESC"]],
        raw: true,
      });
      //, roles: { [Op.ne]: "Admin" }, roles: { [Op.ne]: "Super Admin"}
      //console.table(get_userList);
      //console.log(`get registereduserdetails end`);
      res.status(200).send({ issuccess: true, data: get_userList });
    } else if (user_role == "Admin") {
      const get_userList = await RegisteredUserDetails.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "ismail_verified",
          "userstatus",
          "islock",
          "mobile_number",
          "mobile_access",
          "roles",
          "mobile_accessReson",
          "locked_reason",
          "isreadonly",
        ],
        where: { isdele: false, roles: { [Op.notIn]: ["Super Admin"] } },
        order: [["id", "DESC"]],
        raw: true,
      });
      //, roles: { [Op.ne]: "Admin" }, roles: { [Op.ne]: "Super Admin"}
      //console.table(get_userList);
      //console.log(`get registereduserdetails end`);
      res.status(200).send({ issuccess: true, data: get_userList });
    }
    else {
      //console.log(`You dont have access`);
      logs.info(`You dont have access`);
      res.status(400).send(`You dont have access`);
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('Registration page error Api (userDetails)' + ex);
    res.status(400).send(ex.message);
    mail.mailSendError(
      `Error in registration page. Api (userDetails)`,
      ex
    );
  }
});

//get all registered station user
registeruser.get("/getstationuser", validuser, async (req, res) => {
  try {
    logs.info("get userDetails started");
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;
    if (user_role == "Admin" || user_role == "Station Incharge") {
      const get_userList = await RegisteredUserDetails.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "ismail_verified",
          "userstatus",
          "islock",
          "mobile_number",
          "mobile_access",
          "roles",
          "mobile_accessReson",
          "locked_reason",
          "isreadonly",
        ],
        where: {
          isdele: false,
          roles: { [Op.in]: ["Station Incharge"] },
        },
        order: [["id", "DESC"]],
        raw: true,
      });
      //, roles: { [Op.ne]: "Admin" }, roles: { [Op.ne]: "Super Admin"}
      //console.table(get_userList);
      //console.log(`get userDetails end`);
      res.status(200).send({ issuccess: true, data: get_userList });
    } else if (user_role == "Super Admin") {
      const get_userList = await RegisteredUserDetails.findAll({
        attributes: [
          "id",
          "username",
          "email",
          "ismail_verified",
          "userstatus",
          "islock",
          "mobile_number",
          "mobile_access",
          "roles",
          "mobile_accessReson",
          "locked_reason",
          "isreadonly",
        ],
        where: { isdele: false, roles: { [Op.notIn]: ["Super Admin"] } },
        order: [["id", "DESC"]],
        raw: true,
      });
      //, roles: { [Op.ne]: "Admin" }, roles: { [Op.ne]: "Super Admin"}
      //console.table(get_userList);
      //console.log(`get registereduserdetails end`);
      res.status(200).send({ issuccess: true, data: get_userList });
    } else {
      //console.log(`You dont have access`);
      logs.info(`You dont have access`);
      res.status(400).send(`You dont have access`);
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('Registration page error Api (stationuser)' + ex);
    res.status(400).send(ex.message);
    mail.mailSendError(
      `Error in registration page. Api (stationuser)`,
      ex
    );
  }
});

//get all registered user profile
registeruser.get("/getUserProfile", validuser, async (req, res) => {
  try {
    logs.info("get user profile details started");
    //console.log(`get user profile details started`);
    const user_id = JwtDecode(req.token).Userid,
      user_role = JwtDecode(req.token).Roles,
      user_mail = JwtDecode(req.token).Email;

    var get_details = await RegisteredUserDetails.findOne(
      {
        attributes: [
          "id",
          "username",
          "email",
          "mobile_access",
          "roles",
          "mobile_number",
        ],
        where: { id: user_id },
      },
      { raw: true }
    );

    var userdetails = await user_details.user_details.findOne(
      {
        attributes: ["VerificationCode"],
        where: { user_registration_id: user_id },
      },
      { raw: true,}
    );

    let u_details = {
      id: get_details.id,
      username: get_details.username,
      email: get_details.email,
      mobile_number: get_details.mobile_number,
      mobile_access: get_details.mobile_access,
      roles: get_details.roles,
      VerificationCode:
        userdetails == null ? null : userdetails.VerificationCode,
    };
    res.status(200).json({ issuccess: true, data: u_details });

    //console.log(`get user profile details end`);
    logs.info(`get user profile details end`);
  } catch (ex) {
    //console.log(ex);
    logs.error('Registration page error Api (userDetails)' + ex);
    res.status(400).send(ex.message);
    mail.mailSendError(
      `Error in registration page. Api (userDetails)`,
      ex
    );
  }
});

//verify user account
registeruser.put("/verifyUserAccount", async (req, res) => {
  try {
    logs.info("Email activation started");
    //console.log("Email activation started");
    //console.log(req.body);
    const email = req.body.email,
      email_enc = req.body.enc1;
    var user_details = await RegisteredUserDetails.findOne({
      where: { email },
    });
    const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
      current_Date = moment().format("YYYY-MM-DD");
    let transaction = await db.transaction({ autocommit: false });
    try {
      if (user_details === null) {
        //console.log("error log user not found");
        logs.info("error log user not found");
        res.status(401).json({ issuccess: false, msg: "user not found" });
      } else {
        if (!user_details.ismail_verified) {
          const email_decrypt = await bcrypt.compareSync(email, email_enc);
          if (email_decrypt) {
            const update_mailVerification = await RegisteredUserDetails.update(
              { ismail_verified: true },
              { where: { email } },
              { transaction: transaction }
            );
            const log_insert = await RegisteredUserDetailsLog.create(
              {
                username: user_details.username,
                userid: user_details.id,
                email: user_details.email,
                ismail_verified: true,
                user_status: user_details.userstatus,
                islock: user_details.islock,
                incorrect_password_attempt:
                  user_details.incorrect_password_attempt,
                mobile_access: user_details.mobile_access,
                mobile_number: user_details.mobile_number,
                ismobile_active: user_details.ismobile_active,
                updatedby_id: user_details.id,
                updateddate: current_datetime,
                isdele: user_details.isdele,
                roles: user_details.roles,
              },
              { transaction: transaction }
            );
            var subject = "Mail Verified Successfully";
            var to = email;
            var cc = "";
            var mail_body = "Succssfully mail verified";

            await transaction.commit();
            //console.log("Mail activated successfully");
            logs.info("Mail activated successfully");
            res
              .status(200)
              .json({ issuccess: true, msg: "Mail activated successfully" });
            mail.mailSend(to, cc, subject, mail_body);
          } else {
            // console.log("Invaid mail, verification failed");
            logs.info("Invaid mail, verification failed");
            res.status(401).json({ issuccess: false, msg: "Invaid mail" });
          }
        } else {
          //console.log("Your account is actived already");
          logs.info("Your account is actived already");
          res
            .status(200)
            .json({ issuccess: true, msg: "Your account is actived already" });
        }
      }
    } catch (ex) {
      await transaction.rollback();
      //console.log(ex.message);
      logs.error('Registration page error Api (verifyUserAccount)' + ex);
      res.status(400).json({ issuccess: false, msg: ex.message });
      mail.mailSendError(
        `Error in registration page. Api (verifyUserAccount)`,
        ex
      );
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('Registration page error Api (verifyUserAccount)' + ex);
    res.status(400).send(ex.message);
    mail.mailSendError(
      `Error in registration page. Api (verifyUserAccount)`,
      ex
    );
  }
});

module.exports = registeruser;
