const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const bodyParser = require("body-parser");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const JwtDecode = require("jwt-decode");
var lodash = require("lodash");

const { Sequelize, Op } = require("sequelize");
const mail = require("../../services/mail");

const log4js = require("../../log4js");
const logs = log4js.logger;

const reader = require('xlsx')

const railwaystation = express.Router();

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const RegisteredRailwayStationLogs = require("../../models/registeredrailwaystationlogs");
const StationAccess = require("../../models/stationaccess");
const RegisteredUserDetails = require("../../models/registereduserdetails");
const StationDetails = require("../../models/stationdetails");
const ZoneDetails = require("../../models/zonedetails");
const Asserts = require("../../models/asserts");
const SignalCircuitData = require("../../models/signalcircuitdata");
const TrackCircuitData = require("../../models/trackcircuitdata");
const PointMachineData = require("../../models/pointmachinedata");
const RegisteredPointMachine = require("../../models/registeredpointmachine");
const RegisteredTrackCircuit = require("../../models/registeredtrackcircuit");
const RegisteredSignalCircuit = require("../../models/registeredsignalcircuit");
const AlertMessage = require('../../models/alertmessage');
const AlertMessageLogs = require('../../models/alertmessagelogs');
const AlertMode = require("../../models/alertmode");
const RegisteredLCGate = require("../../models/registeredlcgate");
const RegisteredAxleCounter = require("../../models/registeredaxlecounter");
const RegisteredRelay = require("../../models/registeredrelay");
const RegisteredBattery = require("../../models/registeredbattery");
const RegisteredIPS = require("../../models/registeredips");

