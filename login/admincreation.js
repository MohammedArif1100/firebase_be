const express = require("express");
const db = require("../config/db").db;
const moment = require("moment");
const process = require("process");
const bcrypt = require('bcrypt');
// var LINQ = require('node-linq').LINQ;

const app = new express();
app.use(express.json());

const dotenv = require("dotenv");
dotenv.config();

const log4js = require("../log4js");
const logs = log4js.logger;

const RegisteredUserDetails = require("../models/registereduserdetails");
const UserRoles = require("../models/userrole");

//admin creation function call
const admin_insert = async () => {
    try {
        const get_total_count = await RegisteredUserDetails.findAll();
        //console.log('Total users count-' + get_total_count.length);
        //logs.info('Total users count-' + get_total_count.length);
        const current_datetime = moment().format("YYYY-MM-DD HH:mm:ss");
        const roles = "Admin"
        if (get_total_count.length === 0) {
            logs.info('Admin creation started')
            //console.log(`Admin creation started`);    
            //password hasher
            const password_hash = await bcrypt.hashSync(process.env.SUPERADMIN_PASSWORD, Number((process.env.saltRounds)));
            //insert super admin and admin details
            let transaction = await db.transaction({ autocommit: false });
            try {
                let users_list = [
                    {
                        username: "Software",
                        email: "sw@caliberinterconnect.net",
                        password: password_hash,
                        userstatus: true,
                        islock: false,
                        ismail_verified: true,
                        createddate: current_datetime,
                        incorrect_password_attempt: "0",
                        isdel: false,
                        mobile_number: "1234567890",
                        mobile_access: true,
                        updateddate: current_datetime,
                        roles: "Super Admin",
                    },
                    {
                        username: "Admin",
                        email: "admin@railways.com",
                        password: password_hash,
                        userstatus: true,
                        islock: false,
                        ismail_verified: true,
                        createddate: current_datetime,
                        incorrect_password_attempt: "0",
                        isdel: false,
                        mobile_number: "8870027842",
                        mobile_access: true,
                        updateddate: current_datetime,
                        roles,
                    },
                ];
                const create_admin_login = await RegisteredUserDetails
                    .bulkCreate(users_list, { transaction: transaction });
                logs.info('super admin and admin created')
                //console.log('super admin and admin created');
                //insert user roles details
                const userRoles_list = [
                    {
                        userrole: "Super Admin",
                        createdby_id: `${create_admin_login[1].id}`,
                        createddate: `${current_datetime}`,
                        isdele: false,
                    },
                    {
                        userrole: "Admin",
                        createdby_id: `${create_admin_login[1].id}`,
                        createddate: `${current_datetime}`,
                        isdele: false,
                    },
                    {
                        userrole: "Station Incharge",
                        createdby_id: `${create_admin_login[1].id}`,
                        createddate: `${current_datetime}`,
                        isdele: false,
                    },
                    {
                        userrole: "Employee",
                        createdby_id: `${create_admin_login[1].id}`,
                        createddate: `${current_datetime}`,
                        isdele: false,
                    },
                ];
                const create_useraction = await UserRoles
                    .bulkCreate(userRoles_list, { transaction: transaction })
                    .then((datas) => { });
                //commit the datas into database
                logs.info('user roles created')
                await transaction.commit();
                //console.log('user roles created');                    
            }
            catch (ex) {
                //if any error occured while commiting database will rool bacl into previous identity
                await transaction.rollback();
                //console.log(ex.message);
                logs.error('admin insertion error-' + ex);
            }
        }
    }
    catch (ex) {
        logs.info("admin creation error-" + ex);
    }
}

module.exports = admin_insert;

