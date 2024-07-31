const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("alert message table logs creation");

const AlertMessageLogs = db.define(
  "AlertMessageLogs",
  {    
    alertmessageid :{
      type:Sequelize.INTEGER,
      allowNull:false,
    },   
    stationid :{
      type:Sequelize.INTEGER,
      allowNull:false,
    },  
    assertid :{
      type:Sequelize.INTEGER,
      allowNull:false,
    },    
    assert : {
      type:Sequelize.STRING,
      allowNull:false,
    }, 
    alertname :{
      type:Sequelize.STRING,
      allowNull:false,
    },   
    value :{
        type:Sequelize.STRING,
        allowNull:false,
    },
    message :{
      type:Sequelize.TEXT,
      allowNull:false,
    }, 
    unit :{
      type:Sequelize.STRING,
      allowNull:false,
    },    
    mode :{
      type:Sequelize.STRING,
      allowNull:false,
    },
    email : {
      type:Sequelize.BOOLEAN,
      allowNull:false,
    },
    sms : {
      type:Sequelize.BOOLEAN,
      allowNull:false,
    },
    voice : {
      type:Sequelize.BOOLEAN,
      allowNull:false,
    },
    isactive : {
      type:Sequelize.BOOLEAN,
      allowNull:false,
    },  
    iseditable : {
      type:Sequelize.BOOLEAN,
      allowNull:false,
    },  
    view : {
      type:Sequelize.BOOLEAN,
      allowNull:false,
    },
    description : {
      type:Sequelize.STRING,
      allowNull:false,
    },   
    updateddate: {
      type: Sequelize.DATE,
      allowNull: false,
    }, 
    updatedby_id: {
      type:Sequelize.INTEGER,
      allowNull:false,
    },    
    isdele: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "AlertMessageLogs",
    freezeTableName: true,
    timestamps: false,
    restartIdentity: true,
  }
);

AlertMessageLogs.sync({ alter: true });

module.exports = AlertMessageLogs;
