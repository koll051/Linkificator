
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// controler.js - Linkificator's module
// author: MarkaPola


//
// Manage UI controling linkificator behavior
//

function Controler (properties) {
    class ListenerManager {
        constructor () {
            this._listeners = new Set();
        }

        [Symbol.iterator]() {
            return this._listeners[Symbol.iterator]();
        }
        
        addListener (listener) {
            this._listeners.add(listener);
        }
        removeListener (listener) {
            this._listeners.delete(listener);
        }
        hasListener (listener) {
            this._listeners.has(listener);
        }
    }

    
    var excludedURLs = (function () {
		var urls = new Array();

		return {
			add: function (url) {
				if (urls.indexOf(url) == -1) {
					urls.push(url);
					return true;
				}
				return false;
			},
			remove: function (url) {
				let index = urls.indexOf(url);
				if (index != -1) {
					urls.splice(index, 1);
					return true;
				}
				return false;
			},
            // return true if url is excluded, false otherwise
			toggle: function (url) {
				let index = urls.indexOf(url);
				if (index == -1) {
					urls.push(url);
					return true;
				} else {
					urls.splice(index, 1);
					return false;
				}
			},

			isExcluded: function (url) {
				return urls.indexOf(url) != -1;
			}
		};
	})();

    var includedURLs = (function () {
        var urls = new Map();

		return {
			add: function (tab) {
                urls.set(tab.id, tab.url);
			},
			remove: function (tab) {
                urls.delete(tab.id);
			},
            update: function (tab) {
                if (tab === undefined) return;
                
                let id = tab.id;
                
                let url = urls.get(id);
                if (url && (tab.url !== url)) {
                    urls.delete(id);
                }
            },
            
            // return true if url is included, false otherwise
			toggle: function (tab) {
                let id = tab.id;
                
                if (urls.has(id)) {
                    urls.delete(id);
                    return false;
                } else {
                    urls.set(id, tab.url);
                    return true;
                }
			},

			isIncluded: function (tab) {
                let url = urls.get(tab.id);

                return url && (tab.url === url);
			}
		};
	})();

    var browserAction = (function () {
        function getDefault () {
            return {
                state: isActive() ? 'processed' : 'not_processed', 
                icon: isActive() ? (isManual() ? { 16: 'resources/icons/link16-manual.png',
                                                   32: 'resources/icons/link32-manual.png'}
                                               : {16: 'resources/icons/link16-on.png',
                                                  32: 'resources/icons/link32-on.png'})
                                 : {16: 'resources/icons/link16-off.png',
                                    32: 'resources/icons/link32-off.png'},
                badge: isActive() && displayBadge() ? "0" : "", 
                tooltip: isActive() ?  browser.i18n.getMessage("stats.0links") + " " + browser.i18n.getMessage("stats.time", 0)
                                    : browser.i18n.getMessage("stats.not_processed")
            };
        }
        function getCurrent (request) {
            var current = getDefault();
            let tab = request.tab;
            
			if (isActive() && request.isValid) {
				if (excludedURLs.isExcluded(tab.url)) {
					current.state = 'excluded';
					current.icon = {16: 'resources/icons/link16-excluded.png',
                                    32: 'resources/icons/link32-excluded.png'},
                    current.badge = "";
					current.tooltip = browser.i18n.getMessage("stats.excluded");
				} else if (isValidURL(tab.url)) {
					current.state = 'processed';
					current.icon = isManual() ? { 16: 'resources/icons/link16-manual.png',
                                                   32: 'resources/icons/link32-manual.png'}
                                               : {16: 'resources/icons/link16-on.png',
                                                  32: 'resources/icons/link32-on.png'}, 
                    current.badge = displayBadge() ? "0" : "";
					current.tooltip = browser.i18n.getMessage("stats.0links") + " " + browser.i18n.getMessage("stats.time", 0);
				} else {
					current.state = 'filtered';
					current.icon = {16: 'resources/icons/link16-excluded.png',
                                    32: 'resources/icons/link32-excluded.png'}, 
                    current.badge = "";
					current.tooltip = browser.i18n.getMessage("stats.filtered");
				}
			} else {
				current.icon = isActive() ? (isManual() ? { 16: 'resources/icons/link16-manual.png',
                                                            32: 'resources/icons/link32-manual.png'}
                                          : {16: 'resources/icons/link16-on.png',
                                             32: 'resources/icons/link32-on.png'})
                                 : {16: 'resources/icons/link16-off.png',
                                    32: 'resources/icons/link32-off.png'};
				current.state = 'not_processed';
                current.badge = "";
				current.tooltip = browser.i18n.getMessage("stats.not_processed");
			}

            return current;
        }

        return {
            update: function (request) {
                if (request.hasOwnProperty('statistics')) {
                    if (request.hasOwnProperty('displayBadge')) {
                        if (request.displayBadge) {
                            let count = request.statistics.links;
                            if (count > 999) count = "999+";
                            
                            if (request.tab) {
                                browser.browserAction.setBadgeText({tabId: request.tab.id,
                                                                    text: count.toString()});
                            } else {
                                // ignore request
                            }
                        } else {
                            if (request.tab)
                                browser.browserAction.setBadgeText({tabId: request.tab.id, text: ""});
                            else {
                                browser.tabs.query({}).then(tabs => {
                                    for (const tab of tabs) {
                                        browser.browserAction.setBadgeText({tabId: tab.id, text: ""});
                                    }
                                });
                            }
                        }
                    }
                    if (request.hasOwnProperty('displayTooltip')) {
                        let stats = request.statistics;
                        let tooltip;
                        
                        switch (stats.links) {
                        case 0:
                            tooltip = browser.i18n.getMessage("stats.0links");
                            break;
                        case 1:
                            tooltip = browser.i18n.getMessage("stats.1link");
                            break;
                        default:
                            tooltip = browser.i18n.getMessage("stats.links", stats.links);
                        }
                        tooltip += " " + browser.i18n.getMessage("stats.time", stats.time);

                        let tabId = request.tab.id;
                        browser.browserAction.setTitle({tabId: tabId, title: tooltip});
                    }
                } else {
                    let state = getCurrent(request);
                    let tabId = request.tab.id;
                    
                    browser.browserAction.setIcon({tabId: tabId, path: state.icon});
                    browser.browserAction.setTitle({tabId: tabId, title: state.tooltip});
                    browser.browserAction.setBadgeText({tabId: tabId, text: state.badge});
                }
            }
        };
    })();

    let badgeListeners = new ListenerManager();

    //
    // utility functions
    //
    function isActive () {
        return properties.activated;
    }
    function isManual () {
        return properties.manual;
    }
    function displayBadge () {
        return properties.displayBadge;
    }

    function isValidURL (url) {
        if (properties.domains.type === 'none')
			return true;

		let useRegExp = properties.domains.useRegExp;
        let flag = properties.domains.type === 'white';
		let list = properties.domains.list[properties.domains.type];

		let index = 0;
		while (index != list.length) {
			if (useRegExp) {
				if (url.match(new RegExp(list[index++], "i"))) {
					return flag;
				}
			} else {
				if (url.toLowerCase().indexOf(list[index++]) != -1) {
					return flag;
				}
			}
		}
		
        return !flag;
    }


    // handle preferences changes
    browser.storage.onChanged.addListener((changes,  areaName) => {
        if (areaName !== properties.area) return;

        for (let key in changes) {
            properties[key] =  changes[key].newValue;
            switch (key) {
            case 'displayBadge':
                for (let listener of badgeListeners)
                    listener({displayBadge: properties.displayBadge});
                
                break;
            }
        }
    });

    
    return {
        isActive: function () {
            return isActive();
        },
		linkifyURL: function (tab) {
			return !excludedURLs.isExcluded(tab.url) && (includedURLs.isIncluded(tab) || isValidURL(tab.url));
		},

        setStatus: function (request) {
            includedURLs.update(request.tab);
			browserAction.update(request);
		},

        get onBadgeChanged () {
            return badgeListeners;
        }
    };
}