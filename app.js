// app.js

const http = require('http');

eval(require('fs').readFileSync('./libs/hxl.js', 'utf8'));
eval(require('fs').readFileSync('./libs/hxlBites_merged.js', 'utf8'));

const host = 'localhost';
const port = 3000;

function requestListener(req, res) {
    res.setHeader("Content-Type", "application/json");
    switch (req.url) {
        case "/charts":
            charts(req, res)
            break
        case "/maps":
            maps(req, res)
            break
        case "/text":
            texts(req, res)
            break
        default:
            res.writeHead(404);
            res.end(JSON.stringify({message:"Resource not found"}));
    }
};

function charts(req, res) {
	if (req.method == 'POST') {
        let body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            let post = JSON.parse(body);
           	res.writeHead(200);
           	let hxlData = post['hxlData'];
           	console.log('chart call')
           	let charts = getChartBites(hxlData);
	    	res.end(JSON.stringify({bites:charts}));
        });
    } else {
	    res.writeHead(200);
	    res.end(JSON.stringify({error:"please make a post request"}));
	}
}

function maps(req, res) {
	if (req.method == 'POST') {
        let body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            let post = JSON.parse(body);
           	res.writeHead(200);
           	let hxlData = post['hxlData'];
           	console.log('map call')
           	let maps = getMapBites(hxlData);
	    	res.end(JSON.stringify({bites:maps}));
        });
    } else {
	    res.writeHead(200);
	    res.end(JSON.stringify({error:"please make a post request"}));
	}
}

function texts(req, res) {
	if (req.method == 'POST') {
        let body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', function () {
            let post = JSON.parse(body);
           	res.writeHead(200);
           	let hxlData = post['hxlData'];
           	console.log('text call')
           	let text = getTextBites(hxlData);
	    	res.end(JSON.stringify({bites:text}));
        });
    } else {
	    res.writeHead(200);
	    res.end(JSON.stringify({error:"please make a post request"}));
	}
}

function getChartBites(data){
	let hb = hxlBites.data(data)
	let charts = hb.getChartBites();
	return charts
}

function getMapBites(data){
	let hb = hxlBites.data(data)
	let maps = hb.getMapBites();
	return maps
}

function getTextBites(data){
	let hb = hxlBites.data(data)
	let texts = hb.getTextBites();
	console.log('text')
	console.log(texts);
	return texts
}

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});