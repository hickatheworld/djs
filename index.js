const express = require('express');
const https = require('https');
const server = express();

let docs = { classes: {}, typedefs: {} };

https.get('https://raw.githubusercontent.com/discordjs/discord.js/docs/v12.json', function (res) {
	let text = '';
	res.on('data', function (data) {
		text += data;
	});
	res.on('end', function () {
		const fetched = JSON.parse(text);
		['classes', 'typedefs'].forEach(field => {
			docs[field] = fetched[field].reduce((obj, item) => {
				obj[item.name] = item;
				return obj;
			});
		});
		console.log('Docs fetched.');
		server.listen(80, function () {
			console.log('Server listening.');
		});
	});
});

server.get('/favicon.ico', function (_req, res) {
	res.sendStatus(404);
});

server.get('/*', function (req, res) {
	console.log(req.headers);
	const [base, ...params] = req.params[0].split('.');
	console.log(base, params);
	if (base in docs.classes) {
		res.redirect(`https://discord.js.org/#/docs/main/stable/class/${base}`);
	} else if (base in docs.typedefs) {
		res.redirect(`https://discord.js.org/#/docs/main/stable/typedef/${base}`);
	} else {
		res.redirect(`https://discord.js.org/#/docs/main/stable/search?query=${base}`);
	}
});