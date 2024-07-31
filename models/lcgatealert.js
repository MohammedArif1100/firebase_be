const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("LC Gate alert log table creation");

const LCGateAlert = db.define(
    'LCGateAlert' , 
    {
        lcgateid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        lcgatedataid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },     
        stationid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        message :{
            type:Sequelize.TEXT,
            allowNull:false,
        },
        modeid : {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        createddate: {
            type:Sequelize.DATE,
            allowNull:false,
        },    
        isdele: {
            type:Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        }
    },
    {
        tabelname: 'LCGateAlert',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

LCGateAlert.sync({alter:true})

module.exports = LCGateAlert;