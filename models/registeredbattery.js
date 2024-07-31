const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Battery table creation");

const RegisteredBattery = db.define(
    'RegisteredBattery',
    {       
        stationid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },    
        batteryname: {
            type:Sequelize.STRING,
            allowNull:true,
        },
        type: {
            type:Sequelize.STRING,
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
        tabelname: 'RegisteredBattery',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredBattery.sync({alter:true})

module.exports = RegisteredBattery;