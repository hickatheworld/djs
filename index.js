const express = require('express');
const https = require('https');
const server = express();

let docs = { classes: {}, typedefs: {} };
const BASE_DOCS_URL = 'https://discord.js.org/#/docs/main/stable';


https.get('https://raw.githubusercontent.com/discordjs/discord.js/docs/stable.json', function (res) {
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
		server.listen(process.env.PORT, process.env.IP, function () {
			console.log('Server listening.');
		});
	});
});

server.set('view engine', 'ejs');
server.set('views', './views');

server.get('/favicon.ico', function (_req, res) {
	res.sendStatus(404);
});

server.get('/*', function (req, res) {
	const params = req.params[0].split('.');
	const base = params.shift();
	if (!(base in docs.classes || base in docs.typedefs))
		return res.redirect(`${BASE_DOCS_URL}/search?query=${base}.${params.join('.')}`);
	if (params.length === 0) {
		if (base in docs.classes)
			return res.redirect(`${BASE_DOCS_URL}/classes/${base}`);
		else
			return res.redirect(`${BASE_DOCS_URL}/typedef/${base}`);
	}
	let current = docs.typedefs[base] || docs.classes[base];
	let scroll;
	// Using every instead of forEach allows to 'break' the loop by returning false, just like using break.
	params.every((param, i) => {
		if (current.props.some(p => p.name === param)) {
			if (i === params.length - 1)
				scroll = param;
			else {
				let type = current.props.find(p => p.name === param).type.flat();
				if (type.length > 1) {
					scroll = param;
					return false;
				}
				current = docs.typedefs[type[0][0]] || docs.classes[type[0][0]];
			}

		} else if (current.methods.some(p => p.name === param)) {
			scroll = param;
			return false;
		}
		else
			return false;

		return true;
	});
	const scope = (current.name in docs.classes) ? 'class' : 'typedef';
	let url = `${BASE_DOCS_URL}/${scope}/${current.name}`;
	let desc = current.description;
	if (scroll) {
		url += `?scrollTo=${scroll}`;
		const prop = current.props.find(p => p.name === scroll) || current.methods.find(m => m.name === scroll);
		desc = prop.description;
		if (prop.returns)
			desc += `\nReturn type: ${prop.nullable ? '?' : ''}${prop.returns.flat().flat().join('').replace(/</g, '&#60;').replace(/>/g, '&#62;')}`;
		else if (prop.type)
			desc += `\nType: ${prop.nullable ? '?' : ''}${prop.type.flat().flat().join('').replace(/</g, '&#60;').replace(/>/g, '&#62;')}`;

	}
	if (req.headers['user-agent'].includes('Discordbot')) {
		res.render('embed', { name: `${base}.${params.join('.')}`, desc });
	}
	else
		res.redirect(url);
});