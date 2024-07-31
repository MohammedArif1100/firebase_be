const log4js = require("log4js");
const moment = require("moment"),
  current_date = moment().format("YYYY-MM-DD");


// log creation
log4js.configure({
  appenders: {
    current_date: { type: "file", filename: `log/${current_date}.log` },
  },
  categories: {
    default: {
      appenders: [`current_date`],
      level: "error",
      level: "trace",
      level: "info",
    },
  },
});

module.exports.logger = log4js.getLogger(`${current_date}`);

