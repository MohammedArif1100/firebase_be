const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Axle Counter alert log table creation");

const AxleCounterAlert = db.define(
    'AxleCounterAlert' , 
    {
        axlecounterid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        axlecounterdataid :{
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
        tabelname: 'AxleCounterAlert',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

AxleCounterAlert.sync({alter:true})

module.exports = AxleCounterAlert;