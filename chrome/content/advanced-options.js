
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Advanced options management - Linkificator's module
 * author: MarkaPola */

const Cu = Components.utils;
const {Services} = Cu.import('resource://gre/modules/Services.jsm');

// utility function
function $ (id) {
	return document.getElementById(id);
}


var Utils = {
	/**
	 * Retrieves a string from global.properties string bundle, will throw if string isn't found.
	 * 
	 * @param {String} name  string name
	 * @return {String}
	 */
	getString: function (name)
	{
		// Randomize URI to work around bug 719376
		let stringBundle = Services.strings.createBundle("chrome://linkificator/locale/global.properties?" + Math.random());
		Utils.getString = function(name)
		{
			return stringBundle.GetStringFromName(name);
		}
		return Utils.getString(name);
	},

	/**
	 * Shows an alert message like window.alert() but with a custom title.
	 * 
	 * @param {Window} parentWindow  parent window of the dialog (can be null)
	 * @param {String} title  dialog title
	 * @param {String} message  message to be displayed
	 */
	alert: function (parentWindow, title, message) {
		if (!title)
			title = "Linkificator";
		Services.prompt.alert(parentWindow, title, message);
	}
};


//************** Links ************************
function Links (properties) {
	var supportEmail = $('advanced-settings.link-type.email');
	var supportAbout = $('advanced-settings.link-type.about');

    supportEmail.checked = properties.support.email;
    supportAbout.checked = properties.support.about;

 	return {
		retrieve: function (properties) {
			properties.changed.support = {};
			properties.changed.support.email = supportEmail.checked;
			properties.changed.support.about = supportAbout.checked;
		},

		release: function () {
			// nothing to do for now
		}
	}
}


//************** Custom Rules ************************
function CustomRule (rule) {
	if (rule === undefined) {
		this.name = "";
		this.pattern = "";
		this.url = "";
		this.active = true;
	} else {
		this.name = rule.name;
		this.pattern = rule.pattern;
		this.url = rule.url;
		this.active = rule.active;
	}
}
CustomRule.prototype = {
	name: null,
	pattern: null,
	url: null,

	active: true,

	validate: function () {
		let errorMessage = "";

		function check (regex) {
			try {
				RegExp (regex);
				return true;
			} catch (e) {
				if (errorMessage.length) errorMessage += "\n";
				errorMessage += e;
				return false;
			}
		}

		if (this.name.length == 0 || this.pattern.length == 0 || this.url.length == 0) {
			Utils.alert(window,
						Utils.getString('advanced-settings.rules-validation.title'),
						Utils.getString('advanced-settings.rules-validation.empty-field'));
			return false;
		}

		let patternValid = check(this.pattern);
		let urlValid = check(this.url);

		if (patternValid && urlValid)
			return true;

		if (!patternValid && !urlValid) {
			Utils.alert(window,
						Utils.getString('advanced-settings.rules-validation.title'),
						Utils.getString('advanced-settings.rules-validation.invalid-re')+"\n"+errorMessage);
		} else if (!patternValid) {
			Utils.alert(window,
						Utils.getString('advanced-settings.rules-validation.title'),
						Utils.getString('advanced-settings.rules-validation.invalid-pattern')+"\n"+errorMessage);
		} else {
			Utils.alert(window,
						Utils.getString('advanced-settings.rules-validation.title'),
						Utils.getString('advanced-settings.rules-validation.invalid-url')+"\n"+errorMessage);
		}
		
		return false;
	}
};


function Tooltip (tooltip) {
	this._tooltip = $(tooltip);
}
Tooltip.prototype = {
	_tooltip: null,

	update: function (rule) {
		if (rule) {
			this._tooltip.firstChild.setAttribute('value', rule.pattern);
			this._tooltip.firstChild.nextSibling.setAttribute('value', rule.url);
		} else {
			this._tooltip.firstChild.setAttribute('value', '?');
			this._tooltip.firstChild.nextSibling.setAttribute('value', '?');
		}
	}
};


