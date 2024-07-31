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


const ips = express.Router();

const app = new express();
app.use(express.json());

require("expose-gc")


const db = require("../../config/db").db;
const { validuser } = require("../../login/verifytoken");
const Asserts = require("../../models/asserts");
const RegisteredIPS = require("../../models/registeredips");
const RegisteredIPSLogs = require("../../models/registeredipslogs");
const StationAccess = require("../../models/stationaccess");
const NotificationControl = require("../../models/notificationcontrol");
const RegisteredRailwayStations = require("../../models/registeredrailwaystation");
const IPSData = require("../../models/ipsdata");
const IPSAlert = require("../../models/ipsalert");
const AlertMode = require("../../models/alertmode");
const excel = require("exceljs");
const reader = require('xlsx');


//register ips
ips.post("/registerips", validuser, async (req, res) => {
    try {
        logs.info("New IPS registration started");
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
            const stationid = req.body.stationid,
                ipsname = req.body.ipsname,
                manufacture = req.body.manufacture,
                serialno = req.body.serialno,
                createdby_id = user_id,
                isdele = false;

            var ips_check = [await RegisteredIPS.findOne({
                where: { stationid: stationid, ipsname: ipsname },
            })];
            ips_check = ips_check[0] !== null ? ips_check : []

            const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                current_Date = moment().format("YYYY-MM-DD");

            if (ips_check.length !== 0) {
                if (ips_check[0].isdele === true) {
                    let transaction = await db.transaction({ autocommit: false });
                    try {
                        const update_ips = await RegisteredIPS.update(
                            {
                                stationid,
                                ipsname,
                                manufacture,
                                serialno,
                                updateddate: current_datetime,
                                isdele: false,
                                isdele_reason: null,
                            },
                            { where: { id: ips_check[0].id }, returning: true, plain: true },
                            { transaction: transaction }, { raw: true })
                        logs.info("IPS registration inserted");

                        const log_insert = await RegisteredIPSLogs.create(
                            {
                                ipsid: update_ips[1].id,
                                ipsname: update_ips[1].ipsname,
                                stationid: update_ips[1].stationid,
                                manufacture: update_ips[1].manufacture,
                                serialno: update_ips[1].serialno,
                                updateddate: current_datetime,
                                updatedby_id: user_id,
                                isdele_reason: null,
                                isdele,
                            },
                            { transaction: transaction }
                        );
                        logs.info("IPS registration log inserted");

                        await transaction.commit();
                        res
                            .status(200)
                            .json({ issuccess: true, msg: "IPS inserted Successfully" });
                        logs.info("IPS Successfully Registered");
                        //console.log("IPS Successfully Registered")
                    }
                    catch (ex) {
                        await transaction.rollback();
                        //console.log(ex.message);
                        logs.error('IPS page error Api (registerips)' + ex);
                        res.status(400).json({ issuccess: false, msg: ex.message });
                        mail.mailSendError(`Error in IPS page. Api (registerips)`, ex);
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
                    const register_ips = await RegisteredIPS.create({
                        stationid,
                        ipsname,
                        manufacture,
                        serialno,
                        createddate: current_datetime,
                        createdby_id,
                        updateddate: current_datetime,
                        isdele,
                    },
                        { transaction: transaction })
                    logs.info("IPS registration inserted");

                    const log_insert = await RegisteredIPSLogs.create(
                        {
                            ipsid: register_ips.id,
                            stationid,
                            ipsname,
                            manufacture,
                            serialno,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele,
                        },
                        { transaction: transaction }
                    );
                    logs.info("IPS registration log inserted");

                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "IPS inserted Successfully" });
                    logs.info("IPS Successfully Registered");
                    //console.log("IPS Successfully Registered")
                }
                catch (ex) {
                    await transaction.rollback();
                    //console.log(ex.message);
                    logs.error('IPS page error Api (registerips)' + ex);
                    res.status(400).json({ issuccess: false, msg: ex.message });
                    mail.mailSendError(`Error in IPS page. Api (registerips)`, ex);
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
        logs.error('IPS page error Api (registerips)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in IPS page. Api (registerips)`, ex);
    }
});

//edit registered ips
ips.put("/editips", validuser, async (req, res) => {
    try {
        logs.info("IPS edit started");
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
                    currentipsname = req.body.currentipsname,
                    newipsname = req.body.newipsname,
                    stationid = parseInt(req.body.stationid),
                    ipsname = req.body.ipsname,
                    manufacture = req.body.manufacture,
                    serialno = req.body.serialno,
                    isdele = false

                const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss"),
                    current_Date = moment().format("YYYY-MM-DD");

                const station_ips = await RegisteredIPS.findAll(
                    { where: { stationid, isdele: false }, raw: true, }
                )

                var ips_check = lodash.find(station_ips, { id: id })
                ips_check = ips_check == undefined ? null : ips_check

                if (ips_check == null) {
                    logs.info("IPS not exists in this station.");
                    //console.log("IPS not exists in this station.");
                    res.status(401).json({ issuccess: false, msg: "IPS not exists in this station." });
                }
                else {

                    let repeat_names = false;

                    currentipsname == newipsname ? repeat_names = false : station_ips.find(value => value.ipname == newipsname) ? repeat_names = true : false

                    let transaction = await db.transaction({ autocommit: false });
                    try {
                        if (repeat_names == false) {
                            const update_ips = await RegisteredIPS.update(
                                {
                                    ipsname: newipsname,
                                    manufacture: manufacture,
                                    serialno: serialno,
                                    updateddate: current_datetime
                                },
                                { where: { id }, returning: true, plain: true },
                                { transaction: transaction }, { raw: true })

                            logs.info("IPS updated");
                            const log_insert = await RegisteredIPSLogs.create(
                                {
                                    ipsid: update_ips[1].id,
                                    ipsname: update_ips[1].ipsname,
                                    stationid: update_ips[1].stationid,
                                    ipsname: update_ips[1].ipsname,
                                    manufacture: update_ips[1].manufacture,
                                    serialno: update_ips[1].serialno,
                                    updateddate: current_datetime,
                                    updatedby_id: user_id,
                                    isdele,
                                },
                                { transaction: transaction }
                            );
                            logs.info("IPS log inserted");
                            await transaction.commit();
                            res
                                .status(200)
                                .json({ issuccess: true, msg: "Successfully Updated" });
                            logs.info("IPS Successfully Updated");
                            //console.log("IPS Successfully Updated")  
                        }
                        else {
                            logs.info("IPS already exist in this station");
                            res.status(400).json({ issuccess: false, msg: "IPS already exists in the station" });
                        }
                    }
                    catch (ex) {
                        await transaction.rollback();
                        //console.log(ex.message);
                        logs.error('IPS page error Api (editips)' + ex);
                        res.status(400).json({ issuccess: false, msg: ex.message });
                        mail.mailSendError(`Error in IPS page. Api (editips)`, ex);
                    }
                }
            }
            catch (ex) {
                //console.log(ex.message);
                logs.error('IPS page error Api (editips)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(`Error in IPS page. Api (editips)`, ex);
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
        logs.error('IPS page error Api (editips)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in IPS page. Api (editips)`, ex);
    }
});

//delete ips
ips.put("/deleteips", validuser, async (req, res) => {
    try {
        logs.info("IPS delete started");
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

                const ips_check = await RegisteredIPS.findOne(
                    {
                        where: { id, isdele: false },
                    })

                if (ips_check != null) {

                    const update_ips = await RegisteredIPS.update(
                        {
                            isdele: true,
                            isdele_reason: isdele_reason,
                            updateddate: current_datetime
                        },
                        { where: { id }, returning: true, plain: true },
                        { transaction: transaction }, { raw: true });

                    logs.info("IPS dele updated");

                    const log_insert = await RegisteredIPSLogs.create(
                        {
                            ipsid: update_ips[1].id,
                            stationid: update_ips[1].stationid,
                            ipsname: update_ips[1].ipsname,
                            manufacture: update_ips[1].manufacture,
                            serialno: update_ips[1].serialno,
                            updateddate: current_datetime,
                            updatedby_id: user_id,
                            isdele_reason: update_ips[1].isdele_reason,
                            isdele: false,
                        },
                        { transaction: transaction }
                    );
                    logs.info("IPS dele log inserted");
                    await transaction.commit();
                    res
                        .status(200)
                        .json({ issuccess: true, msg: "Successfully deleted" });
                    logs.info("IPS Successfully deleted");
                    //console.log("IPS Successfully deleted")
                }
                else {
                    logs.info("IPS not found");
                    //console.log("IPS not found"");
                    res.status(401).json({ issuccess: false, msg: "IPS not found" });
                }
            }
            catch (ex) {
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('IPS page error Api (deleteips)' + ex);
                res.status(400).json({ issuccess: false, msg: ex.message });
                mail.mailSendError(
                    `Error in IPS page. Api (deleteips)`,
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
        logs.error('IPS page error Api (deleteips)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
        mail.mailSendError(
            `Error in IPS page. Api (deleteips)`, ex);
    }
});

//get all IPS in a station for ips list
ips.get("/getallips", validuser, async (req, res) => {
    try {
        //console.log(`get ips started`);         
        logs.info(`get ips started`)
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles,
            user_mail = JwtDecode(req.token).Email;

        if (user_role == "Station Incharge") {

            const access = await StationAccess.findAll(
                { where: { userid: user_id, isdele: false }, raw: true, })
            if (access.length > 0) {

                RegisteredRailwayStations.hasMany(RegisteredIPS, { foreignKey: 'stationid' });
                RegisteredIPS.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

                const datas = await RegisteredRailwayStations.findAll({
                    attributes: [
                        ['id', 'stationid'],
                        'stationname',
                        'stationcode',
                        [Sequelize.literal('"RegisteredIPs"."id"'), 'id'],
                        [Sequelize.literal('"RegisteredIPs"."ipsname"'), 'ipsname'],
                        [Sequelize.literal('"RegisteredIPs"."manufacture"'), 'manufacture'],
                        [Sequelize.literal('"RegisteredIPs"."serialno"'), 'serialno'],
                    ],
                    include: [
                        {
                            model: RegisteredIPS,
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
                        [Sequelize.literal('"RegisteredIPs"."id"')],
                    ],
                })

                logs.info(`get ips end`)
                res.status(200).json({ issuccess: true, data: datas });
            }
            else {
                logs.info(`get ips end`)
                res.status(200).json({ issuccess: true, data: [] });
            }

        }
        else {
            if (user_role == "Admin") {

                RegisteredRailwayStations.hasMany(RegisteredIPS, { foreignKey: 'stationid' });
                RegisteredIPS.belongsTo(RegisteredRailwayStations, { foreignKey: 'stationid' });

                const datas = await RegisteredRailwayStations.findAll({
                    attributes: [
                        ['id', 'stationid'],
                        'stationname',
                        'stationcode',
                        [Sequelize.literal('"RegisteredIPs"."id"'), 'id'],
                        [Sequelize.literal('"RegisteredIPs"."ipsname"'), 'ipsname'],
                        [Sequelize.literal('"RegisteredIPs"."manufacture"'), 'manufacture'],
                        [Sequelize.literal('"RegisteredIPs"."serialno"'), 'serialno'],
                    ],
                    include: [
                        {
                            model: RegisteredIPS,
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
                        [Sequelize.literal('"RegisteredIPs"."id"')],
                    ],
                })

                logs.info(`get ips end`)
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
        logs.error('IPS page error Api (getallips)' + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

// get ips data
ips.get("/getipsdata", validuser, async (req, res) => {
    logs.info("getipsdata  started")
    try {
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        const stationid = 1;
        const ipsid = 1;
        if (user_role == "Admin" || user_role == "Super Admin") {
            var get_list = await IPSData.findAll({
                where: { ipsid: ipsid },
                order: [["id", "DESC"]],
            });
            res.status(200).json({ issuccess: true, data: get_list });
        }
        else if (user_role == "Station Incharge") {

            const access_check = await StationAccess.findOne(
                { where: { stationid: stationid, userid: user_id, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSData.findAll({
                    where: { ipsid: ipsid },
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSData.findAll({
                    where: { ipsid: ipsid },
                    order: [["id", "DESC"]],
                });
                res.status(200).json({ issuccess: true, data: get_list });
            }
            else {
                res.status(400).json({ issuccess: false, msg: "you dont have access to views logs" });
            }
        }
        logs.info(
            "get ips data logs ended"
        );
    } catch (ex) {
        logs.error("IPS data error Api (getipsdata)" + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

// get ips data
ips.get("/getstationips", validuser, async (req, res) => {
    logs.info("getstationips started")
    try {
        logs.info(req.query)

        var get_ips = await RegisteredIPS.findOne({
            where: {
                stationid: parseInt(req.query.stationid),
                isdele: false,
            },
            raw: true
        })
        var get_list = []
        if (get_ips != null) {
            get_list = await IPSData.findOne({
                where: { ipsid: get_ips.id, isdele: false },
                order: [["id", "DESC"]],
                limit: 1,
                raw: true,
            })
            if (get_list != null) {
                get_list.ipsd = get_ips.id
                get_list.ipsname = get_ips.ipsname
            }
            get_list = get_list != null ? [get_list] : []
        }
        res.status(200).json({ issuccess: true, data: get_list });
        logs.info("get ips data ended");
    } catch (ex) {
        logs.error("IPS data error Api (getstationips)" + ex);
        res.status(400).json({
            issuccess: false,
            msg: `Something went wrong. Please try again later.`,
        });
    }
});

//get the selected ips current data based on paginaion
ips.get("/getstationipscurrentdata", validuser, async (req, res) => {
    logs.info(`get station ips current  data started`);
    try {
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        //user_mail = JwtDecode(req.token).Email; 
        const stationid = req.query.stationid
        const ipsid = req.query.ipsid

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
        where_condition.ipsid = ipsid;
        logs.info("where condition is : " + where_condition);

        var total_data_count = await IPSData.count({
            where: where_condition,
            order: [["id", "DESC"]],
        });

        if (user_role == "Admin" || user_role == "Super Admin") {

            var get_list = await IPSData.findAll({
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
                var get_list = await IPSData.findAll({
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSData.findAll({
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
            "get ips data logs ended"
        );
    }
    catch (ex) {
        logs.error('IPS page error Api (getstationipscurrentdata)' + ex);
        res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
    }

});

//get the selected current alert data based opaginaion
ips.get("/getstationipscurrentalert", validuser, async (req, res) => {
    try {
        logs.info(
            "get ips current alert started"
        );

        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        //user_mail = JwtDecode(req.token).Email; 
        const stationid = req.query.stationid
        const ipsid = req.query.ipsid

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
        where_condition.ipsid = ipsid;
        logs.info("where condition is : " + where_condition);

        var total_data_count = await IPSAlert.count({
            where: where_condition,
            order: [["id", "DESC"]],
        });

        if (user_role == "Admin" || user_role == "Super Admin") {
            var get_list = await IPSAlert.findAll({
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
                var get_list = await IPSAlert.findAll({
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSAlert.findAll({
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
            "get ips current alert ended"
        );
    } catch (ex) {
        //console.log(ex.message);
        logs.error('IPS page error Api (getstationipscurrentalert)' + ex);
        res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
    }
});

//get the selected data based on start , end and paginaion
ips.get("/getstationipsdata", validuser, async (req, res) => {
    logs.info(`get station ips data started`);
    try {
        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        //user_mail = JwtDecode(req.token).Email; 
        const stationid = req.query.stationid
        const ipsid = req.query.ipsid

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
        where_condition.ipsid = ipsid;
        logs.info("where condition is : " + where_condition);

        var total_data_count = await IPSData.count({
            where: where_condition,
            order: [["id", "DESC"]],
        });

        if (user_role == "Admin" || user_role == "Super Admin") {

            var get_list = await IPSData.findAll({
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
                var get_list = await IPSData.findAll({
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSData.findAll({
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
            "get ips data logs ended"
        );
    }
    catch (ex) {
        logs.error('IPS page error Api (getstationipsdata)' + ex);
        res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
    }

});

//get the selected ips alert logs based on start,end and paginaion
ips.get("/getstationipsalert", validuser, async (req, res) => {
    try {
        logs.info(
            "get ips alert logs started"
        );

        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        //user_mail = JwtDecode(req.token).Email; 
        const stationid = req.query.stationid
        const ipsid = req.query.ipsid

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
        where_condition.ipsid = ipsid;
        logs.info("where condition is : " + where_condition);

        var total_data_count = await IPSAlert.count({
            where: where_condition,
            order: [["id", "DESC"]],
        });

        if (user_role == "Admin" || user_role == "Super Admin") {
            var get_list = await IPSAlert.findAll({
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
                var get_list = await IPSAlert.findAll({
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSAlert.findAll({
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
            "get ips alert logs ended"
        );
    } catch (ex) {
        //console.log(ex.message);
        logs.error('IPS page error Api (getstationipsalert)' + ex);
        res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
    }
});

//download the selected ips circuit data based on start,end and paginaion
ips.get("/downloadipsdatareport", validuser, async (req, res) => {
    try {
        logs.info(
            "get ips circuit data report started"
        );

        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        //user_mail = JwtDecode(req.token).Email;    
        const stationid = req.query.stationid
        const ipsid = req.query.ipsid

        const ipsname = await RegisteredIPS.findOne({ where: { id: ipsid, isdele: false } })

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
        let worksheet = workbook.addWorksheet("IPSDate");

        // res is a Stream object
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "IPSDataReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
        );

        //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

        worksheet.columns = [
            { header: "S.No", key: "Id", width: 5 },
            // { header: "Station Name", key: "stationname", width: 10 },
            { header: "IPS Name", key: "ipsname", width: 20 },
            { header: "Track(V) CBF", key: "track_voltage_cbf", width: 10 },
            { header: "Track(V) MTP", key: "track_voltage_mtp", width: 10 },
            { header: "Signal(V) CBF", key: "signal_voltage_cbf", width: 10 },
            { header: "Signal(V) MTP", key: "signal_voltage_mtp", width: 10 },
            { header: "B110(Vdc)", key: "b110_vdc", width: 10 },
            { header: "EXT Relay(V) CBF", key: "ext_relay_voltage_cbf", width: 10 },
            { header: "EXT Relay(V) MTP", key: "ext_relay_voltage_mtp", width: 10 },
            { header: "Block(V) CBF", key: "block_voltage_cbf", width: 10 },
            { header: "Block(V) MTP", key: "block_voltage_mtp", width: 10 },
            { header: "BLB(V) CBF", key: "block_line_bat_voltage_cbf", width: 10 },
            { header: "BLB(V) MTP", key: "block_line_bat_voltage_mtp", width: 10 },
            { header: "AxleCounter(V) CBF", key: "axle_counter_voltage_cbf", width: 10 },
            { header: "AxleCounter(V) MTP", key: "axle_counter_voltage_mtp", width: 10 },
            { header: "LVR (VDC)", key: "lvr_vdc", width: 10 },
            { header: "AxleCounter(V) CBF 1", key: "axle_counter_voltage_cbf_1", width: 10 },
            { header: "Track(I) CBF", key: "track_current_cbf", width: 10 },
            { header: "Track(I) MTP", key: "track_current_mtp", width: 10 },
            { header: "Signal(I) CBF", key: "signal_current_cbf", width: 10 },
            { header: "Signal(I) MTP", key: "signal_current_mtp", width: 10 },
            { header: "B110(Idc)", key: "b110_idc", width: 10 },
            { header: "EXT Relay(I) CBF", key: "ext_relay_current_cbf", width: 10 },
            { header: "EXT Relay(I) MTP", key: "ext_relay_current_mtp", width: 10 },
            { header: "Block(I) CBF", key: "block_current_cbf", width: 10 },
            { header: "Block(I) MTP", key: "block_current_mtp", width: 10 },
            { header: "BLB(I) CBF", key: "block_line_bat_current_cbf", width: 10 },
            { header: "BLB(I) MTP", key: "block_line_bat_current_mtp", width: 10 },
            { header: "AxleCounter(I) CBF", key: "axle_counter_current_cbf", width: 10 },
            { header: "AxleCounter(I) MTP", key: "axle_counter_current_mtp", width: 10 },
            { header: "AxleCounter(I) CBF 1", key: "axle_counter_current_cbf_1", width: 10 },
            { header: "IRS(V) CBF OC", key: "internal_relay_signal_voltage_cbf_oc", width: 10 },
            { header: "IRS(V) CBF IC", key: "internal_relay_signal_voltage_cbf_ic", width: 10 },
            { header: "IRS(V) MTP OC", key: "internal_relay_signal_voltage_mtp_oc", width: 10 },
            { header: "IRS(V) MTP IC", key: "internal_relay_signal_voltage_mtp_ic", width: 10 },
            { header: "Point(V) IC", key: "point_machine_voltage_ic", width: 10 },
            { header: "Point(V) CBF IC", key: "point_machine_voltage_cbf_oc", width: 10 },
            { header: "Point(V) MTP OC", key: "point_machine_voltage_mtp_oc", width: 10 },
            { header: "IRS(I) CBF OC", key: "internal_relay_signal_current_cbf_oc", width: 10 },
            { header: "IRS(I) CBF IC", key: "internal_relay_signal_current_cbf_ic", width: 10 },
            { header: "IRS(I) MTP IC", key: "internal_relay_signal_current_mtp_ic", width: 10 },
            { header: "IRS(I) MTP OC", key: "internal_relay_signal_current_mtp_oc", width: 10 },
            { header: "Point(I) IC", key: "point_machine_current_ic", width: 10 },
            { header: "Point(I) CBF OC", key: "point_machine_current_cbf_oc", width: 10 },
            { header: "Point(I) MTP OC", key: "point_machine_current_mtp_oc", width: 10 },
            { header: "LMP(V) IC", key: "local_main_power_voltage_ic", width: 10 },
            { header: "LMP(V) OC", key: "local_main_power_voltage_oc", width: 10 },
            { header: "Load(I) IC", key: "load_current_ic", width: 10 },
            { header: "Load(I) OC", key: "load_current_oc", width: 10 },
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
        where_condition.ipsid = ipsid;
        logs.info("where condition is : " + where_condition);

        if (user_role == "Admin" || user_role == "Super Admin") {

            var get_list = await IPSData.findAll({
                where: where_condition,
                order: [["id", "DESC"]],
                raw: true,
            });
            global.gc()
            for await (const element of get_list) {
                list.push({
                    Id: sno,
                    ipsname: ipsname.ipsname + ' @' + stationname.stationname,
                    track_voltage_cbf: element.track_voltage_cbf,
                    track_voltage_mtp: element.track_voltage_mtp,
                    signal_voltage_cbf: element.signal_voltage_cbf,
                    signal_voltage_mtp: element.signal_voltage_mtp,
                    b110_vdc: element.b110_vdc,
                    ext_relay_voltage_cbf: element.ext_relay_voltage_cbf,
                    ext_relay_voltage_mtp: element.ext_relay_voltage_mtp,
                    block_voltage_cbf: element.block_voltage_cbf,
                    block_voltage_mtp: element.block_voltage_mtp,
                    block_line_bat_voltage_cbf: element.block_line_bat_voltage_cbf,
                    block_line_bat_voltage_mtp: element.block_line_bat_voltage_mtp,
                    axle_counter_voltage_cbf: element.axle_counter_voltage_cbf,
                    axle_counter_voltage_mtp: element.axle_counter_voltage_mtp,
                    lvr_vdc: element.lvr_vdc,
                    axle_counter_voltage_cbf_1: element.axle_counter_voltage_cbf_1,
                    track_current_cbf: element.track_current_cbf,
                    track_current_mtp: element.track_current_mtp,
                    signal_current_cbf: element.signal_current_cbf,
                    signal_current_mtp: element.signal_current_mtp,
                    b110_idc: element.b110_idc,
                    ext_relay_current_cbf: element.ext_relay_current_cbf,
                    ext_relay_current_mtp: element.ext_relay_current_mtp,
                    block_current_cbf: element.block_current_cbf,
                    block_current_mtp: element.block_current_mtp,
                    block_line_bat_current_cbf: element.block_line_bat_current_cbf,
                    block_line_bat_current_mtp: element.block_line_bat_current_mtp,
                    axle_counter_current_cbf: element.axle_counter_current_cbf,
                    axle_counter_current_mtp: element.axle_counter_current_mtp,
                    axle_counter_current_cbf_1: element.axle_counter_current_cbf_1,
                    internal_relay_signal_voltage_cbf_oc: element.internal_relay_signal_voltage_cbf_oc,
                    internal_relay_signal_voltage_cbf_ic: element.internal_relay_signal_voltage_cbf_ic,
                    internal_relay_signal_voltage_mtp_oc: element.internal_relay_signal_voltage_mtp_oc,
                    internal_relay_signal_voltage_mtp_ic: element.internal_relay_signal_voltage_mtp_ic,
                    point_machine_voltage_ic: element.point_machine_voltage_ic,
                    point_machine_voltage_cbf_oc: element.point_machine_voltage_cbf_oc,
                    point_machine_voltage_mtp_oc: element.point_machine_voltage_mtp_oc,
                    internal_relay_signal_current_cbf_oc: element.internal_relay_signal_current_cbf_oc,
                    internal_relay_signal_current_cbf_ic: element.internal_relay_signal_current_cbf_ic,
                    internal_relay_signal_current_mtp_ic: element.internal_relay_signal_current_mtp_ic,
                    internal_relay_signal_current_mtp_oc: element.internal_relay_signal_current_mtp_oc,
                    point_machine_current_ic: element.point_machine_current_ic,
                    point_machine_current_cbf_oc: element.point_machine_current_cbf_oc,
                    point_machine_current_mtp_oc: element.point_machine_current_mtp_oc,
                    local_main_power_voltage_ic: element.local_main_power_voltage_ic,
                    local_main_power_voltage_oc: element.local_main_power_voltage_oc,
                    load_current_ic: element.load_current_ic,
                    load_current_oc: element.load_current_oc,
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
                var get_list = await IPSData.findAll({
                    where: where_condition,
                    order: [["id", "DESC"]],
                    raw: true,
                });
                global.gc()
                for await (const element of get_list) {
                    list.push({
                        Id: sno,
                        ipsname: ipsname.ipsname + ' @' + stationname.stationname,
                        track_voltage_cbf: element.track_voltage_cbf,
                        track_voltage_mtp: element.track_voltage_mtp,
                        signal_voltage_cbf: element.signal_voltage_cbf,
                        signal_voltage_mtp: element.signal_voltage_mtp,
                        b110_vdc: element.b110_vdc,
                        ext_relay_voltage_cbf: element.ext_relay_voltage_cbf,
                        ext_relay_voltage_mtp: element.ext_relay_voltage_mtp,
                        block_voltage_cbf: element.block_voltage_cbf,
                        block_voltage_mtp: element.block_voltage_mtp,
                        block_line_bat_voltage_cbf: element.block_line_bat_voltage_cbf,
                        block_line_bat_voltage_mtp: element.block_line_bat_voltage_mtp,
                        axle_counter_voltage_cbf: element.axle_counter_voltage_cbf,
                        axle_counter_voltage_mtp: element.axle_counter_voltage_mtp,
                        lvr_vdc: element.lvr_vdc,
                        axle_counter_voltage_cbf_1: element.axle_counter_voltage_cbf_1,
                        track_current_cbf: element.track_current_cbf,
                        track_current_mtp: element.track_current_mtp,
                        signal_current_cbf: element.signal_current_cbf,
                        signal_current_mtp: element.signal_current_mtp,
                        b110_idc: element.b110_idc,
                        ext_relay_current_cbf: element.ext_relay_current_cbf,
                        ext_relay_current_mtp: element.ext_relay_current_mtp,
                        block_current_cbf: element.block_current_cbf,
                        block_current_mtp: element.block_current_mtp,
                        block_line_bat_current_cbf: element.block_line_bat_current_cbf,
                        block_line_bat_current_mtp: element.block_line_bat_current_mtp,
                        axle_counter_current_cbf: element.axle_counter_current_cbf,
                        axle_counter_current_mtp: element.axle_counter_current_mtp,
                        axle_counter_current_cbf_1: element.axle_counter_current_cbf_1,
                        internal_relay_signal_voltage_cbf_oc: element.internal_relay_signal_voltage_cbf_oc,
                        internal_relay_signal_voltage_cbf_ic: element.internal_relay_signal_voltage_cbf_ic,
                        internal_relay_signal_voltage_mtp_oc: element.internal_relay_signal_voltage_mtp_oc,
                        internal_relay_signal_voltage_mtp_ic: element.internal_relay_signal_voltage_mtp_ic,
                        point_machine_voltage_ic: element.point_machine_voltage_ic,
                        point_machine_voltage_cbf_oc: element.point_machine_voltage_cbf_oc,
                        point_machine_voltage_mtp_oc: element.point_machine_voltage_mtp_oc,
                        internal_relay_signal_current_cbf_oc: element.internal_relay_signal_current_cbf_oc,
                        internal_relay_signal_current_cbf_ic: element.internal_relay_signal_current_cbf_ic,
                        internal_relay_signal_current_mtp_ic: element.internal_relay_signal_current_mtp_ic,
                        internal_relay_signal_current_mtp_oc: element.internal_relay_signal_current_mtp_oc,
                        point_machine_current_ic: element.point_machine_current_ic,
                        point_machine_current_cbf_oc: element.point_machine_current_cbf_oc,
                        point_machine_current_mtp_oc: element.point_machine_current_mtp_oc,
                        local_main_power_voltage_ic: element.local_main_power_voltage_ic,
                        local_main_power_voltage_oc: element.local_main_power_voltage_oc,
                        load_current_ic: element.load_current_ic,
                        load_current_oc: element.load_current_oc,
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSData.findAll({
                    where: where_condition,
                    order: [["id", "DESC"]],
                    raw: true,
                });
                global.gc()
                for await (const element of get_list) {
                    list.push({
                        Id: sno,
                        ipsname: ipsname.ipsname + ' @' + stationname.stationname,
                        track_voltage_cbf: element.track_voltage_cbf,
                        track_voltage_mtp: element.track_voltage_mtp,
                        signal_voltage_cbf: element.signal_voltage_cbf,
                        signal_voltage_mtp: element.signal_voltage_mtp,
                        b110_vdc: element.b110_vdc,
                        ext_relay_voltage_cbf: element.ext_relay_voltage_cbf,
                        ext_relay_voltage_mtp: element.ext_relay_voltage_mtp,
                        block_voltage_cbf: element.block_voltage_cbf,
                        block_voltage_mtp: element.block_voltage_mtp,
                        block_line_bat_voltage_cbf: element.block_line_bat_voltage_cbf,
                        block_line_bat_voltage_mtp: element.block_line_bat_voltage_mtp,
                        axle_counter_voltage_cbf: element.axle_counter_voltage_cbf,
                        axle_counter_voltage_mtp: element.axle_counter_voltage_mtp,
                        lvr_vdc: element.lvr_vdc,
                        axle_counter_voltage_cbf_1: element.axle_counter_voltage_cbf_1,
                        track_current_cbf: element.track_current_cbf,
                        track_current_mtp: element.track_current_mtp,
                        signal_current_cbf: element.signal_current_cbf,
                        signal_current_mtp: element.signal_current_mtp,
                        b110_idc: element.b110_idc,
                        ext_relay_current_cbf: element.ext_relay_current_cbf,
                        ext_relay_current_mtp: element.ext_relay_current_mtp,
                        block_current_cbf: element.block_current_cbf,
                        block_current_mtp: element.block_current_mtp,
                        block_line_bat_current_cbf: element.block_line_bat_current_cbf,
                        block_line_bat_current_mtp: element.block_line_bat_current_mtp,
                        axle_counter_current_cbf: element.axle_counter_current_cbf,
                        axle_counter_current_mtp: element.axle_counter_current_mtp,
                        axle_counter_current_cbf_1: element.axle_counter_current_cbf_1,
                        internal_relay_signal_voltage_cbf_oc: element.internal_relay_signal_voltage_cbf_oc,
                        internal_relay_signal_voltage_cbf_ic: element.internal_relay_signal_voltage_cbf_ic,
                        internal_relay_signal_voltage_mtp_oc: element.internal_relay_signal_voltage_mtp_oc,
                        internal_relay_signal_voltage_mtp_ic: element.internal_relay_signal_voltage_mtp_ic,
                        point_machine_voltage_ic: element.point_machine_voltage_ic,
                        point_machine_voltage_cbf_oc: element.point_machine_voltage_cbf_oc,
                        point_machine_voltage_mtp_oc: element.point_machine_voltage_mtp_oc,
                        internal_relay_signal_current_cbf_oc: element.internal_relay_signal_current_cbf_oc,
                        internal_relay_signal_current_cbf_ic: element.internal_relay_signal_current_cbf_ic,
                        internal_relay_signal_current_mtp_ic: element.internal_relay_signal_current_mtp_ic,
                        internal_relay_signal_current_mtp_oc: element.internal_relay_signal_current_mtp_oc,
                        point_machine_current_ic: element.point_machine_current_ic,
                        point_machine_current_cbf_oc: element.point_machine_current_cbf_oc,
                        point_machine_current_mtp_oc: element.point_machine_current_mtp_oc,
                        local_main_power_voltage_ic: element.local_main_power_voltage_ic,
                        local_main_power_voltage_oc: element.local_main_power_voltage_oc,
                        load_current_ic: element.load_current_ic,
                        load_current_oc: element.load_current_oc,
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
            "get ips data report ended"
        );
    } catch (ex) {
        //console.log(ex);
        logs.error('Ips page error Api (downloadipsdatareport)' + ex);
        res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
    }
});

//download the selected ips  alert based on start,end and paginaion
ips.get("/downloadipsalertreport", validuser, async (req, res) => {
    try {
        logs.info(
            "get ips alert report started"
        );

        const user_id = JwtDecode(req.token).Userid,
            user_role = JwtDecode(req.token).Roles;
        //user_mail = JwtDecode(req.token).Email;    
        const stationid = req.query.stationid
        const ipsid = req.query.ipsid

        const ipsname = await RegisteredIPS.findOne({ where: { id: ipsid, isdele: false } })

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
        let worksheet = workbook.addWorksheet("IPSAlert");

        // res is a Stream object
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "IPSAlertReport" + moment().format('MMM_DD_HH_mm_ss') + ".xlsx"
        );

        //worksheet.headerFooter.oddHeader = "&C&KCCCCCC&\"Aril\"52 exceljs";

        worksheet.columns = [
            { header: "S.No", key: "Id", width: 7 },
            // { header: "Station Name", key: "stationname", width: 10 },
            { header: "IPS Name", key: "ipsname", width: 20 },
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
        where_condition.ipsid = ipsid;
        logs.info("where condition is : " + where_condition);

        if (user_role == "Admin" || user_role == "Super Admin") {

            var get_list = await IPSAlert.findAll({
                where: where_condition,
                order: [["id", "DESC"]],
                raw: true,
            });
            global.gc()
            for await (const element of get_list) {
                list.push({
                    Id: sno, //element.id,
                    // stationname: stationname.stationname,
                    ipsname: ipsname.ipsname + ' @' + stationname.stationname,
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
                var get_list = await IPSAlert.findAll({
                    where: where_condition,
                    order: [["id", "DESC"]],
                    raw: true,
                });
                global.gc()
                for await (const element of get_list) {
                    list.push({
                        Id: sno, //element.id,
                        // stationname: stationname.stationname,
                        ipsname: ipsname.ipsname + ' @' + stationname.stationname,
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
                { where: { stationid: stationid, userid: user_id, assertsid: 7, isdele: false } })

            if (access_check != null) {
                var get_list = await IPSAlert.findAll({
                    where: where_condition,
                    order: [["id", "DESC"]],
                    raw: true,
                });
                global.gc()
                for await (const element of get_list) {
                    list.push({
                        Id: sno, //element.id,
                        // stationname: stationname.stationname,
                        ipsname: ipsname.ipsname + ' @' + stationname.stationname,
                        type: ipsname.type,
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
            "get ips alert report ended"
        );
    } catch (ex) {
        //console.log(ex);
        logs.error('Ips page error Api (downloadipsalertreport)' + ex);
        res.status(400).json({ issuccess: false, msg: `Something went wrong. Please try again later.` });
    }
});


module.exports = ips;