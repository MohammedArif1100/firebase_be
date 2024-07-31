const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("signal circuit 1A data table creation");

const SignalCircuit1AData = db.define(
"SignalCircuit1AData",
{
    signalcircuitid :{
        type:Sequelize.INTEGER,
        allowNull:false,
    },      
    count :{
        type:Sequelize.INTEGER,
        allowNull:false,
    },  
    greenvoltage: {
        type:Sequelize.DOUBLE,
        allowNull:false,
    },
    greencurrent: {
        type:Sequelize.DOUBLE,
        allowNull:false,
    },
    redvoltage: {
        type:Sequelize.DOUBLE,
        allowNull:false,
    },
    redcurrent: {
        type:Sequelize.DOUBLE,
        allowNull:false,
    },
    yellowvoltage: {
        type:Sequelize.DOUBLE,
        allowNull:false,
    },
    yellowcurrent : {
        type: Sequelize.DOUBLE,
        allowNull : false,
    },
    lightyellowvoltage : {
        type : Sequelize.DOUBLE,
        allowNull : null,
    },  
    lightyellowcurrent : {
        type : Sequelize.DOUBLE,
        allowNull : null,
    },
    createddate: {
        type: Sequelize.DATE,
        allowNull: false,
    }, 
    isdele: {
        type:Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    }
},
{
    tabelname: 'SignalCircuit1AData',
    freezetablename: true,
    timestamps:false,
    restartIdentity: true,
}
);

SignalCircuit1AData.sync({alert: true});

module.exports = SignalCircuit1AData;