function Panel (panel, start, complete) {
	this._panel = $(panel);

	this._init = start;
	this._complete = complete;

	this._name = $("advanced-settings.custom-rules.panel.name");
	this._pattern = $("advanced-settings.custom-rules.panel.pattern");
	this._url = $("advanced-settings.custom-rules.panel.url");
	
	this._panel.addEventListener('popupshowing', this.init.bind(this));

	$('advanced-settings.custom-rules.panel.ok').addEventListener('command', this.validate.bind(this));
	$('advanced-settings.custom-rules.panel.cancel').addEventListener('command', this.hide.bind(this));
}
Panel.prototype = {
	_rule: null,
	
	_init: null,
	_complete: null,

	_panel: null,

	_name: null,
	_pattern: null,
	_url: null,

	init: function (event) {
		this._rule = this._init();
		this._name.value = this._rule.name;
		this._pattern.value = this._rule.pattern;
		this._url.value = this._rule.url;
	},

	validate: function (event) {
		// update rule
		this._rule.name = this._name.value;
		this._rule.pattern = this._pattern.value;
		this._rule.url = this._url.value;

		if (this._rule.validate()) {
			this.hide();
			this._complete(this._rule);
		}
	},

	hide: function (event) {
		this._panel.hidePopup();
	},

	release: function () {
		// remove event listeners
		this._panel.removeEventListener('popupshowing', this.init.bind(this));
		$('advanced-settings.custom-rules.panel.ok').removeEventListener('command', this.validate.bind(this));
		$('advanced-settings.custom-rules.panel.cancel').addEventListener('command', this.hide.bind(this));
	}
};

function ListItem (template, tooltip, rule, remove) {
	this._tooltip = tooltip;
	this._rule = rule;
	this._remove = remove;

	// create DOM element from template
	this._richlistitem = template.cloneNode(true);
	this._richlistitem.removeAttribute('id');
	this._richlistitem.removeAttribute('hidden');
	this._richlistitem._data = this;

	this._checkbox = this._richlistitem.firstChild.firstChild;
	this._checkbox.setAttribute('checked', this._rule.active);
	this._label = this._checkbox.nextSibling;
	this._label.setAttribute('value', this._rule.name);

	// checkbox handling
	this._checkbox.addEventListener('command', this._setCheckbox.bind(this));
	// tooltip handling
	this._label.addEventListener('mouseover', this._updateTooltip.bind(this));
	// delete button handling
	this._label.nextSibling.nextSibling.addEventListener('command', this._delete.bind(this));
}
ListItem.prototype = {
	_richlistitem: null,
	_checkbox: null,
	_label: null,

	_tooltip: null,
	_rule: null,

	_setCheckbox: function (event) {
		this._rule.active = this._checkbox.checked;
	},
	_updateTooltip: function (event) {
		this._tooltip.update(this._rule);
	},
	_delete: function (event) {
		this.release();
		this._remove(this);
	},

	get node () {
		return this._richlistitem;
	},
	get rule () {
		return this._rule;
	},

	update: function () {
		this._label.setAttribute('value', this._rule.name);
	},

	release: function () {
		// remove event listeners
		this._checkbox.removeEventListener('command', this._setCheckbox.bind(this));
		this._label.removeEventListener('mouseover', this._updateTooltip.bind(this));
		this._label.nextSibling.nextSibling.removeEventListener('command', this._delete.bind(this));
	},

	getRule: function (node) {
		return node._data._rule;
	},
	updateRule: function (node, rule) {
		node._data.update();
	},
	releaseNode: function (node) {
		node._data.release();
	}
}

