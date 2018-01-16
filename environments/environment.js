const moment = require('moment-timezone');

function extractSeries(json) {
    var indicatorFullText = json['Meta Data']['2: Indicator'];
    var indicatorShortText = getIndicatorShort(indicatorFullText);
    var pts = json['Technical Analysis: '+indicatorShortText];
    var symbol = json['Meta Data']['1: Symbol'];
    var lastKey = json['Meta Data']['3: Last Refreshed'];
    var series = generateSeries(pts, lastKey)
    return {
        'series': series,
        'symbol': symbol,
        'indicatorFullText': indicatorFullText,
        'indicatorShortText': indicatorShortText,
    };
}

function extractPriceSeries(json) {
    var pts = json['Time Series (Daily)'];
    var xAxisLabels = []
    var yAxisLabels = [[], []]
    for (var i in pts) {
        xAxisLabels.push(new Date(i).getTime());
        yAxisLabels[0].push(parseFloat(pts[i]['4. close']));
        yAxisLabels[1].push(parseInt(pts[i]['5. volume']));
    }
    return {
        'series': [
            sortZip(zip(xAxisLabels, yAxisLabels[0]), 0),
            sortZip(zip(xAxisLabels, yAxisLabels[1]), 0)
        ],
        'symbol': json['Meta Data']['2. Symbol'].toUpperCase(),
        'lastRefresh': json['Meta Data']['3. Last Refreshed']
    };
}

function generateSeries(pts, lastKey) {
    var yAxisKeys = pts[lastKey];
    var yAxisLabels = {};
    for (var i in yAxisKeys) {
        yAxisLabels[i] = []
    }
    var xAxisLabels = [];
    for (var i in pts) {
        if (i < '2017-06')
            continue;
        xAxisLabels.push(new Date(i).getTime());
        for (var k in pts[i]) {
            yAxisLabels[k].push(parseFloat(pts[i][k]));
        }
    }
    var res = [];
    var count = 0
    for (var k in yAxisLabels) {
        var tmp = Object.assign({}, {
            name: k,
            //yAxis: count,
            data: sortZip(zip(xAxisLabels, yAxisLabels[k]), 0)
        });
        res.push(tmp);
    }
    return res;
}

function getIndicatorShort(indicatorFullText) {
    var regexp = /.*\((\w+)\)/g;
    matches = regexp.exec(indicatorFullText);
    return matches.length > 1 ? matches[1] : null;
}

function zip(l1, l2) {
    var res = []
    for (var i = 0; i < l1.length && i < l2.length; ++i) {
        res.push([l1[i],l2[i]]);
    }
    return res;
}

function sortZip(l, idx) {
    l.sort(function cmp(a, b) {
        return b[idx] < a[idx] ?  1 : b[idx] > a[idx] ? -1 : 0;
    });
    return l;
}

function isBusinessHours() {
    var curr = moment().tz('America/New_York');
    var st = moment('09:30', 'HH:mm').tz('America/New_York');
    var end = moment('16:00', 'HH:mm').tz('America/New_York');
    return (curr.isAfter(st) && curr.isBefore(end));
}

