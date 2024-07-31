const express = require("express");

const bcrypt = require("bcrypt");
const fs = require("fs");

const moment = require("moment");
const jwt = require("jsonwebtoken");
const { Sequelize, Op } = require("sequelize");
const mail = require("../services/mail");

const app = new express();
var forgetpassword = express.Router();
const db = require("../config/db").db;

const log4js = require("../log4js");
const logs = log4js.logger;

const dotenv = require("dotenv");
dotenv.config();

const Request_Url = process.env.DEFAULT_URL;
const encrypt_content = `${process.env.EMAIL_CHECK}`;

const RegisteredUserDetails = require("../models/registereduserdetails");
const RegisteredUserDetailsLog = require("../models/registereduserdetailslog");

//This api will send the forgot pw link to users registed mail id with time limit.
forgetpassword.get("/forgotpassword_linksend", async (req, res) => {
  try {
    // console.log("Forgetpassword mail send started");
    //console.log(req.query);
    logs.info("Forgetpassword mail send started");
    logs.info(req.query);
    const email = req.query.mail;
    const mail_check = await RegisteredUserDetails.findOne({
      where: { email },
    });
    if (mail_check === null) {
      //console.log("Usermail not found");
      logs.info("Usermail not found");
      res.status(401).json({ issuccess: false, msg: "Mail id not found" });
    } else {
      if (!mail_check.is_user_hold) {
        logs.info("Forgetpassword mail send started");
        // console.log(`Forgetpassword mail send started`);
        //http://192.168.10.222:3000/forgotpassword
        const expire_datetime = Math.floor(Date.now() / 1000) + 60 * 60;
        //console.log(expire_datetime);
        //console.log(encrypt_content);
        var encrypted = await bcrypt.hashSync(
          encrypt_content + "" + expire_datetime,
          10
        );
        const encrypted_email = await bcrypt.hashSync(email, Number((process.env.saltRounds)));
        //console.log(encrypted);
        const link = `${Request_Url}PasswordChange?email=${email}&&enc1=${encrypted}&&enc2=${expire_datetime}&&enc3=${encrypted_email}`;
        //console.log(link);
        const to = email;
        const cc = email; //"karthikeyan.t@caliberinterconnect.net"; //email;
        var subject = "Reset your password";
        const logo_image = `public/logo/IntelenseLogoNew.png`; ///`/public/logo/IntelenseLogoNew.png`;  //`/public/logo/IntelenseLogoNew.png`;
        var mail_body =
          "<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'>" +
          "<html xmlns = 'https://www.w3.org/1999/xhtml' xmlns:v='urn:schemas-microsoft-com:vml' xmlns:o ='urn:schemas-microsoft-com:office:office'>" +
          "<head><title>Corrective Action Report</title><meta http-equiv = 'Content-Type' content ='text/html; charset=utf-8'><meta http-equiv ='X-UA-Compatible' content ='IE=edge'>" +
          "<style type ='text/css'>" +
          "body {margin: 0!important;padding: 0!important;}img {border: 0!important;outline: none!important;}p { Margin: 0px!important;Padding: 0px!important;}table {border-collapse: collapse;}td, a, span {border-collapse: collapse;}.ExternalClass * {line-height: 100%;}.em_defaultlink a {color: inherit!important;text-decoration: none!important;}span.MsoHyperlink {color: inherit;}span.MsoHyperlinkFollowed {color: inherit;}" +
          "@@media(min-width:481px) and (max-width:699px) {.em_main_table {width: 100% !important;}.em_wrapper {width: 100% !important;}.em_hide { display: none!important;}.em_img {width: 100% !important;height: auto!important;}.em_h20 {height: 20px!important;}.em_padd {padding: 20px 10px!important;}}" +
          "@@media screen and (max-width: 480px) {.em_main_table {width: 100% !important;}.em_wrapper {width:100% !important;}.em_hide {display: none!important;}.em_img {width: 100% !important;height: auto!important;}.em_h20 {height: 20px!important;}.em_padd {padding: 20px 10px!important;}.em_text1{font-size: 16px!important;line-height: 24px!important;} u + .em_body.em_full_wrap {width: 100% !important;width: 100vw!important;}}" +
          "</style ></head >" +
          "<body class='em_body' style='margin:0px; padding:0px;' bgcolor='#efefef'>" +
          " <table class='em_full_wrap' valign='top' width='100%' cellspacing='0' cellpadding='0' border='0' bgcolor='#efefef' align='center'>" +
          "<tbody> <tr><td valign='top' align='center'>" +
          "<table class='em_main_table border_style' style='width:700px;box-shadow: 0 4px 8px 0 rgba(0,0,0,0.5);' width='700' cellspacing='0' cellpadding='0' align='center'>" +
          "<tbody><br><br><tr>" +
          "<td style='padding:15px;' class='em_padd' valign='top' bgcolor='#f6f7f8' align='center'>" +
          "<table width='100%' cellspacing='0' cellpadding='0' border='0' align='center'>" +
          "<tbody><tr><td valign='top' align='center' style='padding-top:10px;'><img class='em_img' alt='CiYes Logo' style='' src='https://caliberinterconnect.com/public/ken_logo.png' width='50%' border='0' height='50%'></td>" +
          "</tr></tbody></table></td></tr>" +
          "<tr><td style='padding-top:30px; padding-bottom:20px; color:white;font-family:Times New Roman; ' class='em_padd' valign='top' bgcolor='#479af5' align='center'>" +
          "<table width='100%' cellspacing='0' cellpadding='0' border='0' align='center'>" +
          "<tbody><tr><td style='font-family:georgia; font-size:30px;  color:#ffffff;' valign='top' align='center'>SCB Groups Password Reset</td></tr>" +
          //"<tr><td style='font-size:14px;  font-weight:bold;padding-top:5px;text-align:center; color:black;'>" + db.car_no + "</td></tr>" +
          //"<tr><td style='font-size:14px;  font-weight:bold;padding-top:10px;text-align:center; color:white;'>" + db.car_deslog + "  &nbsp-&nbsp  " + db.car_proname + "  &nbsp-&nbsp  " + db.car_cusname + "</td></tr>" +
          // "<tr><td style='font-size:14px;  font-weight:bold;padding-top:20px;padding-right:10px;text-align:right; color:white;'> Raised By : " + c_user + " </td>" +
          " </tr></tbody></table></td></tr>" +
          "<tr><td style='font-size:18px;padding-top:30px; padding-left:20px;font-weight:bold;font-family:Times New Roman;' valign='top' align='left'> Dear " +
          email.split("@")[0].toUpperCase() +
          ",</td></tr>" +
          "<tr><td width='100%' style='font-size:16px;padding-top:10px;  padding-left:100px;font-family:Times New Roman; ' valign='top' align='left'> &nbsp;&nbsp; <p>Some one try to reset your SCB Groups password.</p><p>If this was you, please  <a href=" +
          link +
          "> Click here</a> to reset password.</p><p> &nbsp;</p> </td></tr>" +
          "<tr><td style='padding-top:10px; padding-bottom:40px; padding-left:5px; color:white; font-family:Times New Roman;' class='em_padd' valign='top' bgcolor='#0d1121' align='center'>" +
          "<table width='100%' cellspacing='0' cellpadding='0' border='0' align='center'><tbody>" +
          "<tr><td style='font-size:20px; color:white; font-weight:bold; padding-top:20px; padding-right:10px;padding-left:15px;text-align:left;'> NOTE :</td></tr>" +
          "<tr><td width='100%' style='padding-top:10px; color:white; padding-right:10px;padding-left:15px; line-height:30px;font-size:18px;'><p> This link is expired with in one hour. This is system generated e-mail and  please do not reply. If you received it in error, no action is required.</p></td> </tr>" +
          "</tbody></table></td></tr></tbody></table></td></tr>" +
          "<tr><td class='em_hide' style='line-height:1px;min-width:700px;background-color:#ffffff;'><img alt='' src='images/spacer.gif' style='max-height:1px; min-height:1px; display:block; width:700px; min-width:700px;' width='700' border='0' height='1'></td>" +
          "</tr></tbody></table>" +
          "<div class='em_hide' style='white-space: nowrap; display: none; font-size:0px; line-height:0px;'>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;</div>" +
          "</body></html>";

        mail.mailSend(to, cc, subject, mail_body);
        //console.log("Successfully mail sent");
        logs.info("Forgetpassword mail send ended");
        res
          .status(200)
          .json({ issuccess: true, msg: "Successfully mail sent" });
      } else {
        //console.log("Your account is locked");
        logs.info("Your account is locked");
        res
          .status(501)
          .json({ issuccess: false, msg: "Your account is locked" });
      }
    }
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Forget password page error Api (forgotpassword_linksend)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in forget password page. Api (forgotpassword_linksend)`,
      ex
    );
  }
});

// this api will check the link expire time if time is expired then user cant change the pw, need to give forgot pw requset
forgetpassword.get("/resetPassword_linkexpiryCheck", async (req, res) => {
  try {
    //console.log(req.query);
    logs.info(req.query);
    const email = req.query.email;
    const encrypt_source = req.query.enc1.trim(),
      encrypted_email = req.query.enc3.trim(),
      encrypted_time = req.query.enc2.trim();
    var Mail_success = await bcrypt.compareSync(email, encrypted_email);
    if (!Mail_success) {
      //console.log("Incorrect Usermail");
      logs.info("Incorrect Usermail");
      res.status(401).json({ issuccess: false, msg: "Incorrect Usermail" });
    } else {
      const mail_check = await Registered_UserDetail.findOne({ email });
      if (mail_check === null) {
        //console.log("Usermail not found");
        logs.info("Usermail not found in reset password link expiry check");
        res.status(401).json({ issuccess: false, msg: "Mail id not found" });
      } else {
        //var get_decrypt = await bcrypt.decrypt(encrypt_source);
        var success = await bcrypt.compareSync(
          encrypt_content + "" + encrypted_time,
          encrypt_source
        );
        if (!success) {
          //console.log("Incorrect secret key");
          logs.info("Incorrect secret key");
          res.status(401).json({ issuccess: false, msg: "Incorrect key" });
        } else {
          const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");
          const duration_time = moment
            .unix(encrypted_time)
            .format("YYYY-MM-DD HH:mm:ss");
          //console.log(current_datetime + " /// " + duration_time);
          if (current_datetime > duration_time) {
            //console.log("Link expired");
            logs.info("Link expired");
            res.status(203).json({ issuccess: false, msg: "Link expired" });
          } else {
            //console.log("Success");
            logs.info("Success");
            res.status(200).json({ issuccess: true, msg: "Success" });
          }
        }
      }
    }
  } catch (ex) {
    //console.log(ex.message);
    logs.error('Forget password page error  Api (resetPassword_linkexpiryCheck)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in forget password page. Api (resetPassword_linkexpiryCheck)`,
      ex
    );
  }
});

