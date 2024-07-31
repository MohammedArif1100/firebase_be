const express = require('express');
const Sequelize = require('sequelize');
const db = require('../config/db').db;
const app = new express();
app.use(express.json());

const log4js = require('../log4js');
const logs = log4js.logger;

logs.info('pointmachine B data table creation');

const PointmachineBdata = db.define(

    'PointmachineBdata' , 
     {
        pointmachineid :{
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        cyclecount : {
            type:Sequelize.INTEGER,
            allowNull:false,
        } ,  
        pointmachineterminal : {
            type:Sequelize.STRING,
            allowNull:false,
        } ,      
        direction :{
            type:Sequelize.STRING,
            allowNull:false,
         },
         forwardindicationvoltage: {
            type:Sequelize.DOUBLE,
            allowNull:true,
        },
        reverseindicationvoltage: {
            type:Sequelize.DOUBLE,
            allowNull:true,
        },
        forwardvoltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        reversevoltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },       
        forwardcurrentavg: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        forwardcurrentpeak: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        reversecurrentavg: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        reversecurrentpeak: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        }, 
        vibrationx: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        vibrationy: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        vibrationz: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        forwardtime: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        reversetime: {
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
        tabelname: 'PointmachineBdata',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
);

PointmachineBdata.sync({alter:true})

module.exports = PointmachineBdata;