module.exports = {
    autoComplete: {
        url: 'http://dev.markitondemand.com/MODApis/Api/v2/Lookup/json',
        param: 'input'
    },
    stockInfo: {
        apiKey: 'ESD6WKJA9FUB3I8T',
        tableExtractor: {
            type: 'infoTable',
            wsRespType: 'price',
            formatter: (json) => {
                var lastRefreshedDate = json['Meta Data']['3. Last Refreshed']
                lastRefreshed = new Date(lastRefreshedDate).toISOString().slice(0,10);
                var timeSeries = json['Time Series (Daily)'];
                var prevDay = new Date(lastRefreshed);
                var prevDayKey = lastRefreshed;
                for (var i = 0; i < 6; ++i) {
                    prevDay.setTime(prevDay.getTime() -86400000);
                    prevDayKey = prevDay.toISOString().slice(0, 10);
                    if (timeSeries[prevDayKey])
                        break;
                }
                var jsonResp = {};
                var priceDiff = timeSeries[lastRefreshed]['4. close'] - timeSeries[prevDayKey]['4. close'];
                var pricePercent = priceDiff / timeSeries[prevDayKey]['4. close'];
                jsonResp['symbol'] = json['Meta Data']['2. Symbol'];
                jsonResp['price'] = parseFloat(timeSeries[lastRefreshed]['4. close']).toFixed(2) + "";
                jsonResp['open'] = parseFloat(timeSeries[lastRefreshed]['1. open']).toFixed(2) + "";
                var tmp = new Date().toTimeString().substr(0,8);
                if (isBusinessHours()){
                    jsonResp['prevClose'] = parseFloat(timeSeries[prevDayKey]['4. close']).toFixed(2) + "";
                } else {
                    jsonResp['prevClose'] = 'Close';
                }
                jsonResp['prevClose'] = parseFloat(timeSeries[prevDayKey]['4. close']).toFixed(2) + "";
                jsonResp['change'] = parseFloat(priceDiff).toFixed(2) + "";
                jsonResp['changePercent'] = parseFloat(pricePercent).toFixed(2);
                jsonResp['changeDisp'] = "" + parseFloat(priceDiff).toFixed(2) + "(" + parseFloat(pricePercent).toFixed(2) + "%)";
                jsonResp['range'] = "" + parseFloat(timeSeries[lastRefreshed]['3. low']).toFixed(2) + " - " + parseFloat(timeSeries[lastRefreshed]['2. high']).toFixed(2);
                jsonResp['volume'] = timeSeries[lastRefreshed]['5. volume'] + "";
                if (isBusinessHours()) {
                    jsonResp['timestamp'] = moment(lastRefreshedDate).tz('America/New_York').format('YYYY-MM-DD HH:mm:SS z');
                } else {
                    jsonResp['timestamp'] = lastRefreshed + ' 16:00:00 ' + moment().tz('America/New_York').format('z');
                }
                 
                
                return jsonResp;
            }
        },
        historicalExtractor: {
            type: 'historical',
            wsRespType: 'price',
            formatter: (json) => {
                var timeSeries = json['Time Series (Daily)'];
                var jsonResp = [];
                for (var i in timeSeries) {
                    jsonResp.push([new Date(i).getTime(), parseFloat(timeSeries[i]['4. close'])]);
                }
                
                return sortZip(jsonResp, 0);
            }
        },
        summaryExtractor: {
            formatter: (json) => {
                var jsonResp = {};
                jsonResp.symbol = json['Meta Data']['2. Symbol'];

                var lastRefreshedDate = json['Meta Data']['3. Last Refreshed']
                lastRefreshed = new Date(lastRefreshedDate).toISOString().slice(0,10);
                var timeSeries = json['Time Series (Daily)'];
                var prevDay = new Date(lastRefreshed);
                var prevDayKey = lastRefreshed;
                for (var i = 0; i < 6; ++i) {
                    prevDay.setTime(prevDay.getTime() -86400000);
                    prevDayKey = prevDay.toISOString().slice(0, 10);
                    if (timeSeries[prevDayKey])
                        break;
                }

                var priceDiff = timeSeries[lastRefreshed]['4. close'] - timeSeries[prevDayKey]['4. close'];
                var pricePercent = priceDiff / timeSeries[prevDayKey]['4. close'];

                jsonResp['symbol'] = json['Meta Data']['2. Symbol'];
                jsonResp['price'] = parseFloat(timeSeries[lastRefreshed]['4. close']).toFixed(2);
                jsonResp['change'] = parseFloat(priceDiff).toFixed(2);
                jsonResp['changePercent'] = parseFloat(pricePercent).toFixed(2);

                return jsonResp;
            }
        },
        urls: [{
            type: 'price',
            url: 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY',
            formatter: (json) => {
                var lastRefreshed = json['Meta Data']['3. Last Refreshed']
                lastRefreshed = new Date(lastRefreshed).toISOString().slice(0,10);
                var timeSeries = json['Time Series (Daily)'];
                var prevDay = new Date(lastRefreshed);
                var prevDayKey = lastRefreshed;
                for (var i = 0; i < 6; ++i) {
                    prevDay.setTime(prevDay.getTime() -86400000);
                    prevDayKey = prevDay.toISOString().slice(0, 10);
                    if (timeSeries[prevDayKey])
                        break;
                }
                var jsonResp = {};
                var priceDiff = timeSeries[lastRefreshed]['4. close'] - timeSeries[prevDayKey]['4. close'];
                var pricePercent = priceDiff / timeSeries[prevDayKey]['4. close'];
                return jsonResp;
            },
            priceFormatter: (json) => {
                return extractPriceSeries(json);
            }
        }, {
            type: 'sma',
            url: 'https://www.alphavantage.co/query?function=SMA&interval=daily&time_period=10&series_type=close',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'ema',
            url: 'https://www.alphavantage.co/query?function=EMA&interval=daily&time_period=10&series_type=close',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'stoch',
            url: 'https://www.alphavantage.co/query?function=STOCH&interval=daily',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'rsi',
            url: 'https://www.alphavantage.co/query?function=RSI&interval=daily&time_period=10&series_type=close',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'adx',
            url: 'https://www.alphavantage.co/query?function=ADX&interval=daily&time_period=10',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'cci',
            url: 'https://www.alphavantage.co/query?function=CCI&interval=daily&time_period=10',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'bbands',
            url: 'https://www.alphavantage.co/query?function=BBANDS&interval=daily&time_period=10&series_type=close',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }, {
            type: 'macd',
            url: 'https://www.alphavantage.co/query?function=MACD&interval=daily&series_type=close',
            formatter: (json) => {
                var series = extractSeries(json);
                return series;
            }
        }],
        indicatorUrlIdxMap: (indicator) => {
            return {
                'price': 0,
                'sma': 1,
                'ema': 2,
                'stoch': 3,
                'rsi': 4,
                'adx': 5,
                'cci': 6,
                'bbands': 7,
                'macd': 8,
            }[indicator];
        }                                
    },
    newsFeed: {
        type: 'feed',
        url: 'https://seekingalpha.com/api/sa/combined/',
        formatter: (json) => {
            var tmp = json['rss']['channel'][0]['item']
            var res = []
            for (var i = 0; i < tmp.length && i < 5; ++i) {
                res.push({
                    title: tmp[i].title[0],
                    author: tmp[i]['sa:author_name'][0],
                    pubDate: tmp[i].pubDate[0],
                    link: tmp[i].link[0]
                });
            }
            return res;
        }
    },
    historical: {
        type: 'historical',
        url: '',
        formatter: (json) => {
            return json;
        }
    }
};


