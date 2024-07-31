const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("track circuit data table creation");

const TrackCircuitData = db.define(
    'TrackCircuitData',
    {
        trackcircuitid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        feed_count : {
            type:Sequelize.INTEGER,
            allowNull:false,
        },  
        feed_current: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        feed_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },       
        choke_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        battery_charger_dc_voltage : {
            type:Sequelize.DOUBLE,
             allowNull:false,
        },  
        battery_charger_dc_current : {
            type:Sequelize.DOUBLE,
             allowNull:false,
        },  
        battery_charger_ac_voltage : {
            type:Sequelize.DOUBLE,
             allowNull:false,
        },  
        battery_charger_ac_current : {
            type:Sequelize.DOUBLE,
             allowNull:false,
        },  
        relay_count : {
            type:Sequelize.INTEGER,
            allowNull:false,
        },         
        relay_current: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        relay_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        trv: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        index_score: {
            type:Sequelize.INTEGER,
            allowNull:false,
        }, 
        leakage_current: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        health: {
            type:Sequelize.STRING,
            allowNull:false,
        }, 
        track_OC: {
            type:Sequelize.STRING,
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
        tabelname: 'TrackCircuitData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

TrackCircuitData.sync({alter:true})

module.exports = TrackCircuitData;