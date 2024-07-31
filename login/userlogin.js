const express = require("express");
var useragent = require("express-useragent");
const bcrypt = require("bcrypt");
const fs = require("fs");
const bodyParser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const errormail = require("../services/mail");

const log4js = require("../log4js");
const logs = log4js.logger;

const dotenv = require("dotenv");
dotenv.config();

const privateKey = process.env.JWT_PRIVATEKEY;
const secretKey = process.env.JWT_SECREYKEY; //'INTELENSECIS@!#1';

const userlogin = express.Router();
let refreshtokens = [];

const db = require("../config/db").db;

const RegisteredUserDetails = require("../models/registereduserdetails");
const RegisteredUserDetailsLog = require("../models/registereduserdetailslog");


const app = new express();
app.use(express.json());
app.set("trust proxy", true);


const requestIP = require("request-ip");

//registered user login
userlogin.post("/login", async (req, res) => {
  try {
    //(req.body);
    logs.info(req.body);
    //console.log(req.useragent);
    logs.info("user login started");
    //console.log("user login started");
    //username and pass
    //console.log(req.body.username.toUpperCase());
    //const password_hash = await bcrypt.hashSync(req.body.pass, Number((process.env.saltRounds)));
    //console.log(password_hash);
    const user_details = await RegisteredUserDetails.findOne({
      where: {
        email: req.body.username,
      },
    }); //"id", "username", "email","password"
    logs.info("success")
    const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");
    //userid,requestIP,loginfrom,login_success,loginplace,devicename,createddate,isdele,

    // console.log(
    //   req.socket.remoteAddress +
    //     "//" +
    //     req.headers["cf-connecting-ip"] +
    //     " /// " +
    //     req.headers["x-forwarded-for"] +
    //     " /// " +
    //     req.useragent
    // );

    //console.log(JSON.stringify(req.useragent));
    //console.log(req.ip);

    const requestIP_ = requestIP.getClientIp(req);
    // logs.info( `ip :${requestIP_.split("f:")[1]} `);
    // console.log(`ip :${requestIP_.split("f:")[1]} `);

    // console.log(
    //   `ip :${requestIP_.split("f:")[1]} , loginfrom : ${loginfrom}, `
    // );

    //const apiResponse = await axios.get(URL + "&ip_address=" + '192.168.10.210');
    //console.log(apiResponse);

    if (user_details === 0 || user_details === null) {
      // console.log("error log username not found");
      logs.info("error log username not found");
      res.status(401).send("user not found");
    } else {
      if (user_details.incorrect_password_attempt >= Number((process.env.LOGIN_ATTEMPT))) {
        // console.log(
        //   "Your account is locked. Because of the incorrect password attempt"
        // );
        logs.info(
          "Your account is locked. Because of the incorrect password attempt"
        );
        res
          .status(401)
          .json(
            "Your account is locked. Because of the incorrect password attempt"
          );
      } else {
        if (!user_details.ismail_verified) {
          // const create_toolAccessLog = await ToolAccessLog.create({
          //   userid: user_details.id,
          // });
          // console.log(
          //   "Your account is not activated. Kindly activate your account"
          // );
          logs.info(
            "Your account is not activated. Kindly activate your account"
          );
          res.status(403).send("Kindly activate your account...");
        } else {
          if (user_details.isdele === true) {
            //console.log("Your account is deleted");
            logs.info("Your account is deleted");
            res
              .status(403)
              .send(
                "Your account is deleted. Please ask Front Desk to re-open rthe account"
              );
          } else {
            if (user_details.islock === true) {
              //console.log("Your account is Locked");
              logs.info("Your account is Locked");
              res
                .status(403)
                .send(
                  "Your account is Locked. Please ask Admin to un-lock the account"
                );
            } else {
              //console.log("login started");
              logs.info("login started");
              var encpass = user_details.password.trim();

              var succesresult = bcrypt.compareSync(
                req.body.pass,
                encpass.trim()
              );
              //console.log("succ res " + succesresult);

              //console.log(val.rows[0].Password);
              //console.table(await bcrypt.compareSync(req.body.pass, encpass));

              if (!succesresult) {
                //console.log("Error: Incorrect password");
                logs.info("Error: Incorrect password");

                //console.log(current_datetime);

                const incorrect_password_attempt =
                  moment(user_details.lastpassword_failuredate).format(
                    "YYYY-MM-DD"
                  ) == moment().format("YYYY-MM-DD")
                    ? parseInt(user_details.incorrect_password_attempt) + 1
                    : 0;

                let islock = user_details.islock,
                  locked_period = user_details.locked_period,
                  locked_reason = user_details.locked_reason;
                if (incorrect_password_attempt == Number((process.env.LOGIN_ATTEMPT))) {
                  (islock = true),
                    (locked_period = current_datetime),
                    (locked_reason = `Too many incorrect password attempt`);
                }
                const log_insert = await RegisteredUserDetailsLog.create({
                  userid: user_details.id,
                  username: user_details.username,
                  email: user_details.email,
                  ismail_verified: user_details.ismail_verified,
                  user_status: user_details.userstatus,
                  islock, //user_details.islock,
                  locked_period, //: user_details.locked_period,
                  locked_reason,
                  incorrect_password_attempt: "true",
                  mobile_number: user_details.mobile_number,
                  updateddate: current_datetime,
                  lastpassword_failuredate: current_datetime,
                  password_changeddate: user_details.password_changeddate,
                  roles: user_details.roles,
                  mobile_access: user_details.mobile_access,
                  isdele: "false",
                  isreadonly: user_details.isreadonly,
                });
                const UserDetails_update =
                  await RegisteredUserDetails.update(
                    {
                      islock,
                      locked_period,
                      locked_reason,
                      incorrect_password_attempt,
                      lastpassword_failuredate: current_datetime,
                    },
                    {
                      where: {
                        id: user_details.id,
                      },
                    }
                  );
                let chan = Number((process.env.LOGIN_ATTEMPT)) - incorrect_password_attempt;
                var msg =
                  incorrect_password_attempt > 1
                    ? `Wrong Password! You have tried ${incorrect_password_attempt},and ${chan} chances left`
                    : `Incorrect Password`;
                res.status(401).send(msg);
              } else {
                //console.log("password successfull");
                logs.info("password successfull");

                const log_insert = await RegisteredUserDetailsLog.create({
                  userid: user_details.id,
                  username: user_details.username,
                  email: user_details.email,
                  ismail_verified: user_details.ismail_verified,
                  user_status: user_details.userstatus,
                  islock: user_details.islock,
                  locked_period: user_details.locked_period,
                  locked_reason: null,
                  incorrect_password_attempt: false,
                  mobile_number: user_details.mobile_number,
                  updateddate: current_datetime,
                  //lastpassword_failuredate: current_datetime,
                  password_changeddate: user_details.password_changeddate,
                  roles: user_details.roles,
                  mobile_access: user_details.mobile_access,
                  isdele: "false",
                  isreadonly: user_details.isreadonly,
                });
                const UserDetails_update =
                  await RegisteredUserDetails.update(
                    {
                      incorrect_password_attempt: 0,
                    },
                    {
                      where: {
                        id: user_details.id,
                      },
                    }
                  );

                const user = {
                  Username: user_details.username,
                  Userid: user_details.id,
                  Roles: user_details.roles,
                };
                // console.log(privateKey + " // " + secretKey);exp: Math.floor(Date.now() / 1000) + 60 * 60,
                var expin = req.body.rem === false ? "5d" : "7d";
                if (req.body.from) {
                  expin = "1y";
                }
                expin = "1y";
                //req.useragent.isMobile
                //console.table(user_details.roles);
                //console.log(user_details.isreadonly);
                var jwt_token = jwt.sign(
                  {
                    Username: user_details.username,
                    Email: user_details.email,
                    Userid: user_details.id,
                    Roles: user_details.roles,
                    Isreadonly: user_details.isreadonly,
                  },
                  privateKey,
                  { expiresIn: expin },
                  { algorithms: ["HS512"] }
                );
                //console.log(jwt_token);
                let refresh_token = jwt.sign(
                  {
                    Username: user_details.username,
                    Email: user_details.email,
                    Userid: user_details.id,
                    Roles: user_details.roles,
                    Isreadonly: user_details.isreadonly,
                  },
                  secretKey,
                  { expiresIn: "1d" },
                  { algorithms: ["HS512"] }
                );
                refreshtokens.push(refresh_token);
                //let refresh_token = await jwt.sign(user, secretKey, { expiresIn: '1d' }, { algorithms: ['HS512'] });
                refreshtokens.push(refresh_token);
                ///res.status(200).json(jwt_token, refresh_token);
                const responses = {
                  jwt_token,
                  refresh_token,
                };
                if (req.body.from) {
                  if (user_details.mobile_access) {
                    res.header("authorization", responses).format({
                      json: function () {
                        var responsedata = {};
                        responsedata["status"] = 200;
                        responsedata["message"] = "login successfully.";
                        responsedata["contenttype"] = "application/json.";
                        res.json(responses);
                      },
                    });
                  } else {
                    res.status(403).send(`You don't have mobile access.`);
                  }
                } else {
                  res.header("authorization", responses).format({
                    json: function () {
                      var responsedata = {};
                      responsedata["status"] = 200;
                      responsedata["message"] = "login successfully.";
                      responsedata["contenttype"] = "application/json.";
                      res.json(responses);
                    },
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch (ex) {
    //console.log(ex);
    logs.error('userlogin error-' + ex);
    res.status(400).send(ex.message);
    errormail.mailSendError(`Error in login page. Api (login)`, ex);
  }
});

//check for mobile access
userlogin.get("/mobileAccessCheck", async (req, res) => {
  try {
    //console.log(`mobile access check started`);
    logs.info(`mobile access check started`);
    //console.log(req.query);
    const get_userMobileaccess = await Registered_UserDetail.findOne({
      where: { id: req.query.id },
    });
    let issuccess = false;
    if (get_userMobileaccess.mobile_access) {
      //console.log(` mobile access active`);
      issuccess = true;
      res.status(200).json({ issuccess }); ///({ issuccess: true, msg: "Active" });
    } else {
      //console.log(`mobile access blocked `);
      res.status(400).json({ issuccess }); ///({ issuccess: false, msg: "Blocked" });
    }
    //console.log(`mobile access check end`);
  } catch (ex) {
    //console.log(ex);
    logs.error('login page error Api (mobileAccessCheck)' + ex);
    let issuccess = false;
    res.status(400).json({ issuccess }); //({ issuccess: false, msg: ex.message });
    errormail.mailSendError(`Error in login page. Api (mobileAccessCheck)`, ex);
  }
});

module.exports = userlogin;
