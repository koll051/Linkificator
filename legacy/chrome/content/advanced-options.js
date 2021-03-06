
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Advanced options management - Linkificator's module
 * author: MarkaPola */

"use strict";

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
		};
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
	validate: function () {
		let errorMessage = "";

		function check (regex) {
			try {
				new RegExp (regex);
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


function Panel (panel, callbacks) {
	this._panel = $(panel);

	this._callbacks = callbacks;

	this._name = $("advanced-settings.custom-rules.panel.name");
	this._pattern = $("advanced-settings.custom-rules.panel.pattern");
	this._url = $("advanced-settings.custom-rules.panel.url");
	
	this._handlers = {
		init: this.init.bind(this),
		validate: this.validate.bind(this),
		hide: this.hide.bind(this)
	};

	this._panel.addEventListener('popupshowing', this._handlers.init);

	$('advanced-settings.custom-rules.panel.ok').addEventListener('command', this._handlers.validate);
	$('advanced-settings.custom-rules.panel.cancel').addEventListener('command', this._handlers.hide);
}
Panel.prototype = {
	init: function (event) {
		this._rule = this._callbacks.start();
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
			this._callbacks.complete(this._rule);
		}
	},

	hide: function (event) {
		this._panel.hidePopup();
	},

	release: function () {
		// remove event listeners
		this._panel.removeEventListener('popupshowing', this._handlers.init);
		$('advanced-settings.custom-rules.panel.ok').removeEventListener('command', this._handlers.validate);
		$('advanced-settings.custom-rules.panel.cancel').addEventListener('command', this._handlers.hide);
	}
};

function ListItem (template, tooltip, rule, callbacks) {
	this._tooltip = tooltip;
	this._rule = rule;
	this._callbacks = callbacks;

	// create DOM element from template
	this._richlistitem = template.cloneNode(true);
	this._richlistitem.removeAttribute('id');
	this._richlistitem.removeAttribute('hidden');
	this._richlistitem._data = this;

	this._checkbox = this._richlistitem.firstChild.firstChild;
	this._checkbox.setAttribute('checked', this._rule.active);
	this._label = this._checkbox.nextSibling;
	this._label.setAttribute('value', this._rule.name);
	this._edit = this._label.nextSibling;
	this._delete = this._edit.nextSibling;

	this._handlers = {
		dragstart: this._dragstart.bind(this),
		drop: this._drop.bind(this),
		setCheckbox: this._setCheckbox.bind(this),
		updateTooltip: this._updateTooltip.bind(this),
		remove: this._remove.bind(this)
	};

	// drap&drop handling
	this._label.addEventListener('dragstart', this._handlers.dragstart);
	this._label.addEventListener('drop', this._handlers.drop);
	this._checkbox.addEventListener('dragover', this._dragover);
	this._edit.addEventListener('dragover', this._dragover);
	this._delete.addEventListener('dragover', this._dragover);

	// checkbox handling
	this._checkbox.addEventListener('command', this._handlers.setCheckbox);
	// tooltip handling
	this._label.addEventListener('mouseover', this._handlers.updateTooltip);
	// delete button handling
	this._delete.addEventListener('command', this._handlers.remove);
}
ListItem.prototype = {
	_dragstart: function (event) {
		return this._callbacks.dragstart(event, this);
	},
	_dragover: function (event) {
		event.stopPropagation();
		return true;
	},
	_drop: function (event) {
		this._callbacks.drop(event, this);
	},

	_setCheckbox: function (event) {
		this._rule.active = this._checkbox.checked;

		this._callbacks.update(this);
	},
	_updateTooltip: function (event) {
		this._tooltip.update(this._rule);
	},
	_update: function () {
		this._label.setAttribute('value', this._rule.name);

		this._callbacks.update(this);
	},
	_remove: function (event) {
		this.release();

		this._callbacks.remove(this);
	},

	get node () {
		return this._richlistitem;
	},
	get rule () {
		return this._rule;
	},

	release: function () {
		// remove event listeners
		this._label.removeEventListener('dragstart', this._handlers.drag);
		this._label.removeEventListener('drop', this._handlers.drop);
		this._checkbox.removeEventListener('dragover', this._dragover);
		this._edit.removeEventListener('dragover', this._dragover);
		this._delete.removeEventListener('dragover', this._dragover);

		this._checkbox.removeEventListener('command', this._handlers.setCheckbox);
		this._label.removeEventListener('mouseover', this._handlers.updateTooltip);
		this._delete.removeEventListener('command', this._handlers.remove);
	},

	getRule: function (node) {
		return node._data._rule;
	},
	updateRule: function (node, rule) {
		node._data._update();
	},

	releaseNode: function (node) {
		node._data.release();
	}
};

function DragManager (event, listbox, item) {
	this._source = event.target;
	this._listbox = listbox;
	this._item = item;

	event.dataTransfer.setData("application/x-custom-rule", JSON.stringify(item.rule));
	event.dataTransfer.effectAllowed = "move";
	event.dataTransfer.setDragImage(item.node, 30, 10);

	this._handlers = {
		drop: this._drop.bind(this),
		release: this.release.bind(this)
	};

	// bind all needed drag and drop events
	let list = listbox.node;
	list.addEventListener('dragover', this._dragover);
	list.addEventListener('drop', this._handlers.drop);

	event.target.addEventListener('dragend', this._handlers.release);
}
DragManager.prototype = {
	_dragover: function (event) {
		event.preventDefault();
	},
	_drop: function (event) {
	    this.drop(event, null);
	},

	drop: function (event, target) {
	    event.stopPropagation();
		event.preventDefault();

		if (target === this._item) {
			// nothing to do, cancel drag&drop operation
			event.dataTransfer.effectAllowed = "none";
		} else {
			this._listbox.remove(this._item);
			if (target) {
				this._listbox.insertBefore(this._item, target);
			} else {
				this._listbox.append(this._item);
			}
		}
	},

	release: function (event) {
		let list = this._listbox.node;
		list.removeEventListener('dragover', this._dragover);
		list.removeEventListener('drop', this._handlers.drop);

		this._source.removeEventListener('dragend', this._handlers.release);
	}
};

function ListBox (listbox, itemTemplate, tooltip, callbacks) {
	this._richlistbox = $(listbox);
	this._template = $(itemTemplate);
	this._callbacks = callbacks;

	this._tooltip = new Tooltip(tooltip);

    this._dragManager = null;
    
	this._handlers = {
		dragstart: this.dragstart.bind(this),
		drop: this.drop.bind(this),
		update: this.update.bind(this),
		remove: this.remove.bind(this)
	};
}
ListBox.prototype = {
	get node () {
		return this._richlistbox;
	},

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

	loadRules: function (rules) {
		for (let index = 0; index < rules.length; ++index) {
			this.addRule (new CustomRule(rules[index]));
		}
	},

	addRule: function (rule) {
		let item = new ListItem(this._template, this._tooltip, rule, this._handlers);

		if (this._richlistbox.selectedIndex != -1) {
			this._richlistbox.insertBefore(item.node, this._richlistbox.selectedItem);
		} else {
			this._richlistbox.appendChild(item.node);
		}
		this._richlistbox.ensureElementIsVisible(item.node);

		this._callbacks.update(item);
	},

	updateRule: function (rule) {
		ListItem.prototype.updateRule (this._richlistbox.selectedItem, rule);
	},

	dragstart: function (event, item) {
		this._dragManager = new DragManager(event, this, item);
		return true;
	},
	drop: function (event, item) {
		this._dragManager.drop(event, item);
	},

	insertBefore: function (newItem, refItem) {
		this._richlistbox.insertBefore(newItem.node, refItem.node);

		this._callbacks.update(newItem.rule);
	},
	append: function (listitem) {
		this._richlistbox.appendChild(listitem.node);

		this._callbacks.update(listitem.rule);
	},
	update: function (listitem) {
		this._callbacks.update(listitem.rule);
	},
	remove: function (listitem) {
		this._richlistbox.removeChild(listitem.node);

		this._callbacks.remove(listitem.rule);
	},

	release: function () {
        if (this._dragManager) {
		    this._dragManager.release();
            this._dragManager = null;
        }
        
		// release each listitem
		for (let index = this._richlistbox.getRowCount()-1; index >= 0; index--) {
			ListItem.prototype.releaseNode(this._richlistbox.getItemAtIndex(index));
		}
	}
};

function CustomRules (preferences, defaults, properties) {
	var inInit = true;

	var instantApply = Services.prefs.getBoolPref("browser.preferences.instantApply");
	
	var beforeList = new ListBox('advanced-settings.custom-rules.before-list',
								 'advanced-settings.custom-rules.itemTemplate',
								 'advanced-settings.custom-rules.tooltip',
								 {remove: remove, update: update});
	var afterList = new ListBox('advanced-settings.custom-rules.after-list',
								 'advanced-settings.custom-rules.itemTemplate',
								 'advanced-settings.custom-rules.tooltip',
								 {remove: remove, update: update});

	var panel = new Panel('advanced-settings.custom-rules.panel', {start: start, complete: finalize});

	var currentList = afterList;

	// fill lists
	let customRules = JSON.parse(preferences.getCharPref('customRules'));
	beforeList.loadRules(customRules.beforeList);
	afterList.loadRules(customRules.afterList);

	// list selection
	var deck = $('advanced-settings.custom-rules.deck');
	if (properties.ui.customRules != undefined) {
		let settings = properties.ui.customRules;

		deck.selectedIndex = settings.selectedList;
		$('advanced-settings.custom-rules.list-selection').selectedIndex = settings.selectedList;
		currentList = settings.selectedList == 0 ? beforeList : afterList;

		if (settings.selectedItem != -1) {
			currentList.selectedIndex = settings.selectedItem;
		}
	} else {
		deck.selectedIndex = 1;
		$('advanced-settings.custom-rules.list-selection').selectedIndex = 1;
		
		properties.ui.customRules = {};
		properties.ui.customRules.selectedList = deck.selectedIndex;
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
			currentList.addRule (rule);
		} else {
			currentList.updateRule (rule);
		}
	}

	// current rule update
	function update (rule) {
		if (!inInit && instantApply) {
			// update preferences
			preferences.setCharPref('customRules', serializeRules());
		}
	}
	
	// current rule suppression
	function remove (rule) {
		if (instantApply) {
			// update preferences
			preferences.setCharPref('customRules', serializeRules());
		}
	}
		
	// custom rules to be serialized by JSON
	function serializeRules () {
		// build array of rules
		function getRules (list) {
			let count = list.getRowCount();
			let array = new Array(count);
			for (let index = 0; index < count; ++index) {
				array[index] = list.getRuleAtIndex(index);
			}
			
			return array;
		}

		let customRules = {};
		customRules.beforeList = getRules(beforeList);
		customRules.afterList = getRules(afterList);
		return JSON.stringify(customRules);
	}

	inInit = false;

	return {
		retrieve: function () {
			if (! instantApply) {
				preferences.setCharPref('customRules', serializeRules());
			}
		},

		release: function () {
			// keep some UI settings
			properties.ui.customRules.selectedList = deck.selectedIndex;
			properties.ui.customRules.selectedItem = currentList.selectedIndex;

			panel.release();
			beforeList.release();
			afterList.release();
			$('advanced-settings.custom-rules.list-selection').removeEventListener('command', selectList);
			$('advanced-settings.custom-rules.add').removeEventListener('mouseover', setAdd);
			$('advanced-settings.custom-rules.add').removeEventListener('mouseout', resetAdd);
		}
	};
}


//************** Configuration ************************
function Configuration (preferences, defaults, properties) {
	var instantApply = Services.prefs.getBoolPref("browser.preferences.instantApply");
	
    function resetCharPreference (id) {
        if (! instantApply) {
            // force change of preference to ensure update on reset
            preferences.setCharPref(id, '');
        }
        preferences.clearUserPref(id);
    }
    function resetIntPreference (id) {
        if (! instantApply) {
            // force change of preference to ensure update on reset
            preferences.setIntPref(id, 0);
        }
        preferences.clearUserPref(id);
    }
    
	function resetRequiredCharacters (event) {
		resetCharPreference('requiredCharacters');
	}
	function resetProtocols (event) {
		resetCharPreference('protocols');
	}
	function resetSubdomains (event) {
		resetCharPreference('subdomains');
	}
	function resetExcludedElements (event) {
		resetCharPreference('excludedElements');
	}
	function resetInlineElements (event) {
		resetCharPreference('inlineElements');
	}
	function resetMaxDataSize (event) {
		resetIntPreference('maxDataSize');
	}

    function resetGTLDs (event) {
		resetCharPreference('gTLDs');
	}
    function resetCcTLDs (event) {
		resetCharPreference('ccTLDs');
	}
    function resetGeoTLDs (event) {
		resetCharPreference('geoTLDs');
	}
    function resetCommunityTLDs (event) {
		resetCharPreference('communityTLDs');
	}
    function resetBrandTLDs (event) {
		resetCharPreference('brandTLDs');
	}

	// manage events
	$('advanced-settings.configuration.requiredCharacters.reset').addEventListener('command', resetRequiredCharacters);

	$('advanced-settings.configuration.protocol.reset').addEventListener('command', resetProtocols);

	$('advanced-settings.configuration.subdomain.reset').addEventListener('command', resetSubdomains);

	$('advanced-settings.configuration.excludedElement.reset').addEventListener('command', resetExcludedElements);
	$('advanced-settings.configuration.inlineElement.reset').addEventListener('command', resetInlineElements);
    
	$('advanced-settings.configuration.maxDataSize.reset').addEventListener('command', resetMaxDataSize);
    
	$('advanced-settings.configuration.gTLDs.reset').addEventListener('command', resetGTLDs);
	$('advanced-settings.configuration.ccTLDs.reset').addEventListener('command', resetCcTLDs);
	$('advanced-settings.configuration.geoTLDs.reset').addEventListener('command', resetGeoTLDs);
	$('advanced-settings.configuration.communityTLDs.reset').addEventListener('command', resetCommunityTLDs);
	$('advanced-settings.configuration.brandTLDs.reset').addEventListener('command', resetBrandTLDs);

	return {
		retrieve: function () {
			// nothing to do
		},

		release: function () {
			$('advanced-settings.configuration.requiredCharacters.reset').removeEventListener('command', resetRequiredCharacters);

			$('advanced-settings.configuration.protocol.reset').removeEventListener('command', resetProtocols);

			$('advanced-settings.configuration.subdomain.reset').removeEventListener('command', resetSubdomains);

			$('advanced-settings.configuration.excludedElement.reset').removeEventListener('command', resetExcludedElements);
			$('advanced-settings.configuration.inlineElement.reset').removeEventListener('command', resetInlineElements);

			$('advanced-settings.configuration.inlineElement.reset').removeEventListener('command', resetMaxDataSize);

            $('advanced-settings.configuration.gTLDs.reset').removeEventListener('command', resetGTLDs);
	        $('advanced-settings.configuration.ccTLDs.reset').removeEventListener('command', resetCcTLDs);
	        $('advanced-settings.configuration.geoTLDs.reset').removeEventListener('command', resetGeoTLDs);
	        $('advanced-settings.configuration.communityTLDs.reset').removeEventListener('command', resetCommunityTLDs);
	        $('advanced-settings.configuration.brandTLDs.reset').removeEventListener('command', resetBrandTLDs);

		}
	};
}


var AdvancedSettings = (function () {
	var properties = null;
	var preferences = null;
	var defaults = null;

	var customRules = null;
	var configuration = null;

	var tabbox = $('advanced-settings.tabbox');
	var tabbox2 = $('advanced-settings.configuration.tabbox');

	return {
		init: function () {
			properties = window.arguments[0].wrappedJSObject;
			preferences = Services.prefs.getBranch('extensions.linkificator@markapola.');
	        defaults = Services.prefs.getDefaultBranch('extensions.linkificator@markapola.');

			customRules = CustomRules(preferences, defaults, properties);
			configuration = Configuration(preferences, defaults, properties);

            // configure observers
            $('broadcaster.supportEmail').setAttribute('disabled', !$('pref.supportEmail').value);
            $('broadcaster.supportStandardURLs').setAttribute('disabled', !$('pref.supportStandardURLs').value);

            for (let p of ['automaticLinkification', 'useGTLDs', 'useCcTLDs', 'useGeoTLDs', 'useCommunityTLDs', 'useBrandTLDs']) {
                if ($('pref.'+p).value)
                    $('broadcaster.'+p).removeAttribute('disabled');
                else
                    $('broadcaster.'+p).setAttribute('disabled', true);
            }
            
			// set previously selected tab
			if (properties.ui.selectedTab != undefined) {
				tabbox.selectedIndex = properties.ui.selectedTab;
			}
			if (properties.ui.selectedSubTab != undefined) {
				tabbox2.selectedIndex = properties.ui.selectedSubTab;
			}
		},

		release: function () {
			// keep some UI settings
			properties.ui.selectedTab = tabbox.selectedIndex;
            properties.ui.selectedSubTab = tabbox2.selectedIndex;

			customRules.release();
			configuration.release();

			return true;
		},

		validate: function () {
			customRules.retrieve();
			configuration.retrieve();

			return true;
		},

        change: function (id) {
            var useTLDs = /(automaticLinkification|use.+TLDs)/;
            if (id.match(useTLDs)) {
                // special treatment to support textbox
                if ($('pref.'+id).value) {
                    $('broadcaster.'+id).removeAttribute('disabled');
                } else {
                    $('broadcaster.'+id).setAttribute('disabled', true);
                }
            } else {
                $('broadcaster.'+id).setAttribute('disabled', !$('pref.'+id).value);
            }
        }
	};
})();
