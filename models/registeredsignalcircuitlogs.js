const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("signal circuit logs table creation");

const RegisteredSignalCircuitLogs = db.define(
    'RegisteredSignalCircuitLogs',
    {
        signalcircuitid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },  
        signalname :{
            type:Sequelize.STRING,
            allowNull:false,
        },  
        stationid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },  
        aspecttypeid :{
            type:Sequelize.INTEGER,
            allowNull:true,
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
        tabelname: 'RegisteredSignalCircuitLogs',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredSignalCircuitLogs.sync({alter:true})

module.exports = RegisteredSignalCircuitLogs;