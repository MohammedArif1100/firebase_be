const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("LC Gate data table creation");

const LCGateData = db.define(
    'LCGateData' , 
    {
        lcgateid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        announciator_relay_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        proving_relay_voltage :{
            type:Sequelize.DOUBLE,
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
        tabelname: 'LCGateData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

LCGateData.sync({alter:true})

module.exports = LCGateData;