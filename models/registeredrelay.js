const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("Relay table creation");

const RegisteredRelay = db.define(
    'RegisteredRelay',
    {
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
        tabelname: 'RegisteredRelay',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredRelay.sync({alter:true})

module.exports = RegisteredRelay;