//register railway station
railwaystation.post("/registerstation", validuser, async (req, res) => {
    try {
        logs.info("New railway station registration started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        if (user_role == "Admin" /*|| user_role == "Station Incharge"*/) {
            //console.log(req.body);
            logs.info(req.body);           
            const stationname = req.body.stationname,
                stationcode = req.body.stationcode,
                divisionname = req.body.divisionname,
                zonename = req.body.zonename,
                latitude = req.body.latitude,
                longitude = req.body.longitude,
                manufacture = req.body.manufacture,
                serialno = req.body.serialno,
                createdby_id = user_id,
                isdele = false;
            var stationid = '';

            var station_details_check = [await RegisteredRailwayStations.findOne({
                where: { stationcode: stationcode },
            })];

            station_details_check = station_details_check[0] !== null ? station_details_check : []

            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                current_Date = moment().format("YYYY-MM-DD");

            if (station_details_check.length !== 0) {
                if (station_details_check[0].isdele === true) {
                    let transaction = await db.transaction({ autocommit: false });
                    try {
                        const update_station = await RegisteredRailwayStations.update(
                            {
                                divisionname: divisionname,
                                zonename: zonename,
                                latitude: latitude,
                                longitude: longitude,
                                manufacture: manufacture,
                                serialno: serialno,
                                isdele_reason: null,
                                isdele: false
                            },
                            { where: { id: station_details_check[0].id }, returning: true, plain: true },
                            { transaction: transaction }, { raw: true })
                        logs.info("Railway station registration inserted");

                        const log_insert = await RegisteredRailwayStationLogs.create(
                            {
                                stationid: update_station[1].id,
                                stationname: update_station[1].stationname,
                                stationcode: update_station[1].stationcode,
                                divisionname: update_station[1].divisionname,
                                zonename: update_station[1].zonename,
                                latitude: update_station[1].latitude,
                                longitude: update_station[1].longitude,
                                manufacture: update_station[1].manufacture,
                                serialno: update_station[1].serialno,
                                updateddate: current_datetime,
                                updatedby_id: user_id,
                                isdele_reason: null,
                                isdele: false,
                            },
                            { transaction: transaction }
                        );
                        logs.info("Railway station log inserted");

                        await transaction.commit();
                        res
                            .status(200)
                            .json({ issuccess: true, msg: "Registered Successfully" });                           
                        logs.info("Railway Station Successfully Registered");
                        //console.log("Railway Station Successfully Registered")
                    }
                    catch (ex) {
                        await transaction.rollback();
                        //console.log(ex.message);
                        logs.error('Railwaystation page error Api (registerstation)' + ex);
                        res.status(400).json({ issuccess: false, msg: ex.message });
                        mail.mailSendError(`Error in railwaystation page. Api (registerstation)`, ex);
                    }

                }
                else {
                    //console.log("Given station is already registered.");
                    logs.info("Given station is already available.");
                    res
                        .status(400)
                        .json({ issuccess: false, msg: "Given station is aleady available" });
                }
            }
            else {
                let transaction = await db.transaction({ autocommit: false });
                try {

                    const register_station = await RegisteredRailwayStations.create({
                        stationname,
                        stationcode,
                        divisionname,
                        zonename,
                        latitude,
                        longitude,
                        manufacture,
                        serialno,
                        createddate: current_datetime,
                        createdby_id,
                        updateddate: current_datetime,
                        isdele,
                    },
                        { transaction: transaction }).then(res => stationid = res.id)
                    logs.info("Railway station registration inserted");

                    const log_insert = await RegisteredRailwayStationLogs.create(
                        {
                            stationid: stationid,
                            stationname,
                            stationcode,
                            divisionname,
                            zonename,
                            latitude,
                            longitude,
                            manufacture,
                            serialno,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele,
                        },
                        { transaction: transaction }
                    );
                    logs.info("Railway station registration logs inserted");   
                    
                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Registered Successfully" });
                    logs.info("Railway Station Successfully Registered");
                    //console.log("Railway Station Successfully Registered")

                }
                catch (ex) {
                    await transaction.rollback();
                    //console.log(ex.message);
                    logs.error('Railwaystation page error Api (registerstation)' + ex);
                    res.status(400).json({ issuccess: false, msg: ex.message });
                    mail.mailSendError(`Error in railwaystation page. Api (registerstation)`, ex);
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
        logs.error('Railwaystation page error Api (registerstation)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (registerstation)`, ex);
    }
});

//edit the registered railway station
railwaystation.put("/editstation", validuser, async (req, res) => {
    try {
        logs.info("Railway station edit started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        if (user_role == "Admin" || user_role == "Station Incharge" || user_role == "Super Admin") {
            //console.log(req.body);
            let transaction = await db.transaction({ autocommit: false });
            try {
                logs.info(req.body);
                const id = req.body.id,
                    latitude = req.body.latitude,
                    longitude = req.body.longitude,
                    manufacture = req.body.manufacture,
                    serialno = req.body.serialno

                const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                    current_Date = moment().format("YYYY-MM-DD");

                const get_station = await RegisteredRailwayStations.findOne(
                    { where: { id } },
                    { transaction: transaction })

                if (get_station != null) {
                    const update_station = await RegisteredRailwayStations.update(
                        { latitude: latitude, longitude: longitude, manufacture: manufacture, serialno: serialno },
                        { where: { id }, returning: true, plain: true },
                        { transaction: transaction }, { raw: true })

                    logs.info("Railway station updated");

                    const log_insert = await RegisteredRailwayStationLogs.create(
                        {
                            stationid: update_station[1].id,
                            stationname: update_station[1].stationname,
                            stationcode: update_station[1].stationcode,
                            divisionname: update_station[1].divisionname,
                            zonename: update_station[1].zonename,
                            latitude: update_station[1].latitude,
                            longitude: update_station[1].longitude,
                            manufacture: update_station[1].manufacture,
                            serialno: update_station[1].serialno,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele: false,
                        },
                        { transaction: transaction }
                    );
                    logs.info("Railway station log inserted");

                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Successfully Updated" });
                    logs.info("Railway Station Successfully Updated");
                    //console.log("Railway Station Successfully Updated")
                }
                else {
                    logs.info("Station not found");
                    //console.log("Station not found");
                    res.status(401).json({ issuccess: false, msg: "Station not found" });
                }
            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('Railwaystation page error Api (editstation)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(`Error in railwaystation page. Api (editstation)`, ex);
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
        logs.error('Railwaystation page error Api (editstation)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (editstation)`, ex);
    }
});

//delete the registered railway station
railwaystation.put("/deletestation", validuser, async (req, res) => {
    try {
        logs.info("station delete started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        if (user_role == "Admin" || user_role == "Station Incharge") {
            let transaction = await db.transaction({ autocommit: false });
            try {
                logs.info(req.body);
                const stationcode = req.body.code,
                    id = req.body.id,
                    isdele_reason = req.body.reason;

                const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                    current_Date = moment().format("YYYY-MM-DD");

                const get_station = await RegisteredRailwayStations.findOne(
                    { where: { id } },
                    { transaction: transaction })

                if (get_station != null) {
                    const update_station = await RegisteredRailwayStations.update(
                        { isdele: true, isdele_reason: isdele_reason },
                        { where: { id }, returning: true, plain: true },
                        { transaction: transaction }, { raw: true })

                    logs.info("Railway station log dele updated");

                    const log_insert = await RegisteredRailwayStationLogs.create(
                        {
                            stationid: update_station[1].id,
                            stationname: update_station[1].stationname,
                            stationcode: update_station[1].stationcode,
                            divisionname: update_station[1].divisionname,
                            zonename: update_station[1].zonename,
                            manufacture: update_station[1].manufacture,
                            serialno: update_station[1].serialno,
                            latitude: update_station[1].latitude,
                            longitude: update_station[1].longitude,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele: true,
                            isdele_reason: isdele_reason,
                        },
                        { transaction: transaction }
                    );
                    logs.info("Railway station dele log inserted");
                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Successfully deleted" });
                    logs.info("Railway Station Successfully deleted");
                    //console.log("Railway Station Successfully deleted")
                }
                else {
                    logs.info("Station not found");
                    //console.log("Station not found");
                    res.status(401).json({ issuccess: false, msg: "Station not found" });
                }
            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('Railwaystation page error Api (deletestation)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(
                    `Error in railwaystation page. Api (deletestation)`,
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
        logs.error('Railwaystation page error Api (deletestation)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (deletestation)`, ex);
    }
});

//get all registered railway station
railwaystation.get("/getallstation", validuser, async (req, res) => {
    try {
        logs.info("get all station started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        var station_list = []

        if (user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge" || user_role === "Employee") {

            var get_station_list = await RegisteredRailwayStations.findAll({ where: { isdele: false }, order: [["stationname", "ASC"]],raw: true,}, );

            get_station_list.map(item => {
                let stationdata = {
                    label: item.stationname,
                    value: item.id
                }
                var stationcheck = lodash.find(station_list, stationdata);
                if (stationcheck === undefined || stationcheck === null) {
                    station_list.push(stationdata)
                }
            })

            logs.info("get all station ended");
            //console.log("get all station ended");
            res.status(200).json({ issuccess: true, data: get_station_list, stationlist: station_list });
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    }
    catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getallstation)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

//assign individual station access
railwaystation.post("/assignstationaccess", validuser, async (req, res) => {
    try {
        logs.info("Assign station access started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;

        if (user_role === "Admin") {
            const access_check = await StationAccess.findOne(
                { where: { stationid: req.body.id, userid: req.body.userid, isdele: false } })
            if (access_check == null) {
                let transaction = await db.transaction({ autocommit: false });
                try {
                    logs.info(req.body)
                    const id = req.body.id,
                        assignid = req.body.userid

                    const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                        current_Date = moment().format("YYYY-MM-DD");
                    const create_access = await StationAccess.create(
                        {
                            stationid: id,
                            userid: assignid,
                            createddate: current_datetime,
                            createdby_id: user_id,
                            updateddate: current_datetime,
                            isdele: false
                        },
                        { transaction: transaction }
                    )
                    logs.info("Railway station assigned station access");
                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Successfully assigned" });
                    logs.info("Station Incharge assigned successfully");
                    //console.log("Railway Station Successfully deleted")

                }
                catch (ex) {
                    await transaction.rollback();
                    //console.log(ex.message);
                    logs.error('Railwaystation page error Api (assignstationaccess)' + ex);
                    res.status(400).json({ issuccess: false, msg: ex.message });
                    mail.mailSendError(`Error in railwaystation page. Api (assignstationaccess)`, ex);
                }
            }
            else {
                logs.info("Already assigned");
                //console.log("Already assigned")
                res.status(401).json({ issuccess: false, msg: "Already assigned..." });
            }

        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    }
    catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (assignstationaccess)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (assignstationaccess)`, ex);
    }
});

//get the assigned person station access list
railwaystation.get("/getstationaccesslist", validuser, async (req, res) => {
    try {
        logs.info("Get station access started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;

        //   var email_list = [];
        //   var station_list = [];
        //   var user_list = [];

        if (user_role === "Admin") {

            RegisteredRailwayStations.hasMany(StationAccess, { foreignKey: 'stationid' });
            StationAccess.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

            StationAccess.belongsTo(RegisteredUserDetails, { foreignKey: 'userid' });
            RegisteredUserDetails.hasMany(StationAccess, { foreignKey: 'userid' });

            const datas = await StationAccess.findAll({
                attributes: [
                  'id',
                  'stationid',
                  [Sequelize.literal('"RegisteredRailwayStation"."stationname"'), 'stationname'],
                  [Sequelize.literal('"RegisteredRailwayStation"."stationcode"'), 'stationcode'],
                  [Sequelize.literal('"RegisteredUserDetail"."username"'), 'username'],
                  [Sequelize.literal('"RegisteredUserDetail"."email"'), 'email'],
                ],
                include: [
                  {
                    model: RegisteredRailwayStations,
                    attributes: [],
                    where: {
                      isdele: false,
                    },
                  },
                  {
                    model: RegisteredUserDetails,
                    attributes: [],
                    where: {
                      isdele: false,
                    },
                  },
                ],
                where: {
                  isdele: false,
                },
                raw: true,
                order: [
                  ['id'],
                ],
              })               
            
            //const data = await db.query('SELECT p.id,p.stationid,s.stationname,s.stationcode,r.username,r.email from public."RegisteredRailwayStations" as s  JOIN public."StationAccesses" as p ON s.id = p.stationid  JOIN public."RegisteredUserDetails" as r ON r.id = p.userid  where s.isdele = false and p.isdele = false and r.isdele = false order by p.id')

            // data[0].map(item => {
            //     let stationdata = {
            //       text : item.stationname,
            //       value : item.stationname 
            //     } 
            //     let userdata = {
            //       text : item.username,
            //       value : item.username 
            //     } 
            //     let emaildata = {
            //       text : item.email,
            //       value : item.email 
            //     } 
            //     var stationcheck = lodash.find(station_list, stationdata);
            //     if(stationcheck === undefined || stationcheck === null)
            //     {
            //       station_list.push(stationdata)
            //     } 
            //     var usercheck = lodash.find(user_list, userdata);   
            //     if(usercheck === undefined || usercheck === null)
            //     {
            //       user_list.push(userdata)
            //     }   
            //     var emailcheck = lodash.find(email_list, emaildata);     
            //     if(emailcheck === undefined || emailcheck === null)
            //     {
            //       email_list.push(emaildata)
            //     }           
            //   })

            logs.info("Get station access end");
            //res.status(200).json({issuccess: true, data: data[0], stationlist: station_list, userlist: user_list, emaillist: email_list});             
            res.status(200).json({ issuccess: true, data: datas });
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    }
    catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (assignstationaccess)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (assignstationaccess)`, ex);
    }
});

//delete the assigned person station access 
railwaystation.put("/deletestationaccess", validuser, async (req, res) => {
    try {
        logs.info("delete station access started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        if (user_role === "Admin") {
            let transaction = await db.transaction({ autocommit: false });
            try {
                logs.info(req.body)
                const id = req.body.id,
                    isdele = true,
                    deletereason = null

                const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                    current_Date = moment().format("YYYY-MM-DD");

                const update_station = await StationAccess.update(
                    { isdele: true, deletedby_id: user_id, deleteddate: current_datetime, isdele_reason: deletereason },
                    { where: { id } },
                    { transaction: transaction }
                )

                logs.info("Railway station access deleted");
                await transaction.commit();
                res
                    .status(200)
                    .json({ issuccess: true, msg: "Successfully deleted" });
                logs.info("Station Incharge access deleted successfully");
                //console.log("Railway Station Successfully deleted")

            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('Railwaystation page error Api (deletestationaccess)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(`Error in railwaystation page. Api (deletestationaccess)`, ex);
            }
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    }
    catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (deletestationaccess)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (deletestationaccess)`, ex);
    }
})

//get the station names
railwaystation.get("/getstationname", validuser, async (req, res) => {
    try {
        //console.log(`get station name started`);
        logs.info(`get station name started`)
        var station_list = [];
        var stationnames = (await RegisteredRailwayStations.findAll(
            {
                attributes:['stationname'],
                where: { isdele: false },
                raw: true,
            })).map(data => data.stationname)  

        var get_stations = await StationDetails.findAll(
            { where: { stationname: { [Op.notIn]: stationnames } }, order: [["stationname", "ASC"]], limit: 200, raw: true, },
        );

        get_stations.map(item => {
            let stationdata = {
                text: item.stationname,
                value: item.stationname
            }
            var stationcheck = lodash.find(station_list, stationdata);
            if (stationcheck === undefined || stationcheck === null) {
                station_list.push(stationdata)
            }
            //station_list.push(stationdata)
        })

        // const stationlist = station_list.filter(
        //   (ele, ind) =>
        //     ind ===
        //     station_list.findIndex(
        //       (elem) => elem.text === ele.text && elem.value === ele.value
        //     )
        // );

        // console.log(`get station name end`);
        logs.info(`get station name end`)
        res.status(200).json({ issuccess: true, data: get_stations, stationlist: station_list });

    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getstationname)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }

});

//get the station names based on search
railwaystation.get("/getstationnameByKeyword", validuser, async (req, res) => {   
    try {
        //console.log(`get station name started`);
        logs.info(`getstationnameByKeyword started`)
        var station_list = [];
        var stationName= req.query.name;

        var get_stations = await StationDetails.findAll({
            where: {
                [Op.and]: [
                    { stationname: { [Op.iLike]: `%${stationName}%` } },
                    //{ stationname: { [Op.notIn]: Sequelize.literal(`(SELECT stationname FROM "RegisteredRailwayStations" WHERE isdele = false)`) } }
                    { stationname: { [Op.notIn]: (await RegisteredRailwayStations.findAll(
                        {
                            attributes:['stationname'],
                            where: { isdele: false },
                            raw: true,
                        })).map(data=> data.stationname) } }
                ]
            },
            order: [["stationname", "ASC"]],
            raw: true,
        });           

        get_stations.map(item => {
            let stationdata= {
              text : item.stationname,
              value : item.stationname 
            } 
            var stationcheck = lodash.find(station_list, stationdata);
            if(stationcheck === undefined || stationcheck === null)
            {
                station_list.push(stationdata)
            } 
          })                

        // console.log(`get station name end`);
        logs.info(`get station name end`)
        // res.status(200).json({ issuccess: true, data: station_list});
        if(get_stations.length > 0 && station_list.length > 0){
        res.status(200).json({ issuccess: true, data: get_stations, stationlist: station_list});
        }else{
        res.status(200).json({ issuccess: false, data: [], stationlist: []});
        }
        
    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getstationname)' + ex);
        res.status(400).json({
        issuccess: false,
        msg: `Something went wrong. Please try again later.`,
        });
    }
      
});

//get the zones names
railwaystation.get("/getzonename", validuser, async (req, res) => {
    try {
        //console.log(`get zone name started`);
        logs.info(`get zone name started`)
        var get_zones = await ZoneDetails.findAll();
        //console.log(get_zones);
        // console.log(`get zone name end`);
        logs.info(`get zone name end`)
        res.status(200).json({ issuccess: true, data: get_zones });
    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getzonename)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

//get the registered station
railwaystation.get("/getregisteredstation", validuser, async (req, res) => {
    try {
        //console.log(`get registered station  started`);         
        logs.info(`get registered station started`)
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        var station_list = []

        if (user_role === "Station Incharge") {

            const access = await StationAccess.findAll(
                { where: { userid: user_id, isdele: false }, raw: true, }
            )
            if (access.length > 0) {
                var get_stations = await RegisteredRailwayStations.findAll(
                    { where: { isdele: false, id: { [Op.in]: access.map(a => a.stationid) } }, order: [["stationname", "ASC"]], raw: true, });
                get_stations.map(item => {
                    let stationdata = {
                        label: item.stationname,
                        value: item.id
                    }
                    var stationcheck = lodash.find(station_list, stationdata);
                    if (stationcheck === undefined || stationcheck === null) {
                        station_list.push(stationdata)
                    }
                })
                // console.log(`get registered station ended`);
                logs.info(`get registered station ended`)
                res.status(200).json({ issuccess: true, data: get_stations, stationlist: station_list });
            }
            else {
                logs.info(`get registered station ended`)
                res.status(200).json({ issuccess: true, data: [], stationlist: [] });
            }
        }
        else if (user_role === "Admin" || user_role === "Employee") {
            var get_stations = await RegisteredRailwayStations.findAll({ where: { isdele: false }, order: [["stationname", "ASC"]], raw: true, });
            get_stations.map(item => {
                let stationdata = {
                    label: item.stationname,
                    value: item.id
                }
                var stationcheck = lodash.find(station_list, stationdata);
                if (stationcheck === undefined || stationcheck === null) {
                    station_list.push(stationdata)
                }
            })
            // console.log(`get registered station ended`);
            logs.info(`get registered station ended`)
            res.status(200).json({ issuccess: true, data: get_stations, stationlist: station_list });
        }

    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getregisteredstation)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

//get the asserts list
railwaystation.get("/getassertslist", validuser, async (req, res) => {
    try {
        //console.log(`get asserts list started`);         
        logs.info(`get asserts list started`)
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;

        if (user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge") {
            var get_asserts_list = await Asserts.findAll({ where: { isdele: false }, order: [['id', 'ASC']], raw: true, });
            res.status(200).json({ issuccess: true, data: get_asserts_list });
            logs.info(`get asserts list ended`)
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getassertslist)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
})

//get the station dashboard for real time data
railwaystation.get("/getstationdashboard", async (req, res) => {
    try {
        //console.log(`get station dashboard started`);         
        logs.info(`get station dashboard started`)
        logs.info(req.query)
        const stationid = req.query.stationid

        let point_data = []
        const stations = await RegisteredRailwayStations.findAll({
            where: { id: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        const pointmachines = await RegisteredPointMachine.findAll({
            where: { stationid: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        for await (const point of pointmachines) {
            let datas = await PointMachineData.findAll({
                limit: 3,
                where: { pointmachineid: point.id, isdele: false, log:1 },
                order: [["id", "DESC"]],
                raw: true,
            });
            datas.map(data => point_data.push(data))
        }

        let track_data = []

        const trackcircuits = await RegisteredTrackCircuit.findAll({
            where: { stationid: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        for await (const track of trackcircuits) {
            let datas = await TrackCircuitData.findAll({
                limit: 3,
                where: { trackcircuitid: track.id, isdele: false },
                order: [["id", "DESC"]],
                raw: true,
            });
            datas.map(data => track_data.push(data))
        }

        let signal_data = []

        const signalcircuits = await RegisteredSignalCircuit.findAll({
            where: { stationid: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        for await (const signal of signalcircuits) {
            let datas = await SignalCircuitData.findAll({
                limit: 3,
                where: { signalcircuitid: signal.id, isdele: false },
                order: [["id", "DESC"]],
                raw: true,
            });
            datas.map(data => signal_data.push(data))
        }

        let final_data = []
        final_data.push({
            pointmachinedata: point_data,
            signalcircuitdata: signal_data,
            trackcircuitdata: track_data,
            stations: stations,
            pointmachines: pointmachines,
            trackcircuits: trackcircuits,
            signalcircuits: signalcircuits,

        })

        logs.info("Get station dashboard end");
        res.status(200).json({ issuccess: true, data: final_data });
    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getstationdashboard)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
})

//get the station dashboard for real time data
railwaystation.get("/getstationdashboard1", async (req, res) => {
    try {
        //console.log(`get station dashboard started`);      
        logs.info(`get station dashboard started`)
        logs.info(req.query)
        const stationid = req.query.stationid
       
        RegisteredPointMachine.hasMany(PointMachineData, { foreignKey: 'pointmachineid' });
        PointMachineData.belongsTo(RegisteredPointMachine, { foreignKey: 'pointmachineid' });  
        
        // const pointDataIds = await PointMachineData.findAll({
        //     attributes: ['id'],
        //     where: {
        //         isdele: false,
        //         log: 1,
        //         pointmachineid: {
        //             [Sequelize.literal]: `
        //                 (SELECT id
        //                 FROM public."RegisteredPointMachines"
        //                 WHERE stationid = ${stationid}
        //                 AND isdele = false)
        //             `
        //         }
        //     },
        //     order: [['pointmachineid', 'ASC'], ['id', 'DESC']],
        //     group: ['pointmachineid', 'id'],
        //     having: Sequelize.literal('ROW_NUMBER() <= 3'),
        //     raw: true
        // });
    

        // var datass = await PointMachineData.findAll({
        //     attributes: [
        //     //[Sequelize.col('RegisteredPointMachine.id'), 'id'],
        //     //[Sequelize.col('RegisteredPointMachine.pointmachinename'), 'pointmachinename'],
        //     ['id', 'pointmachinedataid'],
        //     'pointmachineid',
        //     'direction',
        //     'pointcyclecount',
        //     'a_direction',
        //     'b_direction',
        //     'log',
        //     'createddate',
        //     'isdele',
        //     ],
        //     include: [
        //     {
        //         model: RegisteredPointMachine,
        //         attributes: [],
        //         where: {
        //         isdele: false,
        //         stationid: parseInt(req.query.stationid),
        //         },
        //     },         
        //     ],
        //     where: {
        //     isdele: false,
        //     id: {
        //         [Op.in]: (await PointMachineData.findAll({
        //         attributes: [
        //             'id',
        //         ],
        //         // group: ['RegisteredPointMachine.id'],
        //         include: [
        //             {
        //             model: RegisteredPointMachine,
        //             attributes: [],
        //             where: {
        //                 isdele: false,
        //                 stationid: parseInt(req.query.stationid)
        //             },
        //             },
        //         ],
        //         where: {
        //             isdele: false,
        //             log: 1,
        //         },
        //         limit: 3,
        //         order: [["id", "DESC"]],
        //         raw: true,
        //         })).map(data => data.id)
        //     },
        //     log: 1,
        //     },            
        //     group: [
        //     'PointMachineData.id',
        //     ],
        //     raw: true,
        // });
  

        // console.log((await PointMachineData.findAll({
        //     attributes: [
        //         'id',
        //     ],
        //     // group: ['RegisteredPointMachine.id'],
        //     include: [
        //         {
        //             model: RegisteredPointMachine,
        //             attributes: [],
        //             where: {
        //                 isdele: false,
        //                 stationid: parseInt(req.query.stationid)
        //             },
        //         },
        //     ],
        //     where: {
        //         isdele: false,
        //         log: 1,
        //     },
        //     limit: 3,
        //     order: [["id", "DESC"]],
        //     raw: true,
        // })).map(data => data.id))

        // console.log((await RegisteredPointMachine.findAll({
        //     attributes: [
        //         'id',
        //     ],
        //     include: [
        //         {
        //             model: PointMachineData,
        //             attributes: ['id', 'dataid'],
        //             where: {
        //                 isdele: false,
        //             },
        //             limit: 3,
        //             order: [["id", "DESC"]],
        //         },
        //     ],
        //     where: {
        //         isdele: false,
        //         stationid: parseInt(req.query.stationid)
        //     },
        //     raw: true,
        // })).map(data => data.id))

        let point_data = []
        const stations = await RegisteredRailwayStations.findAll({
            where: { id: stationid, isdele: false },
            order: [["id", "ASC"]]
        })

        const pointmachines = await RegisteredPointMachine.findAll({
            where: { stationid: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        for await (const point of pointmachines) {
            let datas = await PointMachineData.findAll({
                limit: 1,
                where: { pointmachineid: point.id, isdele: false },
                order: [["id", "DESC"]],
                raw: true,
            });
            datas.map(data => point_data.push(data))
        }

        let track_data = []

        const trackcircuits = await RegisteredTrackCircuit.findAll({
            where: { stationid: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        for await (const track of trackcircuits) {
            let datas = await TrackCircuitData.findAll({
                limit: 3,
                where: { trackcircuitid: track.id, isdele: false },
                order: [["id", "DESC"]],
                raw: true,
            });
            datas.map(data => track_data.push(data))
        }

        let signal_data = []

        const signalcircuits = await RegisteredSignalCircuit.findAll({
            where: { stationid: stationid, isdele: false },
            order: [["id", "ASC"]],
            raw: true,
        })

        for await (const signal of signalcircuits) {
            let datas = await SignalCircuitData.findAll({
                limit: 3,
                where: { signalcircuitid: signal.id, isdele: false },
                order: [["id", "DESC"]],
                raw: true,
            });
            datas.map(data => signal_data.push(data))
        }


        let final_data = []
        final_data.push({
            pointmachinedata: point_data,
            signalcircuitdata: signal_data,
            trackcircuitdata: track_data,
            stations: stations,
            pointmachines: pointmachines,
            trackcircuits: trackcircuits,
            signalcircuits: signalcircuits,

        })

        logs.info("Get station dashboard end");  
        res.status(200).json({ issuccess: true, data: final_data });
    } catch (ex) {
        //console.log(ex);
        console.log(ex.sql)
        logs.error('Railwaystation page error Api (getstationdashboard)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
})

//get the alert message details 
railwaystation.get("/getalertmessage", validuser, async (req, res) => {
    try {
        logs.info("get station alert started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        const stationid = req.query.stationid,
            assertname = req.query.assertname,
            assertid = req.query.assertid
        if (user_role === "Super Admin") {
            var get_assert_alert_list = await AlertMessage.findAll({ where: { stationid: stationid, assert: assertname, assertid: assertid  }, order: [["id", "ASC"]], raw: true });
            if(get_assert_alert_list.length > 0)
            {
                res.status(200).json({ issuccess: true, data: get_assert_alert_list });
            }
            else
            {
                res.status(200).json({ issuccess: true, data: [], msg: "No alerts for this alerts" });
            }            
        }
        else if (user_role === "Admin" || user_role === "Station Incharge") {
            var get_assert_alert_list = await AlertMessage.findAll({ where: { stationid: stationid, assert: assertname, assertid: assertid }, order: [["id", "ASC"]], raw: true });
            if(get_assert_alert_list.length > 0)
            {
                res.status(200).json({ issuccess: true, data: get_assert_alert_list });
            }
            else
            {
                res.status(200).json({ issuccess: true, data: [], msg: "No alerts for this alerts" });
            }    
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    }
    catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getalertmessage)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

//edit the alert message details 
railwaystation.put("/editalertmessage", validuser, async (req, res) => {
    try {
        logs.info("Edit station alert message values started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        if (user_role == "Admin" || user_role == "Station Incharge" || user_role == "Super Admin") {
            //console.log(req.body);
            let transaction = await db.transaction({ autocommit: false });
            try {
                logs.info(req.body);
                const id = req.body.id,
                    value = req.body.value,
                    message = req.body.message,
                    mode = req.body.mode,
                    email = req.body.email,
                    sms = req.body.email,
                    voice = req.body.voice,
                    isactive = req.body.isactive,
                    description = req.body.description

                const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                    current_Date = moment().format("YYYY-MM-DD");

                const update_alertmessage = await AlertMessage.update(
                    {
                        value: value,
                        message: message,
                        mode: mode,
                        email: email,
                        sms: sms,
                        voice: voice,
                        isactive: isactive,
                        description: description,
                    },
                    { where: { id: id, isdele: false }, returning: true, plain: true },
                    { transaction: transaction },
                    { raw: true }
                )

                const log_insert = await AlertMessageLogs.create(
                    {
                        alertmessageid: update_alertmessage[1].id,
                        stationid: update_alertmessage[1].stationid,
                        assertid: update_alertmessage[1].assertid,
                        assert: update_alertmessage[1].assert,
                        alertname: update_alertmessage[1].alertname,
                        value: value,
                        unit: update_alertmessage[1].unit,
                        message: message,
                        mode: mode,
                        email: email,
                        sms: sms,
                        voice: voice,
                        isactive: isactive,
                        iseditable: update_alertmessage[1].iseditable,
                        view: update_alertmessage[1].view,
                        description: description,
                        updateddate: current_datetime,
                        updatedby_id: user_id,
                        isdele: false,
                    },
                    { transaction: transaction }
                );
                await transaction.commit();
                logs.info("Edit station alert message values Successfully Updated");
                //console.log("Edit station alert message values Successfully Updated")            
                require("../../mqtt/alertvalue").editValues(`${update_alertmessage[1].stationid}@${update_alertmessage[1].assertid}@${update_alertmessage[1].assert}@${update_alertmessage[1].alertname}`, value, message, mode, email, sms, voice, isactive, description)
                res.status(200).json({ issuccess: true, msg: "Successfully Updated" });
            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('Railwaystation page error Api (editalertmessage)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(`Error in railwaystation page. Api (editalertmessage)`, ex);
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
        logs.error('Railwaystation page error Api (editalertmessage)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in railwaystation page. Api (editalertmessage)`, ex);
    }
});

//get the alert mode details 
railwaystation.get("/getalertmodes", validuser, async (req, res) => {
    try {
        logs.info("get station alert mode started");
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;
        if (user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge") {
            var get_station_alert_list = await AlertMode.findAll({ where: { isdele: false }, raw: true, });
            res.status(200).json({ issuccess: true, data: get_station_alert_list });
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    }
    catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getalertmodes)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

// get circuits based on station
railwaystation.get("/getassertslistByStation", validuser,async (req, res) => {
    try {     
        //console.log(`get asserts list started`);         
        logs.info(`getassertslistByStation started`)
        const user_id = JwtDecode(req.token).Userid,
        user_role = JwtDecode(req.token).Roles,
        user_mail = JwtDecode(req.token).Email,
        stationid = parseInt(req.query.stationid);
        if(user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge") {   
            
        var assertslist = await Asserts.findAll({ attributes:["assertname"], order: [["id", "ASC"]],raw: true});      
        assertslist = assertslist.map((obj) => obj.assertname);
        var assertsinalerts = lodash.uniqBy(await AlertMessage.findAll({ attributes:["assert"],where:{stationid: stationid},raw: true}),'assert');             
       
        // Sorting namesToSort based on assertslist
        assertsinalerts.sort((a, b) => {

                const indexA = assertslist.indexOf(a.assert);
                const indexB = assertslist.indexOf(b.assert);
                
                return indexA - indexB;
            });

        if(assertsinalerts.length > 0){
            res.status(200).json({issuccess:true, data:assertsinalerts});   
            logs.info(`getassertslistByStation ended`)     
           
            }else{
                res.status(201).json({issuccess:true, data:[], msg:"No asserts list for selected station"});    
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

// get circuits based on station
railwaystation.get("/getassertnamebyassert", validuser, async (req, res) => {
    try {
        //console.log(`get asserts list started`);         
        logs.info(`assertidsertslistByStation started`)
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email,
            stationid = req.query.stationid;
        assertname = req.query.assertname
        if (user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge") {

            var assertsnamelist = [];
            switch (assertname) {
                case "Point Machine":
                    assertsnamelist = await RegisteredPointMachine.findAll({ attributes: ["id", ["pointmachinename", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "Track Circuit":
                    assertsnamelist = await RegisteredTrackCircuit.findAll({ attributes: ["id", ["trackname", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "Signal Circuit":
                    assertsnamelist = await RegisteredSignalCircuit.findAll({ attributes: ["id", ["signalname", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "Axle Counter":
                    assertsnamelist = await RegisteredAxleCounter.findAll({ attributes: ["id", ["axlecountername", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "LC Gate":
                    assertsnamelist = await RegisteredLCGate.findAll({ attributes: ["id", ["lcgatename", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "Relay":
                    assertsnamelist = await RegisteredRelay.findAll({ attributes: ["id", ["relayname", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "IPS":
                    assertsnamelist = await RegisteredIPS.findAll({ attributes: ["id", ["ipsname", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                case "Battery":
                    assertsnamelist = await RegisteredBattery.findAll({ attributes: ["id", ["type", "assertname"]], where: { stationid: stationid, isdele: false }, raw: true });
                    break;
                default:
                    // Handle default case if needed
                    break;
            }

            if (assertsnamelist.length > 0) {
                res.status(200).json({ issuccess: true, data: assertsnamelist });
                logs.info(`getassertnamebyassert ended`)
            } else {
                res.status(201).json({ issuccess: true, data: [], msg: "No asserts for selected asserts" });
            }
        }
        else {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({ issuccess: false, msg: "Access Denied..." });
        }
    } catch (ex) {
        //console.log(ex);
        logs.error('Railwaystation page error Api (getassertnamebyassert)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
})

//get  registered zones of  station
railwaystation.get("/getregiteredzones", validuser, async (req, res) => {
    try{
        logs.info("get getregiteredzones started");
        const user_id = JwtDecode(req.token).Userid,
          user_role = JwtDecode(req.token).Roles,
          user_mail = JwtDecode(req.token).Email;
          var station_list = []

          if(user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge" || user_role === "Employee") {
                    
            var get_reg_zone_list = await RegisteredRailwayStations.findAll({ where: { isdele: false }, 
                order: [["stationname", "ASC"]],
                attributes:["zonename"],
                raw:true
             });    
             get_reg_zone_list = lodash.uniq(get_reg_zone_list.map(item => item.zonename));       
            logs.info("get getregiteredzones ended");
            //console.log("get all station ended");
            res.status(200).json({issuccess:true, data:get_reg_zone_list});         
          }
          else
          {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({issuccess:false, msg: "Access Denied..."});
          }
    }
    catch (ex){
         //console.log(ex);
        logs.error('Railwaystation page error Api (getregiteredzones)' + ex);
        res.status(400).json({
        issuccess: false,
        msg: `Something went wrong. Please try again later.`,
        });
    }
});

//get  registered division based on registered zone
railwaystation.get("/getregitereddivisionbyzones", validuser, async (req, res) => {
    try{
        logs.info("get getregitereddivisionbyzones started");
        const user_id = JwtDecode(req.token).Userid,
          user_role = JwtDecode(req.token).Roles,
          user_mail = JwtDecode(req.token).Email;
          var zoneName = req.query.zonename;

          if(user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge" || user_role === "Employee") {
                    
            var get_reg_div_list = await RegisteredRailwayStations.findAll({ where: { isdele: false,
                zonename: { [Op.in]: [zoneName] }}, 
                order: [["stationname", "ASC"]],
                attributes:["divisionname"],
                raw:true
             });    
             get_reg_div_list = lodash.uniq(get_reg_div_list.map(item => item.divisionname));       
            logs.info("get getregitereddivisionbyzones ended");
            //console.log("get all station ended");
            res.status(200).json({issuccess:true, data:get_reg_div_list});         
          }
          else
          {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({issuccess:false, msg: "Access Denied..."});
          }
    }
    catch (ex){
         //console.log(ex);
        logs.error('Railwaystation page error Api (getregitereddivisionbyzones)' + ex);
        res.status(400).json({
        issuccess: false,
        msg: `Something went wrong. Please try again later.`,
        });
    }
});

//get  registered station based on registered zone and  division
railwaystation.get("/getregiteredstationbyzonesdivision", validuser, async (req, res) => {
    try{
        logs.info("get getregiteredstationbyzonesdivision started");
        const user_id = JwtDecode(req.token).Userid,
          user_role = JwtDecode(req.token).Roles,
          user_mail = JwtDecode(req.token).Email;
          var zoneName = req.query.zonename;
          var divisionName = req.query.divisionname;

          if(user_role === "Admin" || user_role === "Super Admin" || user_role === "Station Incharge" || user_role === "Employee") {
                    
            var get_reg_station_list = await RegisteredRailwayStations.findAll(
                { 
                where: { 
                isdele: false,
                [Op.and]:[
                    { zonename: { [Op.iLike]: `%${zoneName}%` } },
                    { divisionname: { [Op.iLike]: `%${divisionName}%` } },
                ],
            },
                order: [["stationname", "ASC"]],
                attributes:["stationname", "id"],
                raw:true
             });    
             get_reg_station_list = lodash.uniq(get_reg_station_list.map(item => item));       
            logs.info("get getregiteredstationbyzonesdivision ended");
            //console.log("get all station ended");
            res.status(200).json({issuccess:true, data:get_reg_station_list});         
          }
          else
          {
            logs.info("Admin Only access this page.");
            //console.log("Admin Only access this page.")
            res.status(401).json({issuccess:false, msg: "Access Denied..."});
          }
    }
    catch (ex){
         //console.log(ex);
        logs.error('Railwaystation page error Api (getregiteredstationbyzonesdivision)' + ex);
        res.status(400).json({
        issuccess: false,
        msg: `Something went wrong. Please try again later.`,
        });
    }
});
module.exports = railwaystation;