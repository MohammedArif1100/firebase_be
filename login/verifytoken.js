const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const bparser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
const dotenv = require("dotenv");
const { type } = require("os");

dotenv.config();

const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

const RegisteredUserDetails = require("../models/registereduserdetails");
const errormail = require("../services/mail");

const privateKey = process.env.JWT_PRIVATEKEY;

var validuser = (req, res, next) => {
  try {
    //console.log(req);
    //console.log(req.headers);
    // console.log(req.headers.authorization);
    // let result = req.headers.authorization.substring(
    //   req.headers.authorization.length - 1,
    //   req.headers.authorization.length
    // );
    //console.log(result);
    req.token = req.headers.authorization;
    //logs.info("jwt token verification",);
    jwt.verify(req.token, privateKey, async (err, data) => {
      if (err) {
        //console.log(err);
        //console.log("Token authentication failed");
        logs.info(err);
        res.status(401).send("Invalid Token");
      } else {
        //logs.info(JwtDecode(req.token).Userid);
        const user_id = JwtDecode(req.token).Userid,
          user_role = JwtDecode(req.token).Roles;
        const get_userdetails = await RegisteredUserDetails.findOne({
          where: { id: user_id },
          raw: true,
        });
        // logs.info(get_userdetails);
        if (!get_userdetails.islock) {
          next();
        } else {
          //console.log("user locked");
          logs.info("user locked");
          res.status(401).send("user locked");
        }
      }
    });
  } catch (ex) {
    //console.log(ex);
    logs.error('token verification page error Function (validuser)' + ex);
    res.status(400).json({ issuccess: false, msg: ex.message });
    errormail.mailSendError(`Error in token verification page. Function (validuser)`, ex);
  }
};

module.exports = {
  validuser: validuser,
};
