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
		if (params.length === 0) {
			if (base in docs.class)
				return res.redirect(`${BASE_DOCS_URL}/classes/${base}`);
			else
				return res.redirect(`${BASE_DOCS_URL}/typedef/${base}`);
		}
		let current = docs.typedef[base] || docs.class[base];
		let scroll;
		// Using every instead of forEach allows to 'break' the loop by returning false, just like using break.
		params.every((param, i) => {
			if (get(current.props, param)) {
				if (i === params.length - 1)
					scroll = param;
				else {
					let type = get(current.props, param).type.flat();
					if (type.length > 1) {
						scroll = param;
						return false;
					}
					current = docs.typedef[type[0][0]] || docs.class[type[0][0]];
				}

			} else if (get(current.methods, param)) {
				scroll = param;
				return false;
			}
			else
				return false;

			return true;
		});
		const scope = (current.name in docs.class) ? 'class' : 'typedef';
		let url = `${BASE_DOCS_URL}/${scope}/${current.name}`;
		let desc = current.description;
		if (scroll) {
			url += `?scrollTo=${scroll}`;
			const prop = get(current.props, scroll) || get(current.methods, scroll);
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