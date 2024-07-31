const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("Point machine data log table creation");

const PointMachineData = db.define(
    'PointMachineData' , 
    {
        pointmachineid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },      
        direction :{
            type:Sequelize.STRING,
            allowNull:false,
        },
        pointcyclecount: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        a_direction: {
            type:Sequelize.STRING,
            allowNull:false,
        },  
        a_cyclecount : {
            type:Sequelize.INTEGER,
            allowNull:false,
        } ,  
        a_current_max: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        a_current_avg: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        a_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        a_indication_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:true,
        },
        a_time: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        a_vibration_x: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        a_vibration_y: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        a_vibration_z: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        b_direction: {
            type:Sequelize.STRING,
            required: true,
            allowNull:false,
        },
        b_cyclecount : {
            type:Sequelize.INTEGER,
            allowNull:false,
        } ,  
        b_current_max: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        b_current_avg: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        b_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        b_indication_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:true,
        }, 
        b_time: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        b_vibration_x: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        b_vibration_y: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        b_vibration_z: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        log: {
            type:Sequelize.INTEGER,
            allowNull:true,
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
        tabelname: 'PointMachineData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

PointMachineData.sync({alter:true})

module.exports = PointMachineData;