function ListBox (listbox, itemTemplate, tooltip) {
	this._richlistbox = $(listbox);
	this._template = $(itemTemplate);

	this._tooltip = new Tooltip(tooltip);
}
ListBox.prototype = {
	_richlistbox: null,
	_template: null,

	get selectedIndex () {
		return this._richlistbox.selectedIndex;
	},
	set selectedIndex (index) {
		this._richlistbox.selectedIndex = index;
		this._richlistbox.ensureIndexIsVisible(index);
	},

	get currentRule () {
		return this._richlistbox.currentIndex == -1 ? null : ListItem.prototype.getRule(this._richlistbox.getItemAtIndex(this._richlistbox.currentIndex));
	},
	get selectedRule () {
		return this._richlistbox.selectedIndex == -1 ? null : ListItem.prototype.getRule(this._richlistbox.selectedItem);
	},

	getRowCount: function () {
		return this._richlistbox.getRowCount();
	},

	getRuleAtIndex: function (index) {
		return ListItem.prototype.getRule(this._richlistbox.getItemAtIndex(index));
	},

	load: function (rules) {
		for (let index = 0; index < rules.length; ++index) {
			this.add (new CustomRule(rules[index]));
		}
	},

	add: function (rule) {
		let item = new ListItem(this._template, this._tooltip, rule, this.remove.bind(this));

		if (this._richlistbox.selectedIndex != -1) {
			this._richlistbox.insertBefore(item.node, this._richlistbox.selectedItem);
		} else {
			this._richlistbox.appendChild(item.node);
		}
		this._richlistbox.ensureElementIsVisible(item.node);
	},

	remove: function (listitem) {
		this._richlistbox.removeChild(listitem.node);
	},

	update: function (rule) {
		ListItem.updateRule (this._richlistbox.selectedItem, rule);
	},

	release: function () {
		// release each listitem
		for (let index = this._richlistbox.getRowCount()-1; index >= 0; index--) {
			ListItem.releaseNode(ListItem.this._richlistbox.getItemAtIndex(index));
		}
	}
}

function CustomRules (properties) {
	var beforeList = new ListBox('advanced-settings.custom-rules.before-list',
								 'advanced-settings.custom-rules.itemTemplate',
								 'advanced-settings.custom-rules.tooltip');
	var afterList = new ListBox('advanced-settings.custom-rules.after-list',
								 'advanced-settings.custom-rules.itemTemplate',
								 'advanced-settings.custom-rules.tooltip');

	var panel = new Panel('advanced-settings.custom-rules.panel', start, finalize);

	var currentList = afterList;

	// fill lists
	let customRules = JSON.parse(properties.customRules.rules);
	beforeList.load(customRules.beforeList);
	afterList.load(customRules.afterList);

	// list selection
	var deck = $('advanced-settings.custom-rules.deck');
	if (properties.ui.customRules != undefined) {
		let settings = properties.ui.customRules;

		deck.slectedIndex = settings.selectedList;
		$('advanced-settings.custom-rules.list-selection').selectedIndex = settings.selectedList;
		currentList = settings.selectedList == 0 ? beforeList : afterList;

		currentList.selectedIndex = settings.selectedItem;
	} else {
		deck.selectedIndex = 1;
		$('advanced-settings.custom-rules.list-selection').selectedIndex = 1;
	}

	function selectList (event) {
		currentList = this.selectedIndex == 0 ? beforeList : afterList;
		deck.selectedIndex = this.selectedIndex;
	}
	$('advanced-settings.custom-rules.list-selection').addEventListener('command', selectList);

	// current rule retrieval
	var addRule = false;
	function setAdd () {
		addRule = true;
	}
	function resetAdd () {
		addRule = false;
	}
	/// track mouse over Add button
	$('advanced-settings.custom-rules.add').addEventListener('mouseover', setAdd);
	$('advanced-settings.custom-rules.add').addEventListener('mouseout', resetAdd);
	function start () {
		if (addRule) {
			currentAction = 'add';
			return new CustomRule();
		} else {
			currentAction = 'edit';
			return currentList.currentRule;
		}
	}

	// current rule finalization
	var currentAction = 'edit';
	function finalize (rule) {
		if (currentAction == 'add') {
			currentList.add (rule);
		} else {
			currentList.update (rule);
		}
	}

	// build array of rules
	function getRules (list) {
		let count = list.getRowCount();
		let array = new Array(count);
		for (let index = 0; index < count; ++index) {
			array[index] = list.getRuleAtIndex(index);
		}

		return array;
	}

	return {
		retrieve: function (properties) {
			// build object to be serialized by JSON
			let customRules = {};
			customRules.beforeList = getRules(beforeList);
			customRules.afterList = getRules(afterList);
			properties.changed.customRules = {};
			properties.changed.customRules.rules = JSON.stringify(customRules);
			
			// keep some UI settings
			properties.ui.customRules = {};
			properties.ui.customRules.selectedList = deck.selectedIndex;
			properties.ui.customRules.selectedItem = currentList.selectedIndex;
		},

		release: function () {
			panel.release();
			beforeList.release();
			afterList.release();
			$('advanced-settings.custom-rules.list-selection').removeEventListener('command', selectList);
			$('advanced-settings.custom-rules.add').removeEventListener('mouseover', setState);
			$('advanced-settings.custom-rules.add').removeEventListener('mouseout', resetState);
		}
	}
}


