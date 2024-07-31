const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("Relay logs table creation");

const RegisteredRelayLogs = db.define(
    'RegisteredRelayLogs',
    {
        relayid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },  
        relayname: {
            type:Sequelize.STRING,
            allowNull:false,
        }, 
        stationid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        assertsid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        assertid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        wordlocation: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },  
        bitlocation :{
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
        tabelname: 'RegisteredRelayLogs',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredRelayLogs.sync({alter:true})

module.exports = RegisteredRelayLogs;