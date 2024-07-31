const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("railway station logs table creation");

const RegisteredRailwayStationLogs = db.define(
    'RegisteredRailwayStationLogs',
    {
        stationid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },        
        stationname: {
            type:Sequelize.STRING,
            allowNull:false,
        },   
        stationcode: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        divisionname: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        zonename: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        latitude: {
            type:Sequelize.DOUBLE,
            allowNull:true,
        },
        longitude: {
            type:Sequelize.DOUBLE,
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
            type: Sequelize.DATE,
            allowNull: false,
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
        tablename :'RegisteredRailwayStationLogs',
        freezeTableName: true,
        timestamps: false,
        restartIdentity: true,
    }
);

RegisteredRailwayStationLogs.sync({alter:true})

module.exports = RegisteredRailwayStationLogs;

