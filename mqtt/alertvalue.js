const AlertMessage = require("../models/alertmessage");
var lodash = require("lodash");
const log4js = require("../log4js");
const logs = log4js.logger;


var alert_value_list = []

module.exports = {

    editValues: function (key, value, message, mode, email, sms, voice, isactive, description) {
        try {
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].value = value.toString();
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].message = message.toString();
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].mode = mode;
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].email = email;
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].sms = sms;
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].voice = voice;
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].isactive = isactive;
            alert_value_list[alert_value_list.findIndex(x => x.key === key.toString())].description = description;
        }
        catch (ex) {
            logs.error('Error in editing alert_values' + ex);
            //console.log('Error in editing alert_values' + ex) 
        }
    },

    addvalues: function (key, id, value, unit, message, mode, email, sms, voice, isactive, iseditable, view, description, assert) {
        try {
            alert_value_list.push({ key: key, id: id, value: value, unit: unit, message: message, mode: mode, email: email, sms: sms, voice: voice, isactive: isactive, iseditable: iseditable, view: view, description: description, assert: assert })
        }
        catch (ex) {
            logs.error('Error in adding alert_values' + ex);
            //console.log('Error in adding alert_values' + ex)   
        }
    },
    getValues: function () { return alert_value_list; },

    getalerts: async function () {

        try {

            if (alert_value_list.length == 0) {
                var alerts = await AlertMessage.findAll({ where: { isdele: false }, order: [["id", "ASC"]], raw: true })

                // var result = lodash(alerts)
                // .groupBy(x => `${x.stationid}@${x.alertname}')
                // .map((value, key) => ({stationid: key, value: lodash.map(value,'value').toString()}))
                //     .value();

                for (let i = 0; i < alerts.length; i++)// for await(var alert of alerts)
                {
                    alert_value_list.push({ key: `${alerts[i].stationid}@${alerts[i].assertid}@${alerts[i].assert}@${alerts[i].alertname}`, id: alerts[i].id, value: alerts[i].value, unit: alerts[i].unit, message: alerts[i].message, message: alerts[i].message, mode: alerts[i].mode, email: alerts[i].email, sms: alerts[i].sms, voice: alerts[i].voice, isactive: alerts[i].isactive, iseditable: alerts[i].iseditable, view: alerts[i].view, description: alerts[i].description, assert: alerts[i].assert });
                }
                return alert_value_list;
            }
        }
        catch (ex) {
            logs.error('Error in getting alert_values' + ex);
            //console.log('Error in getting alert_values' + ex)  
        }
    }
};
