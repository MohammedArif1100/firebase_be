const express = require("express");
const Sequelize = require("sequelize");
const db = require("../config/db").db;
const app = new express();
app.use(express.json());


const log4js = require("../log4js");
const logs = log4js.logger;


logs.info("track circuit relay data table creation");

// const TrackCircuitRelayData = db.define(
//     'TrackCircuitRelayData',
//     {
//         trackcircuitid: {
//             type:Sequelize.INTEGER,
//             allowNull:false,
//         },
//         count : {
//             type:Sequelize.INTEGER,
//             allowNull:false,
//         } ,  
//         trackcircuitterminal : {
//             type:Sequelize.STRING,
//             allowNull:false,
//         } ,        
//         relayendvoltage: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         },
//         relayendcurrent: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         },
//         trackvoltage: {
//             type:Sequelize.DOUBLE,
//             allowNull:false,
//         },
//         createddate: {
//             type:Sequelize.DATE,
//             allowNull:false,
//         },    
//         isdele: {
//             type:Sequelize.BOOLEAN,
//             defaultValue: false,
//             allowNull: false,
//         }
//     },
//     {
//         tabelname: 'TrackCircuitRelayData',
//         freezetablename: true,
//         timestamps:false,
//         restartIdentity: true,
//     }
// );

const TrackCircuitRelayData = db.define(
    'TrackCircuitRelayData',
    {
        trackcircuitid: {
            type:Sequelize.INTEGER,
            allowNull:false,
        },
        count : {
            type:Sequelize.INTEGER,
            allowNull:false,
        } ,  
        trackcircuitterminal : {
            type:Sequelize.STRING,
            allowNull:false,
        } , 
        feed_voltage : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },    
        feed_current : {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },  
        choke_voltage : {
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
        relay_voltage: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        relay_current: {
            type:Sequelize.DOUBLE,
            allowNull:false,
        },
        trv: {
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
        tabelname: 'TrackCircuitRelayData',
        freezetablename: true,
        timestamps:false,
        restartIdentity: true,
    }
);





TrackCircuitRelayData.sync({alter : true});

module.exports = TrackCircuitRelayData;