//if the link is successed then pw will updated below.
forgetpassword.put("/resetpasswordUpdate", async (req, res) => {
  let transaction = await db.transaction({ autocommit: false });

  try {
    //console.log("Password reset started");
    logs.info("Password reset started");
    logs.info(req.body);
    //console.log(req.body);
    const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
      current_Date = moment().format("YYYY-MM-DD");
    const email = req.body.email,
      new_password = req.body.Password;
    const get_user = await Registered_UserDetail.findOne({ where: { email } });
    if (get_user === null) {
      //console.log("Usermail not found");
      logs.info("Usermail not found");
      res.status(401).json({ issuccess: false, msg: "Mail id not found" });
    } else {
      ///ismail_verified ,incorrect_password_attempt, locked_period
      const hash_password = await bcrypt.hashSync(new_password, Number((process.env.saltRounds)));
      const update_password = await Registered_UserDetail.update(
        { password: hash_password },
        { where: { email } },
        { transaction: transaction }
      );

      const log_insert = await RegisteredUserDetailsLog.create(
        {
          userid: get_user.id,
          username: get_user.username,
          email: get_user.email,
          ismail_verified: get_user.ismail_verified,
          user_status: get_user.userstatus,
          islock: get_user.islock,
          locked_reason: get_user.locked_reason,
          locked_period: get_user.locked_period,
          incorrect_password_attempt: false,
          mobile_access: get_user.mobile_access,
          mobile_accessReson: get_user.mobile_accessReson,
          mobile_number: get_user.mobile_number,
          ismobile_active: get_user.ismobile_active,
          password_changeddate: current_datetime,
          updatedby_id: get_user.id,
          updateddate: current_datetime,
          isdele: true,
          isdele_reason: get_user.isdele_reason,
          roles: get_user.roles,
        },
        { transaction: transaction }
      );

      await transaction.commit();
      //console.log("password updated successfully");
      logs.info("password updated successfully");
      res
        .status(200)
        .json({ issuccess: true, msg: "Password updated successfully" });
    }
  } catch (ex) {
    await transaction.rollback();
    // console.log(ex.message);
    logs.error('Forget password page error Api (resetpasswordUpdate)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    mail.mailSendError(
      `Error in forget password page. Api (resetpasswordUpdate)`,
      ex
    );
  }
});

module.exports = forgetpassword;
