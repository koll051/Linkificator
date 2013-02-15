

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* panel state and mouse clicks handling - Linkificator's module
 * author: MarkaPola */

var options = document.getElementById("linkificator-options");
var toggle = document.getElementById("linkificator-toggle");
var manage = document.getElementById("linkificator-manage");
var linkify = document.getElementById("linkificator-linkify");

var isActive = true;
var l10n = null;

// Reset stored coordinates to avoid hover style on panel show
function reset (event) {
	let element = event.target;
	element.mouseX = undefined;
	element.mouseY = undefined;
}

options.addEventListener('click', function(event) {
	self.port.emit('options');
	
	event.preventDefault();
	reset(event);
}, true);

toggle.addEventListener('click', function(event) {
	self.port.emit('toggle');
	event.preventDefault();
}, true);

manage.addEventListener('click', function(event) {
	self.port.emit('manage');
	event.preventDefault();
}, true);

linkify.addEventListener('click', function(event) {
	if (isActive) {
		self.port.emit('re-parse');
	}
	event.preventDefault();
	reset(event);
}, true);


self.port.on('initialize', function (data) {
	l10n = data;

	options.textContent = l10n.options;
	toggle.textContent = l10n.disable;
	manage.textContent = l10n.exclude;
	linkify.textContent = l10n.linkify;
});

self.port.on('configure', function (config) {
	isActive = config.active;

	toggle.textContent = isActive ? l10n.disable : l10n.enable;
	manage.textContent = config.status == 'excluded' ? l10n.include : l10n.exclude;
	manage.setAttribute("class", config.status == 'excluded' || config.status == 'processed' ? "linkificator-active" : "linkificator-inactive");
	linkify.setAttribute("class", config.status == 'processed' ? "linkificator-active" : "linkificator-inactive");
});

