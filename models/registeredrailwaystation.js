const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Registered railway station table creation");

const RegisteredRailwayStations = db.define(
    'RegisteredRailwayStations',
    {
        stationname: {
            type:Sequelize.STRING,
            allowNull:false,
            unique:true,
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
        createddate: {
            type:Sequelize.DATE,
            allowNull:false,
        },      
        createdby_id: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },       
        updateddate: {
            type: Sequelize.DATE,
            allowNull: true,
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
        tablename :'RegisteredRailwayStations',
        freezeTableName: true,
        timestamps: false,
        restartIdentity: true,
    }
);

RegisteredRailwayStations.sync({alter:true})

module.exports = RegisteredRailwayStations;

