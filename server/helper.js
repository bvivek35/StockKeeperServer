const environment = require('../environments/environment.js');
const request = require('request');
const parseXMLString = require('xml2js').parseString;

module.exports = {
    getStockUrl: function (url, apiKey, symbol) {
        return url + '&apikey=' + apiKey + '&symbol=' + symbol;
    }, isAlphaVantageRespValid: (json) => {
        if (!json['Meta Data'])
            return false;
        return true;
    }, ALPHAVANTAGE_ERROR_RESP: {
        error: 'Could not get a response from Alpha vantage ! Try again after a while.'
    }, connectNewsFeed: (url, cb) => {
        var _this = this;
        request(url, (err, resp, body) => {
            parseXMLString(body, (err, result) => {
                cb(err, result);
            });
        });
    },
    xmlToJson: (xml, cb) => {
        parseXMLString(xml, (err, result) => {
            cb(err, result);
        });
    },
    echoFormatter: (json) => {
        return json;
    }, priceFormatter: (json) => {
        return json;
    }, indicatorFormatter: (json) => {
        
    }
};