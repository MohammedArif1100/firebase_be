const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("Point machine table creation");

const RegisteredPointMachine = db.define(
    'RegisteredPointMachine' , 
    {
        pointmachinename :{
            type:Sequelize.STRING,
            allowNull:false,
        },        
        stationid :{
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
        tabelname: 'RegisteredPointMachine',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

RegisteredPointMachine.sync({alter:true})

module.exports = RegisteredPointMachine;