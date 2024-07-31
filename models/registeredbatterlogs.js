const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("Battery logs table creation");

const RegisteredBatteryLogs = db.define(
    'RegisteredBatteryLogs',
    {
        batteryid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },  
        batteryname: {
            type:Sequelize.STRING,
            allowNull:true,
        },        
        stationid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },   
        type: {
            type:Sequelize.STRING,
            allowNull:false,
        },  
        manufacture: {
            type:Sequelize.STRING,
            allowNull:true,
        },   
        serialno: {
            type:Sequelize.STRING,
            allowNull:true,
        },                     
        updateddate: {
            type:Sequelize.DATE,
            allowNull:false,
        },  
        updatedby_id: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },   
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: true,
        }, 
        isdele_reason: {
            type: Sequelize.STRING,
            allowNull: true,
          },   
        isdele: {
            type:Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        }
    },
    {
        tabelname: 'RegisteredBatteryLogs',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredBatteryLogs.sync({alter:true})

module.exports = RegisteredBatteryLogs;