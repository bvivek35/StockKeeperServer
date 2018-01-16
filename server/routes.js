const request = require('request');
const environment = require('../environments/environment.js');
const helper = require('./helper.js');

module.exports = (app) => {

    app.get('/', (req, res) => {
        res.send('It Works !');
    });

    app.get('/api/getDate', (req, res) => {
        res.send(JSON.stringify(new Date()));
    });

    app.get('/api/listSymbols/:prefix', (req, res) => {
        var prefix = req.params.prefix;
        var wsUrl = environment.autoComplete.url;
        wsUrl += '?' + environment.autoComplete.param + '=' + prefix;
        console.log('Making call to : ' + wsUrl);
        request(wsUrl, (err, resp, body) => {
            var jsonResp = {};
            if (err || resp.statusCode != 200) {
                console.error('Error while calling : ' + wsUrl, err);
                console.log('Resp : ', resp.statusCode, resp.body);
                jsonResp['status'] = 'failure';
                jsonResp['data'] = resp.body;
            } else {
                jsonResp['status'] = 'success';
                var tmp = [];
                var parsedResp = JSON.parse(body);
                for (var i = 0; i < parsedResp.length; ++i) {
                    var option = parsedResp[i]['Symbol'] + ' - ' + 
                                    parsedResp[i]['Name'] + '(' + parsedResp[i]['Exchange'] + ')';
                    tmp.push({
                        option: option,
                        symbol: parsedResp[i]['Symbol']
                    });
                }
                jsonResp['data'] = tmp;
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(jsonResp));
        });
    });

    app.get('/api/stockInfo/summary', (req, res) => {
        var symbols = req.query.symbols.split("|");
        console.log('Summary for: ', symbols);
        var numRequests = symbols.length;
        var completedRequests = 0;
        var jsonData = [];
        var apiKey = environment.stockInfo.apiKey;
        var formatter = environment.stockInfo.summaryExtractor.formatter;
        for (var i = 0; i < numRequests; ++i) {
            var symbol = symbols[i];
            var url = helper.getStockUrl(environment.stockInfo.urls[0].url, apiKey, symbol);
            ((_url, _formatter) => {
                request(_url, (err, resp, body) => {
                    console.log('Called : ', _url);
                    let wsResp = JSON.parse(body);
                    if (resp.statusCode != 200 || !helper.isAlphaVantageRespValid(wsResp)) {
                        jsonData.push({
                            symbol: symbol,
                            error: 'Try after a while !',
                            status: 'fail'
                        });
                        console.log(wsResp);
                    } else {
                        var tmp = formatter(wsResp);
                        tmp.status = 'success';
                        jsonData.push(tmp);

                    }
                    completedRequests++;
                    if (completedRequests == numRequests) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({status:'success', data:jsonData}));
                    }
                });
            })(url, formatter); 
        }
    });

    app.get('/api/stockInfo/:symbol', (req, res) => {
        var symbol = req.params.symbol;
        var apiKey = environment.stockInfo.apiKey;
        var jsonResp = {};
        var completedRequests = 0;
        var numRequests = environment.stockInfo.urls.length;
        for (var i = 0; i < environment.stockInfo.urls.length; ++i) {
            var url = environment.stockInfo.urls[i].url;
            var type = environment.stockInfo.urls[i].type;
            var formatter = environment.stockInfo.urls[i].formatter;
            url = helper.getStockUrl(url, apiKey, symbol);
            ((_url, _type, _formatter) => {
                request(_url, (err, resp, body) => {
                    console.log('Called : ', _url);
                    let wsResp = JSON.parse(body);
                    if (resp.statusCode != 200 || !helper.isAlphaVantageRespValid(wsResp)) {
                        console.error(resp.statusCode, resp.body);
                        jsonResp[_type] = {
                            error: 'Try after a while !'
                        };
                        console.log(jsonResp[_type]);
                    } else {
                        jsonResp[_type] = _formatter(wsResp);
                    }
                    completedRequests++;
                    if (completedRequests == numRequests) {
                        helper.connectNewsFeed(environment.newsFeed.url + symbol, (err, result) => {
                            jsonResp[environment.newsFeed.type] = environment.newsFeed.formatter(result);
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify({status:'success', data:jsonResp}));
                        });
                    }
                });
            })(url, type, formatter);
        }
    });

    app.get('/api/stockInfo/newsFeed/:symbol', (req, res) => {
        var symbol = req.params.symbol;
        console.log('NewsFeed Req: ' + symbol);
        helper.connectNewsFeed(environment.newsFeed.url + symbol, (err, result) => {
            var jsonResp = environment.newsFeed.formatter(result);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                status:'success',
                type: environment.newsFeed.type,
                data:jsonResp
            }));
        });
    });

    app.get('/api/stockInfo/indicators/:symbol', (req, res) => {
        var symbol = req.params.symbol;
        var apiKey = environment.stockInfo.apiKey;
        var jsonResp = {};
        console.log('Indicators for: ' + symbol);
        var numRequests = environment.stockInfo.urls.length;
        var completedRequests = 0;
        for (var i = 0; i < numRequests; ++i) {
            var url = environment.stockInfo.urls[i].url;
            var type = environment.stockInfo.urls[i].type;
            var formatter = environment.stockInfo.urls[i].formatter;
            url = helper.getStockUrl(url, apiKey, symbol);
            ((_url, _type, _formatter) => {
                request(_url, (err, resp, body) => {
                    console.log('Called : ', _url);
                    let wsResp = JSON.parse(body);
                    if (resp.statusCode != 200 || !helper.isAlphaVantageRespValid(wsResp)) {
                        jsonResp[_type] = {
                            error: 'Try after a while !'
                        };
                        console.log(jsonResp[_type]);
                    } else {
                        jsonResp[_type] = wsResp;//_formatter(wsResp);
                    }
                    completedRequests++;
                    if (completedRequests == numRequests) {
                        var tableExtractor = environment.stockInfo.tableExtractor;
                        jsonResp[tableExtractor.type] = tableExtractor.formatter(jsonResp[tableExtractor.wsRespType])
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({status:'success', data:jsonResp}));
                    }
                });
            })(url, type, formatter); 
        }
    });

    app.get('/api/stockInfo/table/:symbol', (req, res) => {
        var symbol = req.params.symbol;
        var jsonResp = {};
        var apiKey = environment.stockInfo.apiKey;
        var url = environment.stockInfo.urls[0].url;
        url = helper.getStockUrl(url, apiKey, symbol);
        var type = environment.stockInfo.tableExtractor.type;
        jsonResp.data = {};
        request.get(url, (err, resp, body) => {
            let wsResp = JSON.parse(body);
            if (resp.statusCode != 200 || !helper.isAlphaVantageRespValid(wsResp)) {
                jsonResp.status = 'fail';
                jsonResp.data[type] = {
                    error: 'Try after a while !'
                };
                console.log(jsonResp[type]);
            } else {
                jsonResp.status = 'success';
                jsonResp.data[type] = environment.stockInfo.tableExtractor.formatter(wsResp);//_formatter(wsResp);
            }
            res.send(JSON.stringify(jsonResp));
        });
    });

    app.get('/api/stockInfo/historical/:symbol', (req, res) => {
        var symbol = req.params.symbol;
        var jsonResp = {};
        var apiKey = environment.stockInfo.apiKey;
        var url = environment.stockInfo.urls[0].url;
        url = helper.getStockUrl(url, apiKey, symbol) + '&outputsize=full';
        var type = environment.stockInfo.historicalExtractor.type;
        jsonResp.data = {};
        request.get(url, (err, resp, body) => {
            let wsResp = JSON.parse(body);
            if (resp.statusCode != 200 || !helper.isAlphaVantageRespValid(wsResp)) {
                jsonResp.status = 'fail';
                jsonResp.data[type] = {
                    error: 'Try after a while !'
                };
                console.log(jsonResp[type]);
            } else {
                jsonResp.status = 'success';
                jsonResp.data[type] = environment.stockInfo.historicalExtractor.formatter(wsResp);//_formatter(wsResp);
            }
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(jsonResp));
        });
    });

    app.get('/api/mock/stockInfo/:symbol', (req, res) => {
        var fs = require('fs');
        
        var jsonResp = JSON.parse(fs.readFileSync('./mock/mock_appl.json'));
        var xmlStr = fs.readFileSync('./mock/mock_appl.xml');
        helper.xmlToJson(xmlStr, (err, result) => {
            jsonResp['data']['feed'] = environment.newsFeed.formatter(result);
        });
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(jsonResp));
    });

    app.get('/api/stockInfo/indicator/:symbol/:indicator', (req, res) => {
        var symbol = req.params.symbol;
        var indicator = req.params.indicator;
        var apiKey = environment.stockInfo.apiKey;
        var idx = environment.stockInfo.indicatorUrlIdxMap(indicator);
        var type = environment.stockInfo.urls[idx].type;
        var formatter = environment.stockInfo.urls[idx].formatter;
        if (type === 'price')
            formatter = environment.stockInfo.urls[idx].priceFormatter;
        var url = environment.stockInfo.urls[idx].url;
        url = helper.getStockUrl(url, apiKey, symbol);
        var jsonResp = {};
        request.get(url, (err, resp, body) => {
            console.log('Called : ', url);
            let wsResp = JSON.parse(body);  
            if (resp.statusCode != 200 || !helper.isAlphaVantageRespValid(wsResp)) {
                jsonResp['data'] = {
                    error: 'Try after a while !'
                };
                console.log(jsonResp[type]);
            } else {
                jsonResp['data'] = formatter(wsResp);
            }
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(jsonResp));
        });
    });
};
