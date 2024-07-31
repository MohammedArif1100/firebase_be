const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("Axle Counter table creation");

const RegisteredAxleCounter = db.define(
    'RegisteredAxleCounter',
    {       
        axlecountername: {
            type: Sequelize.STRING,
            allowNull:false,
        },  
        stationid: {
            type:Sequelize.INTEGER,
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
        tabelname: 'RegisteredAxleCounter',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredAxleCounter.sync({alter:true})

module.exports = RegisteredAxleCounter;