const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Battery data table creation");

const BatteryData = db.define(
    'BatteryData',
    {
        batteryid: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        battery_cells: {
            type: Sequelize.JSON,
            allowNull: false,
        },       
        bank_voltage: {
            type: Sequelize.DOUBLE,
            allowNull: false,
        },
        charging_current: {
            type: Sequelize.DOUBLE,
            allowNull: false,
        },
        discharging_current: {
            type: Sequelize.DOUBLE,
            allowNull: false,
        },
        spare_cells: {
            type: Sequelize.JSON,
            allowNull: false,
        },
        spare_bank_voltage: {
            type: Sequelize.DOUBLE,
            allowNull: false,
        },
        spare_charging_current: {
            type: Sequelize.DOUBLE,
            allowNull: false,
        },
        spare_discharging_current: {
            type: Sequelize.DOUBLE,
            allowNull: false,
        },
        createddate: {
            type: Sequelize.DATE,
            allowNull: false,
        },
        isdele: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        }
    },
    {
        tabelname: 'BatteryData',
        freezetablename: true,
        timestamps: false,
        restartIdentity: true,
    }
)

BatteryData.sync({ alter: true })

module.exports = BatteryData;