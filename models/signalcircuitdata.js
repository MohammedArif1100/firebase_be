const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("signal circuit data table creation");

const SignalCircuitData = db.define(
    'SignalCircuitData',
    {
        signalcircuitid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },   
        terminal :  {
            type:Sequelize.STRING,
            allowNull:false,
        }, 
        greenvoltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        greencurrent: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        redvoltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        redcurrent: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        yellowvoltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        yellowcurrent : {
            type: Sequelize.DOUBLE,
            allowNull : false,
        },
        lightyellowvoltage : {
            type : Sequelize.DOUBLE,
            allowNull : false,
        },  
        lightyellowcurrent : {
            type : Sequelize.DOUBLE,
            allowNull : false,
        },   
        whitevoltage : {
            type : Sequelize.DOUBLE,
            allowNull : false,
            defaultValue : 0,
        },  
        whitecurrent : {
            type : Sequelize.DOUBLE,
            allowNull : false,
            defaultValue : 0,
        },   
        signal_aspect: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        aspect_current: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        aspect_voltage: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        index_score: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        gui: {
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        createddate: {
            type: Sequelize.DATE,
            allowNull: false,
        }, 
        isdele: {
            type:Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        }
    },
    {
        tabelname: 'SignalCircuitData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

SignalCircuitData.sync({alter:true})

module.exports = SignalCircuitData;