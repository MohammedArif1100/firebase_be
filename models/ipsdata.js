const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());

const log4js = require("../log4js");
const logs = log4js.logger;

logs.info("IPS data table creation");

const IPSData = db.define(
    'IPSData' , 
    {
        ipsid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        ips_terminal: {
            type:Sequelize.STRING,
            allowNull:false,
        },
        track_voltage_cbf : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        track_voltage_mtp : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        signal_voltage_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        signal_voltage_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        b110_vdc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        ext_relay_voltage_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        ext_relay_voltage_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_voltage_cbf:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_voltage_mtp:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_line_bat_voltage_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_line_bat_voltage_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        axle_counter_voltage_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        axle_counter_voltage_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        lvr_vdc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        axle_counter_voltage_cbf_1 :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        track_current_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        track_current_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        signal_current_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        signal_current_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        b110_idc  :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        ext_relay_current_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        ext_relay_current_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_current_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_current_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_line_bat_current_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        block_line_bat_current_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        axle_counter_current_cbf :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        axle_counter_current_mtp :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        lvr_idc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        axle_counter_current_cbf_1 :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_voltage_cbf_oc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_voltage_cbf_ic :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_voltage_mtp_ic :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_voltage_mtp_oc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        point_machine_voltage_ic :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        point_machine_voltage_cbf_oc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        point_machine_voltage_mtp_oc :{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_current_cbf_oc:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_current_cbf_ic:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_current_mtp_ic:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        internal_relay_signal_current_mtp_oc:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        point_machine_current_ic:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        point_machine_current_cbf_oc:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        point_machine_current_mtp_oc:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        local_main_power_voltage_ic:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        local_main_power_voltage_oc:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        load_current_ic:{
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        load_current_oc:{
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
        tabelname: 'IPSData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
)

IPSData.sync({alter:true})

module.exports = IPSData;