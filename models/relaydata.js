const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Relay data table creation");

const RelayData = db.define(
    'RelayData' , 
    {
        relayid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },                   
        value: {
            type:Sequelize.INTEGER,
            allowNull:true,
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
        tabelname: 'RelayData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RelayData.sync({alter:true})

module.exports = RelayData;