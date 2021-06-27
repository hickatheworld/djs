// Hey!
// I'm glad you're interested in this code.
// And I'm also sorry to present to you such a poor code.
// But understand, I'm too lazy to refactor it properly.
// I'm content it works at least lol
const express = require('express');
const https = require('https');
const app = express();

let docs = { class: {}, typedef: {} };
const BASE_DOCS_URL = 'https://discord.js.org/#/docs/main/stable';

https.get('https://raw.githubusercontent.com/discordjs/discord.js/docs/stable.json', function (res) {
	let raw = '';
	res.on('data', function (data) {
		raw += data;
	});
	res.on('end', function () {
		const fetched = JSON.parse(raw);
		[['class', 'classes'], ['typedef', 'typedefs']].forEach(([docsField, fetchedField]) => {
			docs[docsField] = fetched[fetchedField].reduce((obj, item) => {
				obj[item.name] = item;
				return obj;
			});
		});
		console.log('Docs fetched.');
		app.listen(process.env.PORT || 80, process.env.IP, function () {
			console.log('Server listening.');
		});
	});
});

app.set('view engine', 'ejs');
app.set('views', './views');

app
	.get('/', function (_req, res) {
		res.redirect('https://discord.js.org/#/');
	})
	.get('/favicon.ico', function (_req, res) {
		res.sendStatus(404);
	})
	.get('/*', function (req, res) {
		const params = req.params[0].split('.');
		const base = params.shift();
		if (!isInDocs(base))
			return res.redirect(`${BASE_DOCS_URL}/search?query=${base}.${params.join('.')}`);
		if (params.length === 0)
			return res.redirect(`${BASE_DOCS_URL}/${which(base)}/${base}`);

		let page = docs.typedef[base] || docs.class[base];
		let property;
		// Using every instead of forEach allows to 'break' the loop by returning false, just like using break.
		params.every((param, i) => {
			if (get(page.props, param)) {
				if (i === params.length - 1)
					property = param;
				else {
					let type = get(page.props, param).type.flat();
					if (type.length > 1) {
						property = param;
						return false;
					}
					page = docs.typedef[type[0][0]] || docs.class[type[0][0]];
				}

			} else if (get(page.methods, param)) {
				property = param;
				return false;
			}
			else
				return false;

			return true;
		});
		let url = `${BASE_DOCS_URL}/${which(page.name)}/${page.name}`;
		let desc = page.description;
		if (property) {
			url += `?scrollTo=${property}`;
			const prop = get(page.props, property) || get(page.methods, property);
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

/**
 * Checks if a given name is in the docs 
 * @param {string} name 
 * @returns {boolean}
 */
function isInDocs(name) {
	return name in docs.typedef || name in docs.class;
}

/**
 * Gets a property from an array of objects as they are for classes' properties/methods in the docs JSON.
 * @param {Array<Record<string, any>>} arr The array to search in
 * @param {string} name The name of the value to get
 * @returns {?any}
 */
function get(arr, name) {
	return arr.find(p => p.name === name);
}

/**
 * Determines if a given property is part of the `class` or `typedef` side of the docs
 * @param {string} property The property to search the nature
 * @returns {string|null}
 */
function which(property) {
	if (property in docs.class)
		return 'class';
	else if (property in docs.typedef)
		return 'typedef';
	else
		return null;
}