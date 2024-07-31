const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("Station Access table creation");

const StationAccess = db.define(
    'StationAccess' , 
    {       
        stationid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },   
        userid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        createddate: {
            type:Sequelize.DATE,
            allowNull:false,
        },        
        createdby_id: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        deletedby_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        deleteddate: {
            type: Sequelize.DATE,
            allowNull: true,
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
        tabelname: 'StationAccess',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

StationAccess.sync({alter:true})

module.exports = StationAccess;