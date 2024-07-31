const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Axle Counter data table creation");

const AxleCounterData = db.define(
    'AxleCounterData' , 
    {
        axlecounterid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        dc_converter_voltage_1: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        dc_converter_voltage_2: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        preparatory_relay_voltage_1: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },   
        preparatory_relay_voltage_2: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        vital_relay_voltage_1: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        vital_relay_voltage_2: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },          
        reset_relay_voltage: {
            type:Sequelize.DOUBLE,
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
        tabelname: 'AxleCounterData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

AxleCounterData.sync({alter:true})

module.exports = AxleCounterData;