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
		// We only need the classes/typedefs from the docs, the rest is not relevant.
		// In these two arrays, `docsField` is the name we give to the field in our docs object,
		// (Which is meant to match with the discord.js.org docs endpoints)
		// and the `fetchedField` is the name of the field in the received docs object from GitHub.
		[['class', 'classes'], ['typedef', 'typedefs']].forEach(([docsField, fetchedField]) => {
			// The initial field is in the form of an array of objects,
			// All of these objects have a name property.
			// We map each of these objects in another object instead of an array for convenience.
			docs[docsField] = fetched[fetchedField].reduce((obj, item) => {
				obj[item.name] = item;
				return obj;
			});
		});
		console.log('Docs fetched.');
		// The env variables are provided by our host and are necessary for it to work
		// 80 is just a fallback for development.
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
		// This request is sent by browsers automatically.
		// Our service does not have any favicon.
		res.sendStatus(404);
	})
	.get('/*', function (req, res) {
		const params = req.params[0].split('.');
		const base = params.shift();
		if (!isInDocs(base))
			return res.redirect(`${BASE_DOCS_URL}/search?query=${base}.${params.join('.')}`);
		/* TO-DO: Remove this redirect to propose an embed even with only a base class/typedef provided. */
		if (params.length === 0)
			return res.redirect(`${BASE_DOCS_URL}/${which(base)}/${base}`);

		// page represents the page of the docs we'll access (either on the /class or /typedef endpoint)
		let page = docs.typedef[base] || docs.class[base];
		// property represents the property to set optionally on the `scrollTo` parameter on the page
		let property;
		// Using every instead of forEach allows to 'break' the loop by returning false, just like using break.
		params.every((param, i) => {
			if (get(page.props, param)) {
				if (i === params.length - 1)
					// If this param is the last of the array,
					// We don't have to search for its type and redirect to the corresponding docs page
					// We reference it as a property of the previous class.
					property = param;
				else {
					let type = get(page.props, param).type.flat();
					if (type.length > 1) {
						// If the array of types in the docs objects has more than 1 value
						// It is probably a Collection/Array.
						// We don't want to route to these objects' documentations.
						property = param;
						return false;
					}
					page = docs.typedef[type[0][0]] || docs.class[type[0][0]];
				}

			} else if (get(page.methods, param)) {
				// A method doesn't have any actual properties from discord.js
				// We don't want to propose to route the following parameters to its return type
				// As these are quite difficult to parse.
				// Such a usage is not really relevant anyway, 
				// So if a method is found, we ignore any following parameter.
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
			// This means the request was sent by Discord to generate an embed
			// Hence we provide them the required data to generate one, see views/embed.ejs.
			res.render('embed', { name: `${base}.${params.join('.')}`, desc });
		}
		else
			res.redirect(url);
		// In the other hand, this means the request is probably from a brower
		// Or any entity we don't care about. Therefore we just redirect to discord.js.org
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
	// As the properties/methods of different classes are stored in arrays in discord.js' docs object
	// We can't just index by name as we would do with a regular object.
	// Also, remapping how we do it for the `class` and `typedef` fields doesn't seem really useful in this case.
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