//************** Configuration ************************
function Configuration (properties) {
	var protocols = $('advanced-settings.protocol.list');
	var subdomains = $('advanced-settings.subdomain.list');
	var excludedElements = $('advanced-settings.excludedElement.list');

	var changed = {};

	// attach default values to nodes
	var defaults = properties.configuration.defaults;
	protocols.setAttribute ('value', defaults.protocols);
	subdomains.setAttribute ('value', defaults.subdomains);
	excludedElements.setAttribute ('value', defaults.excludedElements);

	// set actual values
	protocols.value = properties.configuration.protocols;
	subdomains.value = properties.configuration.subdomains;
	excludedElements.value = properties.configuration.excludedElements;

	function changeProtocols (event) {
		changed.protocols = protocols.value;
	}
	function changeSubdomains (event) {
		changed.subdomains = subdomains.value;
	}
	function changeExcludedElements (event) {
		changed.excludedElements = excludedElements.value;
	}

	function resetProtocols (event) {
			protocols.reset();
			changed.protocols = defaults.protocols;
	}
	function resetSubdomains (event) {
			subdomains.reset();
			changed.subdomains = defaults.subdomains;
	}
	function resetExcludedElements (event) {
			excludedElements.reset();
			changed.excludedElements = defaults.excludedElements;
	}

	// manage events
	$('advanced-settings.protocol.list').addEventListener('change', changeProtocols);
	$('advanced-settings.protocol.reset').addEventListener('command', resetProtocols);

	$('advanced-settings.subdomain.list').addEventListener('change', changeSubdomains);
	$('advanced-settings.subdomain.reset').addEventListener('command', resetSubdomains);

	$('advanced-settings.excludedElement.list').addEventListener('change', changeExcludedElements);
	$('advanced-settings.excludedElement.reset').addEventListener('command', resetExcludedElements);

	return {
		retrieve: function (properties) {
			properties.changed.configuration = changed;
		},

		release: function () {
			$('advanced-settings.protocol.list').removeEventListener('change', changeProtocols);
			$('advanced-settings.protocol.reset').removeEventListener('command', resetProtocols);

			$('advanced-settings.subdomain.list').removeEventListener('change', changeSubdomains);
			$('advanced-settings.subdomain.reset').removeEventListener('command', resetSubdomains);

			$('advanced-settings.excludedElement.list').removeEventListener('change', changeExcludedElements);
			$('advanced-settings.excludedElement.reset').removeEventListener('command', resetExcludedElements);
		}
	}
}


var AdvancedSettings = (function () {
	var properties = null;

	var links = null;
	var customRules = null;
	var configuration = null;

	return {
		init: function () {
			properties = window.arguments[0].wrappedJSObject;

			links = Links(properties);
			customRules = CustomRules(properties);
			configuration = Configuration(properties);

			// set previously selected tab
			if (properties.ui.selectedTab != undefined) {
				$('advanced-settings.tabbox').selectedIndex = properties.ui.selectedTab;
			}
		},

		release: function () {
			links.release();
			customRules.release();
			configuration.release();
		},

		validate: function () {
			// retrieve changed values
			properties.changed = {};

			links.retrieve(properties);
			customRules.retrieve(properties);
			configuration.retrieve(properties);

			// keep some UI settings
			properties.ui.selectedTab = $('advanced-settings.tabbox').selectedIndex;
		}
	};
})();
