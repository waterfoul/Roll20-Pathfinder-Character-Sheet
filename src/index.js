import _ from 'underscore';
import {on,randomInteger,getsectionIDs,getTranslationByKey,getAttrs,setAttrs,removeRepeatingRow,generateRowID} from '../stubs/on';
import TAS from 'exports-loader?TAS!TheAaronSheet';
import {PFLog,PFConsole} from './PFLog';
import * as SWUtils from './SWUtils';
import PFConst from './PFConst';
import PFDB from './PFDB';
import * as PFUtils from './PFUtils';
import * as PFMacros from './PFMacros';
import * as PFMenus from './PFMenus';

//how to run this before anything? even before stuff is loaded?
TAS.config({
 logging: {
   info: true,
   debug: true
 }
});
TAS.debugMode();


var PFAttackOptions = PFAttackOptions || (function () {
	'use strict';
	var optionTemplates = {
		melee_notes: "{{melee_notes=REPLACE}}",
		ranged_notes: "{{ranged_notes=REPLACE}}",
		CMB_notes: "{{CMB_notes=REPLACE}}",
		attack_notes: "{{attack_notes=REPLACE}}",
		header_image: "{{header_image=REPLACE}}"
	},
	optionDefaults = {
		notes: {
			melee: "@{melee-attack-notes}",
			ranged: "@{ranged-attack-notes}",
			CMB: "@{CMB-notes}",
			attack: "@{attack-notes}"
		},
		image: {
			melee: "@{header_image-pf_attack-melee}",
			ranged: "@{header_image-pf_attack-ranged}",
			CMB: "@{header_image-pf_attack-cmb}"
		}
	},
	//not used since melee options field actually look at the text..
	//optionAttrs = ["melee-attack-notes", "ranged-attack-notes", "CMB-notes", "attack-notes", "header_image-pf_attack-melee", "header_image-pf_attack-ranged", "header_image-pf_attack-cmb"],
	optionToggles = ["toggle_attack_melee_notes", "toggle_attack_ranged_notes", "toggle_attack_CMB_notes", "toggle_attack_attack_notes", "toggle_attack_header_image"],
	//attackOptionRegex = PFUtils.getOptionsCompiledRegexMap(optionTemplates),
	repeatingOptionAttrs = ["attack-type", "damage-ability", "damage-dice-num","damage-die","damage","attack"],
	repeatingOptionHelperAttrs = [""],// ["damage-mod", "attack-mod"],
	repeatingOptionGetAttrs = repeatingOptionAttrs.concat(repeatingOptionHelperAttrs),
	repeatingOptionGetAttrsLU = _.map(repeatingOptionGetAttrs,function(field){return '_'+field;}),
	/********* REPEATING WEAPON FIELDSET *********/
	/** getOptionText - resets entire macro options text for a repeating_weapon row
	*@param {string} prefix repeating_weapon_id_
	*@param {map} toggleValues map of ".showxxxx" where xxxx is what to display, already calculated for us
	*@param {map} rowValues output from getAttrs
	*/
	getOptionText = function (prefix, toggleValues, rowValues) {
		var 
		attackType = PFUtils.findAbilityInString(rowValues[prefix + "attack-type"]),
		damageAbility = PFUtils.findAbilityInString(rowValues[prefix + "damage-ability"]),
		optionText = "";
		if (!(attackType || rowValues[prefix + "attack"] )) {
			optionText += "{{no_attack_roll=1}}";
		} else if (attackType){
			attackType = attackType.replace('attk-','').replace('2', '')||"";
			if(toggleValues['show'+attackType.toLowerCase()]){
				optionText += optionTemplates[attackType + "_notes"].replace("REPLACE", optionDefaults.notes[attackType])||"";
			}
		}
		if (toggleValues.showheader_image) {
			optionText += optionTemplates.header_image.replace("REPLACE", optionDefaults.image[attackType||'melee'])||"";
		}
		if (!(damageAbility || rowValues[prefix + "damage"] || 
			(parseInt(rowValues[prefix + "damage-dice-num"], 10) && parseInt(rowValues[prefix + "damage-die"], 10)))) {
			optionText += "{{no_damage=1}}";
		}
		if (toggleValues.showattack) {
			optionText += optionTemplates.attack_notes.replace("REPLACE", optionDefaults.notes.attack)||"";
		}
		return optionText;
	},
	/* resets one row of repeating_weapons
	* note this is almost exactly like resetOption suggesting there is a way to refactor these*/
	resetOption = function (id, eventInfo, callback) {
		var done = _.once(function(){
			TAS.debug("leaving PFAttackOptions.resetOption, rowid: "+ id);
			if (typeof callback === "function"){
				callback();
			}
		}),
		prefix = "repeating_weapon_" + PFUtils.getRepeatingIDStr(id),
		rowfields = _.map(repeatingOptionGetAttrs, function (attr) {
			return prefix + attr;
		}),
		allFields = optionToggles;
		allFields = allFields.concat(rowfields);
		//TAS.log("resetOption, fields to get",allFields);
		getAttrs(allFields, function (v) {
			var toggleValues = _.reduce(optionToggles, function (memo, attr) {
				memo['show' + attr.toLowerCase().slice(14).replace('_notes', '')] = (parseInt(v[attr], 10) || 0);
				return memo;
			}, {}),
			optionText = "",
			setter = {};
			optionText = getOptionText(prefix, toggleValues, v)||"";
			if (typeof optionText !== "undefined" && optionText !== null) {
				setter[prefix + "macro_options"] = optionText;
			}
			if (_.size(setter) > 0) {
				setAttrs(setter, PFConst.silentParams, done);
			} else {
				done();
			}
		});
	},
	resetSomeOptions = function(ids,eventInfo,callback){
		var done=_.once(function(){
			if (typeof callback === 'function'){
				callback();
			}
		});
		if(!(ids && _.size(ids))){
			done();
			return;
		}
		getAttrs(optionToggles,function(vout){
			var fields,
			toggleValues = _.reduce(optionToggles, function (memo, attr) {
				memo['show' + attr.toLowerCase().slice(14).replace('_notes', '')] = (parseInt(vout[attr], 10) || 0);
				return memo;
			}, {});
			fields = SWUtils.cartesianAppend(["repeating_weapon_"],ids,repeatingOptionGetAttrsLU);
			getAttrs(fields,function(v){
				var setter = _.reduce(ids,function(memo,id){
					var prefix='repeating_weapon_'+id+'_',tempstr='';
					try{
						tempstr = getOptionText(prefix,toggleValues,v);
						//tempstr= getOptionTextNew(prefix,toggleValues,v)||'';
						if(tempstr!== v[prefix+'macro_options']){
							memo[prefix+'macro_options']=tempstr;
						}
					} finally {
						return memo;
					}
				},{});
				if(_.size(setter)){
					setAttrs(setter,PFConst.silentParams,done);
				} else {
					done();
				}
			});
		});
	},
	/*resetOptions - updates repeating_weapon_ attack _options for all attacks.*/
	resetOptions = function (callback,eventInfo) {
		getSectionIDs("repeating_weapon", function (ids) {
			resetSomeOptions(ids,eventInfo,callback);
		});
	},
	recalculate = function (callback) {
		resetOptions(callback);
	},
	events = {
		attackOptionEventsPlayer: repeatingOptionAttrs,
		attackOptionEventsAuto: repeatingOptionHelperAttrs
	},
	registerEventHandlers = function () {
		_.each(optionToggles, function (toggleField) {
			on("change:" + toggleField, TAS.callback(function toggleAttackNoteOption(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					resetOptions(null,eventInfo);
				}
			}));
		});
		//attack options for one row
		_.each(events.attackOptionEventsAuto, function (fieldToWatch) {
			var eventToWatch = "change:repeating_weapon:" + fieldToWatch;
			on(eventToWatch, TAS.callback(function eventUpdateAttackTypeOptionSheet(eventInfo) {
				if (eventInfo.sourceType === "sheetworker") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					resetOption(null, eventInfo);
				}
			}));
		});
		_.each(events.attackOptionEventsPlayer, function (fieldToWatch) {
			var eventToWatch = "change:repeating_weapon:" + fieldToWatch;
			on(eventToWatch, TAS.callback(function eventUpdateAttackTypeOptionPlayer(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					resetOption(null, eventInfo);
				}
			}));
		});
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFAttackOptions module loaded  ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		getOptionText: getOptionText,
		resetOption: resetOption,
		resetOptions: resetOptions,
		resetSomeOptions: resetSomeOptions
	};
}());
var PFEncumbrance = PFEncumbrance || (function () {
	'use strict';
	var
	// Returns the carrying capacity for a given strength score and load type
	// Will recursively calculate for strength scores over 29
	getCarryingCapacity = function (str, load) {
		var l,
		m,
		h,
		r;
		switch (str) {
			case 0:
				l = 0;
				m = 0;
				h = 0;
				break;
			case 1:
				l = 3;
				m = 6;
				h = 10;
				break;
			case 2:
				l = 6;
				m = 13;
				h = 20;
				break;
			case 3:
				l = 10;
				m = 20;
				h = 30;
				break;
			case 4:
				l = 13;
				m = 26;
				h = 40;
				break;
			case 5:
				l = 16;
				m = 33;
				h = 50;
				break;
			case 6:
				l = 20;
				m = 40;
				h = 60;
				break;
			case 7:
				l = 23;
				m = 46;
				h = 70;
				break;
			case 8:
				l = 26;
				m = 53;
				h = 80;
				break;
			case 9:
				l = 30;
				m = 60;
				h = 90;
				break;
			case 10:
				l = 33;
				m = 66;
				h = 100;
				break;
			case 11:
				l = 38;
				m = 76;
				h = 115;
				break;
			case 12:
				l = 43;
				m = 86;
				h = 130;
				break;
			case 13:
				l = 50;
				m = 100;
				h = 150;
				break;
			case 14:
				l = 58;
				m = 116;
				h = 175;
				break;
			case 15:
				l = 66;
				m = 133;
				h = 200;
				break;
			case 16:
				l = 76;
				m = 153;
				h = 230;
				break;
			case 17:
				l = 86;
				m = 173;
				h = 260;
				break;
			case 18:
				l = 100;
				m = 200;
				h = 300;
				break;
			case 19:
				l = 116;
				m = 233;
				h = 350;
				break;
			case 20:
				l = 133;
				m = 266;
				h = 400;
				break;
			case 21:
				l = 153;
				m = 306;
				h = 460;
				break;
			case 22:
				l = 173;
				m = 346;
				h = 520;
				break;
			case 23:
				l = 200;
				m = 400;
				h = 600;
				break;
			case 24:
				l = 233;
				m = 466;
				h = 700;
				break;
			case 25:
				l = 266;
				m = 533;
				h = 800;
				break;
			case 26:
				l = 306;
				m = 613;
				h = 920;
				break;
			case 27:
				l = 346;
				m = 693;
				h = 1040;
				break;
			case 28:
				l = 400;
				m = 800;
				h = 1200;
				break;
			case 29:
				l = 466;
				m = 933;
				h = 1400;
				break;
			default:
				l = getCarryingCapacity(str - 10, "light") * 4;
				m = getCarryingCapacity(str - 10, "medium") * 4;
				h = getCarryingCapacity(str - 10, "heavy") * 4;
				break;
		}
		switch (load) {
			case "light":
				r = l;
				break;
			case "medium":
				r = m;
				break;
			case "heavy":
				r = h;
				break;
		}
		return r;
	},
	/* updateCurrentLoad-updates the current load radio button */
	updateCurrentLoad = function (callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		};
		getAttrs(["load-light", "load-medium", "load-heavy", "load-max", "current-load", "carried-total","max-dex-source"], function (v) {
			var curr = 0,
			carried = 0,
			light = 0,
			medium = 0,
			heavy = 0,
			max = 0,
			maxDexSource = 0,
			ignoreEncumbrance = 0,
			newLoad = 0,
			setter = {},
			params = {};
			try {
				//TAS.debug("at updateCurrentLoad",v);
				maxDexSource=parseInt(v["max-dex-source"],10)||0;
				ignoreEncumbrance =  (maxDexSource===1 || maxDexSource===3)?1:0;
				curr = parseInt(v["current-load"], 10) || 0;
				if (ignoreEncumbrance){
					newLoad=0;
				} else {
					
					carried = parseInt(v["carried-total"], 10) || 0;
					light = parseInt(v["load-light"], 10) || 0;
					medium = parseInt(v["load-medium"], 10) || 0;
					heavy = parseInt(v["load-heavy"], 10) || 0;
					max = heavy * 2;
				
					//TAS.debug"current-load=" + curr + ", carried-total=" + carried + ", load-light=" + light + ", load-medium=" + medium);
					if (carried <= light) {
						//TAS.debug("light load");
						newLoad = 0;
					} else if (carried <= medium) {
						//TAS.debug("medium load");
						newLoad = 1;
					} else if (carried <= heavy) {
						//TAS.debug("heavy load");
						newLoad = 2;
					} else if (carried <= max) {
						//TAS.debug"over heavy but under max");
						newLoad = 3;
					} else if (carried > max) {
						//TAS.debug"maximum load");
						newLoad = 4;
					}
				}
				if (curr !== newLoad){
					setter["current-load"] = newLoad;
				}
			} catch (err) {
				TAS.error("PFEncumbrance.updateCurrentLoad", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/* updateLoadsAndLift
	* updates the load and lift numbers
	*/
	updateLoadsAndLift = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["STR", "size", "size-multiplier", "legs", "load-light", "load-medium", "load-heavy", "load-max",
		"lift-above-head", "lift-off-ground", "lift-drag-and-push", "load-str-bonus", "load-multiplier", 
		"total-load-multiplier", "load-misc"], function (v) {
			var str = 10,
			size = 1,
			sizeMult = 1,
			currSizeMult = 1,
			currTotalLoadMult = 1,
			legs = 2,
			light = 0,
			medium = 0,
			heavy = 0,
			max = 0,
			aboveHead = 0,
			offGround = 0,
			drag = 0,
			strMod = 0,
			loadMult = 1,
			mult = 1,
			misc = 0,
			l = 0,
			m = 0,
			h = 0,
			a = 0,
			o = 0,
			d = 0,
			setter = {},
			params = {};
			try {
				str = parseInt(v["STR"], 10) || 0;
				size = parseInt(v["size"], 10) || 0;
				sizeMult = parseInt(v["size-multiplier"], 10) || 0;
				currSizeMult = sizeMult;
				currTotalLoadMult = parseInt(v["total-load-multiplier"], 10) || 0;
				legs = parseInt(v["legs"], 10) || 0;
				if (legs!==4){legs=2;}
				light = parseInt(v["load-light"], 10) || 0;
				medium = parseInt(v["load-medium"], 10) || 0;
				heavy = parseInt(v["load-heavy"], 10) || 0;
				max = parseInt(v["load-max"], 10) || 0;
				aboveHead = parseInt(v["lift-above-head"], 10) || 0;
				offGround = parseInt(v["lift-off-ground"], 10) || 0;
				drag = parseInt(v["lift-drag-and-push"], 10) || 0;
				strMod = parseInt(v["load-str-bonus"], 10) || 0;
				loadMult = parseInt(v["load-multiplier"], 10) || 0;
				mult = 1;
				misc = parseInt(v["load-misc"], 10) || 0;
				l = getCarryingCapacity(str + strMod, "light") + misc;
				m = getCarryingCapacity(str + strMod, "medium") + misc;
				h = getCarryingCapacity(str + strMod, "heavy") + misc;
				if (loadMult < 1) {
					loadMult = 1;
				}
				loadMult--;
				//TAS.debug("STR=" + str + ", legs=" + legs + ", load-light=" + light + ", load-medium=" + medium + ", load-heavy=" + heavy + ", lift-above-head=" + aboveHead + ", lift-off-ground=" + offGround + ", lift-drag-and-push=" + drag + ", load-str-bonus=" + strMod + ", load-multiplier=" + loadMult + ", load-misc=" + misc);
				if (legs !== 4 ) {
					switch (size) {
						case -8:
							sizeMult = 16;
							break;
						case -4:
							sizeMult = 8;
							break;
						case -2:
							sizeMult = 4;
							break;
						case -1:
							sizeMult = 2;
							break;
						case 1:
							sizeMult = 3 / 4;
							break;
						case 2:
							sizeMult = 1 / 2;
							break;
						case 4:
							sizeMult = 1 / 4;
							break;
						case 8:
							sizeMult = 1 / 8;
							break;
						default:
							sizeMult = 1;
					}
				} else if (legs === 4) {
					switch (size) {
						case -8:
							sizeMult = 24;
							break;
						case -4:
							sizeMult = 12;
							break;
						case -2:
							sizeMult = 6;
							break;
						case -1:
							sizeMult = 3;
							break;
						case 0:
							sizeMult = 1.5;
							break;
						case 1:
							sizeMult = 1;
							break;
						case 2:
							sizeMult = 3 / 4;
							break;
						case 4:
							sizeMult = 1 / 2;
							break;
						case 8:
							sizeMult = 1 / 4;
							break;
						default:
							sizeMult = 1.5;
					}
				}
				mult += loadMult;
				mult *= sizeMult;
				l *= mult;
				m *= mult;
				h *= mult;
				a = h;
				o = h * 2;
				d = h * 5;
				//TAS.debug("new light load=" + l + ", new medium load=" + m + ", new heavy load=" + h + ", new above head=" + a + ", new off ground=" + o + ", new drag=" + d);
				if (currSizeMult !== sizeMult) {
					setter["size-multiplier"] = sizeMult;
				}
				if (currTotalLoadMult !== mult) {
					setter["total-load-multiplier"] = mult;
				}
				if (light !== l) {
					setter["load-light"] = l;
				}
				if (medium !== m) {
					setter["load-medium"] = m;
				}
				if (heavy !== h) {
					setter["load-heavy"] = h;
				}
				if (max !== (h*2)){
					setter["load-max"] = (h*2);
				}
				if (aboveHead !== a) {
					setter["lift-above-head"] = a;
				}
				if (offGround !== o) {
					setter["lift-off-ground"] = o;
				}
				if (drag !== d) {
					setter["lift-drag-and-push"] = d;
				}
			} catch (err) {
				TAS.error("updateLoadsAndLift", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/* updateModifiedSpeed
	* updates the modified speed and run values  */
	updateModifiedSpeed = function (callback) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		attribList = ["current-load", "speed-base", "speed-modified", "speed-run",  "race", "is_dwarf", "max-dex-source", "run-mult"];
		_.each(PFDefense.defenseArmorShieldRows, function (row) {
			attribList.push(row + "-equipped");
			attribList.push(row + "-type");
		});
		getAttrs(attribList, function (v) {
			var currSpeed = parseInt(v["speed-modified"], 10) || 0,
			currRun = parseInt(v["speed-run"], 10) || 0,
			currLoad = parseInt(v["current-load"], 10) || 0,
			base = parseInt(v["speed-base"], 10) || 0,
			speedDropdown = parseInt(v["max-dex-source"], 10) || 0,
			origRunMult = isNaN(parseInt(v["run-mult"], 10)) ? 4 : parseInt(v["run-mult"], 10),
			newSpeed = base,
			runMult = origRunMult,
			newRun = base * runMult,
			combinedLoad = 0,
			isDwarf = false,
			inHeavy = false,
			inMedium = false,
			armorLoad = 0,
			setter = {};
			try {
				//TAS.debug("speed-modified=" + currSpeed + ", speed-run=" + currRun + ", current-load=" + currLoad + ", speed-base=" + base + ", load-heavy=" + heavy + ", carried-total=" + carried);
				// #0: Armor, Shield & Load
				// #1: Armor & Shield only
				// #2: Load only
				// #3: None
				if (speedDropdown !== 3) {
					//dwarf base speed not lowered but run multiplier can be.
					isDwarf = parseInt(v.is_dwarf,10)||0;
					if (!isDwarf){
						isDwarf = typeof v.race === "undefined" ? false : v.race.toLowerCase().indexOf("dwarf") >= 0;
						if (isDwarf){
							setter["is_dwarf"]=1;
						}
					}
					if (speedDropdown === 0 || speedDropdown === 1) {
						inHeavy = (v["armor3-type"] === "Heavy" && (v["armor3-equipped"] == "1" || typeof v["armor3-equipped"] === "undefined"));
						inMedium = (v["armor3-type"] === "Medium" && (v["armor3-equipped"] == "1" || typeof v["armor3-equipped"] === "undefined"));
						if (inMedium){ armorLoad = 1;}
						else if (inHeavy) {armorLoad = 2;}
					}
					combinedLoad = Math.max(armorLoad,currLoad);
					if (combinedLoad===4){
						newSpeed = 0;
						newRun=0;
						runMult=0;
					} else if (combinedLoad === 3){
						newSpeed = 5;
						newRun=0;
						runMult=0;
					} else if (combinedLoad === 2 || combinedLoad === 1) {
						if (!isDwarf){
							if (base <= 5) {
								newSpeed = 5;
							} else if (base % 15 === 0) {
								newSpeed = base * 2 / 3;
							} else if ((base + 5) % 15 === 0) {
								newSpeed = (base + 5) * 2 / 3;
							} else {
								newSpeed = ((base + 10) * 2 / 3) - 5;
							}
						}
						runMult--;
					} else {
						newSpeed = base;
					}
				}
				newRun = newSpeed * runMult;
				if (currSpeed !== newSpeed) {
					setter["speed-modified"] = newSpeed;
				}
				if (currRun !== newRun) {
					setter["speed-run"] = newRun;
				}
			} catch (err) {
				TAS.error("PFEncumbrance.updateModifiedSpeed", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {}, done);
				} else {
					done();
				}
			}
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFEncumbrance.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		setSpeedWhenDone = _.once(function () {
			updateModifiedSpeed(done);
		}),
		setEncumbrance = _.once(function () {
			updateCurrentLoad(setSpeedWhenDone);
		}),
		setLoadCapability = _.once(function () {
			updateLoadsAndLift(setEncumbrance, silently);
		});
		try {
			setLoadCapability();
		} catch (err) {
			TAS.error("PFEncumbrance.recalculate", err);
			done();
		}
	},
	registerEventHandlers = function () {
		on("change:current-load change:speed-base change:race change:armor3-equipped change:armor3-type change:max-dex-source change:run-mult", TAS.callback(function eventUpdateModifiedSpeed(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updateModifiedSpeed();
		}));
		on('change:load-light change:carried-total', TAS.callback(function eventUpdateCurrentLoad(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "sheetworker"){
				updateCurrentLoad();
			}
		}));
		on("change:STR change:legs change:load-str-bonus change:load-multiplier change:load-misc", TAS.callback(function eventUpdateLoadsAndLift(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updateLoadsAndLift();
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFEncumbrance module loaded    ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		getCarryingCapacity: getCarryingCapacity,
		updateCurrentLoad: updateCurrentLoad,
		updateLoadsAndLift: updateLoadsAndLift,
		updateModifiedSpeed: updateModifiedSpeed
	};
}());
var PFInventory = PFInventory || (function () {
	'use strict';
	var wornEquipmentRowsOld = ["Belt", "Body", "Chest", "Eyes", "Feet", "Hands", "Head", "Headband", "Neck", "Ring1", "Ring2", "Shoulders", "Wrist"],
	wornEquipmentRowsNew = ["Armor", "Belt", "Body", "Chest", "Eyes", "Feet", "Hands", "Head", "Headband", "Neck", "Ring1", "Ring2", "Shield", "Shoulders", "Wrist"],
	wornEquipmentRowsPlusCarried=["Carried","NotCarried"].concat(wornEquipmentRowsNew),
	locationMap = {'Carried':0,'NotCarried':1,'Armor':2,'Belt':3,'Body':4,'Chest':5,'Eyes':6,'Feet':7,'Hands':8,
		'Head':9,'Headband':10,'Neck':11,'Ring1':12,'Ring2':13,'Shield':14,'Shoulders':15,'Wrist':16},
	equipMap = {'noEquipType':0,'Weapon':1,'Armor':2,'Ammo':3,'Consumables':4,'OtherMagic':5,'Gear':6,'Other':7},
	groupMapForMenu = {0:'',1:'weapons',2:'armor-shield',3:'ammunition',4:'consumables',5:'other-magic-items',6:'gear-tool',7:'other-items'},
	wornEquipmentColumns = ["charges", "weight", "hp", "hp_max", "value"],
	commonLinkedAttributes = ["attack-type", "range", "masterwork", "crit-target", "crit-multiplier", "damage-dice-num", "damage-die", "damage",
		"precision_dmg_macro", "precision_dmg_type", "critical_dmg_macro", "critical_dmg_type"],
	/** resetCommandMacro sets command button macro with all rows from one ability list.
	* calls PFMenus.getRepeatingCommandMacro
	* sets the returned string to macro with attribute name: section+"_buttons_macro"
	*@param {function} callback  when done
	*/
	resetCommandMacro=function(callback){
		var done = _.once(function () {
				TAS.debug("leaving PFInventory.resetCommandMacro: ");
				if (typeof callback === "function") {
					callback();
				}
			}),
			params={};
		//TAS.debug"PFInventory.resetCommandMacro getting rollmenu  ");
		params={
			'section': 'item',
			'name': 'items',
			'usesField': 'qty',
			'linkField': 'roll',
			'nameField': 'name',
			'filterField': 'showinmenu',
			'npcLinkField': 'npc-roll',
			'groupBy':'equip-type',
			'translateGroup':1,
			'groupMap': groupMapForMenu
		};
		getAttrs(['is_npc'],function(v){
			var isNPC=parseInt(v.is_npc,10)||0, 
			numToDo=isNPC?2:1, 
			doneOne=_.after(numToDo,done);
			PFMenus.resetOneCommandMacro('item',isNPC,doneOne,'',groupMapForMenu);
			if (isNPC){
				PFMenus.resetOneCommandMacro('item',false,doneOne,'',groupMapForMenu);
			}
		});
	},
	/** Gets the worn item grid row name corresponding to location number in dropdown
	*@param {int} location a value from repeating_item_$X_location
	*@returns {string} name of "worn-space" to set
	*/
	getWornItemNameField = function (location) {
		var wornSlot = "";
		if (location > 1 && wornEquipmentRowsPlusCarried[location]) {
			//TAS.debug("getWornItemNameField at location:" + wornEquipmentRowsPlusCarried[location]);
			if (location !== locationMap.Armor && location !== locationMap.Shield) {
				wornSlot = "worn-" + wornEquipmentRowsPlusCarried[location];
			} else if (location === locationMap.Armor) {
				wornSlot = "armor3";
			} else if (location === locationMap.Shield) {
				wornSlot = "shield3";
			}
		}
		return wornSlot;
	},
	/** updateRepeatingItems totals columns 
	*@param {function} callback to call when done
	*@param {boolean} silently if true send PFConst.silentParams to setAttrs
	*/
	updateRepeatingItems = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		try {
			//TAS.debug("at updateRepeatingItems");
			TAS.repeating('item').attrs('item_total_weight', 'item-total-hp', 'item-total-hp_max', 'item-total-value').fields('item-weight', 'qty', 'qty_max', 'location', 'item-hp', 'item-hp_max', 'value').reduce(function (m, r) {
				try {
					//TAS.debug("in weight add row, variables: weight: "+r.F['item-weight']+", qty:"+r.I.qty+", max:"+r.I.qty_max +", loc:"+ r.I.location);
					if (r.I.qty > 0 && (r.I.location !== locationMap.NotCarried)) {
						if (r.I.qty_max === 0 || r.I.qty_max===1) {
							m['item-weight'] += r.F['item-weight'] * r.I.qty;
						} else {
							m['item-weight'] += r.F['item-weight'];
						}
					}
					m['item-hp'] += r.I['item-hp'];
					m['item-hp_max'] += r.I['item-hp_max'];
					m.value += r.I.value * r.I.qty;
				} catch (errinner) {
					TAS.error("PFInventory.updateRepeatingItems inner error", errinner);
				} finally {
					return m;
				}
			}, {
				'item-weight': 0,
				'item-hp': 0,
				'item-hp_max': 0,
				value: 0
			}, function (m, r, a) {
				a.S['item_total_weight'] = m['item-weight'];
				a.S['item-total-hp'] = m['item-hp'];
				a.S['item-total-hp_max'] = m['item-hp_max'];
				a.S['item-total-value'] = m.value;
			}).execute(done);
		} catch (err) {
			TAS.error("PFInventory.updateRepeatingItems", err);
			done();
		}
	},
	/** updateCarriedCurrency  totals weight for carried currency 
	*@param {function} callback to call when done
	*@param {boolean} silently if true send PFConst.silentParams to setAttrs
	*/
	updateCarriedCurrency = function (callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		};
		getAttrs(["CP", "SP", "GP", "PP", "carried-currency"], function (v) {
			var curr = parseInt(v["carried-currency"], 10) || 0,
			params = {},
			carried = 0;
			try {
				carried = ((parseInt(v["CP"], 10) || 0) + (parseInt(v["SP"], 10) || 0) + (parseInt(v["GP"], 10) || 0) + (parseInt(v["PP"], 10) || 0)) / 50;
				//TAS.debug("curr=" + curr + ", carried=" + carried);
				if (curr !== carried) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs({
						"carried-currency": carried
					}, params, done);
				} else {
					done();
				}
			} catch (err) {
				TAS.error("PFInventory.updateCarriedCurrency", err);
				done();
			}
		});
	},
	/** updateCarriedTotal- updates the total for carried weight
	*@param {function} callback to call when done
	*@param {boolean} silently if true send PFConst.silentParams to setAttrs
	*/
	updateCarriedTotal = function (callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		};
		getAttrs(["carried-currency", "item_total_weight", "carried-misc", "carried-total"], function (v) {
			var curr,
			carried,
			params = {};
			try {
				curr = parseFloat(v["carried-total"], 10) || 0;
				carried = ((parseFloat(v["carried-currency"], 10) || 0) * 100 + (parseFloat(v["item_total_weight"], 10) || 0) * 100 + (parseFloat(v["carried-misc"], 10) || 0) * 100) / 100; // Fix bad javascript math
				//TAS.debug("curr=" + curr + ", carried=" + carried);
				if (curr !== carried) {
					setAttrs({
						"carried-total": carried
					}, params, done);
				} else {
					done();
				}
			} catch (err) {
				TAS.error("PFInventory.updateCarriedTotal", err);
				done();
			}
		});
	},
	/** Got rid of the Worn Equipment section, so migrate any values to the Equipment as repeating entries.
	* Worn Armor & Worn Shield are now disabled and controlled by the Equipment section in the Inventory tab.
	*@param {function} callback to call when done
	*@param {boolean} silently if true send PFConst.silentParams to setAttrs
	*/
	migrateWornEquipment = function (callback) {
		var doneMigrating = _.once(function () {
			TAS.debug("leaving PFInventory.migrateWornEquipment");
			if (typeof callback === "function") {
				callback();
			}
		}),
		copyWornEquipmentToNewItem = function ( row, callback) {
			var done = _.once(function () {
				TAS.debug("leaving PFInventory.copyWornEquipmentToNewItem for "+row);
				if (typeof callback === "function") {
					callback();
				}
			}),
			attribList = ["worn-" + row];
			attribList.push("worn-" + row + "-description");
			attribList.push("worn-" + row + "-hardness");
			_.each(wornEquipmentColumns,function(col){
				attribList.push("worn-" + row + "-" + col);
			});
			getAttrs(attribList, function (v) {
				var newRowId = ''
				, newRowAttrs = {}
				, weightRowAttrs = {}
				, attrib = ""
				, newLocation = 0
				, newEquipType = equipMap.noEquipType;
				// Migrate the worn equipment entry to equipment if the name is populated
				try {
					TAS.debug("PFInventory.copyWornEquipmentToNewItem checking "+row+" it is:"+v["worn-" + row]);
					if (v["worn-" + row]) {
						newRowId = generateRowID();
						/* Assign defined worn equipment values to new repeating_item entry */
						newRowAttrs["repeating_item_" + newRowId + "_name"] = v["worn-" + row];
						newRowAttrs["repeating_item_" + newRowId + "_row_id"] = newRowId;
						attrib = v["worn-" + row + "-description"];
						if (attrib) {
							newRowAttrs["repeating_item_" + newRowId + "_short-description"] = attrib;
						}
						attrib = v["worn-" + row + "-charges"];
						if (attrib) {
							newRowAttrs["repeating_item_" + newRowId + "_qty"] = attrib;
							newRowAttrs["repeating_item_" + newRowId + "_qty_max"] = v["worn-" + row + "-charges_max"]||50;
						} else {
							weightRowAttrs["repeating_item_" + newRowId + "_qty"] = 1;
							weightRowAttrs["repeating_item_" + newRowId + "_qty_max"] = 1;
						}
						attrib = v["worn-" + row + "-weight"];
						if (attrib) {
							weightRowAttrs["repeating_item_" + newRowId + "_item-weight"] = attrib;
						}
						attrib = v["worn-" + row + "-hardness"];
						if (attrib) {
							weightRowAttrs["repeating_item_" + newRowId + "_hardness"] = attrib;
						}
						attrib = v["worn-" + row + "-hp"];
						if (attrib) {
							weightRowAttrs["repeating_item_" + newRowId + "_item-hp"] = attrib;
						}
						attrib = v["worn-" + row + "-hp_max"];
						if (attrib) {
							newRowAttrs["repeating_item_" + newRowId + "_item-hp_max"] = attrib;
						}
						attrib = v["worn-" + row + "-value"];
						if (attrib) {
							weightRowAttrs["repeating_item_" + newRowId + "_value"] = attrib;
						}
						newRowAttrs["worn-" + row + "-roll"] = "@{repeating_item_" + newRowId + "_macro-text}";
						// Location
						newLocation = locationMap[row];
						//wornEquipmentRowsPlusCarried.indexOf(row);
						newRowAttrs["repeating_item_" + newRowId + "_location"] = newLocation;
						newRowAttrs["repeating_item_" + newRowId + "_old_location"] = newLocation;
						newEquipType = equipMap.OtherMagic;
						newRowAttrs["repeating_item_" + newRowId + "_equip-type"] = newEquipType;
						newRowAttrs["repeating_item_" + newRowId + "_equiptype-tab"] = newEquipType;
					}
				} catch (err) {
					TAS.error("PFInventory.copyWornEquipmentToNewItem", err);
				} finally {
					//TAS.debug("PFInventory.migrateWornEquipment.copyWornEquipmentToNewItem setting:",newRowAttrs);
					if (_.size(newRowAttrs)>0){
						setAttrs(newRowAttrs, PFConst.silentParams, done); 
					} else {
						done();
					}
					//weight, hardness, qty are set non silently to trigger recalc
					if(_.size(weightRowAttrs)>0){
						setAttrs(weightRowAttrs);
					}
				}
			});
		},
		// Migrate the armor & worn shield entries to equipment if the name is populated
		//item: value from PFDefense.defenseArmorShieldRowsOld
		copyWornDefenseToNewItem = function (item, wornAlreadySet, callback) {
			var done = _.once(function (wasSetToWorn) {
				TAS.debug("leaving PFInventory.copyWornDefenseToNewItem did we set worn for "+item+"?: "+wasSetToWorn);
				if (typeof callback === "function") {
					callback(wasSetToWorn);
				}
			}),
			attribList = [item, item + "-type"],
			defenseName = "",
			isArmor = 0,
			isShield = 0;

			//armor or shield?
			if ((/armor/i).test(item)) {
				isArmor = 1;
			} else if ((/shield/i).test(item)) {
				isShield = 1;
			} else {
				done(0);
				return;
			}
			// Search for pre-existing matching entry in equipment
			getAttrs([item], function (vi) {
				//TAS.debug("vi[item]=" + vi[item]);
				if (!vi[item]){
					done(0);
					return;
				}
				defenseName = vi[item];
				getSectionIDs("repeating_item", function (ids) {
					//TAS.debug("ids=" + ids);
					var fields = [];
					fields = _.map(ids, function (id) {
						return "repeating_item_" + id + "_name";
					});
					_.each(PFDefense.defenseArmorShieldColumns, function (column) {
						attribList.push(item + "-" + column);
					});
					attribList = attribList.concat(fields);
					//TAS.debug("copyWornDefenseToNewItem attribList=" + attribList);
					getAttrs(attribList, function (v) {
						var prefix, matchingField, newRowId = '', newRowAttrs = {}, locationAttrs={},  maxDex=0, attrib = "", isNewRow = true, markedEquipped=0, isWorn=0;
						try {							
							//TAS.notice("PFInventory.copyWornDefenseToNewItem item:"+item+" was already set="+wornAlreadySet,v);
							markedEquipped=parseInt(v[item + "-equipped"],10)||0;
							maxDex = parseInt(v[item+"-max-dex"],10);
							if(isNaN(maxDex)){
								maxDex=99;
							}
							matchingField = _.find(fields, function (field) { return defenseName === v[field]; });
							//TAS.debug("matchingField=" + matchingField);
							if (matchingField) {
								isNewRow = false;
								newRowId = SWUtils.getRowId(matchingField);//.replace("repeating_item_", "").replace("_name", "");
							} else {
								newRowId = generateRowID();
							}
							newRowAttrs["repeating_item_" + newRowId + "_equip-type"] = equipMap.Armor;
							newRowAttrs["repeating_item_" + newRowId + "_equiptype-tab"] = equipMap.Armor;
							/* Assign defined worn equipment values to new repeating_item entry */
							if (isNewRow) {
								newRowAttrs["repeating_item_" + newRowId + "_name"] = defenseName;
							}
							newRowAttrs["repeating_item_" + newRowId + "_qty"] = 1;
							newRowAttrs["repeating_item_" + newRowId + "_qty_max"] = 1;
							if (!wornAlreadySet &&  markedEquipped=== 1) {
								isWorn=1;
								if (isArmor) {
									if(isNewRow){
										newRowAttrs["repeating_item_" + newRowId + "_location"] = locationMap.Armor;
										newRowAttrs["repeating_item_" + newRowId + "_old_location"] = locationMap.Armor;
									} else {
										locationAttrs["repeating_item_" + newRowId + "_location"] = locationMap.Armor;
									}
									newRowAttrs["armor3-roll"] = "@{repeating_item_" + newRowId + "_macro-text}";
									newRowAttrs["armor3"] = v[item];
								} else {
									if(isNewRow){
										newRowAttrs["repeating_item_" + newRowId + "_location"] = locationMap.Shield;
										newRowAttrs["repeating_item_" + newRowId + "_old_location"] = locationMap.Shield;
									} else {
										locationAttrs["repeating_item_" + newRowId + "_location"] = locationMap.Shield;
									}
									newRowAttrs["shield3-roll"] = "@{repeating_item_" + newRowId + "_macro-text}";
									newRowAttrs["shield3"] = v[item];
								}
								//set to blank
								if (maxDex>50){
									newRowAttrs[item+"-max-dex"]="-";
								}
							} else {
								//do not need to put in locationAttrs since we set it something last time we came through for other row
								newRowAttrs["repeating_item_" + newRowId + "_location"] = locationMap.NotCarried; // not Carried
								newRowAttrs["repeating_item_" + newRowId + "_old_location"] = locationMap.NotCarried;
								//ensure it is not marked equipped
								if(markedEquipped){
									newRowAttrs[item + "-equipped"]=0;
								}
								// Leave the entry there. The player can manage the entry from inventory and equip it on Defenses tab
							}
							//do not set type, max-dex, or equipped, but do all other columns:
							_.each(["acbonus", "enhance", "acp", "spell-fail", "proficiency"],function(col){
								attrib = v[item + "-" + col];
								if (attrib) {
									newRowAttrs["repeating_item_" + newRowId + "_item-" + col] = attrib;
								}
							});
							
							if (maxDex> 50){
								newRowAttrs["repeating_item_" + newRowId + "_item-max-dex"]="-";
							} else {
								newRowAttrs["repeating_item_" + newRowId + "_item-max-dex"]=maxDex;
							}
							
							attrib = v[item + "-type"];
							if (attrib) {
								newRowAttrs["repeating_item_" + newRowId + "_item-defense-type"] = attrib;
							}
						} catch (err) {
							TAS.error("PFInventory.copyWornDefenseToNewItem", err);
						} finally {
							if (_.size(newRowAttrs)>0){
								//TAS.debug("PFInventory.copyWornDefenseToNewItem item:"+item+",setting:",newRowAttrs);
								setAttrs(newRowAttrs,PFConst.silentParams, function(){
									if(_.size(locationAttrs)>0){
										setAttrs(locationAttrs,{},function(){done(isWorn);});
									} else {
										done(isWorn);
									}
								});
							} else {
								done(false);
							}
						}
					});
				});
			});
		};
		//TAS.debug("############","at PFInventory.migrateWornEquipment");
		getAttrs(["migrated_worn_equipment"], function (v) {
			var foundWornArmor=false,
			foundWornShield=false,
			doneAll =_.after(2,function(){
				//TAS.debug("#### PFInventory.migrateWornEquipment.doneAll 2");
				setAttrs({"migrated_worn_equipment": "1"}, {}, doneMigrating);
			}),
			doneWornRow = _.after(_.size(wornEquipmentRowsOld),function(){
				TAS.debug("checking armor3");
				copyWornDefenseToNewItem('armor3',foundWornArmor,function(wasSet){
					foundWornArmor=foundWornArmor||wasSet;
					TAS.debug("checking armor2, found="+foundWornArmor);
					copyWornDefenseToNewItem('armor2',foundWornArmor,function(wasSet){
						foundWornArmor=foundWornArmor||wasSet;
						TAS.debug("checking armor0, found="+foundWornArmor);
						copyWornDefenseToNewItem('armor',foundWornArmor,doneAll);
					});
				});
				TAS.debug("checking shield3");
				copyWornDefenseToNewItem('shield3',foundWornShield,function(wasSet){
					foundWornShield=foundWornShield||wasSet;
					TAS.debug("checking shield2, found="+foundWornShield);
					copyWornDefenseToNewItem('shield2',foundWornShield,function(wasSet){
						foundWornShield=foundWornShield||wasSet;
						TAS.debug("checking shield0, found="+foundWornShield);
						copyWornDefenseToNewItem('shield',foundWornShield,doneAll);
					});
				});
			});
			try {
				//TAS.debug("PFInventory.migrateWornEquipment flag is ",v," and there are "+_.size(wornEquipmentRowsOld)+" rows of worn equip");
				if (parseInt(v["migrated_worn_equipment"],10) === 1) {
					TAS.debug("##########","ALREADY MIGRATED WORN EQUIPMENT");
					doneMigrating();
					return;
				}
				//do worn equipment rows before armor, because sometimes they have armor in a slot.
				_.each(wornEquipmentRowsOld,function(row){
					copyWornEquipmentToNewItem(row,doneWornRow);
				});
				// Orphaned attributes:
				// worn-equipment-show
				// worn-total-charges
				// worn-total-weight
				// worn-total-hp
				// worn-total-hp_max
				// worn-total-value
				// carried-worn-equipment
				// For each wornEquipmentRowsOld, worn-{row}-{column}, where columns are: "charges", "weight", "hp", "hp_max", "value", "description", "hardness", "roll"
				// For each wornEquipmentRowsOld, worn-{row}
			} catch (err) {
				TAS.error("PFInventory.migrateWornEquipment", err);
				doneMigrating();
			}
		});
	},
	/** updateEquipmentLocation updates a row for repeating item when location dropdown changed.
	* when done set old location to the new location
	* Handle equipment location change
	*@param {string} id id of row updated, or null
	*@param {function} callback to call when done
	*@param {boolean} silently if true call setAttrs with {silent:true}
	*@param {object} eventInfo USED - from event, to get id from sourceAttribute
	*/
	updateEquipmentLocation = function (id, callback, silently, eventInfo) {
		var done = _.once(function () {
			TAS.debug("leaving PFInventory.updateEquipmentLocation");
			if (typeof callback === "function") {
				callback();
			}
		}),
		/* unsetOtherItems makes sure any other row than id is not in location */
		unsetOtherItems = function (location, id) {
			if (!id || location < 2 || !location) {
				done();
				return;
			}
			/*
			* The player has now changed the location to a worn slot, so check for other repeating items that have the same
			* slot and set them to 'carried'.
			*/
			getSectionIDs("repeating_item", function (idarray) { // get the repeating set
				var attribs = [];
				if (_.size(idarray) <= 1) {
					done();
					return;
				}
				_.each(idarray, function (currentID, i) { // loop through the set
					if (currentID !== id) {
						attribs.push("repeating_item_" + currentID + "_location");
					}
				});
				getAttrs(attribs, function (w) {
					var setter = {};
					_.each(idarray, function (currentID, i) { // loop through the set
						if ((parseInt(w["repeating_item_" + currentID + "_location"], 10) || 0) === location) {
							setter["repeating_item_" + currentID + "_location"] = 0;
							setter["repeating_item_" + currentID + "_old_location"] = 0;
						}
					});
					if (_.size(setter) > 0) {
						setAttrs(setter, { silent: true }, done);
					} else {
						done();
					}
				});
			});
		},
		idStr = PFUtils.getRepeatingIDStr(id),
		item_entry = 'repeating_item_' + idStr,
		realItemID = id || (eventInfo ? (SWUtils.getRowId(eventInfo.sourceAttribute) || "") : ""),
		prefix = 'repeating_item_' + realItemID + "_",
		locationField = prefix + "location",
		nameField = prefix + "name",
		oldLocationField = prefix + "old_location",
		rollField = prefix + "macro-text"
		;

		try {
			//TAS.debug("updateEquipmentLocation: called for ID "+ realItemID);
			//sample source: repeating_item_-kbkc95wvqw1n4rbgs1c_location
			// note that the source is always lowercase, but the actual ID is both cases
			//check value of 'location' to see if it is being worn; if not check to see if the player is removing it from 'worn'
			//TAS.debug("updateEquipmentLocation source=" + source);
			getAttrs([locationField, oldLocationField, nameField], function (v) {
				var location = 0,
					oldlocation = 0,
					wornItemAttrs = {},
					wornSlot = "",
					itemName = "";
				//TAS.debug("updateEquipmentLocation: ", v);
				try {
					location = parseInt(v[locationField], 10);
					if(!isNaN(location)){
						oldlocation = parseInt(v[oldLocationField], 10) ;
						if (isNaN(oldlocation)){
							oldlocation=location;
						}
						wornItemAttrs[oldLocationField] = location;
						if (location ===  locationMap.Carried && oldlocation !== locationMap.NotCarried && oldlocation !== location) { 
								wornSlot = getWornItemNameField(oldlocation);
								if (wornSlot) {
									wornItemAttrs[wornSlot] = "";
									wornItemAttrs[wornSlot + "-roll"] = "";
								}
						} else if (location > locationMap.NotCarried) {
							wornSlot = getWornItemNameField(location);
							if (wornSlot) {
								itemName = v[nameField] || "";
								if (itemName){
									wornItemAttrs[wornSlot] = itemName;
								} else {
									wornItemAttrs[wornSlot] = "Row "+ realItemID;
								}
								wornItemAttrs[wornSlot + "-roll"] = "@{" + rollField + "}";
							}
							if (oldlocation > 1 && oldlocation !== location) {
								wornSlot = getWornItemNameField(oldlocation);
								if (wornSlot) {
									wornItemAttrs[wornSlot] = "";
									wornItemAttrs[wornSlot + "-roll"] = "";
								}
							}
						}
					}
				} catch (err2) {
					TAS.error("updateEquipmentLocation update location error:", err2);
				} finally {
					if (_.size(wornItemAttrs) > 0) {
						//TAS.debug("updateEquipmentLocation, setting slot ", wornItemAttrs);
						setAttrs(wornItemAttrs, { silent: true }, function () {
							if (location > locationMap.NotCarried){
								unsetOtherItems(location, id);
							}
						});
					} else {
						done();
					}
				}
			});
		} catch (err) {
			TAS.error("PFInventory.updateEquipmentLocation", err);
		}
	},
	/** replace the values on the Defenses tab in disabled fields with this row's values
	* from the equipment. Some fields like Armor Bonus, ACP, and Max Dex are not available in the equipment, so they
	* will need to be edited manually after making this change.
	*@param {int} location the value of location attribute in repeating_item
	*@param {string} sourceAttribute eventInfo sourceAttribute of change user made that called this
	*@param {function} callback call when done
	*/
	updateWornArmorAndShield = function (location, sourceAttribute, callback) {
		var done = _.once(function () {
			TAS.debug("leaving PFInventory.updateWornArmorAndShield");
			if (typeof callback === "function") {
				callback();
			}
		})
		, defenseItem = ""
		, attribUpdated = ""
		, itemFullPrefix = ""
		, attribList = []
		, id =""
		, item_entry=""
		, itemFields = ["item-acbonus","item-acenhance","item-max-dex","item-acp","item-spell-fail","item-defense-type","item-proficiency",
			"name","set-as-armor","set-as-shield","location","old_location","equip-type","acenhance"];
		try {
			attribUpdated = SWUtils.getAttributeName(sourceAttribute);
			id = SWUtils.getRowId(sourceAttribute);
			item_entry = "repeating_item_" + id + "_";
			if (item_entry.slice(-1) !== "_") {
				item_entry += "_";
			}
			itemFullPrefix = item_entry + "item-";
			defenseItem = (location === locationMap.Armor ? "armor3" : "shield3");
			//TAS.debug"at update worn armor, defenseItem=" + defenseItem);
			
			attribList =_.map(itemFields,function(attr){
				return item_entry + attr;
			});
			
			attribList = _.reduce(PFDefense.defenseArmorShieldColumns, function (memo, col) {
				memo.push(defenseItem + "-" + col);
				return memo;
			}, attribList);
			
			attribList.push(defenseItem);

			//TAS.debug("PFInventory.updateWornArmorAndShield fields ", attribList);
		} catch (err) {
			TAS.error("PFInventory.updateWornArmorAndShield error before getattrs", err);
			done();
			return;
		}
		//TAS.debug("attribList=" + attribList);
		getAttrs(attribList, function (w) {
			var i=0, setter={}, silentSetter={}, equipType=0,actualLocation=0, attrib="";
			try {
				//if we are setting new, or updating an item in the location, or updating an item in a diffrent location
				//so we can set a new ring of shield, but not update it. but we can update armor and shields.
				if (attribUpdated==='set-as-armor' || attribUpdated==='set-as-shield' || location === locationMap.Armor || location === locationMap.Shield  ) {
					//TAS.debug("updateWornArmorAndShield ", w);
					for (i = 0; i < PFDefense.defenseArmorShieldColumns.length; i++) {
						if (PFDefense.defenseArmorShieldColumns[i] !== "max-dex" &&
								PFDefense.defenseArmorShieldColumns[i] !== "equipped" &&
								PFDefense.defenseArmorShieldColumns[i] !== "type" && 
								PFDefense.defenseArmorShieldColumns[i] !== "enhance" ) {
							attrib = parseInt(w[itemFullPrefix + PFDefense.defenseArmorShieldColumns[i]], 10) || 0;
							if (parseInt(w[defenseItem + "-" + PFDefense.defenseArmorShieldColumns[i]], 10) !== attrib) {
								setter[defenseItem + "-" + PFDefense.defenseArmorShieldColumns[i]] = attrib;
							}
						}
					}
					attrib = w[item_entry + "name"];
					if (attrib) {
						if (w[defenseItem] !== attrib) {
							setter[defenseItem] = attrib;
						}
					} else {
						setter[defenseItem] = "";
					}
					attrib = w[itemFullPrefix + "acenhance"];
					if (attrib){
						setter[defenseItem + "-enhance"] = attrib;
					}
					
					attrib = w[itemFullPrefix + "defense-type"];
					if (attrib) {
						if (defenseItem === "shield3" && attrib === "Medium") {
							//invalid choice, prob meant heavy shield
							attrib = "Heavy";
						} else if (defenseItem === "armor3" && attrib === "Tower Shield") {
							//invalid
							attrib = "Heavy";
						}
						if (w[defenseItem + "-type"] !== attrib) {
							setter[defenseItem + "-type"] = attrib;
						}
					}
					attrib = parseInt(w[itemFullPrefix + "max-dex"], 10);
					if (w[itemFullPrefix + "max-dex"] === "-" || isNaN(attrib)) {
						setter[defenseItem + "-max-dex"] = "-";
					} else {
						setter[defenseItem + "-max-dex"] = attrib;
					}
					if (w[defenseItem + "-equipped"] !== "1") {
						setter[defenseItem + "-equipped"] = 1;
					}

					//reset the buttons silently so we don't loop.
					attrib = parseInt(w[item_entry + "set-as-armor"], 10);
					if (attrib) {
						silentSetter[item_entry + "set-as-armor"] = "0";
					}
					attrib = parseInt(w[item_entry + "set-as-shield"], 10);
					if (attrib) {
						silentSetter[item_entry + "set-as-shield"] = "0";
					}
					//if we hit "set as armor or shield" on a peice of armor / shield equipment, make sure to slot it.
					//do it silently so we don't loop 
					equipType = parseInt(w[item_entry + "equip-type"],10);
					actualLocation= parseInt(w[item_entry+"location"],10);
					if ((!isNaN(equipType)) && actualLocation!== locationMap.Armor && actualLocation !== locationMap.Shield && equipType === equipMap.Armor && 
					  (attribUpdated==='set-as-armor' || attribUpdated==='set-as-shield')  ){
							silentSetter[item_entry + "old_location"] = actualLocation;
							silentSetter[item_entry+"location"] = location;
					}
				} else {
					TAS.warning("no reason to update armor or shield for " + sourceAttribute + " in location " + wornEquipmentRowsPlusCarried[location]);
				}
			} catch (errinner) {
				TAS.error("PFInventory.updateWornArmorAndShield INNER error", errinner);
			} finally {
				if (_.size(silentSetter)>0){
					setAttrs(silentSetter,PFConst.silentParams,function(){
						if (actualLocation !== location){
							updateEquipmentLocation(id,null,true,null);
						}
					});
				}
				if (_.size(setter) > 0) {
					//TAS.debug("updating defenses tab for " + defenseItem, setter);
					setAttrs(setter, {}, done);
				} else {
					done();
				}
			}
		});
	},
	/**  calls updateEquipmentLocation for all items
	*/
	updateLocations = function(){
		getSectionIDs('repeating_item',function(ids){
			_.each(ids,function(id){
				updateEquipmentLocation(id,null,null,null);
			});
		});
	},
	/** Triggered from a button in repeating_items, it will create a repeating attack entry from the item entry
	* @param {string} source the eventItem.sourceAttribute
	* @param {string} weaponId if the row already exists, overwrite all fields but 'name'
	*/
	createAttackEntryFromRow = function (source, callback, silently, weaponId) {
		var done = _.once(function () {
			//TAS.debug("leaving PFInventory.createAttackEntryFromRow");
			if (typeof callback === "function") {
				callback();
			}
		})
		, attribList = []
		, itemId = SWUtils.getRowId(source)
		, idStr = PFUtils.getRepeatingIDStr(itemId)
		, item_entry = 'repeating_item_' + idStr;

		//TAS.debug("PFInventory.createAttackEntryFromRow: item_entry=" + item_entry + " , weapon:"+weaponId);
		attribList.push(item_entry + "name");
		commonLinkedAttributes.forEach(function (attr) {
			attribList.push(item_entry + "item-" + attr);
		});
		attribList.push(item_entry + "item-wpenhance");
		attribList.push(item_entry + "item-dmg-type");
		attribList.push(item_entry + "default_size");
		//TAS.debug("attribList=" + attribList);
		getAttrs(attribList, function (v) {
			var newRowId
			, setter = {}
			, silentSetter={}
			, enhance = 0
			, prof = 0
			, params = silently?PFUtils.silentParams:{};
			try {
				//TAS.debug("weaponId is :"+weaponId);
				if (!weaponId){
					newRowId = generateRowID();
				} else {
					newRowId = weaponId;
				}
				//TAS.debug("the new row id is: "+newRowId);
				//TAS.debug("v[" + item_entry + "name]=" + v[item_entry + "name"]);
				if (v[item_entry + "name"]) {
					if (!weaponId){
						setter["repeating_weapon_" + newRowId + "_name"] = v[item_entry + "name"];
					}
					silentSetter["repeating_weapon_" + newRowId + "_source-item-name"] = v[item_entry + "name"];
				}
				commonLinkedAttributes.forEach(function (attr) {
					//TAS.debug("v[" + item_entry + "item-" + attr + "]=" + v[item_entry + "item-" + attr]);
					if (v[item_entry + "item-" + attr]) {
						setter["repeating_weapon_" + newRowId + "_" + attr] = v[item_entry + "item-" + attr];
					}
				});
				if ( (/melee/i).test(v[item_entry + "item-attack_type"])) {
					setter["repeating_weapon_" + newRowId + "_damage-ability"] = "@{STR-mod}";
				}
				enhance = parseInt(v[item_entry + "item-wpenhance"],10)||0;
				if(enhance){
					setter["repeating_weapon_" + newRowId + "_enhance"] = enhance;
				}
				//TAS.debug("v[" + item_entry + "item-defense-type]=" + v[item_entry + "item-defense-type"]);
				if (v[item_entry + "item-dmg-type"]) {
					setter["repeating_weapon_" + newRowId + "_type"] = v[item_entry + "item-dmg-type"];
				}
				//TAS.debug("v[" + item_entry + "item-proficiency]=" + v[item_entry + "item-proficiency"]);
				prof = parseInt(v[item_entry + "item-proficiency"], 10) || 0;
				if (prof !== 0) {
					prof = -4;
					setter["repeating_weapon_" + newRowId + "_proficiency"] = prof;
				}
				if (v[item_entry + "default_size"]) {
					setter["repeating_weapon_" + newRowId + "_default_size"] = v[item_entry + "default_size"];
				}
				setter["repeating_weapon_" + newRowId + "_default_damage-dice-num"] = v[item_entry + "damage-dice-num"]||0;
				setter["repeating_weapon_" + newRowId + "_default_damage-die"] = v[item_entry + "damage-die"]||0;
				silentSetter["repeating_weapon_" + newRowId + "_source-item"] = itemId;
				//TAS.debug("creating new attack", setter);
			} catch (err) {
				TAS.error("PFInventory.createAttackEntryFromRow", err);
			} finally {
				if (_.size(setter)>0){
					setter[item_entry + "create-attack-entry"] = 0;
					setAttrs(setter, params, function(){
						//can do these in parallel
						PFAttackOptions.resetOption(newRowId);
						PFAttackGrid.resetCommandMacro();
						done();
					});
					if (_.size(silentSetter)){
						setAttrs(silentSetter,PFConst.silentParams);
					}
				} else {
					setter[item_entry + "create-attack-entry"] = 0;
					setAttrs(setter,PFConst.silentParams,done);
				}
			}
		});
	},
	updateAssociatedAttack = function (source, callback) {
		var done = _.once(function () {
			TAS.debug("leaving PFInventory.updateAssociatedAttack");
			if (typeof callback === "function") {
				callback();
			}
		})
		, attrib = "", weaponAttrib = "", sourceVal = "", itemId = "", sectionName = ""
		, fields = [], setter = {}, attribList = [];
		try {
			if (!source) {
				done();
				return;
			}
			itemId = SWUtils.getRowId(source);
			attrib = SWUtils.getAttributeName(source);
			//TAS.debug("attrib=" + attrib);
			if (source.indexOf("repeating_weapon_") === 0) {
				// source is an attack, so pull all data from the source (item/spell/spell-like ability) to update the attack
				// attrib will be source-item, source-spell, or source-ability
				TAS.error("PFInventory.updateAssociatedAttack, called on weapon event, no longer supported!");
				done();
				return;
			}
			// source is an item, so update all linked attacks with the changed attribute
			weaponAttrib = attrib.replace("item-", "");
			if (attrib === 'name') { weaponAttrib = 'source-item-name'; }
			else if (attrib === 'item-dmg-type') { weaponAttrib = 'type'; }
			else if (attrib === 'wpenhance') {weaponAttrib = 'enhance'; }
		} catch (outererror1) {
			TAS.error("PFInventory.updateAssociatedAttack outer1", outererror1);
			done();
			return;
		}
		getAttrs([source], function (srcv) {
			var sourceAttr='';
			sourceVal = srcv[source];
			if (typeof sourceVal === "undefined"){
				sourceVal = "";
			}
			//TAS.debug"sourceVal=" + sourceVal);
			if (attrib === "proficiency") {
				sourceVal = parseInt(sourceVal, 10) || 0;
				if (sourceVal !== 0) {
					sourceVal = -4;
				}
			}
			sourceVal = String(sourceVal);
			//TAS.debug("itemId=" + itemId, "attrib=" + attrib, "weaponAttrib=" + weaponAttrib);
			getSectionIDs("repeating_weapon", function (idarray) { // get the repeating set
				fields = _.reduce(idarray, function (memo, currentID) {
					memo = memo.concat(["repeating_weapon_" + currentID + "_source-item", "repeating_weapon_" + currentID + "_" + weaponAttrib]);
					return memo;
				}, []);
				//TAS.debug("processing currentID=" + currentID);
				getAttrs(fields, function (w) {
					setter = {}; // start with a blank in this loop
					try {
						//TAS.debug"PFInventory.updateAssociatedAttack ", w);
						_.each(idarray, function (currentID) { // loop through the set
							var targetVal = "", wField = ""; // start with blank in this loop
							//TAS.debug("source=" + source, "v[repeating_weapon_" + currentID + "_source-item]=" + v["repeating_weapon_" + currentID + "_source-item"]);
							//TAS.debug("itemId=" + itemId)
							//TAS.debug"comparing " + itemId + " with " + w["repeating_weapon_" + currentID + "_source-item"]);
							if (itemId === w["repeating_weapon_" + currentID + "_source-item"]) {
								wField = "repeating_weapon_" + currentID + "_" + weaponAttrib;
								targetVal = w[wField];
								if (attrib === "proficiency" ) {
									targetVal = parseInt(targetVal, 10) || 0;
								}
								targetVal= String(targetVal);
								if (targetVal !== sourceVal) {
									setter[wField] = sourceVal;
									if (sourceAttr === 'damage-die' || sourceAttr === 'damage-dice-num'){
										setter["repeating_weapon_" + currentID + "_default_"+ sourceAttr]=sourceVal; 
									}
								}
							}
						});
					} catch (innererror) {
						TAS.error("PFInventory.updateAssociatedAttack inner1", innererror);
					} finally {
						if (_.size(setter) > 0) {
							//TAS.debug"updating attack", setter);
							setAttrs(setter);
						}
					}
				});
			});
		});
	},
	/** Determines the equipment type from looking at the name. 
	* DOES NOT WORK for armor or weapons, this is for after you have already determined it is not an armor or weapon type.
	*@param {string} name the name field 
	*/
	getEquipmentTypeFromName = function(name){
		var tempstr, currType=equipMap.noEquipType, matches;
		if(!name){return currType;}
		tempstr=name.toLowerCase();
		matches=tempstr.match(/(?:\bwand\b|\bring\b|\brod\b|plate|sword|shield|mail|spear|potion|spellbook|smokestick|incense|scroll|alchemist|antitoxin|antidote|elixir|staff|acid|\boil\b|water|component pouch|arrow|bolt|bullet|sunrod|flask|ration|armor spike|kit|saddle|tool|spike|pole|ladder|lantern|candle|torch|rope|chain|crowbar|\bnet\b|\bram\b|tanglefoot|tinder|flint|vial)/i);
		if (matches){
			switch (matches[0]){
				case 'sword':
				case 'spear':
				case 'armor spike':
				case 'net':
					currType=equipMap.Weapon;
					break;
				case 'mail':
				case 'plate':
				case 'shield':
					currType=equipMap.Armor;
					break;
				case 'vial':
				case 'flint':
				case 'kit':
				case 'tool':
				case 'spike':
				case 'crowbar':
				case 'ram':
				case 'lantern':
				case 'candle':
				case 'torch':
				case 'rope':
				case 'chain':
				case 'saddle':
				case 'spyglass':
				case 'spellbook':
				case 'tinder':
				case 'component pouch':
					currType=equipMap.Gear;
					break;
				case 'ring':
					currType=equipMap.OtherMagic;
					break;
				case 'tanglefoot':
				case 'incense':
				case 'smokestick':
				case 'sunrod':
				case 'ration':
				case 'water':
				case 'alchemist':
				case 'oil':
				case 'flask':
				case 'acid':
				case 'rod':
				case 'wand':
				case 'potion':
				case 'elixir':
				case 'scroll':
				case 'staff':
				case 'antitoxin':
				case 'antidote':
					currType=equipMap.Consumables;
					break;
				case 'arrow':
				case 'bolt':
				case 'bullet':
				case 'stone':
					currType=equipMap.Ammo;
					break;
			}
		}
		return currType;
	},
	importFromCompendium = function(eventInfo){
		var id=SWUtils.getRowId(eventInfo.sourceAttribute),
		prefix='repeating_item_'+id+'_',
		itemprefix = prefix+'item-',
		fields=['default_char_size','equipment_tab',
			itemprefix+'category_compendium',
			itemprefix+'value_compendium',
			itemprefix+'range_compendium',
			itemprefix+'critical_compendium',
			itemprefix+'smalldamage_compendium',
			itemprefix+'meddamage_compendium',
			itemprefix+'specialtype_compendium',
			itemprefix+'speed20_compendium',
			itemprefix+'speed30_compendium',
			itemprefix+'weight_compendium',
			itemprefix+'spell-fail_compendium',
			itemprefix+'acbonus_compendium',
			itemprefix+'acp_compendium',
			itemprefix+'dmg-type',
			prefix+'description',
			itemprefix+'max-dex',
			prefix+'name'];
		TAS.debug('at importFromCompendium getting fields', fields);
		getAttrs(fields,function(v){
			var setter={},size=0,tempInt=0,temp,name,matches,attr='',tempstr='',
			  isWeapon=0,isArmor=0,isOther=0,currTab=99,currType=equipMap.noEquipType,
			  speed30=0,speed20=0;
			try {
				//TAS.debug("importFromCompendium values are",v);
				if (v[itemprefix+'category_compendium']!=='Items'){
					TAS.warn("compendium item is " +v['repeating_item_item-category_compendium'] + ', INVALID' );
					return;
				}
				setter[prefix+'row_id']=id;
				name= v[prefix+'name'];
				PFUtils.getCompendiumIntSet(itemprefix,'range',v,setter);
				PFUtils.getCompendiumFunctionSet(itemprefix,'value',PFUtils.getCostInGP,v,setter);
				PFUtils.getCompendiumIntSet(itemprefix,'spell-fail',v,setter);
				PFUtils.getCompendiumIntSet(itemprefix,'acbonus',v,setter);
				PFUtils.getCompendiumIntSet(itemprefix,'acp',v,setter);
				if(v[itemprefix+'acbonus_compendium']){
					isArmor=1;
				}
				
				speed30 = parseInt(v[itemprefix+'speed20_compendium'],10)||0;
				speed20 = parseInt(v[itemprefix+'speed30_compendium'],10)||0;
				
				if (v[itemprefix+'max-dex']){
					temp=v[itemprefix+'max-dex'];
					temp=temp.replace(/\u2013|\u2014|-|\\u2013|\\u2014/,'-');
					if (temp!==v[itemprefix+'max-dex']){
						setter[itemprefix+'max-dex']=temp;
					}
				}
				if (v[itemprefix+'specialtype_compendium']){
					temp = v[itemprefix+'specialtype_compendium'];
					temp=temp.replace(/\u2013|\u2014|-|\\u2013|\\u2014/,'');
					if (temp){
						if(v[itemprefix+'item-dmg-type']){
							temp = v[itemprefix+'item-dmg-type'] + ' ' + v[itemprefix+'specialtype_compendium'];
						} else {
							temp = v[itemprefix+'specialtype_compendium'];
						}
						setter[itemprefix+'item-dmg-type']=temp;
					}
				}
				if(v[itemprefix+'critical_compendium']){
					isWeapon=1;
					temp = PFUtils.getCritFromString(v[itemprefix+'critical_compendium']);
					if(temp){
						if(temp.crit!==20){
							setter[itemprefix+'crit-target']=temp.crit;
						}
						if(temp.critmult!==2){
							setter[itemprefix+'crit-multiplier']=temp.critmult;
						}
					}
				}
				size=parseInt(v['default_char_size'],10)||0;
				tempstr='meddamage_compendium';
				tempInt=0;
				if (size>=1){
					tempInt=1;
					tempstr='smalldamage_compendium';
				}
				if (size !== 0){
					//set  default size of item to small or medium, not other, let user do that for now
					setter[prefix+'default_size']=tempInt;
				}
				PFUtils.getCompendiumIntSet(itemprefix,'weight',v,setter);
				//small size, weight is 1/2
				if(size >= 1){
					tempInt=parseInt(setter[itemprefix+'weight'],10)||0;
					if (tempInt){
						tempInt = (tempInt / 2)*100/100;
						setter[itemprefix+'weight']=tempInt;
					}
				} 
				if (v[itemprefix+tempstr]){
					isWeapon=1;
					temp = PFUtils.getDiceDieFromString(v[itemprefix+tempstr]);
					if (temp){
						if (temp.dice && temp.die){
							setter[itemprefix+'damage-dice-num']=temp.dice;
							setter[itemprefix+'damage-die']=temp.die;
						}
						if (temp.plus){
							setter[itemprefix+'damage']=temp.plus;
						}
					}
				}

				if (isWeapon){
					currType=equipMap.Weapon;
					if(v[itemprefix+'range_compendium']&& parseInt(v[itemprefix+'range_compendium'],10)>0){
						setter[itemprefix+'attack-type']='@{attk-ranged}';
					} else {
						setter[itemprefix+'attack-type']='@{attk-melee}';
					}
				} else if (isArmor){
					currType=equipMap.Armor;
					//set encumbrance 
					//mUST LOOK AT name string and determine armor, then set heavy, medium, or light.
					//for shields it is easy
					//we can probably look at the change in speed to determine this.
					if (name) {
						if ((/tower/i).test(name)){
							tempstr="Tower Shield";
						} else if (speed30===30 && speed20 === 20){
							tempstr="Light";
						} else if ((/heavy|stone|full|half.plate|splint|banded|iron|tatami|kusari/i).test(tempstr)){
							tempstr="Heavy";
						} else if ((/medium|mountain|chainmail|breastplate|scale|kikko|steel|horn|mirror|hide|maru|armored coat/i).test(tempstr)){
							tempstr="Medium";
						} else {
							tempstr="Light";
						}
						setter[itemprefix+"defense-type"]=tempstr;
					}
					
				} else  {
					currType=getEquipmentTypeFromName(name);
				}
				if (currType<0){
					currType=equipMap.Other;
				} else if (currType===equipMap.Weapon){
					setter[prefix+'weapon-attributes-show']=1;
				} else if (currType===equipMap.Armor){
					setter[prefix+'armor-attributes-show']=1;					
				}
				//it just ignores it! why!? so don't change tab cause it won't be on the new tab.
				if(currType){
					setter['equipment_tab']=currType;
					setter[prefix+'equip-type']=currType;
					setter[prefix+'equiptype-tab']=currType;
				}
				setter[prefix+'qty']=1;
				setter[prefix+'qty_max']=1;
				setter[prefix+'location']=0;
				setter[prefix+'old_location']=0;

				setter[itemprefix+'category_compendium']="";
				setter[itemprefix+'value_compendium']="";
				setter[itemprefix+'range_compendium']="";
				setter[itemprefix+'critical_compendium']="";
				setter[itemprefix+'smalldamage_compendium']="";
				setter[itemprefix+'meddamage_compendium']="";
				setter[itemprefix+'specialtype_compendium']="";
				setter[itemprefix+'speed20_compendium']="";
				setter[itemprefix+'speed30_compendium']="";
				setter[itemprefix+'weight_compendium']="";
				setter[itemprefix+'spell-fail_compendium']="";
				setter[itemprefix+'acbonus_compendium']="";
				setter[itemprefix+'acp_compendium']="";

				
			} catch (err){
				TAS.error("importFromCompendium",err);
			} finally {
				//TAS.debug"importFromCompendium setting",setter);
				if (_.size(setter)>0){
					setAttrs(setter,PFConst.silentParams, updateRepeatingItems);
				}
			}
		});
	},
	setNewDefaults = function(callback){
		var done = _.once(function(){
			TAS.debug("leaving PFInventory.setNewDefaults");
			if(typeof callback === "function"){
				callback();
			}
		});
		TAS.debug("at PFInventory.setNewDefaults");
		getAttrs(['migrated_itemlist_defaults'],function(v){
			try {
				TAS.debug("PFInventory.setNewDefaults ",v);
				if(parseInt(v.migrated_itemlist_defaults,10)===1){
					done();
					return;
				}
				getSectionIDs('repeating_item',function(ids){
					var fields=[];
					try {
						if (!ids || !_.size(ids)){
							done();
							return;
						}

						fields = _.map(ids,function(id){
							return 'repeating_item_'+id+'_name';
						});
					} catch (miderror){
						TAS.error("PFInventory.setNewDefaults miderror",miderror);
						done();
						return;
					}
					getAttrs(fields,function(v){
						var setter={};
						try {
							setter = _.reduce(ids,function(m,id){
								var prefix = 'repeating_item_'+id+'_',
								nameField=prefix+'name',guess=0;
								try {
									if(v[nameField]){
										guess=getEquipmentTypeFromName(v[nameField]);
									}
									if (guess){
										m[prefix+'equip-type']=guess;
										m[prefix+'equiptype-tab']=guess;
									} else {
										m[prefix+'equip-type']=equipMap.noEquipType;
										m[prefix+'equiptype-tab']=equipMap.noEquipType;
									}
									m[prefix+'showinmenu']=0;
								} catch (errin){
									TAS.error("PFInventory.setNewDefaults error repeating_item  id "+id,errin);
								} finally {
									return m;
								}
							},{});
							setter['migrated_itemlist_defaults']=1;
						} catch (err){
							TAS.error("PFInventory.setNewDefaults error setting defaults ",err);
						} finally {
							if (_.size(setter)>0){
								setAttrs(setter,PFConst.silentParams,done);
							} else {
								done();
							}
						}
					});
				});
			} catch (outererr){
				TAS.error("PFInventory.setNewDefaults outererr",outererr);
				done();
			}
		});
	},
	migrate = function (callback, oldversion) {
		TAS.debug("At PFInventory.migrate");
		PFMigrate.migrateRepeatingItemAttributes(function(){
			setNewDefaults(function(){
				migrateWornEquipment(callback);
			});
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFInventory.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		setTotals = _.after(2, function () {
			updateLocations();
			resetCommandMacro();
			updateCarriedTotal(done);
		});
		try {
			TAS.debug("at PFInventory.recalculate");
			migrate(function(){
				updateCarriedCurrency(setTotals, silently);
				updateRepeatingItems(setTotals, silently);
			});
		} catch (err) {
			TAS.error("PFInventory.recalculate", err);
			done();
		}
	},
	registerEventHandlers = function () {
		var tempstr="";
		on('change:repeating_item:item-category_compendium', TAS.callback(function EventItemCompendium(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				importFromCompendium(eventInfo);
			}
		}));
		
		on('change:repeating_item:location', TAS.callback(function eventUpdateItemLocation(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateEquipmentLocation(null,null,null,eventInfo);
			}
		}));
		on('change:repeating_item:item-weight change:repeating_item:qty change:repeating_item:qty_max change:repeating_item:location', TAS.callback(function eventUpdateItemTotalWeight(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				getAttrs(['repeating_item_location','repeating_item_old_location','repeating_item_item-weight','repeating_item_qty'],function(v){
					var newloc = parseInt(v.repeating_item_location,10)||0,
					oldloc = parseInt(v.repeating_item_old_location,10)||0;
						TAS.repeating('item').attrs('item_total_weight').fields('item-weight', 'qty', 'qty_max', 'location').reduce(function (m, r) {
							//TAS.debug"in weight add row, variables: weight: "+r.F['item-weight']+", qty:"+r.I.qty+", max:"+r.I.qty_max +", loc:"+ r.I.location);
							if (r.I.qty > 0 && (r.I.location !== locationMap.NotCarried)) {
								//TAS.debug("adding "+r.F['item-weight']);
								if (r.I.qty_max === 0 || r.I.qty_max===1) {
									m['item-weight'] += r.F['item-weight'] * r.I.qty;
								} else {
									m['item-weight'] += r.F['item-weight'];
								}
							}
							return m;
						}, {
							'item-weight': 0
						}, function (m, r, a) {
							a.S['item_total_weight'] = m['item-weight'];
						}).execute();
				});
			}
		}));
		on('change:repeating_item:item-hp change:repeating_item:item-hp_max', TAS.callback(function eventUpdateItemTotalHp(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			TAS.repeating('item').attrs('item-total-hp', 'item-total-hp_max').fields('item-hp', 'item-hp_max').reduce(function (m, r) {
				m['item-hp'] += r.I['item-hp'];
				m['item-hp_max'] += r.I['item-hp_max'];
				return m;
			}, {
				'item-hp': 0,
				'item-hp_max': 0
			}, function (m, r, a) {
				a.S['item-total-hp'] = m['item-hp'];
				a.S['item-total-hp_max'] = m['item-hp_max'];
			}).execute();
		}));
		on('change:repeating_item:value', TAS.callback(function eventUpdateItemTotalValue(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			TAS.repeating('item').attrs('item-total-value').fields('value', 'qty').reduce(function (m, r) {
				m.value += r.I.value * r.I.qty;
				return m;
			}, {
				value: 0
			}, function (m, r, a) {
				a.S['item-total-value'] = m.value;
			}).execute();
		}));
		on('remove:repeating_item', TAS.callback(function eventRemoveItem(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateRepeatingItems();
			}
			// Find matching source-item in repeating_weapon then clear the source-item and source-item-name attributes for each
			var setter = {}, itemId = eventInfo.sourceAttribute.replace("repeating_item_", "");
			getSectionIDs("repeating_weapon", function (idarray) { // get the repeating set
				_.each(idarray, function (currentID) { // loop through the set
					getAttrs(["repeating_weapon_" + currentID + "_source-item"], function (v) {
						if (itemId === v["repeating_weapon_" + currentID + "_source-item"]) {
							setter["repeating_weapon_" + currentID + "_source-item"] = "";
							setter["repeating_weapon_" + currentID + "_source-item-name"] = "";
							//TAS.debug"clearing source-item for attack entry " + currentID, setter);
							setAttrs(setter, PFConst.silentParams);
						}
					});
				});
			});
		}));
		on('change:CP change:SP change:GP change:PP', TAS.callback(function eventUpdateCarriedCurrency(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updateCarriedCurrency();
		}));
		on('change:carried-currency change:item_total_weight change:carried-misc', TAS.callback(function eventUpdateCarriedTotal(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updateCarriedTotal();
		}));
		//change item worn in shield or armor location
		on('change:repeating_item:location change:repeating_item:item-defense-type change:repeating_item:item-acbonus change:repeating_item:item-max-dex change:repeating_item:item-acp change:repeating_item:item-spell-fail change:repeating_item:item-proficiency change:repeating_item:acenhance',
			TAS.callback(function eventUpdateWornArmorAndShield(eventInfo) {
				var location = 0;
				TAS.debug("caught " + eventInfo.sourceAttribute + " event" + eventInfo.sourceType);
				getAttrs(["repeating_item_location"], function (v) {
					var location = parseInt(v["repeating_item_location"], 10) || 0;
					if (location === locationMap.Armor || location === locationMap.Shield){
						updateWornArmorAndShield(location, eventInfo.sourceAttribute);
					}
				});
		}));
		_.each(commonLinkedAttributes, function (fieldToWatch) {
			var eventToWatch = "change:repeating_item:item-" + fieldToWatch;
			on(eventToWatch, TAS.callback(function eventupdateAssociatedAttackLoop(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event" + eventInfo.sourceType);
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					updateAssociatedAttack(eventInfo.sourceAttribute);
				}
			}));
		});
		on('change:repeating_item:name change:repeating_item:item-dmg-type change:repeating_item:item-proficiency change:repeating_item:default_size change:repeating_item:wpenhance',
			TAS.callback(function eventupdateAssociatedAttack(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event" + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateAssociatedAttack(eventInfo.sourceAttribute);
			}
		}));
		on("change:repeating_item:create-attack-entry", TAS.callback(function eventcreateAttackEntryFromRow(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				createAttackEntryFromRow(eventInfo.sourceAttribute);
			}
		}));
		on("change:repeating_item:set-as-armor", TAS.callback(function eventcreateArmorEntryFromRow(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateWornArmorAndShield(locationMap.Armor, eventInfo.sourceAttribute,null );
			}
		}));
		on("change:repeating_item:set-as-shield", TAS.callback(function eventcreateShieldEntryFromRow(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateWornArmorAndShield(locationMap.Shield, eventInfo.sourceAttribute,null );
			}
		}));
		on("change:repeating_item:showinmenu", TAS.callback(function eventShowItemInMenu(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				resetCommandMacro(eventInfo );
			}
		}));
		on("change:repeating_item:equip-type", TAS.callback(function eventItemEquipTypeChange(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				getAttrs(['repeating_item_equip-type','repeating_item_equiptype-tab'],function(v){
					var newtype=parseInt(v['repeating_item_equip-type'],10)||0,
					oldtype=parseInt(v['repeating_item_equiptype-tab'],10)||0;
					//TAS.debug("################","At change:repeating_item:equip-type updating equiptype:"+newtype+", currtab:"+oldtype,v);
					if (newtype !== oldtype){
						setAttrs({'repeating_item_equiptype-tab':newtype},PFConst.silentParams);
					}
				});
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFInventory module loaded      ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		migrate: migrate,
		recalculate: recalculate,
		createAttackEntryFromRow: createAttackEntryFromRow,
		resetCommandMacro: resetCommandMacro,
		setNewDefaults: setNewDefaults,
		wornEquipmentRowsOld: wornEquipmentRowsOld,
		updateLocations: updateLocations,
		wornEquipmentRowsNew: wornEquipmentRowsNew,
		wornEquipmentColumns: wornEquipmentColumns,
		commonLinkedAttributes: commonLinkedAttributes,
		updateRepeatingItems: updateRepeatingItems,
		updateCarriedCurrency: updateCarriedCurrency,
		updateCarriedTotal: updateCarriedTotal,
		migrateWornEquipment: migrateWornEquipment,
		updateWornArmorAndShield: updateWornArmorAndShield,
		updateEquipmentLocation: updateEquipmentLocation,
		updateAssociatedAttack: updateAssociatedAttack
	};
}());
var PFSpellOptions = PFSpellOptions || (function () {
	'use strict';
	var optionToggles = ["toggle_spell_school_notes", "toggle_spell_casting_time_notes", "toggle_spell_duration_notes", 
		"toggle_spell_saving_throw_notes", "toggle_spell_sr_notes", "toggle_spell_range_notes", "toggle_spell_targets_notes", 
		"toggle_spell_description_notes", "toggle_spell_concentration_notes", "toggle_spell_concentration_check", 
		"toggle_spell_casterlevel_notes", "toggle_spell_casterlevel_check", "toggle_spell_level_notes", "toggle_spell_components_notes", 
		"toggle_spell_spellnotes_notes", "toggle_spell_spell_fail_check", "toggle_spell_damage_notes"],
	optionTemplates = {
		school: "{{school=REPLACE}}",
		casting_time: "{{casting_time=REPLACE}}",
		components: "{{components=REPLACE}}",
		duration: "{{duration=REPLACE}}",
		saving_throw: "{{saving_throw=REPLACE}}",
		sr: "{{sr=REPLACE}}",
		casterlevel: "{{casterlevel=[[ REPLACE ]]}}",
		range: "{{range=REPLACE}}",
		targets: "{{targets=REPLACE}}",
		Concentration: "{{Concentration=[[ REPLACE ]]}}",
		description: "{{description=REPLACE}}",
		dc: "{{dc=[[ REPLACE ]]}}",
		spellPen: "{{spellPen=[[ REPLACE ]]}}",
		range_pick: "{{REPLACE=Range_pick}}",
		rangetext: "{{rangetext=REPLACE}}",
		level: "{{level=REPLACE}}",
		spellclass: "{{spellclass=REPLACE}}",
		cast_def: "{{cast_def=[[ REPLACE ]]}}",
		cast_defDC: "{{cast_defDC=[[ REPLACE ]]}}",
		concentrationNote: "{{concentrationNote=REPLACE}}",
		spellPenNote: "{{spellPenNote=REPLACE}}",
		casterlevel_chk: "{{casterlevel_chk=[[ 1d20 + REPLACE ]]}}",
		Concentration_chk: "{{Concentration_chk=[[ 1d20 + REPLACE ]]}}",
		spellnotes: "{{spells_notes=REPLACE}}",
		spell_fail_check: "{{spell_fail_check=[[ 1d100cf<[[ @{spell-fail} ]]cs>[[ @{spell-fail}+1 ]] ]]}}",
		spell_fail: "{{spell_fail=@{spell-fail}}}",
		spelldamage: "{{spelldamage=REPLACE}}",
		spelldamagetype: "{{spelldamagetype=REPLACE}}"
		
	},
	/* non repeating */
	optionAttrs = ["Concentration-0-def", "Concentration-1-def", "Concentration-2-def","spell-fail"],
	optionTogglesPlusOptionAttrs = optionToggles.concat(optionAttrs),
	/* repeating*/
	repeatingOptionAttrs = ["school", "cast-time", "duration", "save", "sr", "range_numeric", "targets", "description", "Concentration-mod", 
		"savedc", "SP-mod", "range_pick", "range", "spell_level", "spellclass", "casterlevel", "components", "spellclass_number",
		"damage-macro-text", "damage-type"],
	repeatingOptionHelperAttrs = ["spellclass_number", "SP_misc", "CL_misc", "Concentration_misc", "slot", "spell-attack-type"],
	repeatingOptionAttrsToGet = repeatingOptionAttrs.concat(repeatingOptionHelperAttrs),
	rowattrToOptionToggleMap = {
		school: "toggle_spell_school_notes",
		"cast-time": "toggle_spell_casting_time_notes",
		components: "toggle_spell_components_notes",
		duration: "toggle_spell_duration_notes",
		save: "toggle_spell_saving_throw_notes",
		sr: "toggle_spell_sr_notes",
		range: "toggle_spell_range_notes",
		targets: "toggle_spell_targets_notes",
		description: "toggle_spell_description_notes",
		spellnotes:"toggle_spells_notes",
		spell_fail_check: "toggle_spell_spell_fail_check",
		"damage-macro-text": "toggle_spell_damage_notes",
		"damage-type": "toggle_spell_damage_notes"
	},
	optionTemplateRegexes = PFUtils.getOptionsCompiledRegexMap(optionTemplates),
	/* updateSpellOption - updates an existing @{spell_options} text for a row depending on the field updated on existing row
	*/
	updateSpellOption = function (eventInfo, fieldUpdated) {
		var fieldName = "repeating_spells_" + fieldUpdated,
		toggleField = rowattrToOptionToggleMap[fieldUpdated];
		getAttrs([fieldName, "repeating_spells_spell_options", "repeating_spells_spell_lvlstr", toggleField, "repeating_spells_SP-mod", "repeating_spells_savedc"], function (v) {
			var optionText = v["repeating_spells_spell_options"],
			newValue = "", 
			setter = {};
			//make sure we are not updating from compendium
			//this works it is just fast enough that it will not do anything since importFromCompendium is not done.
			if ((!v["repeating_spells_spell_lvlstr"]) && optionText) {
				try {
					//TAS.debug("PFSpellOptions.updateSpellOption, field: "+ fieldUpdated,v);
					newValue = v[fieldName] || "";
					if (parseInt(v[toggleField],10) === 1) {
						//TAS.debug"made it inside toggleField");
						switch (fieldUpdated) {
							case 'school':
								optionText = optionText.replace(optionTemplateRegexes.school, optionTemplates.school.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								break;
							case 'cast-time':
								optionText = optionText.replace(optionTemplateRegexes.casting_time, optionTemplates.casting_time.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								break;
							case 'components':
								optionText = optionText.replace(optionTemplateRegexes.components, optionTemplates.components.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								break;
							case 'duration':
								optionText = optionText.replace(optionTemplateRegexes.duration, optionTemplates.duration.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								break;
							case 'range':
								optionText = optionText.replace(optionTemplateRegexes.range, optionTemplates.range.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								break;
							case 'targets':
								optionText = optionText.replace(optionTemplateRegexes.targets, optionTemplates.targets.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								break;
							case 'save':
								if (PFUtils.shouldNotDisplayOption('saving_throw', newValue)) {
									optionText = PFUtils.deleteOption(optionText, "saving_throw", optionTemplateRegexes);
								} else {
									optionText = optionText.replace(optionTemplateRegexes.saving_throw, optionTemplates.saving_throw.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)));
								}
								break;
							case 'sr':
								if (PFUtils.shouldNotDisplayOption('sr', newValue)) {
									optionText = PFUtils.deleteOption(optionText, "sr", optionTemplateRegexes);
								} else {
									optionText = optionText.replace(optionTemplateRegexes.sr, optionTemplates.sr.replace("REPLACE", newValue));
								}
								break;
							case 'damage-macro-text':
								//TAS.debug"found damage macro-text="+newValue);
								if (PFUtils.shouldNotDisplayOption('damage-macro-text', newValue)) {
									optionText = PFUtils.deleteOption(optionText, "spelldamage", optionTemplateRegexes);
								} else {
									optionText = optionText.replace(optionTemplateRegexes.spelldamage, optionTemplates.spelldamage.replace("REPLACE", newValue));
								}
								break;
							case 'damage-type':
								//TAS.debug"found damage type"+newValue);
								if (PFUtils.shouldNotDisplayOption('damage-type', newValue)) {
									optionText = PFUtils.deleteOption(optionText, "spelldamagetype", optionTemplateRegexes);
								} else {
									optionText = optionText.replace(optionTemplateRegexes.spelldamagetype, optionTemplates.spelldamagetype.replace("REPLACE", newValue));
								}
								break;
						}
						setter["repeating_spells_spell_options"] = optionText;
						setAttrs(setter, {
							silent: true
						});
					}
				} catch (err){
					TAS.error("PFSpellOptions.updateSpellOption",err);
				}
			}
		});
	},
	/** getOptionText - resets entire @{spell_options} text for a spell row
	* if the field to update is one that is set by updateSpellOption, then need to set {{key=}} so it can find correct one to replace.
	*@param {string} id of row or null
	*@param {jsobj} eventInfo NOT USED
	*@param {object} toggleValues values from getAttrs of spell toggle option fields
	*@param {object} rowValues values from getAttrs of row attributes
	*@returns {string}
	*/
	getOptionText = function (id, eventInfo, toggleValues, rowValues) {
		var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id),
		customConcentration = parseInt(rowValues[prefix + "Concentration_misc"], 10) || 0,
		customCasterlevel = parseInt(rowValues[prefix + "CL_misc"], 10) || 0,
		classNum = parseInt(rowValues[prefix + "spellclass_number"], 10),
		spellLevel = parseInt(rowValues[prefix + "spell_level"], 10),
		spellSlot = parseInt(rowValues[prefix + "slot"], 10),
		casterlevel = parseInt(rowValues[prefix + "casterlevel"], 10),
		concentrationMod = parseInt(rowValues[prefix + "Concentration-mod"], 10),
		levelForConcentrate = (isNaN(spellSlot) || spellSlot === spellLevel) ? spellLevel : spellSlot,
		defDC = 15 + (levelForConcentrate * 2),
		defMod = parseInt(rowValues["Concentration-" + classNum + "-def"], 10) || 0,
		optionText = "",
		newValue = "";
		//TAS.debug("getOptionText, defMod: " + defMod);
		if (isNaN(classNum) || isNaN(spellLevel)) {
			TAS.warn("cannot set options for spell! id:" + id + "  class or level are not numbers");
			return "";
		}
		if (toggleValues.showschool) {
			optionText += optionTemplates.school.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "school"]))||"";
		}
		if (toggleValues.showlevel) {
			optionText += optionTemplates.spellclass.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "spellclass"]))||"";
			optionText += optionTemplates.level.replace("REPLACE", spellLevel);
		}
		if (toggleValues.showcasting_time) {
			optionText += optionTemplates.casting_time.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "cast-time"]))||"";
		}
		if (toggleValues.showcomponents) {
			optionText += optionTemplates.components.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "components"]))||"";
		}
		if (toggleValues.showsaving_throw) {
			newValue = rowValues[prefix + "save"] || "";
			if (PFUtils.shouldNotDisplayOption('saving_throw', newValue)) {
				optionText += "{{saving_throw=}}";
			} else {
				optionText += optionTemplates.saving_throw.replace("REPLACE", SWUtils.escapeForRollTemplate(newValue)||"");
			}
			optionText += optionTemplates.dc.replace("REPLACE", parseInt(rowValues[prefix + "savedc"], 10) || 0);
		}
		if (toggleValues.showrange) {
			optionText += optionTemplates.range_pick.replace("REPLACE", rowValues[prefix + "range_pick"] || "blank")||"";
			optionText += optionTemplates.range.replace("REPLACE", parseInt(rowValues[prefix + "range_numeric"], 10) || 0)||"";
			optionText += optionTemplates.rangetext.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "range"] || "")||"");
		}
		if (toggleValues.showtargets) {
			optionText += optionTemplates.targets.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "targets"])||"");
		}
		if (toggleValues.showduration) {
			optionText += optionTemplates.duration.replace("REPLACE", SWUtils.escapeForRollTemplate(rowValues[prefix + "duration"])||"");
		}
		if (toggleValues.showsr) {
			newValue = rowValues[prefix + "sr"] || "";
			if (PFUtils.shouldNotDisplayOption('sr', newValue)) {
				optionText += "{{sr=}}";
			} else {
				optionText += optionTemplates.sr.replace("REPLACE", newValue)||"";
			}
		}
		if (toggleValues.showcasterlevel && customCasterlevel) {
			optionText += optionTemplates.casterlevel.replace("REPLACE", casterlevel)||"";
		} else {
			optionText += "{{casterlevel=}}";
		}
		if (toggleValues.showcasterlevel_check) {
			optionText += optionTemplates.casterlevel_chk.replace("REPLACE", casterlevel)||"";
		}
		if (toggleValues.showcasterlevel || toggleValues.showcasterlevel_check) {
			newValue = parseInt(rowValues[prefix + "SP-mod"], 10) || 0;
			if (newValue === 0) {
				optionText += "{{spellPen=}}";
			} else {
				optionText += optionTemplates.spellPen.replace("REPLACE", newValue)||"";
			}
		}
		if (toggleValues.showconcentration && customConcentration) {
			optionText += optionTemplates.Concentration.replace("REPLACE", concentrationMod)||"";
		} else {
			optionText += "{{Concentration=}}";
		}
		if (toggleValues.showconcentration_check) {
			optionText += optionTemplates.Concentration_chk.replace("REPLACE", concentrationMod)||"";
		}
		if (toggleValues.showconcentration || toggleValues.showconcentration_check) {
			if (defMod > 0) {
				optionText += optionTemplates.cast_def.replace("REPLACE", defMod)||"";
			} else {
				optionText += "{{cast_def=}}";
			}
			optionText += optionTemplates.cast_defDC.replace("REPLACE", defDC)||"";
		}
		if (toggleValues.showdescription) {
			optionText += optionTemplates.description.replace("REPLACE", "@{description}")||"";
		} 
		if (toggleValues.showspellnotes) {
			optionText += optionTemplates.spellnotes.replace("REPLACE", "@{spell-class-"+classNum+"-spells-notes}")||"";
		}
		if (toggleValues.showspell_fail_check && parseInt(rowValues['spell-fail'],10) > 0) {
			//TAS.debug("adding spellfailure "+optionTemplates.spell_fail_check +" for id "+ id);
			optionText += optionTemplates.spell_fail_check||"";
			optionText += optionTemplates.spell_fail||"";
		}

		if (toggleValues.showdamage ){
			if(!PFUtils.findAbilityInString(rowValues[prefix+"spell-attack-type"])){
				optionText += optionTemplates.spelldamage.replace("REPLACE",(rowValues[prefix+"damage-macro-text"])||"");
			} else {
				optionText += "{{spelldamage=}}";
			}
			if (rowValues["damage-type"]){
				optionText += optionTemplates.spelldamagetype.replace("REPLACE", rowValues["damage-type"]||"");
			} else {
				optionText += "{{spelldamagetype=}}";
			}
		} else {
			optionText += "{{spelldamage=}}{{spelldamagetype=}}";
		}
		//TAS.debug("PFSpell.resetOption returning "+optionText);
		return optionText;
	},
	/** resetOption updates repeating_spells_$X_spell_options
	*@param {string} id id of row or null
	*@param {jsobj} eventInfo NOT USED
	*/
	resetOption = function (id, eventInfo) {
		var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id),
		allFields;
		allFields = _.map(repeatingOptionAttrsToGet, function (field) {
			return prefix + field;
		}).concat(optionTogglesPlusOptionAttrs);
		getAttrs(allFields, function (v) {
			var toggleValues = _.chain(optionToggles).reduce(function (memo, attr) {
				memo['show' + attr.toLowerCase().slice(13).replace('_notes', '')] = (parseInt(v[attr], 10) || 0);
				return memo;
			}, {}).extend({
				"Concentration-0-def": (parseInt(v["Concentration-0-def"], 10) || 0),
				"Concentration-1-def": (parseInt(v["Concentration-1-def"], 10) || 0),
				"Concentration-2-def": (parseInt(v["Concentration-2-def"], 10) || 0)
			}).value(),
			optionText = "",
			setter = {};
			optionText = getOptionText(id, eventInfo, toggleValues, v)||"";
			//TAS.debug("resetOption","About to set",setter);
			if (typeof optionText !== "undefined" && optionText != null){
				setter["repeating_spells_" + PFUtils.getRepeatingIDStr(id) + "spell_options"] = optionText;
			}
			setAttrs(setter, {
				silent: true
			});
		});
	},
	/*resetOptions - updates repeating_spells_spell_options for all spells.
	*@param {jsobj} eventInfo NOT USED
	*/
	resetOptions = function (callback, eventInfo) {
		getAttrs(optionTogglesPlusOptionAttrs, function (tv) {
			var optionFields = repeatingOptionAttrs.concat(repeatingOptionHelperAttrs),
			toggleValues = _.chain(optionToggles).reduce(function (memo, attr) {
				//get word between toggle_spell_ and _notes
				memo['show' + attr.toLowerCase().slice(13).replace('_notes', '')] = (parseInt(tv[attr], 10) || 0);
				return memo;
			}, {}).extend({
				"Concentration-0-def": (parseInt(tv["Concentration-0-def"], 10) || 0),
				"Concentration-1-def": (parseInt(tv["Concentration-1-def"], 10) || 0),
				"Concentration-2-def": (parseInt(tv["Concentration-2-def"], 10) || 0)
			}).value();
			getSectionIDs("repeating_spells", function (ids) {
				var fields = _.map(ids, function (id) {
					var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id),
					rowFields = _.map(optionFields, function (field) {
						return prefix + field;
					});
					return rowFields;
				});
				if (ids || _.size(ids)===0){
					if (typeof callback==="function"){callback();}
					return;
				}
				fields = _.flatten(fields, true);
				getAttrs(fields, function (v) {
					var setter = {};
					_.each(ids, function (id) {
						var optionText = getOptionText(id, eventInfo, toggleValues, v)||"";
						if (typeof optionText !== "undefined" && optionText != null){
							setter["repeating_spells_" + PFUtils.getRepeatingIDStr(id) + "spell_options"] = optionText;
						}
					});
					if (typeof callback === "function") {
						setAttrs(setter, {
							silent: true
						}, callback);
					} else {
						setAttrs(setter, {
							silent: true
						});
					}
				});
			});
		});
	},
	recalculate = function (callback) {
		resetOptions(null, callback);
	},
	events = {
		spellOptionEventsPlayer: ["school", "cast-time", "components", "duration", "save", "sr", "range", "targets", "damage-macro-text", "damage-type"]
	},
	registerEventHandlers = function () {
		//spell options for one row
		_.each(events.spellOptionEventsPlayer, function (fieldToWatch) {
			var eventToWatch = "change:repeating_spells:" + fieldToWatch;
			on(eventToWatch, TAS.callback(function eventOptionsRepeatingSpellsPlayer(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					updateSpellOption(eventInfo, fieldToWatch);
				}
			}));
		});
		//update the spell options
		_.each(optionToggles, function (toggleField) {
			on("change:" + toggleField, TAS.callback(function toggleField(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					resetOptions(null, eventInfo);
				}
			}));
		});
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFSpellOptions module loaded   ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		optionTemplates: optionTemplates,
		optionTemplateRegexes: optionTemplateRegexes,
		resetOption: resetOption,
		resetOptions: resetOptions
	};
}());
var PFSpells = PFSpells || (function () {
	'use strict';
	var
	//spell levels for repeating spell sections
	spellLevels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
	//for parsing: classes without their own spell lists plus bloodrager as sorcerer, whose list is not in compendium - hunter handled special
	classesUsingOtherSpellLists = {
		"arcanist": "wizard",
		"investigator": "alchemist",
		"warpriest": "cleric",
		"skald": "bard",
		"bloodrager": "sorcerer"
	},
	defaultRepeatingMacro='&{template:pf_spell} @{toggle_spell_accessible} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_spell}}} {{name=@{name}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{deafened_note=@{SpellFailureNote}}} @{spell_options}',
	defaultRepeatingMacroMap = {
		'&{template:':{'current':'pf_spell}',old:['pf_generic}','pf_block}']},
		'@{toggle_spell_accessible}':{'current':'@{toggle_spell_accessible}'},
		'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
		'{{color=':{'current':'@{rolltemplate_color}}}'},
		'{{header_image=':{'current':'@{header_image-pf_spell}}}'},
		'{{name=':{'current':'@{name}}}'},
		'{{character_name=':{'current':'@{character_name}}}'},
		'{{character_id=':{'current':'@{character_id}}}'},
		'{{subtitle}}':{'current':'{{subtitle}}'},
		'{{deafened_note=':{'current':'@{SpellFailureNote}}}'},
		'@{spell_options}':{'current':'@{spell_options}'}},
	defaultDeletedMacroAttrs=['@{toggle_accessible_flag}'],
	getSpellTotals = function (ids, v, setter) {
		var totalListed,
		totalPrepped;
		try {
			totalPrepped = _.reduce(PFConst.spellClassIndexes, function (memo, classidx) {
				memo[classidx] = _.reduce(spellLevels, function (imemo, spelllevel) {
					imemo[spelllevel] = 0;
					return imemo;
				}, {});
				return memo;
			}, {});
			totalListed = _.mapObject(totalPrepped, _.clone);
			_.each(ids, function (id) {
				var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id),
				spellLevel = parseInt(v[prefix + "spell_level"], 10),
				classNum = parseInt(v[prefix + "spellclass_number"], 10),
				metamagic = parseInt(v[prefix + "metamagic"], 10) || 0,
				slot = isNaN(parseInt(v[prefix + "slot"], 10)) ? spellLevel : parseInt(v[prefix + "slot"], 10),
				truelevel = metamagic ? slot : spellLevel,
				uses = parseInt(v[prefix + "used"], 10) || 0;
				if (!(isNaN(spellLevel) || isNaN(classNum))) {
					//TAS.debug("resetSpellsTotals", "spellLevel", spellLevel, "classNum", classNum, "metamagic", metamagic, "slot", slot, truelevel, "truelevel", uses, "uses");
					totalPrepped[classNum][truelevel] += uses;
					totalListed[classNum][truelevel] += 1;
				} else {
					TAS.warn("at resetSpellsTotals, ONE OF THESE IS NAN: spellLevel:"+ spellLevel+ ", classNum:"+ classNum);
				}
			});
			_.each(PFConst.spellClassIndexes, function (classidx) {
				_.each(spellLevels, function (spellLevel) {
					if ((parseInt(v["spellclass-" + classidx + "-level-" + spellLevel + "-total-listed"], 10) || 0) !== totalListed[classidx][spellLevel]) {
						setter["spellclass-" + classidx + "-level-" + spellLevel + "-total-listed"] = totalListed[classidx][spellLevel];
					}
					if ((parseInt(v["spellclass-" + classidx + "-level-" + spellLevel + "-spells-prepared"], 10) || 0) !== totalPrepped[classidx][spellLevel]) {
						setter["spellclass-" + classidx + "-level-" + spellLevel + "-spells-prepared"] = totalPrepped[classidx][spellLevel];
						setter["spellclass-" + classidx + "-level-" + spellLevel + "-spells-per-day"] = totalPrepped[classidx][spellLevel];						
					}
				});
			});
		} catch (err) {
			TAS.error("PFSpells.updateSpellTotals", err);
		} finally {
			return setter;
		}
	},
	resetSpellsTotals = function (dummy, eventInfo, callback, silently) {
		var done = _.once(function () {
			TAS.debug("leaving PFSpells.resetSpellsTotals");
			if (typeof callback === "function") {
				callback();
			}
		});
		getSectionIDs("repeating_spells", function (ids) {
			var fields = [],
			rowattrs = ['spellclass_number', 'spell_level', 'slot', 'metamagic', 'used'];
			try {
				_.each(ids, function (id) {
					var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id);
					_.each(rowattrs, function (attr) {
						fields.push(prefix + attr);
					});
				});
				_.each(PFConst.spellClassIndexes, function (classidx) {
					_.each(spellLevels, function (spellLevel) {
						fields.push("spellclass-" + classidx + "-level-" + spellLevel + "-total-listed");
						fields.push("spellclass-" + classidx + "-level-" + spellLevel + "-spells-prepared");
					});
				});
				getAttrs(fields, function (v) {
					var setter = {};
					try {
						setter = getSpellTotals(ids, v, setter);
						if (_.size(setter)) {
							setAttrs(setter, {
								silent: true
							}, done);
						} else {
							done();
						}
					} catch (innererr) {
						TAS.error("PFSpells.resetSpellsTotals innererror:", innererr);
						done();
					}
				});
			} catch (err) {
				TAS.error("PFSpells.resetSpellsTotals:", err);
				done();
			}
		});
	},
	/* ******************************** REPEATING SPELL FUNCTIONS ********************************** */
	setAttackEntryVals = function(spellPrefix,weaponPrefix,v,setter,noName){
		var notes="",attackType="";
		setter = setter||{};
		try {
			attackType=PFUtils.findAbilityInString(v[spellPrefix + "spell-attack-type"]);
			if (v[spellPrefix + "name"]) {
				if(!noName){
					setter[weaponPrefix + "name"] = v[spellPrefix + "name"];
				}
				setter[weaponPrefix + "source-spell-name"] = v[spellPrefix + "name"];
			}
			if (attackType) {
				setter[weaponPrefix + "attack-type"] = v[spellPrefix + "spell-attack-type"];
				if ((/CMB/i).test(attackType)) {
					setter[weaponPrefix + "vs"] = "cmd";
				} else {
					setter[weaponPrefix + "vs"] = "touch";
				}
			}
			if (v[spellPrefix+"range_numeric"]){
				setter[weaponPrefix + "range"]=v[spellPrefix+"range_numeric"];
			}
			if (v[spellPrefix+"range"] && v[spellPrefix+"range_pick"]==="see_text" ){
				notes += "Range:" + v[spellPrefix+"range"];
			}
			
			if (v[spellPrefix +"damage-macro-text"]){
				setter[weaponPrefix+"precision_dmg_macro"] = v[spellPrefix+"damage-macro-text"];
				if(attackType){
					setter[weaponPrefix+"critical_dmg_macro"] = v[spellPrefix+"damage-macro-text"];
				}
			}
			if (v[spellPrefix+ "damage-type"]){
				setter[weaponPrefix+"precision_dmg_type"] = v[spellPrefix+"damage-type"];
				if(attackType){
					setter[weaponPrefix+"critical_dmg_type"] = v[spellPrefix+"damage-type"];
				}
			}
			if (v[spellPrefix+"save"]){
				notes += "Save: "+ v[spellPrefix+"save"] + " DC: " + v[spellPrefix+"savedc"];
			}
			if ( v[spellPrefix+"sr"]){
				if (notes) { notes += ", ";}
				notes += "Spell resist:"+ v[spellPrefix+"sr"];
			}
			if (notes){
				setter[weaponPrefix+"notes"]=notes;
			}
		} catch (err){
			TAS.error("PFSpells.setAttackEntryVals",err);
		} finally {
			return setter;
		}
	},
	/*Triggered from a button in repeating spells */
	createAttackEntryFromRow = function (id, callback, silently, eventInfo, weaponId) {
		var done = _.once(function () {
			TAS.debug("leaving PFSpells.createAttackEntryFromRow");
			if (typeof callback === "function") {
				callback();
			}
		}),
		attribList = [],
		itemId = id || (eventInfo ? SWUtils.getRowId(eventInfo.sourceAttribute) : ""),
		idStr = PFUtils.getRepeatingIDStr(id),
		item_entry = 'repeating_spells_' + idStr,
		attributes = ["range_pick","range","range_numeric","damage-macro-text","damage-type","sr","savedc","save"],
		commonAttributes = ["spell-attack-type","name"];
		
		//TAS.debug("at PFSpells creatattack entry ");
		attributes.forEach(function(attr){
			attribList.push(item_entry +  attr);
		});
		commonAttributes.forEach(function (attr) {
			attribList.push(item_entry +  attr);
		});
		//TAS.debug("attribList=" + attribList);
		getAttrs(attribList, function (v) {
			var newRowId="",
			setter = {},
			prefix = "repeating_weapon_",
			idStr="",
			params = {};
			try {
				//TAS.debug("at PFSpells.createAttackEntryFromRow",v);
				if (!PFUtils.findAbilityInString(v[item_entry + "spell-attack-type"]) && !v[item_entry + "damage-macro-text"]) {
					TAS.warn("no attack to create for spell "+ v[item_entry+"name"] +", "+ itemId );
				} else {
					if (! weaponId ){
						newRowId = generateRowID();
					} else {
						newRowId = weaponId;
					}
					idStr = newRowId+"_";
					prefix += idStr;
					setter = setAttackEntryVals(item_entry, prefix,v,setter,weaponId);
					setter[prefix + "source-spell"] = itemId;
					setter[prefix+"group"]="Spell";
				}
			} catch (err) {
				TAS.error("PFSpells.createAttackEntryFromRow", err);
			} finally {
				if (_.size(setter)>0){
					setter[item_entry + "create-attack-entry"] = 0;
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, {}, function(){
						//can do these in parallel
						PFAttackOptions.resetOption(newRowId);
						PFAttackGrid.resetCommandMacro();
						done();
					});
				} else {
					setter[item_entry + "create-attack-entry"] = 0;
					setAttrs(setter,PFConst.silentParams,done);
				}
			}
		});
	},
	updateAssociatedAttack = function (id, callback, silently, eventInfo) {
		var done = _.once(function () {
			//TAS.debug("leaving PFSpells.updateAssociatedAttack");
			if (typeof callback === "function") {
				callback();
			}
		}),
		itemId = id || (eventInfo ? SWUtils.getRowId(eventInfo.sourceAttribute) : ""),
		item_entry = 'repeating_spells_' + PFUtils.getRepeatingIDStr(itemId),
		attrib = (eventInfo ? SWUtils.getAttributeName(eventInfo.sourceAttribute) : ""),
		attributes=[];
		if (attrib){
			attributes = [item_entry+attrib];
			if ((/range/i).test(attrib)){
				attributes =[item_entry+'range_pick',item_entry+'range',item_entry+'range_numeric'];
			}
		} else {
			attributes = ["range_pick", "range", "range_numeric", "damage-macro-text", "damage-type", "sr", "savedc", "save", "spell-attack-type", "name"];
		}
		getAttrs(attributes,function(spellVal){
			getSectionIDs("repeating_weapon", function (idarray) { // get the repeating set
				var spellsourcesFields=[];
				spellsourcesFields = _.reduce(idarray,function(memo,currentID){
					memo.push("repeating_weapon_"+currentID+"_source-spell");
					return memo;
				},[]);
				getAttrs(spellsourcesFields,function(v){
					var setter={}, params={},idlist=[];
					try {
						_.each(idarray,function(currentID){
							var prefix = "repeating_weapon_"+currentID+"_";
							if (v[prefix+"source-spell"]===itemId){
								idlist.push(currentID);
								setter= setAttackEntryVals(item_entry, prefix,spellVal,setter);
							}
						});
						if (silently) {
							params = PFConst.silentParams;
						}
					} catch (err){
						TAS.error("PFSpells.updateAssociatedAttack",err);
					} finally {
						if (_.size(setter)>0){
							setAttrs(setter, params, function(){
								PFAttackOptions.resetSomeOptions(idlist);
							});
						} else {
							done();
						}
					}
					
				});
			});
		});
	},
	updatePreparedSpellState = function (id, eventInfo) {
		getAttrs(["repeating_spells_used", "repeating_spells_spellclass_number", "repeating_spells_prepared_state", "spellclass-0-hide_unprepared", "spellclass-1-hide_unprepared", "spellclass-2-hide_unprepared"], function (values) {
			var uses = parseInt(values.repeating_spells_used, 10) || 0,
			preparedState = parseInt(values.repeating_spells_prepared_state, 10) || 0,
			classnum = values["repeating_spells_spellclass_number"],
			isPrepared = (parseInt(values["spellclass-" + classnum + "-casting_type"], 10) || 0) === 2 ? 1 : 0,
			hideUnprepared = isPrepared * (parseInt(values["spellclass-" + classnum + "-hide_unprepared"], 10) || 0),
			setter = {};
			if (uses > 0 && preparedState === 0) {
				setter["repeating_spells_prepared_state"] = "1";
			} else if (uses < 1 && preparedState !== 0) {
				setter["repeating_spells_prepared_state"] = "0";
			}
			if (_.size(setter)) {
				if (hideUnprepared) {
					setAttrs(setter, {
						silent: true
					}, PFSpells.resetCommandMacro());
				} else {
					setAttrs(setter, {
						silent: true
					});
				}
			}
		});
	},
	/** - sets prepared_state to 1 if used has a value > 0 */
	resetSpellsPrepared = function () {
		getSectionIDs("repeating_spells", function (ids) {
			var fieldarray = [];
			_.each(ids, function (id) {
				var idStr = PFUtils.getRepeatingIDStr(id),
				prefix = "repeating_spells_" + idStr;
				fieldarray.push(prefix + "used");
				fieldarray.push(prefix + "prepared_state");
			});
			getAttrs(fieldarray, function (v) {
				var setter = {};
				_.each(ids, function (id) {
					var idStr = PFUtils.getRepeatingIDStr(id),
					prefix = "repeating_spells_" + idStr,
					uses = parseInt(v[prefix + "used"], 10) || 0,
					preparedState = parseInt(v[prefix + "prepared_state"], 10) || 0,
					setter = {};
					if (uses > 0 && preparedState === 0) {
						setter[prefix + "prepared_state"] = "1";
						//TAS.debug("resetSpellsPrepared, setting to 1:" + prefix);
					} else if (uses < 1 && preparedState !== 0) {
						setter[prefix + "prepared_state"] = "0";
					}
				});
				if (_.size(setter)) {
					setAttrs(setter, {
						silent: true
					});
				}
			});
		});
	},
	/************* SPELL OPTIONS *********************/
	/** updates all spells when level or concentration or spell penetration is updated 
	*@param {int} classIdx 0..2
	*@param {object} eventInfo from on event 
	*@param {function} callback when done
	*/
	updateSpellsCasterLevelRelated = function (classIdx, eventInfo, callback) {
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		});
		//TAS.debug("updateSpellsCasterLevelRelated", eventInfo);
		if (!(classIdx >= 0 && classIdx <= 2) || isNaN(parseInt(classIdx, 10))) {
			done();
			return;
		}
		getAttrs(["spellclass-" + classIdx + "-level-total", "spellclasses_multiclassed", "Concentration-" + classIdx + "-misc", "spellclass-" + classIdx + "-name",
			"spellclass-" + classIdx + "-SP-mod", "Concentration-" + classIdx + "-def", "Concentration-" + classIdx + "-mod"],function(vout){
			var classLevel = parseInt(vout["spellclass-" + classIdx + "-level-total"], 10) || 0,
				abilityMod = parseInt(vout["Concentration-" + classIdx + "-mod"], 10) || 0,
				multiclassed = parseInt(vout["spellclasses_multiclassed"], 10) || 0,
				defMod = parseInt(vout["Concentration-" + classIdx + "-def"], 10),
				classConcentrationMisc = parseInt(vout["Concentration-" + classIdx + "-misc"], 10) || 0,
				classSPMisc = parseInt(vout["spellclass-" + classIdx + "-SP-mod"], 10) || 0,
				newClassName = vout["spellclass-" + classIdx + "-name"],
				updateDefensiveCasting = eventInfo ? (/\-def$/i.test(eventInfo.sourceAttribute)) : false;
			if (classLevel <= 0) {
				done();
				return;
			}
			//TAS.debug("updateSpellsCasterLevelRelated,class:"+classIdx+", class values:",vout);				
			getSectionIDs("repeating_spells", function (ids) {
				var rowFieldAppnd = ['casterlevel', 'CL_misc', 'spell_class_r', 'spellclass_number', 'spellclass', 'range', 'range_numeric', 'range_pick', 'SP-mod', 'SP_misc', 'Concentration_misc', 'Concentration-mod', 'spell_options'],
				fields = _.reduce(ids, function (memo, id) {
					var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id), row;
					row = _.map(rowFieldAppnd, function (field) {
						return prefix + field;
					});
					return memo.concat(row);
				}, ['spellclass-0-name']);
				getAttrs(fields, function (v) {
					var doneOneRow = _.after(_.size(ids),done),
					classNumSetter = {},
					setter = {};
					try {
						//TAS.debug("updateSpellsCasterLevelRelated,class:"+classIdx+", spells:",v);
						_.each(ids, function (id) {
							var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id),
							classNum = parseInt(v[prefix + "spellclass_number"], 10),
							classRadio = parseInt(v[prefix + "spell_class_r"], 10),
							chosenRange = v[prefix + "range_pick"] || "",
							currRange = parseInt(v[prefix + "range_numeric"], 10) || 0,
							spellConcentrationMisc = parseInt(v[prefix + "Concentration_misc"], 10) || 0,
							optionText = v[prefix + "spell_options"],
							setOption = 0,
							tempstr = "",
							casterlevel = 0,
							newcasterlevel = 0,
							newConcentration = 0,
							newSP = 0,
							newClassName = "",
							newRange = 0;
							try {
								if (isNaN(classNum)) {
									classNum = 0;
									classNumSetter[prefix + "spellclass_number"] = 0;
									classNumSetter[prefix + "spellclass"] = v['spellclass-0-name'];
								} else if (!multiclassed || classNum === classIdx) {
									if (classNum !== classRadio || isNaN(classRadio)) {
										setter[prefix + "spell_class_r"] = classNum;
									}
									newClassName = v['spellclass-'+classNum+'-name'];
									if (newClassName !== v[prefix + "spellclass"]) {
										setter[prefix + "spellclass"] = newClassName;
										if (optionText) {
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.spellclass, PFSpellOptions.optionTemplates.spellclass.replace("REPLACE", SWUtils.escapeForRollTemplate(v[prefix + "spellclass"])));
											setOption = 1;
										}
									}
									casterlevel = parseInt(v[prefix + "casterlevel"], 10);
									newcasterlevel = classLevel + (parseInt(v[prefix + "CL_misc"], 10) || 0);
									if (newcasterlevel < 1) {
										newcasterlevel = 1;
									}
									if (newcasterlevel !== casterlevel || isNaN(casterlevel)) {
										casterlevel = newcasterlevel;
										setter[prefix + "casterlevel"] = newcasterlevel;
										if (optionText) {
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.casterlevel, PFSpellOptions.optionTemplates.casterlevel.replace("REPLACE", newcasterlevel));
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.casterlevel_chk, PFSpellOptions.optionTemplates.casterlevel_chk.replace("REPLACE", newcasterlevel));
											setOption = 1;
										}
									}
									newRange = PFUtils.findSpellRange(v[prefix + "range"], chosenRange, casterlevel) || 0;
									if (newRange !== currRange) {
										setter[prefix + "range_numeric"] = newRange;
										if (optionText) {
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.range, PFSpellOptions.optionTemplates.range.replace("REPLACE", newRange));
											setOption = 1;
										}
									}
									if (updateDefensiveCasting && optionText) {
										if (defMod > 0) {
											tempstr = PFSpellOptions.optionTemplates.cast_def.replace("REPLACE", defMod);
										} else {
											tempstr = "{{cast_def=}}";
										}
										if (optionText.indexOf("{{cast_def=") >= 0) {
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.cast_def, tempstr);
										} else {
											optionText += tempstr;
										}
										setOption = 1;
									}
									newConcentration = newcasterlevel + abilityMod + classConcentrationMisc + spellConcentrationMisc;
									if (newConcentration !== (parseInt(v[prefix + "Concentration-mod"], 10) || 0)) {
										setter[prefix + "Concentration-mod"] = newConcentration;
										if (optionText) {
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.Concentration, PFSpellOptions.optionTemplates.Concentration.replace("REPLACE", newConcentration));
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.Concentration_chk, PFSpellOptions.optionTemplates.Concentration_chk.replace("REPLACE", newConcentration));
											setOption = 1;
										}
									}
									newSP = classSPMisc + (parseInt(v[prefix + "SP_misc"], 10) || 0);
									if (newSP !== (parseInt(v[prefix + "SP-mod"], 10) || 0)) {
										setter[prefix + "SP-mod"] = newSP;
										if (optionText) {
											optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.spellPen, PFSpellOptions.optionTemplates.spellPen.replace("REPLACE", newSP));
											setOption = 1;
										}
									}
									if (setOption) {
										setter[prefix + "spell_options"] = optionText;
									}
								}
							} catch (innererror) {
								TAS.error("updateSpellsCasterLevelRelated innererror on id: "+id,innererror);
							}
						});
						
					} catch (err){
						TAS.error("updateSpellsCasterLevelRelated error:",err);
					} finally {
						if (_.size(setter) > 0 || _.size(classNumSetter) > 0) {
							//TAS.debug"updateSpellsCasterLevelRelated, setting:",classNumSetter,setter);
							if (_.size(classNumSetter) > 0) {
								setAttrs(classNumSetter,{},done);
							}
							if (_.size(setter) > 0) {
								setAttrs(setter, PFConst.silentParams, done);
							}
						} else {
							done();
						}
					}
				});
			});
		});
	},
	/** updates all spells when caster ability or DCs are updated 
	*@param {int} classIdx 0..2
	*@param {object} eventInfo from on event 
	*@param {function} callback when done
	*/
	updateSpellsCasterAbilityRelated = function (classIdx, eventInfo, callback) {
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		});
		//TAS.debug("updateSpellsCasterAbilityRelated", eventInfo);
		if (!(classIdx >= 0 && classIdx <= 2) || isNaN(parseInt(classIdx, 10))) {
			done();
			return;
		}
		getAttrs(["spellclass-" + classIdx + "-level-total", "Concentration-" + classIdx + "-mod", "Concentration-" + classIdx + "-misc", "spellclasses_multiclassed"],function(vout){
			var abilityMod, classConcentrationMisc,multiclassed,setter = {};
			try {
				abilityMod = parseInt(vout["Concentration-" + classIdx + "-mod"], 10) || 0;
				classConcentrationMisc = parseInt(vout["Concentration-" + classIdx + "-misc"], 10) || 0;
				multiclassed = parseInt(vout["spellclasses_multiclassed"], 10) || 0;
				if (!parseInt(vout["spellclass-" + classIdx + "-level-total"],10)){
					done();
					return;
				}
				//var updateAbilityScore = eventInfo?(/concentration\-[012]\-mod/i.test(eventInfo.sourceAttribute)):true;
				getSectionIDs("repeating_spells", function (ids) {
					var fields=[];
					//TAS.debug("updateSpellsCasterAbilityRelated",classIdx,eventInfo);
					//TAS.debug(ids);
					_.each(ids, function (id) {
						var prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id);
						fields = fields.concat([prefix + "spellclass_number", prefix + "spell_level", prefix + "spell_level_r", prefix + "spellclass_number",
						prefix + "casterlevel", prefix + "DC_misc", prefix + "savedc", prefix + "Concentration-mod", prefix + "Concentration_misc", prefix + "spell_options"]);
					});
					getAttrs(fields, function (v) {
						var newConcentration = 0,
						casterlevel = 0;
						//TAS.debug("updateSpellsCasterAbilityRelated,class:"+classIdx+", spells:",v);
						_.each(ids, function (id) {
							var spellLevel = 0, spellLevelRadio = 0, newDC = 0, setOption = 0,
							prefix = "repeating_spells_" + PFUtils.getRepeatingIDStr(id),
							optionText = v[prefix + "spell_options"],
							spellConcentrationMisc = parseInt(v[prefix + "Concentration_misc"], 10) || 0;
							try {
								if (!multiclassed || parseInt(v[prefix + "spellclass_number"], 10) === classIdx) {
									spellLevel = parseInt(v[prefix + "spell_level"], 10);
									spellLevelRadio = parseInt(v[prefix + "spell_level_r"], 10);
									if (isNaN(spellLevel)) {
										TAS.warn("spell level is NaN for " + prefix);
										if (spellLevelRadio !== -1 || isNaN(spellLevelRadio)) {
											setter[prefix + "spell_level_r"] = "-1";
											setter[prefix + "savedc"] = "";
										}
									} else {
										if (spellLevel !== spellLevelRadio || isNaN(spellLevelRadio)) {
											setter[prefix + "spell_level_r"] = spellLevel;
										}
										newDC = 10 + spellLevel + abilityMod + (parseInt(v[prefix + "DC_misc"], 10) || 0);
										if (newDC !== (parseInt(v[prefix + "savedc"], 10) || 0)) {
											setter[prefix + "savedc"] = newDC;
											if (optionText) {
												optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.dc, PFSpellOptions.optionTemplates.dc.replace("REPLACE", newDC));
												setOption = 1;
											}
										}
										casterlevel = parseInt(v[prefix + "casterlevel"], 10) || 0;
										if (!isNaN(casterlevel)) {
											newConcentration = casterlevel + abilityMod + classConcentrationMisc + spellConcentrationMisc;
											if (newConcentration !== (parseInt(v[prefix + "Concentration-mod"], 10) || 0)) {
												setter[prefix + "Concentration-mod"] = newConcentration;
												if (optionText) {
													optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.Concentration, PFSpellOptions.optionTemplates.Concentration.replace("REPLACE", newConcentration));
													optionText = optionText.replace(PFSpellOptions.optionTemplateRegexes.Concentration_chk, PFSpellOptions.optionTemplates.Concentration_chk.replace("REPLACE", newConcentration));
													setOption = 1;
												}
											}
										} else {
											TAS.warn("spell casterlevel is NaN for " + prefix);
											if ((parseInt(v[prefix + "Concentration-mod"], 10) || 0) !== 0) {
												setter[prefix + "Concentration-mod"] = "";
											}
										}
									}
									if (setOption) {
										//TAS.debug("setting option for id "+ id +" to "+optionText);
										setter[prefix + "spell_options"] = optionText;
									}
								}
							} catch (innererror){
								TAS.error("updateSpellsCasterAbilityRelated innererror on id:"+id,innererror);
							} 
						});
					});
				});
			} catch(err){
				TAS.error("updateSpellsCasterAbilityRelated outer error:",err);
			}finally {
				if (_.size(setter) > 0) {
					//TAS.debug("updateSpellsCasterAbilityRelated setting:",setter);
					setAttrs(setter, PFConst.silentParams, done());
				} else if (typeof callback === "function") {
					done();
				}
			}
		});

	},
	resetCommandMacro = function (eventInfo, callback) {
		//TAS.debug("at PFSpells.resetCommandMacro");
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		repeatingSpellAttrs = ["spell_level","spellclass_number","name","school",
			"slot","metamagic","used","isDomain","isMythic"],
		class0BaseMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_spell_accessible} @{toggle_rounded_flag}{{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{spellclass-0-name} ^{spells}}} {{row01=**^{checks}**}} {{row02=[^{caster-level-check}](~@{character_id}|Spell-Class-0-CL-Check) [^{concentration-check}](~@{character_id}|Concentration-Check-0) [^{spell-failure}](~@{character_id}|Spell-Fail-Check)}}",
		class1BaseMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_spell_accessible} @{toggle_rounded_flag}{{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{spellclass-1-name} ^{spells}}} {{row01=**^{checks}**}} {{row02=[^{caster-level-check}](~@{character_id}|Spell-Class-1-CL-Check) [^{concentration-check}](~@{character_id}|Concentration-Check-1) [^{spell-failure}](~@{character_id}|Spell-Fail-Check)}}",
		class2BaseMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_spell_accessible} @{toggle_rounded_flag}{{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{spellclass-2-name} ^{spells}}} {{row01=**^{checks}**}} {{row02=[^{caster-level-check}](~@{character_id}|Spell-Class-2-CL-Check) [^{concentration-check}](~@{character_id}|Concentration-Check-2) [^{spell-failure}](~@{character_id}|Spell-Fail-Check)}}",
		npcClass0BaseMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_spell_accessible} @{toggle_rounded_flag}{{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=^{npc} @{spellclass-0-name} ^{spells}}} {{row01=**^{checks}**}} {{row02=[^{caster-level-check}](~@{character_id}|Spell-Class-0-CL-Check) [^{concentration-check}](~@{character_id}|Concentration-Check-0) [^{spell-failure}](~@{character_id}|Spell-Fail-Check)}}",
		npcClass1BaseMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_spell_accessible} @{toggle_rounded_flag}{{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=^{npc} @{spellclass-1-name} ^{spells}}} {{row01=**^{checks}**}} {{row02=[^{caster-level-check}](~@{character_id}|Spell-Class-1-CL-Check) [^{concentration-check}](~@{character_id}|Concentration-Check-1) [^{spell-failure}](~@{character_id}|Spell-Fail-Check)}}",
		npcClass2BaseMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_spell_accessible} @{toggle_rounded_flag}{{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=^{npc} @{spellclass-2-name} ^{spells}}} {{row01=**^{checks}**}} {{row02=[^{caster-level-check}](~@{character_id}|Spell-Class-2-CL-Check) [^{concentration-check}](~@{character_id}|Concentration-Check-2) [^{spell-failure}](~@{character_id}|Spell-Fail-Check)}}",
		pcBaseMacro=[class0BaseMacro,class1BaseMacro,class2BaseMacro],
		npcBaseMacro=[npcClass0BaseMacro,npcClass1BaseMacro,npcClass2BaseMacro],
		resetToDefault = function(configV){
			var attrs = [],i=0;
			for(i=0;i<3;i++){
				if(configV["spellclass-"+i+"-book"].slice(13) !== pcBaseMacro[i].slice(13)){
					attrs["spellclass-"+i+"-book"]=pcBaseMacro[i];
				}
				if(configV["spellclass-"+i+"-book-npc"].slice(13) !== npcBaseMacro[i].slice(13)){
					attrs["spellclass-"+i+"-book-npc"]=npcBaseMacro[i];
				}
			}
			if (_.size(attrs) > 0) {
				setAttrs(attrs, {
					silent: true
				}, done);
			} else {
				done();
			}
		};
		getAttrs(["spellclass-0-casting_type", "spellclass-1-casting_type", "spellclass-2-casting_type", "spellclass-0-hide_unprepared", 
				"spellclass-1-hide_unprepared", "spellclass-2-hide_unprepared", "spellclass-0-book", "spellclass-1-book", "spellclass-2-book",
				"spellclass-0-book-npc", "spellclass-1-book-npc", "spellclass-2-book-npc", 
				"spellclass-0-show_domain_spells", "spellclass-1-show_domain_spells", "spellclass-2-show_domain_spells",
				"spellmenu_groupby_school", "spellmenu_show_uses", "mythic-adventures-show"], function (configV) {
			var isPrepared = [], showDomain = [], hideUnprepared = [], groupBySchool=0, showUses=0, usesMythic=0;
			try{
				isPrepared = [
					(parseInt(configV["spellclass-0-casting_type"], 10) === 2),
					(parseInt(configV["spellclass-1-casting_type"], 10) === 2),
					(parseInt(configV["spellclass-2-casting_type"], 10) === 2)];
				showDomain = [
					(parseInt(configV["spellclass-0-show_domain_spells"],10)||0),
					(parseInt(configV["spellclass-1-show_domain_spells"],10)||0),
					(parseInt(configV["spellclass-2-show_domain_spells"],10)||0)];
				hideUnprepared = [
					(parseInt(configV["spellclass-0-hide_unprepared"], 10) || 0),
					(parseInt(configV["spellclass-1-hide_unprepared"], 10) || 0),
					(parseInt(configV["spellclass-2-hide_unprepared"], 10) || 0)];
				groupBySchool = parseInt(configV["spellmenu_groupby_school"],10)||0;
				showUses = parseInt(configV["spellmenu_show_uses"],10)||0;
				usesMythic = parseInt(configV["mythic-adventures-show"],10)||0;
			} catch(outererr){
				TAS.error("PFSpells.resetCommandMacro, error assembling global vars",outererr);
				done();
				return;
			}
			getSectionIDs("repeating_spells", function (idarray) {
				var attrs = {};
				//TAS.debug(idarray);
				if (!idarray || idarray.length === 0) {
					resetToDefault(configV);
					return;
				}
				getAttrs(["_reporder_repeating_spells"], function (repValues) {
					//TAS.debug("PFSpells.resetCommandMacro order repValues:",repValues);
					var spellAttrs = _.chain(idarray)
						.map(function(id){
							var prefix = 'repeating_spells_'+PFUtils.getRepeatingIDStr(id),
							retVal = [];
							_.each(repeatingSpellAttrs,function(attr){
								retVal.push(prefix + attr);
							});
							return retVal;
						})
						.flatten()
						.value();
					getAttrs(spellAttrs, function (values) {
						//TAS.debug(values);
						var orderedList, repList, filteredIds, spellsByClass, npcSpellsArray, customSorted=0,
						spellsPC, spellsNPC, i,groups = [],
						spellSchoolReg = /[^\(\[]*/,
						attrs = {},rollTemplateCounter=0,
						tempstr;
						try {
							if (!_.isUndefined(repValues._reporder_repeating_spells) && repValues._reporder_repeating_spells !== "") {
								repList = repValues._reporder_repeating_spells.split(",");
								repList = _.map(repList, function (ID) {
									return ID.toLowerCase();
								});
								orderedList = _.intersection(_.union(repList, idarray), idarray);
								customSorted = 1;
							} else {
								orderedList = idarray;
							}
							spellsByClass = _.chain(orderedList)
							.map(function(id){
								var prefix = "repeating_spells_"+ SWUtils.getRepeatingIDStr(id),
								metaMagic = parseInt(values[prefix + "metamagic"], 10)||0,
								spellSlot = (metaMagic) ? values[prefix + "slot"] : values[prefix + "spell_level"],
								matches,
								schoolForGroup=values[prefix + "school"]||"";
								matches = spellSchoolReg.exec(values[prefix + "school"]||"");
								if (matches && matches[0]){
									schoolForGroup = SWUtils.trimBoth(matches[0]);
									schoolForGroup = schoolForGroup[0].toUpperCase() + schoolForGroup.slice(1).toLowerCase();
								}
								return { id: id,
									level: spellSlot,
									levelstr: "^{level} "+String(spellSlot),
									rawlevel : parseInt(values[prefix + "spell_level"],10),
									school: schoolForGroup,
									spellClass: (parseInt(values[prefix + "spellclass_number"],10)),
									spellClassstr: "class"+values[prefix + "spellclass_number"],
									isDomain: (parseInt(values[prefix + "isDomain"],10)||0),
									isMythic: (usesMythic * parseInt(values[prefix+"isMythic"],10)||0),
									uses: (parseInt(values[prefix + "used"],10)||0),
									name: (values[prefix+"name"]||"")
								};
							})
							.omit(function(spellObj){
								return isNaN(spellObj.rawlevel) || isNaN(spellObj.spellClass) || 
									(hideUnprepared[spellObj.spellClass] && spellObj.uses===0 &&
										(!( showDomain[spellObj.spellClass] && spellObj.isDomain )));
							})
							.map(function(spellObj){
								var spellName = spellObj.name, usesStr="",dstr="",mystr="",lvlstr="", spacestr="";
								try {
									spellName = SWUtils.escapeForChatLinkButton(spellName);
									spellName = SWUtils.escapeForRollTemplate(spellName);
									spellName = SWUtils.trimBoth(spellName);
									usesStr = showUses?("("+spellObj.uses+")"):"";
									if(showUses&&isPrepared[spellObj.spellClass]&&spellObj.isDomain){
										usesStr="";
									}
									mystr=spellObj.isMythic?"&#x1f11c;":""; //   // "&#x24A8;":"";//"(m)":"";//
									dstr= spellObj.isDomain?"&#x1f113;":""; // "";  //"&#x249F;":"";//"(d)":"";//
									lvlstr=groupBySchool?(spellObj.level+":"):"";
									spacestr= (usesStr||mystr||dstr)?" ":"";
									spellName = " ["+lvlstr + spellName + spacestr + dstr + mystr + usesStr + "]";
								} catch (maperr){
									TAS.error("PFSpells.resetCommandMacro error creating link name:",maperr);
								} finally {
									spellObj.pcChatLink = spellName+"(~@{character_id}|repeating_spells_" + spellObj.id + "_roll)";
									spellObj.npcChatLink = spellName+"(~@{character_id}|repeating_spells_" + spellObj.id + "_npc-roll)";
									return spellObj;
								}
							})
							.sortBy('level')
							.groupBy('spellClassstr')
							.mapObject(function(classArray){
								return _.chain(classArray)
								.sortBy(groupBySchool?'school':'levelstr')
								.groupBy(groupBySchool?'school':'levelstr')
								.value();
							})
							.value();

							
							//TAS.debug("#############################");
							//TAS.debug(spellsByClass);
							//TAS.debug("#############################");
							
							//was 2 sets of 3 reduces but can do this faster with 3 each loops and populating both at once 
							spellsPC={};
							spellsNPC={};
							rollTemplateCounter=10;
							_.each(spellsByClass, function(groupList,classGroup){
								var pcstr="",npcstr="";
								_.each(groupList,function(spellList,groupName){
									rollTemplateCounter++;
									pcstr += " {{row"+rollTemplateCounter+"=**" + groupName+"**}}" ;
									npcstr += " {{row"+rollTemplateCounter+"=**" + groupName+"**}}" ;
									rollTemplateCounter++;
									pcstr += " {{row"+rollTemplateCounter+"=";
									npcstr += " {{row"+rollTemplateCounter+"=";
									_.each(spellList,function(spellObj){
										pcstr += spellObj.pcChatLink;
										npcstr += spellObj.npcChatLink;
									});
									pcstr += "}}";
									npcstr += "}}";
								});
								spellsPC[classGroup]=pcstr;
								spellsNPC[classGroup]=npcstr;
							});
							//TAS.debug("#############################");
							//TAS.debug(spellsPC,spellsNPC);
							//TAS.debug("#############################");

							for (i=0;i<3;i++){
								tempstr = pcBaseMacro[i] + spellsPC['class'+i];
								if (tempstr && configV["spellclass-"+i+"-book"].slice(13) !== tempstr.slice(13)) {
									attrs["spellclass-"+i+"-book"]=tempstr;
								} else if (!tempstr && configV["spellclass-"+i+"-book"].slice(13) !== pcBaseMacro[i].slice(13)){
									attrs["spellclass-"+i+"-book"]="";
								}
								tempstr = npcBaseMacro[i] + spellsNPC['class'+i];
								if (tempstr && configV["spellclass-"+i+"-book-npc"].slice(13) !== tempstr.slice(13)) {
									attrs["spellclass-"+i+"-book-npc"]=tempstr;
								} else if (!tempstr && configV["spellclass-"+i+"-book-npc"].slice(13) !== npcBaseMacro[i].slice(13)){
									attrs["spellclass-"+i+"-book-npc"]="";
								}	
							}
							if (_.size(attrs) > 0) {
								setAttrs(attrs, {
									silent: true
								}, done);
							} else {
								done();
							}
						} catch (err) {
							TAS.error("PFSpells.resetCommandMacro", err);
							done();
						}
					});
				});
			});
		});
	},
	//faster smaller than updateSpell
	updateSpellSlot = function (id, eventInfo, callback) {
		var outerdone = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		done = _.once(function () {
			resetCommandMacro(eventInfo, outerdone);
		}),
		idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_spells_" + idStr,
		spellLevelRadioField = prefix + "spell_level_r",
		spellSlotField = prefix + "slot",
		spellLevelField = prefix + "spell_level",
		metamagicField = prefix + "metamagic";
		//TAS.debug("updateSpellSlot", eventInfo, id);
		getAttrs([spellSlotField, spellLevelField, spellLevelRadioField], function (v) {
			var slot = parseInt(v[spellSlotField], 10),
			level = parseInt(v[spellLevelField], 10),
			metamagic = parseInt(v[metamagicField], 10) || 0,
			spellLevelRadio = parseInt(v[spellLevelRadioField],10)||0,
			setter = {};
			try {
				//TAS.debug("updateSpellSlot", v);
				if (metamagic) {
					if (isNaN(level)) {
						slot = -1;
					}
					if (isNaN(slot)) {
						slot = level;
						setter[spellSlotField] = level;
						setAttrs(setter, {
							silent: true
						}, done);
						return;
					}
					if (slot !== spellLevelRadio) {
						//TAS.debug("updating slot to " + slot);
						setter[spellLevelRadioField] = slot;
						if (spellLevelRadio===-1){
							setter["spells_tab"] = slot;
						}
						setAttrs(setter, {
							silent: true
						}, done);
						return;
					}
				}
				outerdone();
			} catch (err) {
				TAS.error("updateSpellSlot", err);
				outerdone();
			}
		});
	},
	/** updates a spell
	*@param {string} id optional, pass id if looping through list of IDs. Null if context is row itself. 
	*@param {eventInfo} eventInfo ACTUALLY USED : if not present forces recalc of everything
	*@param {function} callback - to call when done.
	*@param {boolean} doNotUpdateTotals - if true do NOT call resetSpellsTotals() and resetCommandMacro() at end, otherwise do.
	*/
	updateSpell = function (id, eventInfo, callback, doNotUpdateTotals) {
		var spellLevelUndefined = false,
		classNumWasUndefined=false,
		done = _.once(function () {
			//TAS.debug("leaving PFSpells.updateSpell: id:" + id + " spelllevelundefined=" + spellLevelUndefined);
			//these asynchronous functions can be called at same time as callback.
			if (!spellLevelUndefined) {
				PFSpellOptions.resetOption(id, eventInfo);
				if (!doNotUpdateTotals) {
					resetSpellsTotals();
					resetCommandMacro();
				}
			}
			if (typeof callback === "function") {
				callback();
			}
		}),
		idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_spells_" + idStr,
		classNameField = prefix + "spellclass",
		classRadioField = prefix + "spell_class_r",
		classNumberField = prefix + "spellclass_number",
		casterlevelField = prefix + "casterlevel",
		spellLevelField = prefix + "spell_level",
		spellLevelRadioField = prefix + "spell_level_r",
		dcMiscField = prefix + "DC_misc",
		currDCField = prefix + "savedc",
		fields = [classNumberField, classRadioField, classNameField, casterlevelField, prefix + "CL_misc", 
			prefix + "spellclass_number", prefix + "range_pick", prefix + "range", prefix + "range_numeric", 
			prefix + "SP-mod", prefix + "SP_misc", prefix + "Concentration_misc", prefix + "Concentration-mod", 
			prefix + "spell_options", prefix + "used", prefix + "slot", prefix + "metamagic", spellLevelField, 
			spellLevelRadioField, dcMiscField, currDCField, 
			"spellclass-0-level-total", "spellclass-1-level-total", "spellclass-2-level-total", 
			"spellclass-0-SP-mod", "spellclass-1-SP-mod", "spellclass-2-SP-mod", 
			"Concentration-0-mod", "Concentration-1-mod", "Concentration-2-mod", 
			"Concentration-0-misc", "Concentration-1-misc", "Concentration-2-misc", 
			"Concentration-0-def", "Concentration-1-def", "Concentration-2-def", 
			"spellclass-0-name", "spellclass-1-name", "spellclass-2-name"];
		getAttrs(fields, function (v) {
			var setter = {},
			baseClassNum, classNum = 0, classRadio,	currClassName = "",	className = "",
			baseSpellLevel,	spellLevel,	spellSlot,	metaMagic, spellLevelRadio,
			currCasterLevel, casterlevel, spellAbilityMod,	newDC = 10,
			levelSlot,
			currRange,
			currChosenRange,
			newSP = 0,
			newConcentration = 0,
			updateClass = false,
			updateClassLevel = false,
			updateRange = false,
			updateSP = false,
			updateConcentration = false,
			updateSpellLevel = false,
			updateDC = false,
			updateSlot = false,
			updateStr = "",
			tempMatches,
			hadToSetClass = false,
			newRange = 0;
			try {
				baseClassNum = parseInt(v[classNumberField], 10);
				classNum = baseClassNum || 0;
				classRadio = parseInt(v[classRadioField], 10);
				baseSpellLevel = parseInt(v[spellLevelField], 10);
				spellLevel = baseSpellLevel || 0;
				spellSlot = parseInt(v[prefix + "slot"], 10);
				metaMagic = parseInt(v[prefix + "metamagic"], 10) || 0;
				spellLevelRadio = parseInt(v[spellLevelRadioField], 10);
				currCasterLevel = parseInt(v[casterlevelField], 10);
				casterlevel = currCasterLevel || 0;
				spellAbilityMod = parseInt(v["Concentration-" + classNum + "-mod"], 10) || 0;
				levelSlot = (metaMagic ? spellSlot : spellLevel);
				currRange = parseInt(v[prefix + "range_numeric"], 10) || 0;
				currChosenRange = v[prefix + "range_pick"] || "blank";
				//cannot perform calculations
				if (isNaN(baseClassNum) && isNaN(baseSpellLevel)) {
					TAS.warn("cannot update spell! id:" + id + " both class and level are not numbers", v);
					return;
				}
				//TAS.debug("spell slot:" + spellSlot + ", metamagic:" + metaMagic + ", spelllevel:" + spellLevel + ", radio:" + spellLevelRadio);
				//if looping through with id then force update of all fields.
				if (!eventInfo) {
					updateClass = true;
				}
				//if class is not set, then set to default class 0
				if (isNaN(baseClassNum)) {
					//force to zero?
					classNumWasUndefined=true;
					TAS.debug("#########################","Forcing spell "+id+" to class 0");
					setter[classNumberField] = String(classNum);
					updateClass = true;
					hadToSetClass = true;
				}
				if (classNum !== classRadio) {
					setter[classRadioField] = classNum;
					updateClass = true;
				}
				if (!updateClass && eventInfo && eventInfo.sourceAttribute) {
					updateStr = eventInfo.sourceAttribute.toLowerCase();
					tempMatches = updateStr.match(/lvlstr|range_pick|range|sp_misc|cl_misc|spellclass_number|spell_level|dc_misc|concen|slot/);
					if (tempMatches && tempMatches[0]) {
						switch (tempMatches[0]) {
							case 'range_pick':
							case 'range':
								updateRange = true;
								break;
							case 'sp_misc':
								updateSP = true;
								break;
							case 'cl_misc':
								updateClassLevel = true;
								break;
							case 'spellclass_number':
								updateClass = true;
								break;
							case 'concen':
								updateConcentration = true;
								break;
							case 'spell_level':
								updateSpellLevel = true;
								break;
							case 'dc_misc':
								updateDC = true;
								break;
							case 'slot':
								updateSlot = true;
								break;
							case 'lvlstr':
								updateClass = true;
								updateClassLevel = true;
								updateConcentration = true;
								updateSP = true;
								updateDC = true;
								updateRange = true;
								break;
							default:
								updateClass = true; //unknown just update all
						}
					} else {
						//if we called from importFromCompendium then it's lvlstr
						TAS.warn("Unimportant field updated, do not update row: " + eventInfo.sourceAttribute);
						done();
						return;
					}
				}
				if (isNaN(baseSpellLevel)) {
					if (spellLevelRadio !== -1) {
						setter[spellLevelRadioField] = "-1";
						setter[prefix + "slot"] = "";
					}
					spellLevelUndefined = true;
				} else if (!metaMagic && (updateSpellLevel || spellLevel !== spellLevelRadio)) {
					//TAS.debug("reset radio field after spell update");
					setter[spellLevelRadioField] = spellLevel;
					if (spellLevelRadio===-1){
						setter["spells_tab"] = spellLevel;
					}
					updateSpellLevel = true;
				} else if (metaMagic && !isNaN(spellSlot) && (updateSlot || spellSlot !== spellLevelRadio)) {
					//TAS.debug("reset radio field after spell SLOT update");
					setter[spellLevelRadioField] = spellSlot;
					if (spellLevelRadio===-1){
						setter["spells_tab"] = spellSlot;
					}
				}
				//keep slot in sync
				if (!spellLevelUndefined) {
					if (isNaN(spellSlot)) {
						setter[prefix + "slot"] = spellLevel;
						spellSlot = spellLevel;
						updateSlot = true;
					} else if (!metaMagic && (updateSpellLevel || spellSlot !== spellLevel)) {
						setter[prefix + "slot"] = spellLevel;
					}
				}
				//classname
				className = v["spellclass-" + classNum + "-name"];
				if (updateClass) {
					currClassName = v[classNameField];
					if (currClassName !== className) {
						TAS.debug("setting class name field, should be doing this if classnum was undefined");
						setter[classNameField] = className;
					}
				}
				if (isNaN(currCasterLevel)) {
					updateClassLevel = true;
				}
				//set caster level
				if (updateClass || updateClassLevel) {
					casterlevel = (parseInt(v["spellclass-" + classNum + "-level-total"], 10) || 0) + (parseInt(v[prefix + "CL_misc"], 10) || 0);
					if (casterlevel < 1) {
						casterlevel = 1;
					}
					if (currCasterLevel !== casterlevel || isNaN(currCasterLevel)) {
						setter[prefix + "casterlevel"] = casterlevel;
						updateClassLevel = true;
					}
				}
				if (!(spellLevelUndefined) && (updateClass || updateSpellLevel || updateDC)) {
					newDC = 10 + spellLevel + spellAbilityMod + (parseInt(v[dcMiscField], 10) || 0);
					if (newDC !== (parseInt(v[currDCField], 10) || 0)) {
						setter[currDCField] = newDC;
					}
				}
				if (updateClass || updateClassLevel || updateConcentration) {
					newConcentration = casterlevel + spellAbilityMod + (parseInt(v["Concentration-" + classNum + "-misc"], 10) || 0) + (parseInt(v[prefix + "Concentration_misc"], 10) || 0);
					if (newConcentration !== (parseInt(v[prefix + "Concentration-mod"], 10) || 0)) {
						setter[prefix + "Concentration-mod"] = newConcentration;
					}
				}
				if (updateClass || updateRange || updateClassLevel) {
					newRange = PFUtils.findSpellRange(v[prefix + "range"], currChosenRange, casterlevel) || 0;
					if (newRange !== currRange) {
						setter[prefix + "range_numeric"] = newRange;
					}
				}
				if (updateClass || updateSP || updateClassLevel) {
					newSP = (parseInt(v["spellclass-" + classNum + "-SP-mod"], 10) || 0) + (parseInt(v[prefix + "SP_misc"], 10) || 0);
					if (newSP !== (parseInt(v[prefix + "SP-mod"], 10) || 0)) {
						setter[prefix + "SP-mod"] = newSP;
					}
				}
			} catch (err) {
				TAS.error("PFSpells.updateSpell:" + id, err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {
						silent: true
					}, done);
				} else {
					done();
				}
			}
		});
	},
	/** - updates all spells
	*@param {function} callback when done
	*@param {silently} if should call setAttrs with {silent:true}
	*@param {object} eventInfo not used
	*/
	updateSpells = function (callback, silently, eventInfo) {
		var done = _.once(function () {
			TAS.debug("leaving PFSpells.updateSpells");
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneOne = _.after(3,done);
		getAttrs(['use_spells','spellclass-0-exists','spellclass-1-exists','spellclass-2-exists'],function(v){
			//TAS.debug"at PFSpells.updateSpells. Existing classes:",v);
			if(parseInt(v.use_spells,10)){
				_.times(3,function(n){
					TAS.debug("###############", "PFSpells.updateSpells index is: "+n);
					if (parseInt(v['spellclass-'+n+'-exists'],10)){
						updateSpellsCasterAbilityRelated (n,null,function(){
							updateSpellsCasterLevelRelated(n,null,doneOne);
						});
					} else {
						doneOne();
					}
				});
			} else {
				done();
			}
		});
	},

	updateSpellsOld = function (callback, silently, eventInfo) {
		getSectionIDs("repeating_spells", function (ids) {
			var done = _.after(_.size(ids), function () {
					TAS.debug("leaving PFSpells.updateSpells after " + _.size(ids)+" rows");
						if (typeof callback === "function") {
							callback();
						}
				});
			_.each(ids, function (id) {
				try {
					updateSpell(id, eventInfo, done, true);
				} catch (err){
					TAS.error("PFSpells.updateSpells error - should never happen!",err);
					done();
				}
			});
		});
	},

	/* gets level and class from repeating_spells_spell_lvlstr then updates spell
	* matches class name in compendium against current spell classes in this order:
	* spell class already selected by spell dropdown, spellclass0, spellclass1, spellclass2
	* then sets spell level to the matching level for that class
	* if it cannot find then sets class name to the class level string and updates silently.
	*@param {string} id the id of the row
	*@param {object} eventInfo used to find row id since id param will be null
	*/
	importFromCompendium = function (id, eventInfo) {
		var trueId = "";

		trueId = id || (eventInfo ? SWUtils.getRowId(eventInfo.sourceAttribute) : "");
		
		getAttrs(["repeating_spells_compendium_category","repeating_spells_spell_lvlstr", "spellclass-0-name", "spellclass-1-name", "spellclass-2-name", "repeating_spells_range_from_compendium", "repeating_spells_target_from_compendium", "repeating_spells_area_from_compendium", "repeating_spells_effect_from_compendium","repeating_spells_description"], function (v) {
			var levelStrBase = v["repeating_spells_spell_lvlstr"],
			rangeText = v["repeating_spells_range_from_compendium"],
			areaEffectText = (v["repeating_spells_target_from_compendium"] || "") + (v["repeating_spells_area_from_compendium"] || "") + (v["repeating_spells_effect_from_compendium"] || ""),
			classesInital = [],
			classes = [],
			originalClasses = ["", "", ""],
			classMatch = "",
			level = 0,
			idx = -1,
			foundMatch = false,
			setSilent = {},
			i = 0,
			classesToMatch = {},
			tempclassname = "",
			newRangeSettings,
			hasHunter = false,
			hasDruid = false,
			hasRanger = false,
			minHunterSpellLevel = 99,
			hunterIdx = 99,
			isAttack = false,
			allSame=1,
			modeLevel=-1,
			counter = 0,
			callUpdateSpell = true;
			//TAS.debug("at pfspells.importFromCompendium",v);
			if (levelStrBase) {
				try {
					levelStrBase = levelStrBase.toLowerCase();
					//get first word in names of classes (since users may put archetypes or other variables in)
					//if (currClass) {classesToMatch[0]=currClass.toLowerCase().replace(/^\s+/,"").match(/\w[^\d]+/)[0];}
					if (v["spellclass-0-name"]) {
						tempclassname = v["spellclass-0-name"].toLowerCase().replace(/^\s+/, "").match(/\w+/)[0];
						classesToMatch[tempclassname] = 0;
						originalClasses[0] = tempclassname;
						if (/hunter/.test(tempclassname)) {
							hasHunter = true;
							hunterIdx = 0;
						} else if (/druid/.test(tempclassname)) {
							hasDruid = true;
						} else if (/ranger/.test(tempclassname)) {
							hasRanger = true;
						}
					}
					if (v["spellclass-1-name"]) {
						tempclassname = v["spellclass-1-name"].toLowerCase().replace(/^\s+/, "").match(/\w+/)[0];
						classesToMatch[tempclassname] = 1;
						originalClasses[1] = tempclassname;
						if (/hunter/.test(tempclassname)) {
							hasHunter = true;
							hunterIdx = 1;
						} else if (/druid/.test(tempclassname)) {
							hasDruid = true;
						} else if (/ranger/.test(tempclassname)) {
							hasRanger = true;
						}
					}
					if (v["spellclass-2-name"]) {
						tempclassname = v["spellclass-2-name"].toLowerCase().replace(/^\s+/, "").match(/\w+/)[0];
						classesToMatch[tempclassname] = 2;
						originalClasses[2] = tempclassname;
						if (/hunter/.test(tempclassname)) {
							hasHunter = true;
							hunterIdx = 2;
						} else if (/druid/.test(tempclassname)) {
							hasDruid = true;
						} else if (/ranger/.test(tempclassname)) {
							hasRanger = true;
						}
					}
					if (!(hasHunter && (hasDruid || hasRanger))) {
						//if user is hunter AND other class it's based on then can't tell.
						if (_.size(classesToMatch) > 0) {
							//add the translated classes from classesUsingOtherSpellLists
							_.each(classesToMatch, function (classindex, classname) {
								_.each(classesUsingOtherSpellLists, function (toclass, fromclass) {
									if (classname.indexOf(fromclass) >= 0) {
										classesToMatch[toclass] = classindex;
									}
								});
							});
							//from spell: first split on comma between classes, then on spaces between classname and level
							classesInital = levelStrBase.split(/\s*,\s*/);
							classes = _.map(classesInital, function (a) {
								return a.split(/\s+/);
							});
							for (i = 0; i < classes.length; i++) {
								classes[i][1] = (parseInt(classes[i][1], 10) || 0);
								if (i===0){
									modeLevel=classes[i][1];
								} else {
									if (modeLevel !== classes[i][1]){
										allSame=0;
									}
									
								}
							}
							//classes example: [["sorcerer/wizard","2"],["summoner","1"],["inquisitor","3"],["magus","2"]]
							if (hasHunter) {
								for (i = 0; i < classes.length; i++) {
									if (/druid|ranger/.test(classes[i][0]) && classes[i][1] < minHunterSpellLevel) {
										minHunterSpellLevel = classes[i][1];
										classMatch = classes[i][0];
									}
								}
								if (minHunterSpellLevel < 99) {
									counter++;
									foundMatch = true;
									level = minHunterSpellLevel;
									idx = hunterIdx;
								}
							}
							_.each(classesToMatch, function (classindex, classname) {
								for (i = 0; i < classes.length; i++) {
									//classes on left because it can be longer and have multiple class names such as cleric/druid
									if (classes[i][0].indexOf(classname) >= 0) {
										counter++;
										if (!foundMatch) {
											classMatch = originalClasses[classindex];
											level = classes[i][1];
											idx = classindex;
											foundMatch = true;
										}
									}
								}
							});
						}
					}
				} catch (err) {
					classMatch = "";
				}
				if (counter > 1 || !foundMatch) {
					TAS.warn("importFromCompendium: did not find class match");
					//leave at current choice if there is one
					setSilent["repeating_spells_spell_level"] = "";
					setSilent["repeating_spells_spell_level_r"] = -1;
					setSilent["repeating_spells_spell_class_r"] = -1;
					setSilent["repeating_spells_spellclass_number"] = "";
					setSilent["repeating_spells_spellclass"] = levelStrBase;
					callUpdateSpell = false;
				} else {
					setSilent["repeating_spells_spellclass_number"] = idx;
					setSilent["repeating_spells_spell_level"] = level;
					setSilent["repeating_spells_spell_level_r"] = level;
					setSilent["repeating_spells_spellclass"] = classMatch;
					setSilent["repeating_spells_spell_class_r"] = idx;
					//change tab so spell doesn't disappear.
					setSilent["spells_tab"] = level;
				}
			}
			if (rangeText) {
				try {
					newRangeSettings = PFUtils.parseSpellRangeText(rangeText, areaEffectText);
					setSilent["repeating_spells_range_pick"] = newRangeSettings.dropdown;
					setSilent["repeating_spells_range"] = newRangeSettings.rangetext;
					if (newRangeSettings.dropdown==='touch' ) {
						isAttack=true;
						setSilent["repeating_spells_attack-type"]='attk-melee';
					} else if ( (/ranged touch|ray\s/i).test(v["repeating_spells_description"])  ) {
						isAttack=true;
						setSilent["repeating_spells_attack-type"]='attk-ranged';
					}
				} catch (err2) {
					TAS.error(err2);
					setSilent["repeating_spells_range"] = rangeText.replace(/\s*\(..*/, '');
					setSilent["repeating_spells_range_pick"] = "unknownrange";
				}
			}
			if (areaEffectText) {
				setSilent["repeating_spells_targets"] = areaEffectText;
			}
			setSilent["repeating_spells_spell_lvlstr"] = "";
			setSilent["repeating_spells_range_from_compendium"] = "";
			setSilent["repeating_spells_target_from_compendium"] = "";
			setSilent["repeating_spells_area_from_compendium"] = "";
			setSilent["repeating_spells_effect_from_compendium"] = "";
			if (_.size(setSilent) > 0) {
				setAttrs(setSilent, PFConst.silentParams, function () {
					if (callUpdateSpell) {
						updateSpell(null, eventInfo);
					}
				});
			}
		});
	},
	migrateRepeatingMacros = function (callback){
		var done = _.once(function(){
			TAS.debug("leaving PFSpells.migrateRepeatingMacros");
			if(typeof callback === "function"){
				callback();
			}
		}),
		migrated = _.after(2,function(){
			resetCommandMacro();
			setAttrs({'migrated_spells_macrosv1':1},PFConst.silentParams,done);
		});
		//TAS.debug("at PFSpells.migrateRepeatingMacros");
		getAttrs(['migrated_spells_macrosv1'],function(v){
			if (parseInt(v.migrated_spells_macrosv1,10)!==1){
				PFMacros.migrateRepeatingMacros(migrated,'spells','npc-macro-text',defaultRepeatingMacro,defaultRepeatingMacroMap,defaultDeletedMacroAttrs,'@{NPC-Whisper}');
				PFMacros.migrateRepeatingMacros(migrated,'spells','macro-text',defaultRepeatingMacro,defaultRepeatingMacroMap,defaultDeletedMacroAttrs,'@{PC-Whisper}');
			} else {
				done();
			}
		});
	},
	migrate = function (callback) {
		PFMigrate.migrateSpells(function () {
			PFMigrate.migrateSpellRanges(function () {
				migrateRepeatingMacros (function() {
					if (typeof callback === "function") {
						callback();
					}
				});
			});
		});
	},

	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFSpells.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		recalcTotals = _.once(function () {
			//TAS.debug("at PFSpells.recalculate.recalcTotals");
			resetSpellsPrepared();
			resetSpellsTotals(null, null, null, silently);
			resetCommandMacro();
			//do not call because updateSpells already calls update options
			done();
		}),
		callUpdateSpells = _.once(function(){
			getAttrs(["use_spells"],function(v){
				if (parseInt(v.use_spells,10)){
					updateSpells(recalcTotals,silently);
				} else {
					done();
				}
			});
		});
		migrate(callUpdateSpells);
	},
	events = {
		//events for spell repeating rows
		repeatingSpellEventsPlayer: {
			"change:repeating_spells:DC_misc change:repeating_spells:slot change:repeating_spells:Concentration_misc change:repeating_spells:range change:repeating_spells:range_pick change:repeating_spells:CL_misc change:repeating_spells:SP_misc": [updateSpell],
			"change:repeating_spells:spell_lvlstr": [importFromCompendium],
			"change:repeating_spells:used": [resetSpellsTotals, updatePreparedSpellState],
			"change:repeating_spells:slot": [updateSpellSlot]
		},
		repeatingSpellEventsEither: {
			"change:repeating_spells:spellclass_number change:repeating_spells:spell_level": [updateSpell]
		},
		repeatingSpellAttackEvents: ["range_pick", "range", "range_numeric", "damage-macro-text", "damage-type", "sr", "savedc", "save", "spell-attack-type", "name"]

	},
	registerEventHandlers = function () {
		//SPELLS
		//all repeating spell updates
		var tempstr="";
		_.each(events.repeatingSpellEventsPlayer, function (functions, eventToWatch) {
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function eventRepeatingSpellsPlayer(eventInfo) {
					if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
						TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
						methodToCall(null, eventInfo);
					}
				}));
			});
		});
		_.each(events.repeatingSpellEventsEither, function (functions, eventToWatch) {
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function eventRepeatingSpellsEither(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					methodToCall(null, eventInfo);
				}));
			});
		});
		on("change:spellmenu_groupby_school change:spellmenu_show_uses change:spellclass-0-hide_unprepared change:spellclass-1-hide_unprepared change:spellclass-2-hide_unprepared change:spellclass-0-show_domain_spells change:spellclass-1-show_domain_spells change:spellclass-2-show_domain_spells", TAS.callback(function eventUnpreparedSpellCommandChange(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				resetCommandMacro();
			}
		}));
		on("remove:repeating_spells change:repeating_spells:spellclass_number change:repeating_spells:spell_level change:repeating_spells:slot change:repeating_spells:used change:repeating_spells:school change:repeating_spells:metamagic change:repeating_spells:isDomain change:repeating_spells:isMythic change:_reporder_repeating_spells", TAS.callback(function eventRepeatingSpellAffectingMenu(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				resetCommandMacro();
			}
		}));
		on("remove:repeating_spells change:repeating_spells:spellclass_number change:repeating_spells:spell_level", TAS.callback(function eventRepeatingSpellsTotals(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				resetSpellsTotals();
			}
		}));
		on("change:repeating_spells:create-attack-entry", TAS.callback(function eventcreateAttackEntryFromSpell(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				createAttackEntryFromRow(null,null,false,eventInfo);
			}
		}));
		tempstr = _.reduce(events.repeatingSpellAttackEvents,function(memo,attr){
			memo+="change:repeating_spells:"+attr+" ";
			return memo;
		},"");
		on(tempstr,	TAS.callback(function eventupdateAssociatedSpellAttack(eventInfo) {
			var attr;
			TAS.debug("caught " + eventInfo.sourceAttribute + " event" + eventInfo.sourceType);
			attr = SWUtils.getAttributeName(eventInfo.sourceAttribute);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (attr === 'attack-type')){
				updateAssociatedAttack(null,null,null,eventInfo);
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFSpells module loaded         ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		migrate: migrate,
		recalculate: recalculate,
		spellLevels: spellLevels,
		importFromCompendium: importFromCompendium,
		resetSpellsTotals: resetSpellsTotals,
		resetCommandMacro: resetCommandMacro,
		updatePreparedSpellState: updatePreparedSpellState,
		updateSpell: updateSpell,
		updateSpellSlot: updateSpellSlot,
		updateSpells: updateSpells,
		createAttackEntryFromRow: createAttackEntryFromRow,
		updateSpellsCasterAbilityRelated: updateSpellsCasterAbilityRelated,
		updateSpellsCasterLevelRelated: updateSpellsCasterLevelRelated
	};
}());
var PFSpellCasterClasses = PFSpellCasterClasses || (function () {
	'use strict';
	//the 3 spell classes at top of spells page
	var
	/**  returns whether a base spell level is filled in or not
	*@param {int} spellclassidx 0,1,2 sellcasting class
	*@param {function} callback - to call if exists
	*@param {function} noExistCallback - to call if not exists
	*/
	ifSpellClassExists = function (spellclassidx, callback, noExistCallback) {
		getAttrs(["use_spells","spellclass-" + spellclassidx + "-exists"], function (v) {
			try {
				if (! parseInt(v.use_spells,10)){
					if (typeof noExistCallback === "function") {
						noExistCallback();
					}
				} else if (parseInt(v["spellclass-" + spellclassidx + "-exists"],10)) {
					if (typeof callback === "function") {
						callback();
					}
				} else {
					if (typeof noExistCallback === "function") {
						noExistCallback();
					}
				}
			} catch (err) {
				TAS.error("PFSpellCasterClasses.ifSpellClassExists", err);
				if (typeof noExistCallback === "function") {
					noExistCallback();
				}
			}
		});
	},
	/**  sets {spellclasses_multiclassed} to 1 if more than one spellclass-X-exists is 1
	*@param {nothing} dummy - only here so eventhandlers can call it, since spellclass index is in this position.
	*@param {eventinfo} eventInfo  unused eventinfo from 'on' method
	*/
	updateMultiClassedCasterFlag = function (dummy, eventInfo, callback) {
		var done=_.once(function(){
			TAS.debug("leaving updateMultiClassedCasterFlag");
			if (typeof callback === "function"){
				callback();
			}
		});
		getAttrs(["spellclass-0-exists", "spellclass-1-exists", "spellclass-2-exists"], function (v) {
			var multiclassed = parseInt(v["spellclasses_multiclassed"], 10) || 0, setter={};
			if (((parseInt(v["spellclass-0-exists"], 10) || 0) + (parseInt(v["spellclass-1-exists"], 10) || 0) + (parseInt(v["spellclass-2-exists"], 10) || 0)) > 1) {
				if (!multiclassed) {
					setter.spellclasses_multiclassed= 1;
				}
			} else if (multiclassed) {
				setter.spellclasses_multiclassed= 0;
			} 
			if(_.size(setter)>0){
				setAttrs(setter,PFConst.silentParams,done);
			} else {
				done();
			}
		});
	},
	/** updates the ranges at the top for this spellcasting class
	*@param {int} spellclassidx 0,1,2 the spell casting tab
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {boolean} force if true update no matter if new ranges are same or not.
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateCasterRanges = function (spellclassidx, eventInfo, force, callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		},
		prefix = "spellclass-" + spellclassidx,
		lvlField = prefix + "-level-total",
		closeField = prefix + "-close",
		medField = prefix + "-medium",
		longField = prefix + "-long";
		getAttrs([lvlField, closeField, medField, longField], function (v) {
			var level = (parseInt(v[lvlField], 10) || 0),
			closeRng = parseInt(v[closeField], 10) || 0,
			medRng = parseInt(v[medField], 10) || 0,
			longRng = parseInt(v[longField], 10) || 0,
			ranges = {},
			setter = {},
			params = {};
			try {
				ranges = PFUtils.calculateSpellRanges(level);
				if (force || ranges.close !== closeRng || ranges.medium !== medRng || ranges["long"] !== longRng) {
					setter[closeField] = ranges.close;
					setter[medField] = ranges.medium;
					setter[longField] = ranges["long"];
				}
			} catch (err) {
				TAS.error("PFSpellCasterClasses.updateCasterRanges", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/** updateConcentration - updates concentration for spellclass
	*@param {int} classidx 0,1,2 the spellclass
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateConcentration = function (classidx, eventInfo, callback, silently) {
		//TAS.debug("at PFSpellCasterClasses.updateConcentration");
		SWUtils.updateRowTotal(["Concentration-" + classidx, "spellclass-" + classidx + "-level-total", "Concentration-" + classidx + "-mod", "Concentration-" + classidx + "-misc"], 0, null, false, callback, silently);
	},
	/*********************************** SPELLS PER DAY section *************************************/
	/** updateSaveDCs - update save DCs on left  column of Spells Per Day grid
	*@param {int} classidx 0,1,2 the spellclass
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateSaveDCs = function (classidx, eventInfo, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["Concentration-" + classidx + "-mod", "spellclass-" + classidx + "-level-0-savedc"], function (v) {
			var mod = parseInt(v["Concentration-" + classidx + "-mod"], 10) || 0,
			dcLvlZero = 10 + mod,
			currDC = parseInt(v["spellclass-" + classidx + "-level-0-savedc"], 10),
			setter = {},
			params = {},
			i;
			try {
				//if 0 is different then rest are different. if 0 is same, rest are same.
				if (currDC !== dcLvlZero || isNaN(currDC)) {
					setter["spellclass-" + classidx + "-level-0-savedc"] = dcLvlZero;
					for (i = 1; i < 10; i++) {
						setter["spellclass-" + classidx + "-level-" + i + "-savedc"] = dcLvlZero + i;
					}
				}
			} catch (err) {
				TAS.error("PFSpellCasterClasses.updateSaveDCs", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/** updateBonusSpells - updates Bonus Spells for the class
	* Uses attribute, not the attribute-mod. So it does not change with ability damage or penalties.
	*@param {number} classidx 0,1,2 the spellclass
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateBonusSpells = function (classidx, eventInfo, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		conAbility = "Concentration-" + classidx + "-ability";
		getAttrs([conAbility, "INT", "WIS", "CHA", "STR", "DEX", "CON"], function (v) {
			//eliminate the modifier, we just want @{INT} not @{INT-mod}
			var abilityName = PFUtils.findAbilityInString(v[conAbility]).replace("-mod", ""),
			abilityVal = parseInt(v[abilityName], 10),
			setter = {},
			params = {
				silent: true
			},
			bonusSpells,
			bonusName,
			i,
			prefix = "spellclass-" + classidx + "-level-";
			try {
				if (!isNaN(abilityVal)) {
					if (abilityVal >= 12) {
						for (i = 1; i < 10; i++) {
							bonusSpells = Math.floor(Math.max(Math.floor((abilityVal - 10) / 2) + 4 - i, 0) / 4);
							bonusName = prefix + i + "-bonus";
							setter[bonusName] = bonusSpells;
						}
					} else {
						for (i = 1; i < 10; i++) {
							bonusName = prefix + i + "-bonus";
							setter[bonusName] = 0;
						}
					}
				}
			} catch (err) {
				TAS.error("PFSpellCasterClasses.updateBonusSpells", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/* updateMaxSpellsPerDay */
	updateMaxSpellsPerDay = function (classidx, spelllvl, callback, silently) {
		SWUtils.updateRowTotal(["spellclass-" + classidx + "-level-" + spelllvl + "-spells-per-day_max", "spellclass-" + classidx + "-level-" + spelllvl + "-class", "spellclass-" + classidx + "-level-" + spelllvl + "-bonus", "spellclass-" + classidx + "-level-" + spelllvl + "-misc"], 0, [], false, callback, silently);
	},
	/**  applyConditions - for condition deafened update {SpellFailureNote} on DEFENSE PAGE
	* note drain should have already been applied
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	applyConditions = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		//TAS.debug("at PFSpellCasterClasses.applyConditions");
		getAttrs(["condition-Deafened", "SpellFailureNote"], function (v) {
			var setter = {},
			params = {};
			try {
				if (v["condition-Deafened"] == "4") {
					if (!v["SpellFailureNote"]) {
						setter["SpellFailureNote"] = "Yes";
					}
				} else {
					if (v["SpellFailureNote"]) {
						setter["SpellFailureNote"] = "";
					}
				}
			} catch (err) {
				TAS.error("PFSpellCasterClasses.applyConditions", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	recalcOneClass = function (spellClassIdx, callback, silently) {
		var done = _.once(function () {
			TAS.debug("leaving PFSpells.recalculate.recalcOneClass");
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneOne = _.after(4, done);
		//TAS.debug("at PFSpellCasterClasses.recalcOneClass");
		updateConcentration(spellClassIdx, null, doneOne, silently);
		updateSaveDCs(spellClassIdx, null, doneOne, silently);
		updateCasterRanges(spellClassIdx, null, true, doneOne, silently);
		updateBonusSpells(spellClassIdx, null, doneOne, silently);
	},
	/** updates {spellclass-X-level-total}, sets minimum of 1 if {spellclass-X-level} is > 0
	*@param {int} spellclassidx 0,1,2 the spell casting tab
	*@param {eventInfo} eventInfo unused eventinfo from 'on' method
	*@param {int} classlevel optional override for class level, use this if you know it and sheet attribute might not be updated yet.
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateCasterLevel = function (spellclassidx, eventInfo, classlevel, callback, silently) {
		var done = _.once(function () {
			TAS.debug("leaving updateCasterLevel " + spellclassidx);
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["spellclass-" + spellclassidx + "-level", "spellclass-" + spellclassidx + "-level-total", "spellclass-" + spellclassidx + "-level-misc", "buff_CasterLevel-total", "CasterLevel-Penalty", "spellclass-" + spellclassidx + "-exists"], function (v) {
			var baseLevel = classlevel || parseInt(v["spellclass-" + spellclassidx + "-level"], 10) || 0,
			totalLevel = parseInt(v["spellclass-" + spellclassidx + "-level-total"], 10) || 0,
			spellClassExists = parseInt(v["spellclass-" + spellclassidx + "-exists"], 10) || 0,
			casterlevel = 0,
			setter = {},
			recalcAfter=0,
			params = {};
			try {
				casterlevel = baseLevel + (parseInt(v["spellclass-" + spellclassidx + "-level-misc"], 10) || 0) + (parseInt(v["buff_CasterLevel-total"], 10) || 0) + (parseInt(v["CasterLevel-Penalty"], 10) || 0);
				//if has spells then minimum level is 1 no matter what minuses apply
				if (casterlevel <= 0) {
					if (baseLevel > 0) {
						casterlevel = 1;
					} else {
						casterlevel = 0;
					}
				}
				if (casterlevel !== totalLevel) {
					setter["spellclass-" + spellclassidx + "-level-total"] = casterlevel;
					if (totalLevel===0 && eventInfo){
						recalcAfter=1;
					}
				}
				if (baseLevel > 0) {
					if (spellClassExists === 0) {
						setter["spellclass-" + spellclassidx + "-exists"] = "1";
						recalcAfter=1;
					}
				} else if (spellClassExists === 1) {
					setter["spellclass-" + spellclassidx + "-exists"] = "0";
				}
			} catch (err) {
				TAS.error("PFSpellCasterClasses.updateCasterLevel", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, function(){
						if (recalcAfter){
							recalcOneClass(spellclassidx,done,silently);
						} else {
							done();
						}
					});
				} else {
					done();
				}
			}
		});
	},
	/** updates all 3 caster class levels, usually due to change in buffs or debuffs 
	*@param {nothing} dummy - only here so eventhandlers can call it, since spellclass index is in this position.
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateCasterLevels = function (dummy, eventInfo, callback, silently) {
		updateCasterLevel(0, eventInfo, 0, callback, silently);
		updateCasterLevel(1, eventInfo, 0, callback, silently);
		updateCasterLevel(2, eventInfo, 0, callback, silently);
	},
	/** sets {spellclass-X-name} and {spellclass-X-level} from the class dropdown {spellclass-X}
	* called when the class dropdown is changed.
	*@param {int} spellclassidx 0,1,2 the spell casting tab
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	setCasterClassFromDropdown = function (spellclassidx, eventInfo, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		spellclassdropdown = "spellclass-" + spellclassidx,
		spellclasslevel = "spellclass-" + spellclassidx + "-level";
		getAttrs([spellclassdropdown, spellclasslevel], function (va) {
			var classidx = parseInt(va[spellclassdropdown], 10),
			currClassLevel = parseInt(va[spellclasslevel], 10),
			spellclassname,
			classname,
			classlevel;
			try {
				if (isNaN(classidx) || !va[spellclassdropdown] || va[spellclassdropdown] == "-1") {
					done();
					return;
				}
				spellclassname = "spellclass-" + spellclassidx + "-name";
				classname = "class-" + classidx + "-name";
				classlevel = "class-" + classidx + "-level";
				//if race indicated: use race and HD
				if (classidx === 6) {
					classname = "race";
					classlevel = "npc-hd-num";
				}
				getAttrs([classname, classlevel, spellclassname], function (v) {
					var setter = {},
					setAny = 0,
					updateLevel = 0,
					newClassLevel = parseInt(v[classlevel], 10) || 0;
					try {
						if (currClassLevel !== newClassLevel || isNaN(currClassLevel)) {
							setter[spellclasslevel] = newClassLevel;
							updateLevel = 1;
						}
						if (v[classname] && v[classname] !== v[spellclassname]) {
							setter[spellclassname] = v[classname];
						}

					} catch (err) {
						TAS.error("PFSpellCasterClasses.setCasterClassFromDropdown", err);
					} finally {
						if (_.size(setter) > 0) {
							setAttrs(setter, {
								silent: true
							}, done);
							if (updateLevel) {
								updateCasterLevel(spellclassidx, eventInfo, newClassLevel);
							}
						} else {
							done();
						}
					}
				});
			} catch (errOuter) {
				TAS.error("PFSpellCasterClasses.setCasterClassFromDropdown outer", errOuter);
				done();
			}
		});
	},
	/** update level on SPELL page when updated on CLASS page, but not vice versa
	*@param {int} classidx 0..6 the row on the CLASS GRID starting with 0 to grab level from, or 6 if {npc-hd-num}
	*@param {eventinfo} eventInfo unused eventinfo from 'on' method
	*@param {boolean} force if true update no matter if new ranges are same or not.
	*@param {function} callback - to call when done.
	*@param {boolean} silently if true update with PFConst.silentParams
	*/
	updateCasterFromClassLevel = function (classidx, eventInfo, force, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		spellclassdropdown0 = "spellclass-0",
		spellclassdropdown1 = "spellclass-1",
		spellclassdropdown2 = "spellclass-2";
		if (classidx === "npc-hd-num") {
			classidx = 6;
		} else {
			classidx = parseInt(classidx, 10) || 0;
		}
		getAttrs([spellclassdropdown0, spellclassdropdown1, spellclassdropdown2], function (va) {
			var spellclassidx,
			spellclasslevelField,
			classlevelField,
			prefix,
			classNameField;
			if (parseInt(va[spellclassdropdown0], 10) === classidx) {
				spellclassidx = 0;
			} else if (parseInt(va[spellclassdropdown1], 10) === classidx) {
				spellclassidx = 1;
			} else if (parseInt(va[spellclassdropdown2], 10) === classidx) {
				spellclassidx = 2;
			} else {
				return;
			}
			prefix = "spellclass-" + spellclassidx;
			spellclasslevelField = prefix + "-level";
			classlevelField = "class-" + classidx + "-level";
			classNameField = "class-" + classidx + "-name";
			getAttrs([spellclasslevelField, classlevelField, classNameField], function (v) {
				var setter = {},
				newCasterLevel = parseInt(v[classlevelField], 10) || 0,
				currCasterLevel = parseInt(v[spellclasslevelField], 10);
				if (newCasterLevel !== currCasterLevel || isNaN(currCasterLevel) || force) {
					setter[spellclasslevelField] = newCasterLevel;
					setter[prefix + "-name"] = v[classNameField];
					setAttrs(setter, {
						silent: true
					});
					updateCasterLevel(classidx, eventInfo, newCasterLevel);
				}
			});
		});
	},
	migrate = function(callback,oldversion){
		//TAS.debug("At PFSpellCasterClasses.migrate");
		PFMigrate.migrateUsesSpellFlag(callback);
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("leaving PFSpellCasterClasses.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		recalcTopSection = function (callback, silently) {
			var done = _.once(function () {
				TAS.debug("leaving PFSpellCasterClasses.recalculate.recalcTopSection");
				if (typeof callback === "function") {
					callback();
				}
			}),
			doneOne = _.after(3, done);
			//TAS.debug("at PFSpellCasterClasses.recalculate.recalcTopSection");
			_.each(PFConst.spellClassIndexes, function (spellClassIdx) {
				try {
					setCasterClassFromDropdown(spellClassIdx, null, function () {
						updateCasterLevel(spellClassIdx, null, 0, function () {
							ifSpellClassExists(spellClassIdx, function () {
								recalcOneClass(spellClassIdx,doneOne,silently);
							}, doneOne);
						}, silently);
					}, silently);
				} catch (err) {
					TAS.error("PFSpellCasterClasses.recalculate_recalcTopSection", err);
					doneOne();
				}
			});
		},
		finishAndLeave = _.once(function () {
			updateMultiClassedCasterFlag(null,null,function(){
				PFSpells.recalculate(done, silently, oldversion);
			});
		}),
		callTopSection = _.once(function () {
			recalcTopSection(finishAndLeave, silently);
		}),
		callApplyConditions = _.once(function () {
			applyConditions(callTopSection, silently);
		});
		migrate(function(){
			callApplyConditions();
		},oldversion);
	},
	events = {
		// events for updates to top of class page, each one calls isSpellClassExists
		spellcastingClassEventsAuto: {
			"change:concentration-REPLACE-mod": [updateBonusSpells, updateSaveDCs, updateConcentration, PFSpells.updateSpellsCasterAbilityRelated],
			"change:spellclass-REPLACE-level-total": [updateConcentration, updateCasterRanges, PFSpells.updateSpellsCasterLevelRelated],
			"change:spellclass-REPLACE-SP-mod": [PFSpells.updateSpellsCasterLevelRelated]
		},
		spellcastingClassEventsPlayer: {
			"change:concentration-REPLACE-misc": [updateConcentration, PFSpells.updateSpellsCasterLevelRelated],
			"change:concentration-REPLACE-def": [PFSpells.updateSpellsCasterLevelRelated]
		},
		// events for updates to top of class page even if no spellcasting class exists
		spellcastingClassEventsIgnoreLevel: {
			"change:spellclass-REPLACE-level-misc": [updateCasterLevel],
			"change:spellclass-REPLACE": [setCasterClassFromDropdown],
			"change:spellclass-REPLACE-level": [updateCasterLevel, updateMultiClassedCasterFlag],
			"change:buff_CasterLevel-total change:condition-Drained change:CasterLevel-Penalty": [updateCasterLevels]
		},
		//events for updateBonusSpells section CLASSIDX is the 0-2 classes, SPELLLEVEL is 0-9
		spellcastingClassEventsPerSpellLevel: "change:spellclass-CLASSIDX-level-SPELLLEVEL-class change:spellclass-CLASSIDX-level-SPELLLEVEL-bonus change:spellclass-CLASSIDX-level-SPELLLEVEL-misc"
	},
	registerEventHandlers = function () {
		//spellclass section (3 tabs at top of spell page)
		_.each(PFConst.spellClassIndexes, function (spellClassIdx) {
			var numberIdx = parseInt(spellClassIdx, 10) || 0;
			on("change:Concentration-" + numberIdx + "-ability", TAS.callback(function eventChangeSpellDropdown(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				PFUtilsAsync.setDropdownValue("Concentration-" + numberIdx + "-ability", "Concentration-" + numberIdx + "-mod");
			}));
			_.each(events.spellcastingClassEventsPlayer, function (functions, event) {
				var eventToWatch = event.replace(/REPLACE/g, numberIdx);
				_.each(functions, function (methodToCall) {
					on(eventToWatch, TAS.callback(function eventSpellcasterClassSpecificUpdatePlayerOnly(eventInfo) {
						if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
							TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
							ifSpellClassExists(numberIdx, function () {
								methodToCall(numberIdx, eventInfo);
							});
						}
					}));
				});
			});
			_.each(events.spellcastingClassEventsAuto, function (functions, event) {
				var eventToWatch = event.replace(/REPLACE/g, numberIdx);
				_.each(functions, function (methodToCall) {
					on(eventToWatch, TAS.callback(function eventSpellcasterClassSpecificUpdateAuto(eventInfo) {
						if (eventInfo.sourceType === "sheetworker") {
							TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
							ifSpellClassExists(numberIdx, function () {
								methodToCall(numberIdx, eventInfo);
							});
						}
					}));
				});
			});
			//ignore level means do not call "ifSpellClassExists" first
			_.each(events.spellcastingClassEventsIgnoreLevel, function (functions, event) {
				var eventToWatch = event.replace(/REPLACE/g, numberIdx);
				_.each(functions, function (methodToCall) {
					on(eventToWatch, TAS.callback(function eventSpellcasterClassUpdate(eventInfo) {
						TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
						methodToCall(numberIdx, eventInfo);
					}));
				});
			});
			//spells per day
			_.each(PFSpells.spellLevels, function (spellLevel) {
				var spellNumber = parseInt(spellLevel, 10),
				eventToWatch = events.spellcastingClassEventsPerSpellLevel.replace(/CLASSIDX/g, numberIdx).replace(/SPELLLEVEL/g, spellNumber);
				on(eventToWatch, TAS.callback(function eventSpellsPerDay(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					ifSpellClassExists(numberIdx, function () {
						updateMaxSpellsPerDay(numberIdx, spellNumber);
					});
				}));
			});
		}); //end of spell classes
	};
	registerEventHandlers();
	console.log(PFLog.l + 'PFSpellCasterClasses module loaded' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		ifSpellClassExists: ifSpellClassExists,
		applyConditions: applyConditions,
		setCasterClassFromDropdown: setCasterClassFromDropdown,
		updateBonusSpells: updateBonusSpells,
		updateCasterFromClassLevel: updateCasterFromClassLevel,
		updateCasterLevel: updateCasterLevel,
		updateCasterLevels: updateCasterLevels,
		updateCasterRanges: updateCasterRanges,
		updateConcentration: updateConcentration,
		updateMaxSpellsPerDay: updateMaxSpellsPerDay,
		updateMultiClassedCasterFlag: updateMultiClassedCasterFlag,
		updateSaveDCs: updateSaveDCs,
		recalculate: recalculate
	};
}());
var PFClassRaceGrid = PFClassRaceGrid || (function () {
	'use strict';
	var classColumns = ["hp", "fchp", "skill", "fcskill", "fcalt", "bab", "Fort", "Ref", "Will", "level"],
	raceColumns = ['hp', 'bab', 'Fort', 'Ref', 'Will', 'hd-num'],
	classRows = ["0", "1", "2", "3", "4", "5"],
	
	setMulticlassed =function(){
		var fields =['multiclassed','class-0-level','class-1-level','class-2-level','class-3-level','class-4-level','class-5-level','npc-hd-num'];
		//TAS.debug("at PFClassRaceGrid.setMulticlassed");
		getAttrs(fields,function(v){
			var isMulti=parseInt(v.multiclassed,10)||0,
			totalWLevels=Math.min(1,parseInt(v['class-0-level'],10)||0) + Math.min(1,parseInt(v['class-1-level'],10)||0) +
			 Math.min(1,parseInt(v['class-2-level'],10)||0) + Math.min(1,parseInt(v['class-3-level'],10)||0) +
			 Math.min(1,parseInt(v['class-4-level'],10)||0) + Math.min(1,parseInt(v['class-5-level'],10)||0) +
			 Math.min(1,parseInt(v['hd-num'],10)||0);
			//TAS.debug("PFClassRaceGrid.setMulticlassed, "+ totalWLevels +" rows have levels");
			if (totalWLevels > 1){
				if (!isMulti){
					setAttrs({multiclassed:1});
				}
			} else if (isMulti){
				setAttrs({multiclassed:0});
			}
		});
	},
	/** PFClassRaceGrid.updateClassInformation Updates totals at bottom of Class Information grid
	*@param {string} col end of name of attribute that references column, must be in classColumns or raceColumns 
	*@param {function} callback optional call when finished updating
	*@param {boolean} silently if true then call setAttrs with PFConst.silentParams
	*/
	updateClassInformation = function (col, callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		},
		updateClassInformationInner = function (col, callback, silently) {
			var getFields = [],
			totalColName, col0Name, col1Name, col2Name, col3Name, col4Name, col5Name,
			col0NameTwo,
			col1NameTwo,
			col2NameTwo,
			col3NameTwo,
			col4NameTwo,
			col5NameTwo;
	
			if (col === "fchp") {
				col = "hp";
			} else if (col === "hd-num") {
				col = "level";
			}

			col0Name = "class-0-" + col;
			col1Name = "class-1-" + col;
			col2Name = "class-2-" + col;
			col3Name = "class-3-" + col;
			col4Name = "class-4-" + col;
			col5Name = "class-5-" + col;

			totalColName = (col === "bab" || col === "level") ? col : "total-" + col;
			getFields = [totalColName, col0Name, col1Name, col2Name, col3Name, col4Name, col5Name];
			if (col !== "skill") {
				if (col === "hp") {
					col0NameTwo = "class-0-fc" + col;
					col1NameTwo = "class-1-fc" + col;
					col2NameTwo = "class-2-fc" + col;
					col3NameTwo = "class-3-fc" + col;
					col4NameTwo = "class-4-fc" + col;
					col5NameTwo = "class-5-fc" + col;
					getFields = getFields.concat([col0NameTwo, col1NameTwo, col2NameTwo, col3NameTwo, col4NameTwo, col5NameTwo]);
				}
				//add npc values
				switch (col) {
					case 'bab':
					case 'Fort':
					case 'Will':
					case 'Ref':
						getFields = getFields.concat(["npc-" + col]);
						break;
					case 'hp':
						getFields = getFields.concat(["NPC-HP"]);
						break;
					case 'level':
						getFields = getFields.concat(["npc-hd-num"]);
						break;
				}
				//TAS.debug(getFields);
				SWUtils.updateRowTotal(getFields, 0, [], 0, done, silently);
			} else {
				col0NameTwo = "class-0-level";
				col1NameTwo = "class-1-level";
				col2NameTwo = "class-2-level";
				col3NameTwo = "class-3-level";
				col4NameTwo = "class-4-level";
				col5NameTwo = "class-5-level";
				getFields = getFields.concat([col0NameTwo, col1NameTwo, col2NameTwo, col3NameTwo, col4NameTwo, col5NameTwo]);
				//TAS.debug(getFields);
				getAttrs(getFields, function (v) {
					var setter = {},
					currTot=0,
					params = {},
					tot=0;
					tot = Math.floor((parseFloat(v[col0Name], 10) || 0) * (parseInt(v[col0NameTwo], 10) || 0) + (parseFloat(v[col1Name], 10) || 0) * (parseInt(v[col1NameTwo], 10) || 0) + (parseFloat(v[col2Name], 10) || 0) * (parseInt(v[col2NameTwo], 10) || 0) + (parseFloat(v[col3Name], 10) || 0) * (parseInt(v[col3NameTwo], 10) || 0) + (parseFloat(v[col4Name], 10) || 0) * (parseInt(v[col4NameTwo], 10) || 0) + (parseFloat(v[col5Name], 10) || 0) * (parseInt(v[col5NameTwo], 10) || 0));
					currTot = parseInt(v[totalColName], 10);
					if (isNaN(currTot) || tot !== currTot) {
						setter[totalColName] = tot;
						if (silently) {
							params = PFConst.silentParams;
						}
						setAttrs(setter, params, done);
					} else {
						done();
					}
				});
			}
		};
		//TAS.debug("at PFClassRaceGrid.updateClassInformation: " + col);
		//no sum for hd 
		if (!col || col === "hd") {
			TAS.warn("at updateClassInformation called with bad column:"+col);
			done();
			return;
		}
		if ((/^npc/i).test(col)) {
			col = col.slice(4);
		}
		if(col==="hp"){
			getAttrs(["auto_calc_hp"],function(v){
				if (parseInt(v["auto_calc_hp"],10)){
					done();
				} else {
					updateClassInformationInner(col,done,silently);
				}
			});
		} else {
			updateClassInformationInner(col,done,silently);
		}

	},
	autoCalcClassHpGrid = function(callback,silently,eventInfo){
		var done = _.once(function(){ if (typeof callback === "function") { 
			TAS.debug("Leaving updateClassHpGrid");
			callback();}
		}),
		fields=["auto_calc_hp", "autohp_percent","maxhp_lvl1","is_npc","set_pfs",
			"total-hp", "NPC-HP", "npc-hd-num","npc-hd",
			"class-0-hp","class-0-level","class-0-hd","class-0-fchp",
			"class-1-hp","class-1-level","class-1-hd","class-1-fchp",
			"class-2-hp","class-2-level","class-2-hd","class-2-fchp",
			"class-3-hp","class-3-level","class-3-hd","class-3-fchp",
			"class-4-hp","class-4-level","class-4-hd","class-4-fchp",
			"class-5-hp","class-5-level","class-5-hd","class-5-fchp"
			];
		getAttrs(fields,function(v){
			var maxFirst =0, mult=1, isPFS=0, setter={}, isNPC=0, loudSetter={}, currrowhp=0, rowhp=0, level=0, hd=0, totalhp=0, rowUpdated = -1, matches;
			try {
				//TAS.debug("at autocalc hp",v);
				if (parseInt(v.auto_calc_hp,10)){
					isPFS = parseInt(v.set_pfs,10)||0;
					isNPC = parseInt(v.is_npc,10)||0;
					isPFS = isPFS && (!isNPC);
					mult= PFUtils.getAutoHPPercentMultiplier(v.autohp_percent);
					maxFirst=parseInt(v.maxhp_lvl1,10)||0;
					if (eventInfo && eventInfo.sourceAttribute){
						matches = eventInfo.sourceAttribute.match(/(\d)/);
						if (matches && matches[1]) {
							rowUpdated = parseInt(matches[1],10)||0;
						} else if ((/NPC/i).test(eventInfo.sourceAttribute)){
							rowUpdated = 6;
						}
					}
					//TAS.debug("at autocalc hp, rowupdated is:" + rowUpdated);
					level = parseInt(v['npc-hd-num'],10)||0;
					hd = parseInt(v['npc-hd'],10)||0;
					currrowhp = parseInt(v['NPC-HP'],10)||0;
					if ((level >0 && hd > 0) || !((maxFirst===0 && rowUpdated!==-1 && rowUpdated !== 6))){
						//first do NPC.
						rowhp = PFUtils.getAvgHP(level,hd,mult,maxFirst,isPFS);
						totalhp += rowhp;
						//TAS.debug("adding: "+rowhp);
						if (rowhp !== currrowhp){
							setter['NPC-HP']=rowhp;
						}
						if (maxFirst){ maxFirst = 0;}
					} else {
						totalhp += currrowhp;
						//TAS.debug("adding "+currrowhp);
					}
					_.each(PFClassRaceGrid.classRows,function(rowindex){
						var fchp=0;
						rowhp=0;
						level = parseInt(v["class-"+rowindex+"-level"],10)||0;
						hd = parseInt(v["class-"+rowindex+"-hd"],10)||0;
						currrowhp = parseInt(v["class-"+rowindex+"-hp"],10)||0;
						fchp =  parseInt(v["class-"+rowindex+"-fchp"],10)||0;
						if ((level >0 && hd > 0)||(maxFirst===0 && rowUpdated!==-1 && rowUpdated !== parseInt(rowindex,10))){
							rowhp = PFUtils.getAvgHP(level,hd,mult,maxFirst) ;
							//TAS.debug("adding "+rowhp +" + " + fchp);
							totalhp += rowhp + fchp;
							if (rowhp !== currrowhp){
								setter["class-"+rowindex+"-hp"]=rowhp;
							}
							if (maxFirst){ maxFirst = 0;}
						} else {
							totalhp += currrowhp + fchp;
							//TAS.debug"adding "+currrowhp +" + " + fchp);
						}
					});
					if (totalhp !== parseInt(v['total-hp'],10)){
						loudSetter["total-hp"]= totalhp;
					}
				}
			} catch (err){
				TAS.error("autoCalcClassHpGrid",err);
			} finally {
				if (_.size(loudSetter)>0){
					setAttrs(loudSetter);
				}
				if (_.size(setter)>0){
					setAttrs(setter,PFConst.silentParams,done);
				} else {
					done();
				}
			}
		});
		
	},
	migrate = function (callback){
		callback();
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFClassRaceGrid.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		numcols = classColumns.length,
		columnDone = _.after(numcols, function(){
			autoCalcClassHpGrid(done,silently);
		});
		_.each(classColumns, function (col) {
			PFClassRaceGrid.updateClassInformation(col, columnDone, silently);
		});
		setMulticlassed();
	},
	events = {
		basehp: "change:auto_calc_hp change:autohp_percent change:maxhp_lvl1 ",
		racialhp: "change:npc-hd-num change:npc-hd ",
		perClassRowhp: "change:class-REPLACE-level change:class-REPLACE-hd "
	},
	registerEventHandlers = function () {
		var tempString="";
		_.each(classColumns, function (col) {
			var eventsToWatch = _.map(classRows, function (row) {
				return "change:class-" + row + "-" + col;
			}).join(" ");
			on(eventsToWatch, TAS.callback(function eventTotalClassInformation(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && eventInfo.sourceAttribute.slice(-2)==='hp'  )) {
					updateClassInformation(col, eventInfo);
				}
			}));
			if (col === "level") {
				on(eventsToWatch, TAS.callback(function eventTotalClassInformationLevel(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
						updateClassInformation("skill", eventInfo);
						setMulticlassed();
					}
				}));
			}
		});
		_.each(raceColumns, function (col) {
			on("change:npc-" + col, TAS.callback(function eventUpdateRacialRow(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && eventInfo.sourceAttribute.slice(-2)==='hp')) {
					if (col === 'hd-num') {
						updateClassInformation('level', eventInfo);
					} else {
						updateClassInformation(col, eventInfo);
					}
				}
			}));
		});
		_.each(classRows,function(row){
			tempString = events.perClassRowhp.replace(/REPLACE/g,row);
			on(tempString,TAS.callback(function eventUpdateClassHitPoints(eventInfo){
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					autoCalcClassHpGrid(null,null,eventInfo);
					if ( (/level/i).test(eventInfo.sourceAttribute) ) {
						PFSpells.updateCasterFromClassLevel(parseInt(row, 10), eventInfo);
					}
				}
			}));
		});
		on(events.racialhp,TAS.callback(function eventUpdateRacialHitPoints(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				autoCalcClassHpGrid(null,null,eventInfo);
				if (eventInfo.sourceAttribute === "npc-hd-num"){
					PFSpells.updateCasterFromClassLevel(6, eventInfo);
				}
			}
		}));
		on(events.basehp,TAS.callback(function eventHPAutoCalcSwitches(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				autoCalcClassHpGrid();					
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFClassRaceGrid module loaded  ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		events: events,
		migrate: migrate,
		recalculate: recalculate,
		classColumns: classColumns,
		classRows: classRows,
		autoCalcClassHpGrid: autoCalcClassHpGrid,
		updateClassInformation: updateClassInformation
	};
}());
var PFSkills = PFSkills || (function () {
	'use strict';
	var regularCoreSkills = ["Appraise", "Acrobatics", "Bluff", "Climb", "Diplomacy", "Disable-Device", "Disguise", "Escape-Artist", "Fly", "Handle-Animal", "Heal", "Intimidate", "Linguistics", "Perception", "Ride", "Sense-Motive", "Sleight-of-Hand", "Spellcraft", "Stealth", "Survival", "Swim", "Use-Magic-Device"],
	regularBackgroundSkills = ["Appraise", "Handle-Animal", "Linguistics", "Sleight-of-Hand"],
	regularAdventureSkills = ["Acrobatics", "Bluff", "Climb", "Diplomacy", "Disable-Device", "Disguise", "Escape-Artist", "Fly", "Heal", "Intimidate", "Perception", "Ride", "Sense-Motive", "Sleight-of-Hand", "Spellcraft", "Stealth", "Survival", "Swim", "Use-Magic-Device"],
	regularBackgroundSkillsPlusKnow = regularBackgroundSkills.concat(["Knowledge-Engineering", "Knowledge-Geography", "Knowledge-History", "Knowledge-Nobility"]).sort(),
	regularAdventurePlusKnow = regularAdventureSkills.concat(["Knowledge-Arcana", "Knowledge-Dungeoneering", "Knowledge-Local", "Knowledge-Nature", "Knowledge-Planes", "Knowledge-Religion"]).sort(),
	//number that is appended to 10 versions of skills with subskills.
	skillAppendNums = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
	//same but for misc-skill
	miscSkillAppendNums = ["-0", "-1", "-2", "-3", "-4", "-5", "-6", "-7", "-8", "-9"],
	coreSkillsWithFillInNames = ["Craft", "Misc-Skill", "Perform", "Profession"],
	backgroundOnlySkillsWithFillinNames = ["Artistry", "Lore"],
	skillsWithFillInNames = coreSkillsWithFillInNames.concat(backgroundOnlySkillsWithFillinNames).sort(),
	backgroundOnlySkills = SWUtils.cartesianAppend(backgroundOnlySkillsWithFillinNames, skillAppendNums),
	knowledgeSubSkills = ["Arcana", "Dungeoneering", "Engineering", "Geography", "History", "Local", "Nature", "Nobility", "Planes", "Religion"],
	coreSkillsWithSubSkills = coreSkillsWithFillInNames.concat(["Knowledge"]).sort(),
	skillsWithSubSkills = skillsWithFillInNames.concat(["Knowledge"]).sort(),
	knowledgeSkillAppends = _.map(knowledgeSubSkills, function (subskill) {
		return "-" + subskill;
	}),
	//for each skill array of the possible skills {"Craft":["Craft","Craft2"...],"Perform":["Perform","Perform2"...] }
	subskillArrays = _.reduce(skillsWithSubSkills, function (memo, skill) {
		var appenders = (skill === "Misc-Skill") ? miscSkillAppendNums : (skill === "Knowledge") ? knowledgeSkillAppends : skillAppendNums;
		memo[skill] = SWUtils.cartesianAppend([skill], skillAppendNums);
		return memo;
	}, {}),
	backgroundCoreSkills = regularBackgroundSkillsPlusKnow.concat(subskillArrays["Craft"]).concat(subskillArrays["Perform"]).concat(subskillArrays["Profession"]).concat(["Misc-Skill-5", "Misc-Skill-6", "Misc-Skill-7", "Misc-Skill-8", "Misc-Skill-9"]).sort(),
	adventureSkills = regularAdventurePlusKnow.concat(["Misc-Skill-0", "Misc-Skill-1", "Misc-Skill-2", "Misc-Skill-3", "Misc-Skill-4"]).sort(),
	
	checkRTArray = ["-ReqTrain", "-ranks"],
	baseGenMacro = "/w \"@{character_name}\" &{template:pf_generic} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic-skill}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} ",
	skillHeaderMacro = "{{name=^{REPLACELOWER} ^{skills} }} ",
	npcSkillHeaderMacro = "{{name=^{npc} ^{REPLACELOWER} ^{skills} }} ",
	//  1 is the normal size modifier in size_skill, 2 is size_skill_double
	sizeSkills = {
		"Fly": 1,
		"Stealth": 2,
		"CS-Stealth": 2
	},
	//these are for building the macros
	knowledgeSubSkillsTranslateKeys = _.map(knowledgeSubSkills, function (key) {
		return key.toLowerCase();
	}),
	skillsWithSpaces = ["disable device", "escape artist", "sense motive", "handle animal", "use magic device", "sleight of hand"],
	knowledgeSkills = _.map(knowledgeSubSkills, function (subskill) {
		return "Knowledge-" + subskill;
	}),
	backgroundSkills = backgroundCoreSkills.concat(backgroundOnlySkills).sort(),
	allCoreSkills = adventureSkills.concat(backgroundCoreSkills).sort(),
	consolidatedSkills = ["CS-Acrobatics", "CS-Athletics", "CS-Finesse", "CS-Influence", "CS-Nature", "CS-Perception", "CS-Performance", "CS-Religion", "CS-Society", "CS-Spellcraft", "CS-Stealth", "CS-Survival"],
	allNonFillInSkills = regularCoreSkills.concat(knowledgeSkills).concat(consolidatedSkills).sort(),
	nonMiscFillInSkillsInstances = SWUtils.cartesianAppend(["Craft", "Perform", "Profession", "Artistry", "Lore"], skillAppendNums),
	miscFillInSkillsInstances =SWUtils.cartesianAppend(["Misc-Skill"], miscSkillAppendNums),
	allFillInSkillInstances = nonMiscFillInSkillsInstances.concat(miscFillInSkillsInstances).sort(),
	allTheSkills = allNonFillInSkills.concat(allFillInSkillInstances).sort(),
	coreSkillAbilityDefaults = {
		"Acrobatics": "dex",
		"Appraise": "int",
		"Bluff": "cha",
		"Climb": "str",
		"Craft": "int",
		"Diplomacy": "cha",
		"Disable-Device": "dex",
		"Disguise": "cha",
		"Escape-Artist": "dex",
		"Fly": "dex",
		"Handle-Animal": "cha",
		"Heal": "wis",
		"Intimidate": "cha",
		"Knowledge-Arcana": "int",
		"Knowledge-Dungeoneering": "int",
		"Knowledge-Engineering": "int",
		"Knowledge-Geography": "int",
		"Knowledge-History": "int",
		"Knowledge-Local": "int",
		"Knowledge-Nature": "int",
		"Knowledge-Nobility": "int",
		"Knowledge": "int",
		"Knowledge-Planes": "int",
		"Knowledge-Religion": "int",
		"Linguistics": "int",
		"Perception": "wis",
		"Perform": "cha",
		"Profession": "wis",
		"Ride": "dex",
		"Sense-Motive": "wis",
		"Sleight-of-Hand": "dex",
		"Spellcraft": "int",
		"Stealth": "dex",
		"Survival": "wis",
		"Swim": "str",
		"Use-Magic-Device": "cha"
	},
	
	defaultSkillMacro='&{template:pf_generic} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic-skill}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=^{REPLACELOWER}}} {{check=[[ @{skill-query} + [[ @{REPLACE} ]] ]]}} @{REPLACE-ut} @{skill_options} @{REPLACE-cond-notes} {{generic_note=@{REPLACE-note}}}',
	defaultSkillMacroMap = {
		'&{template:':{'current':'pf_generic}'},
		'@{toggle_accessible_flag}':{'current':'@{toggle_accessible_flag}'},
		'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
		'{{color=':{'current':'@{rolltemplate_color}}}'},
		'{{header_image=':{'current':'@{header_image-pf_generic-skill}}}','old':['@{header_image-pf_generic}}}']},
		'{{character_name=':{'current':'@{character_name}}}'},
		'{{character_id=':{'current':'@{character_id}}}'},
		'{{subtitle}}':{'current':'{{subtitle}}'},
		'{{name=':{'current':'^{REPLACELOWER}}}','old':['REPLACE}}','@{REPLACE-name}}}','^{REPLACE}}}']},
		'{{Check=':{'current':'[[ @{skill-query} + [[ @{REPLACE} ]] ]]}}','old':['[[ 1d20 + [[ @{REPLACE} ]] ]]}}'],'replacements':[{'from':'1d20','to':'@{skill-query}'}]},
		'@{REPLACE-ut}':{'current':'@{REPLACE-ut}'},
		'@{skill_options}':{'current':'@{skill_options}'},
		'@{REPLACE-cond-notes}':{'current':'@{REPLACE-cond-notes}'},
		'{{generic_note=':{'current':'@{REPLACE-note}}}'}
	},
	defaultFillInSkillMacro='&{template:pf_generic} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic-skill}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=^{REPLACELOWERREMOVENUMBER} @{REPLACE-name}}} {{check=[[ @{skill-query} + [[ @{REPLACE} ]] ]]}} @{REPLACE-ut} @{skill_options} @{REPLACE-cond-notes} {{generic_note=@{REPLACE-note}}}',
	defaultFillInSkillMacroMap = _.extend(_.clone(defaultSkillMacroMap),{
		'{{name=':{'current':'^{REPLACELOWERREMOVENUMBER} (@{REPLACE-name})}}','old':['REPLACEREMOVENUMBER (@{REPLACE-name})}}','REPLACE}}','@{REPLACE-name}}}'],'replacements':[{'from':'REPLACEREMOVENUMBER','to':'^{REPLACELOWERREMOVENUMBER}'}]}
	}),
	defaultMiscSkillMacro='&{template:pf_generic} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic-skill}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{REPLACE}}} {{check=[[ @{skill-query} + [[ @{REPLACE} ]] ]]}} @{REPLACE-ut} @{skill_options} @{REPLACE-cond-notes} {{generic_note=@{REPLACE-note}}}',
	defaultMiscSkillMacroMap = _.extend(_.clone(defaultSkillMacroMap),{
		'{{name=':{'current':'@{REPLACE}}}','old':['Misc-Skill (@{REPLACE-name})}}']}
	}),
	defaultSkillDeletedMacroAttrs=['{{check=[[ @{skill-query} + [[ @{REPLACE} ]] ]]}}'],
	defaultSkillAttrName='REPLACE-macro',
	keysNeedingReplacing = ['@{REPLACE-cond-notes}','@{REPLACE-ut}'],
	valsNeedingReplacing = ['@{REPLACE-cond-notes}','@{REPLACE-ut}','{{check=','{{generic_note=','{{name='],
	migrateMacros =function(callback){
		var done = _.once(function(){
			TAS.debug("leaving PFSkills.migrateMacros");
			if (typeof callback === "function"){
				callback();
			}
		}),
		doneOne = _.after(3,function(){
			setAttrs({'migrated_skill_macrosv1':1},PFConst.silentParams,done);
		});
		try {
			TAS.debug("at PFSkills.migrateMacros");
			getAttrs(['migrated_skill_macrosv1'],function(v){
				if(! parseInt(v.migrated_skill_macrosv1,10)) {
					//TAS.debug"migrateMacros, calling migrateStaticMacrosMult on regular skills ");
					PFMacros.migrateStaticMacrosMult(doneOne,defaultSkillAttrName,defaultSkillMacro,defaultSkillMacroMap,null,allNonFillInSkills,keysNeedingReplacing,valsNeedingReplacing,false);
					PFMacros.migrateStaticMacrosMult(doneOne,defaultSkillAttrName,defaultFillInSkillMacro,defaultFillInSkillMacroMap,null,nonMiscFillInSkillsInstances,keysNeedingReplacing,valsNeedingReplacing,true);
					PFMacros.migrateStaticMacrosMult(doneOne,defaultSkillAttrName,defaultMiscSkillMacro,defaultMiscSkillMacroMap,null,miscFillInSkillsInstances,keysNeedingReplacing,valsNeedingReplacing,true);
				} else {
					done();
				}
			});
		} catch (err){
			done();
		}
	},

	/**appendToSubSkills - util to append the string to all 10 names of one type of skill (perform, craft, knowledge, etc)
	* adds the numbers from 0-9 or 1-10 or knowledge, then appends the string , to generate all 10 versions.
	* @param {string} skilllist The name of the skill in, member of skillsWithSubSkills
	* @param {string} appendToEnd The string to append.
	* @returns {Array[string]} array of skill names
	*/
	appendToSubSkills = function (skilllist, appendToEnd) {
		return _.reduce(skilllist, function (memo, skill) {
			var appendnums = (skill === "Misc-Skill") ? miscSkillAppendNums : (skill === "Knowledge") ? knowledgeSkillAppends : skillAppendNums,
			appendArray = SWUtils.cartesianAppend([skill], appendnums, appendToEnd);
			return memo.concat(appendArray);
		}, []);
	},
	/* updateMaxSkills Calculates and sets maximum skill ranks. Minimum 1 per level.
	*  divides by 2 if using consolidated skills
	* @param {event} eventInfo - from event 
	* @callback {function} - callback when done
	*/
	updateMaxSkills = function (eventInfo, callback) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		fields=["total-skill", "total-fcskill", "INT-mod", "level", "Max-Skill-Ranks-mod", "Max-Skill-Ranks", 
		"unchained_skills-show", "BG-Skill-Use","npc-skill","npc-hd-num",
		"class-0-skill","class-1-skill","class-2-skill","class-3-skill","class-4-skill","class-5-skill",
		"class-0-level","class-1-level","class-2-level","class-3-level","class-4-level","class-5-level"
		];
		getAttrs(fields, function (v) {
			var intMod = parseInt(v["INT-mod"], 10) || 0,
			classSkills = parseInt(v["total-skill"], 10) || 0,
			level = parseInt(v.level, 10) || 0,
			fcSkills = parseInt(v["total-fcskill"], 10) || 0,
			extra = parseInt(v["Max-Skill-Ranks-mod"], 10) || 0,
			currSkills = parseInt(v["Max-Skill-Ranks"], 10) || 0,
			totIntMod = 0,
			minSkills=0,
			i=0,
			thislvl=0,
			classPlusInt = 0,
			thisSkill=0,
			totAllSkills = 0,
			setter = {};
			try {
				for(i=0;i<6;i++){
					thislvl=parseInt(v['class-'+i+'-level'],10)||0;
					if (thislvl>0){
						thisSkill=( (parseInt(v['class-'+i+'-skill'],10)||0) * thislvl ) + (intMod * thislvl);
						if (thisSkill < thislvl){
							thisSkill=thislvl;
						}
						classPlusInt += thisSkill;
					}
				}
				thislvl = parseInt(v['npc-hd-num'],10)||0;
				thisSkill = parseInt(v['npc-skill'],10)||0;
				if (thislvl && thisSkill){
					thisSkill = thislvl * thisSkill + intMod * thislvl;
					if (thisSkill < thislvl){
						thisSkill=thislvl;
					}
					classPlusInt +=  thisSkill;
				}
				if (v["unchained_skills-show"] == "1" && (!v["BG-Skill-Use"] || v["BG-Skill-Use"] == "0")) {
					classPlusInt = Math.floor(classPlusInt / 2);
				}
				totAllSkills = classPlusInt + extra;
				if (totAllSkills < level){
					totAllSkills = level;
				}
				totAllSkills += fcSkills;
				if (currSkills !== totAllSkills) {
					setter["Max-Skill-Ranks"] = totAllSkills;
				}
			} catch (err) {
				TAS.error("PFSkills.updateMaxSkills", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {
						silent: true
					}, done);
				} else {
					done();
				}
			}
		});
	},
	/** verifyHasSkill - Checks to see if skill is in list of valid skills for this character (consolidated, background, core).
	* @param {string} skill = the skill name
	* @param {function} callback = a function that takes a a boolean as a first parameter.
	*   called with true if skill is part of valid list, or false if not.
	*/
	verifyHasSkill = function (skill, callback) {
		var first3 = '',
			first4 = '',
			core = false,
			bg = false,
			cs = false,
			isSub = false,
			fields = ["BG-Skill-Use", "unchained_skills-show"];
		try {
			if (skill && typeof callback === "function") {
				first4 = skill.slice(0, 4).toLowerCase();
				first3 = first4.slice(0, 3);
				if (first3 === 'cs-') {
					cs = true;
				} else if (first4 === 'arti' || first4 === 'lore') {
					bg = true;
				} else {
					core = true;
				}
				if (_.contains(allFillInSkillInstances, skill)) {
					isSub = true;
					fields = fields.concat([skill + "-name", skill + "-ranks"]);
				}
				getAttrs(fields, function (v) {
					var retval = false,
					usesBG=parseInt(v["BG-Skill-Use"],10)||0,
					usesUnchained=parseInt(v["unchained_skills-show"],10)||0;
					if (!isSub || v[skill + "-name"] || (parseInt(v[skill+"-ranks"],10)||0)>0) {
						if (core) {
							if (!usesUnchained || usesBG) {
								retval = true;
							}
						} else if (bg) {
							if (usesUnchained && usesBG) {
								retval = true;
							}
						} else {
							if (usesUnchained && !usesBG) {
								retval = true;
							}
						}
					}
					callback(retval);
				});
			}
		} catch (err) {
			TAS.error("PFSkills.verifyHasSkill", err);
			callback(false);
		}
	},
	/** updates one  skill row
	* @param {string} skill to update, must have same capitalization as on HTML
	* @param {function} callback = callback after done with params newvalue, oldvalue.
	* @param {boolean} silently = whether to update silently or not. ignored, always silent.
	*/
	updateSkill = function (skill, callback, silently) {
		var done = function (newVal, oldVal) {
			if (typeof callback === "function") {
				callback(newVal, oldVal);
			}
		},
		csNm = skill + "-cs",
		ranksNm = skill + "-ranks",
		classNm = skill + "-class",
		abNm = skill + "-ability",
		modNm = skill + "-ability-mod",
		racialNm = skill + "-racial",
		traitNm = skill + "-trait",
		featNm = skill + "-feat",
		itemNm = skill + "-item",
		miscNm = skill + "-misc-mod",
		utNm = skill + "-ut",
		rtNm = skill + "-ReqTrain";
		getAttrs([skill, csNm, ranksNm, classNm, abNm, modNm, racialNm, traitNm, featNm, itemNm, miscNm, rtNm, utNm, "enforce_requires_training", "size_skill", "size_skill_double", "acp", "checks-cond", "Phys-skills-cond", "Perception-cond"], function (v) {
			var skillSize = 0,
			adj,
			skillTot = 0,
			setter = {},
			params = {},
			mods = "",
			setAny = 0,
			cond = 0,
			cs = parseInt(v[csNm], 10) || 0,
			currSkill = parseInt(v[skill], 10), //no default
			ranks = parseInt(v[ranksNm], 10) || 0,
			rt = parseInt(v[rtNm], 10) || 0,
			allCond = parseInt(v["checks-cond"], 10) || 0,
			abilityName = '',
			physCond = 0,
			perCond = 0,
			watchrt = parseInt(v["enforce_requires_training"], 10) || 0;
			try {
				abilityName = PFUtils.findAbilityInString(v[abNm]);
				if (rt && ranks === 0) {
					if (v[utNm] !== "{{untrained=1}}") {
						setter[utNm] = "{{untrained=1}}";
					}
				} else if (v[utNm] !== "{{untrained=}}") {
					setter[utNm] = "{{untrained=}}"; //cannot set to "" because then it chooses the default which is "{{untrained=1}}"
				}
				if (ranks && cs) {
					skillTot += 3;
					mods = "3/";
				} else {
					mods = "0/";
				}
				if (abilityName === "DEX-mod" || abilityName === "STR-mod") {
					adj = parseInt(v["acp"], 10) || 0;
					skillTot += adj;
					mods += adj + "/";
				} else {
					mods += "0/";
				}
				skillSize = sizeSkills[skill];
				if (skillSize) {
					if (skillSize === 1) {
						adj = parseInt(v["size_skill"], 10) || 0;
						skillTot += adj;
						mods += adj + "/";
					} else if (skillSize === 2) {
						adj = parseInt(v["size_skill_double"], 10) || 0;
						skillTot += adj;
						mods += adj + "/";
					}
				} else {
					mods += "0/";
				}
				if (abilityName === "DEX-mod" || abilityName === "STR-mod") {
					physCond = parseInt(v["Phys-skills-cond"], 10) || 0;
				}
				if (skill === "Perception" || skill === "CS-Perception") {
					perCond = parseInt(v["Perception-cond"], 10) || 0;
				}
				cond = allCond + physCond + perCond;
				mods += cond;
				skillTot += ranks + cond + (parseInt(v[modNm], 10) || 0) + (parseInt(v[racialNm], 10) || 0) + (parseInt(v[traitNm], 10) || 0) + (parseInt(v[featNm], 10) || 0) + (parseInt(v[itemNm], 10) || 0) + (parseInt(v[miscNm], 10) || 0);
				if (currSkill !== skillTot) {
					setter[skill] = skillTot;
				}
				if (v[classNm]  !== mods) {
					setter[classNm] = mods;
				}
			} catch (err) {
				TAS.error(err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {
						silently: true
					}, function () {
						done(skillTot, currSkill);
					});
				} else {
					done(currSkill, currSkill);
				}
			}
		});
	},
	/**recalculateSkillDropdowns recalculates ability dropdowns for all skills in list silently
	* @param {Array} skills list of skills
	* @param {function} callback callback when done
	* @param {function} errorCallback callback if error encountered creating field list to get.
	*/
	recalculateSkillDropdowns = function (skills, callback, errorCallback) {
		var doneDrop = _.once(function () {
			TAS.debug("Leaving PFSkills.recalculateSkillDropdowns");
			if (typeof callback === "function") {
				callback();
			}
		}),
		fields = ["STR-mod", "DEX-mod", "CON-mod", "INT-mod", "WIS-mod", "CHA-mod"];
		try {
			fields = _.reduce(skills, function (memo, skill) {
				memo.push(skill + "-ability");
				memo.push(skill + "-ability-mod");
				return memo;
			}, fields);
		} catch (err) {
			TAS.error("PFSkills.recalculateSkillDropdowns could not create field list", err);
			if (typeof errorCallback === "function") {
				errorCallback();
			}
			return;
		}
		//first do all dropdowns at once
		getAttrs(fields, function (v) {
			var setter = {},
			abilityMods;
			try {
				//create short list of 6 modifiers. 
				abilityMods = _.reduce(PFAbilityScores.abilitymods, function (memo, mod) {
					memo[mod] = parseInt(v[mod], 10) || 0;
					return memo;
				}, {});
				setter = _.reduce(skills, function (memo, skill) {
					try {
						var ability = PFUtils.findAbilityInString(v[skill + "-ability"]),
						newval = abilityMods[ability];
						if (!(newval === undefined || newval === null || ability !== "") && (newval !== parseInt(v[skill + "-ability-mod"], 10) || 0)) {
							memo[skill + "-ability-mod"] = newval;
						}
					} catch (err) {
						TAS.error("PFSkills.recalculateSkillDropdowns INSIDE REDUCE " + skill, err);
					} finally {
						return memo;
					}
				}, setter);
			} catch (err2) {
				TAS.error("PFSkills.recalculateSkillDropdowns inner", err2);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {
						silent: true
					}, doneDrop);
				} else {
					doneDrop();
				}
			}
		});
	},
	/** recalculateSkillArray recalculates skills first dropdown, then misc mod, then skill total.
	* calls updateSkill for each. Does all dropdowns at once since they are easy to merge into one.
	* @param {Array} skills array of skills to update.
	* @param {function} callback when done
	* @param {boolean} silently whether to call setAttrs of skill total with silent or not.
	*/
	recalculateSkillArray = function (skills, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		skillCount = _.size(skills),
		skillsHandled = 0,
		doneMisc = function (skill) {
			//TAS.debug("PFSkills.recalculateSkillArray done with misc skills call updateSkill on "+skill);
			//final: update each skill
			updateSkill(skill, done, silently);
		},
		doneDrop = function () {
			//second do misc one by one (since it is asynchronous)
			_.each(skills, function (skill) {
				SWUtils.evaluateAndSetNumber(skill + "-misc", skill + "-misc-mod", 0, function () {
					doneMisc(skill);
				}, true);
			});
		};
		recalculateSkillDropdowns(skills, doneDrop, done);
	},
	recalculateSkills = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["unchained_skills-show", "BG-Skill-Use"], function (v) {
			try {
				if (v["unchained_skills-show"] == "1") {
					if (v["BG-Skill-Use"] == "1") {
						//TAS.debug"PFSkills.recalculate: has background skills");
						recalculateSkillArray(backgroundOnlySkills, null, silently);
						//return after long one
						recalculateSkillArray(allCoreSkills, done, silently);
					} else {
						//TAS.debug"PFSkills.recalculate: has consolidatedSkills skills");
						recalculateSkillArray(consolidatedSkills, done, silently);
					}
				} else {
					//TAS.debug"PFSkills.recalculate: has core skills skills");
					recalculateSkillArray(allCoreSkills, done, silently);
				}
			} catch (err) {
				TAS.error("PFSKills.recalculate", err);
				done();
			}
		});
	},
	/** updates the macros for only the 7 subskill rolltemplates 
	* @param {boolean} background -if background skills turned on
	* @param {boolean} rt - if Enforce Requires Training checked 
	* @param {event} eventInfo ?
	* @param {jsobject_map} currMacros map of parent skill button name to command macro. (knowledge, Perform, etc)
	* @param {boolean} isNPC - if sheet is NPC
	* @param {boolean} showBonus - if skill total should be displayed on button.
	*/
	updateSubSkillMacroBook = function (background, rt, eventInfo, currMacros, isNPC, showBonus) {
		var headerString = isNPC ? npcSkillHeaderMacro : skillHeaderMacro,
		skillPrefix = isNPC ? "NPC-" : "",
		assembleSubSkillButtonArray = function (skill, shouldEnforce, v) {
			var appendnums = (skill === "Misc-Skill") ? miscSkillAppendNums : (skill === "Knowledge") ? knowledgeSkillAppends : skillAppendNums,
			subskills = SWUtils.cartesianAppend([skill], appendnums),
			firstPass = [];
			if (skill === "Knowledge") {
				firstPass = subskills;
				return firstPass; //knowledge rollable even if untrained
			}
			firstPass = _.filter(subskills, function (subskill) {
				if (v[subskill + "-name"]) {
					return true;
				}
				return false;
			});
			if (!shouldEnforce) {
				return firstPass;
			}
			return _.filter(firstPass, function (skill) {
				if ((parseInt(v[skill + "-ReqTrain"], 10) || 0) === 0 || (parseInt(v[skill + "-ranks"], 10) || 0) > 0) {
					return true;
				}
				return false;
			});
		},
		getKnowledgeButtonMacro = function (showBonus) {
			var bonusStr = showBonus ? "+ @{REPLACE}" : "",
			knowledgebutton = "[^{REPLACENAME}" + bonusStr + "](~@{character_id}|" + skillPrefix + "REPLACE-check) ";
			return headerString.replace('REPLACELOWER', 'knowledge') + "{{ " + _.reduce(knowledgeSubSkillsTranslateKeys, function (memo, subskill, idx) {
				memo += knowledgebutton.replace(/REPLACENAME/g, subskill).replace(/REPLACE/g, knowledgeSkills[idx]);
				return memo;
			}, "") + " }}";
		},
		getSubSkillButtonMacro = function (skill, skillArray, showBonus,v) {
			var skillTransKey = skill.toLowerCase(),
			bonusStr = showBonus ? "+ @{REPLACE}" : "",
			baseMacro = headerString.replace('REPLACELOWER', skillTransKey),
			singleRowButton = "[REPLACENAME" + bonusStr + "](~@{character_id}|" + skillPrefix + "REPLACE-check) ",
			tempstr = "";
			if (skill === "Knowledge") {
				return getKnowledgeButtonMacro();
			}
			tempstr = _.reduce(skillArray, function (memo, subskill, idx) {
				var buttonName = v[subskill+"-name"];
				if (buttonName){
					buttonName = SWUtils.escapeForChatLinkButton(buttonName);
					buttonName = SWUtils.escapeForRollTemplate(buttonName);
				} else {
					buttonName = "@{"+subskill+"-name}";
				}
				memo += singleRowButton.replace(/REPLACENAME/g, buttonName).replace(/REPLACE/g, subskill);
				return memo;
			}, "");
			if (!tempstr) {
				tempstr = "description = ^{no-skills-available}";
			}
			return baseMacro + "{{ " + tempstr + " }}";
		},
		subskillParents = background ? skillsWithFillInNames : coreSkillsWithFillInNames,
		allsubskillFields = appendToSubSkills(subskillParents, ["-name"]);
		if (rt) {
			allsubskillFields = allsubskillFields.concat(
			appendToSubSkills(subskillParents, checkRTArray)
			);
			allsubskillFields = allsubskillFields.sort();
			//allsubskillFields.concat(appendToSubSkills(subskillParents, checkRTArray)).sort();
		}
		//TAS.debug("updateSubSkillMacroBook: allsubskillFields are:", allsubskillFields);
		getAttrs(allsubskillFields, function (v) {
			var setter = {},
			tempKMac = "";
			//TAS.debug("updateSubSkillMacroBook: event and data are:", eventInfo, v);
			_.each(subskillParents, function (skill) {
				var canshowarray = assembleSubSkillButtonArray(skill, rt, v),
				tempMacro = getSubSkillButtonMacro(skill, canshowarray, showBonus,v);
				tempMacro = baseGenMacro + tempMacro;
				if (currMacros[skillPrefix + skill.toLowerCase() + "_skills-macro"] !== tempMacro) {
					setter[skillPrefix + skill.toLowerCase() + "_skills-macro"] = tempMacro;
				}
			});
			if (currMacros[skillPrefix + "knowledge_skills-macro"]) {
				tempKMac = baseGenMacro + getKnowledgeButtonMacro(showBonus);
				if (currMacros[skillPrefix + "knowledge_skills-macro"] !== tempKMac) {
					setter[skillPrefix + "knowledge_skills-macro"] = tempKMac;
				}
			}
			if (_.size(setter) > 0) {
				setAttrs(setter, PFConst.silentParams);
			}
		});
	},
	assembleSkillButtonArray = function (skills, shouldEnforce, sv) {
		if (!shouldEnforce) {
			return skills;
		}
		return _.filter(skills, function (skill) {
			if (/^Knowled|^Linguis|^Sleight/i.test(skill.slice(0, 7)) || (parseInt(sv[skill + "-ReqTrain"],10)||0) !== 1 || (parseInt(sv[skill + "-ranks"], 10) || 0) > 0) {
				return true;
			}
			return false;
		});
	},
	getSkillButtonMacro = function (name, skillArray, showBonus, isNPC) {
		var skillTransKey = name.toLowerCase(),
		skillPrefix = isNPC ? "NPC-" : "",
		bonusStr = showBonus ? " + @{REPLACE}" : "",
		baseMacro = "{{name= ^{" + skillTransKey + "} }} ",
		npcBaseMacro = "{{name= ^{npc} ^{" + skillTransKey + "} }} ",
		rowbutton = "[^{REPLACELOWER}" + bonusStr + "](~@{character_id}|" + skillPrefix + "REPLACE-check) ",
		subskillbutton = "[^{REPLACELOWER}](~@{character_id}|" + skillPrefix + "REPLACELOWERMAC_skills_buttons_macro) ",
		baseToSend = isNPC?npcBaseMacro:baseMacro, 
		tempstr="";
		try {
			tempstr = _.reduce(skillArray, function (memo, skill, idx) {
				var thistranskey = skill.toLowerCase(),
				thisbutton = (_.contains(skillsWithSubSkills, skill)) ? subskillbutton : rowbutton;
				thisbutton = thisbutton.replace(/REPLACELOWERMAC/g, thistranskey);
				thisbutton = thisbutton.replace(/REPLACELOWER/g, thistranskey);
				thisbutton = thisbutton.replace(/REPLACE/g, skill);
				memo += thisbutton + " ";
				return memo;
			}, "");
			if (!tempstr) {
				tempstr = "^{no-skills-available} ";
			}
		} finally {
			return baseToSend + "{{ " + tempstr + "}}";
		}
	},
	resetOneCommandMacro = function(callback, eventInfo, isNPC,showBonus,unchained,background,consolidated,rt){
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		skillPrefix = isNPC ? "NPC-" : "";
		getAttrs([skillPrefix+"skills-macro", skillPrefix+"background_skills-macro", skillPrefix+"adventure_skills-macro", 
				skillPrefix+"artistry_skills-macro", skillPrefix+"lore_skills-macro", skillPrefix+"craft_skills-macro", skillPrefix+"knowledge_skills-macro",
				skillPrefix+"perform_skills-macro", skillPrefix+"profession_skills-macro", skillPrefix+"misc-skill_skills-macro"], function (v) {
			var i = 0,
			setter = {},
			tempSkillArray = [],
			tempMacro = "",
			allskillstitle = "skills",
			coreArray;
			if (!consolidated) {
				updateSubSkillMacroBook(background, rt, eventInfo, v, isNPC, showBonus);
				//skills without sub skills
				if (rt) {
					getAttrs(SWUtils.cartesianAppend(regularCoreSkills, checkRTArray), function (v) {
						var canshowarray = [],
						tempRTMacro = "",
						temparray = [];
						try {
							if (background) {
								canshowarray = assembleSkillButtonArray(regularBackgroundSkills, rt, v) || [];
								temparray = temparray.concat(canshowarray);
								canshowarray = canshowarray.concat(skillsWithSubSkills).sort();
								tempRTMacro = baseGenMacro + getSkillButtonMacro("background-skills", canshowarray, showBonus, isNPC);
								if (v[skillPrefix + "background_skills-macro"] !== tempRTMacro) {
									setter[skillPrefix + "background_skills-macro"] = tempRTMacro;
								}
								canshowarray = assembleSkillButtonArray(regularAdventureSkills, rt, v) || [];
								temparray = temparray.concat(canshowarray);
								canshowarray = canshowarray.concat(["Knowledge","Misc-Skill"]).sort();
								tempRTMacro = baseGenMacro + getSkillButtonMacro("adventure-skills", canshowarray, showBonus, isNPC);
								if (v[skillPrefix + "adventure_skills-macro"] !== tempRTMacro) {
									setter[skillPrefix + "adventure_skills-macro"] = tempRTMacro;
								}
								temparray = temparray.concat(skillsWithSubSkills).sort();
							} else {
								canshowarray = assembleSkillButtonArray(regularCoreSkills, rt, v) || [];
								temparray = temparray.concat(canshowarray).concat(coreSkillsWithSubSkills).sort();
							}
							tempRTMacro = baseGenMacro + getSkillButtonMacro("skills", temparray, showBonus, isNPC);
							if (v[skillPrefix + "skills-macro"] !== tempRTMacro) {
								setter[skillPrefix + "skills-macro"] = tempRTMacro;
							}
						} catch (errRT){
							TAS.error("PFSkills.resetOneCommandMacro errRT",errRT);
						} finally {
							if (_.size(setter) > 0) {
								setAttrs(setter, PFConst.silentParams, done);
							} else {
								done();
							}
						}
					});
				} else {
					try {
						coreArray = regularCoreSkills.concat(coreSkillsWithSubSkills);
						//no require training
						if (background) {
							coreArray = coreArray.concat(["Artistry", "Lore"]).sort();
							allskillstitle = "all-skills";
							tempSkillArray = regularBackgroundSkills.concat(skillsWithSubSkills).sort();
							tempMacro = getSkillButtonMacro("background-skills", tempSkillArray, showBonus, isNPC);
							setter[skillPrefix + "background_skills-macro"] = baseGenMacro + tempMacro;
							tempSkillArray = regularAdventureSkills.concat(["Knowledge"]).sort();
							tempMacro = getSkillButtonMacro("adventure-skills", tempSkillArray, showBonus, isNPC);
							setter[skillPrefix + "adventure_skills-macro"] = baseGenMacro + tempMacro;
						}
						tempMacro = baseGenMacro + getSkillButtonMacro(allskillstitle, coreArray, showBonus, isNPC);
						if (v[skillPrefix + "skills-macro"] !== tempMacro) {
							setter[skillPrefix + "skills-macro"] = tempMacro;
						}
					} catch (errReg){
						TAS.error("PFSkills.resetOneCommandMacro errReg",errReg);
					} finally {
						if (_.size(setter>0)){
							setAttrs(setter,PFConst.silentParams, done);
						} else {
							done();
						}
					}
				}
			} else {
				//consolidated
				if (rt) {
					getAttrs(SWUtils.cartesianAppend(consolidatedSkills, ["-ReqTrain", "-ranks"]), function (sv) {
						var canshowarray, setter = {}, tempMacro ;
						canshowarray = assembleSkillButtonArray(consolidatedSkills, rt, sv);
						tempMacro = getSkillButtonMacro("skills", canshowarray, showBonus);
						setter[skillPrefix + "consolidated_skills-macro"] = baseGenMacro + tempMacro;
						setAttrs(setter,PFConst.silentParams, done);
					});
				} else {
					tempMacro = getSkillButtonMacro("skills", consolidatedSkills, showBonus);
					setter[skillPrefix + "consolidated_skills-macro"] = baseGenMacro + tempMacro;
					setAttrs(setter,PFConst.silentParams, done);
				}
			}
		});
	},
	resetCommandMacro = function (eventInfo, callback) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["BG-Skill-Use", "unchained_skills-show", "enforce_requires_training", "is_npc", "include_skill_totals"],function(vout){
			var isNPC = parseInt(vout["is_npc"], 10) || 0,
			skillPrefix = isNPC ? "NPC-" : "",
			showBonus = parseInt(vout.include_skill_totals, 10) || 0,
			unchained = parseInt(vout["unchained_skills-show"], 10) || 0,
			background = unchained && (parseInt(vout["BG-Skill-Use"], 10) || 0),
			consolidated = unchained && (!background),
			rt = parseInt(vout["enforce_requires_training"], 10) || 0;
			resetOneCommandMacro(done,eventInfo,isNPC,showBonus,unchained,background,consolidated,rt);
			if (isNPC){
				resetOneCommandMacro(done,eventInfo,false,showBonus,unchained,background,consolidated,rt);
			}
		});
	},
	applyConditions = function (callback,silently,eventInfo){
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		},		
		updateSkillArray  = function(skills){
			_.each(skills,function(skill){
				updateSkill(skill);
			});
		};
		//TAS.debug("at apply conditions");
		getAttrs(["unchained_skills-show", "BG-Skill-Use"], function (v) {
			try {
				if (v["unchained_skills-show"] == "1") {
					if (v["BG-Skill-Use"] == "1") {
						//TAS.debug("PFSkills.recalculate: has background skills");
						updateSkillArray(backgroundOnlySkills);
						//return after long one
						updateSkillArray(allCoreSkills);
					} else {
						//TAS.debug("PFSkills.recalculate: has consolidatedSkills skills");
						updateSkillArray(consolidatedSkills);
					}
				} else {
					//TAS.debug("PFSkills.recalculate: has core skills skills");
					updateSkillArray(allCoreSkills);
				}
			} catch (err) {
				TAS.error("PFSKills.applyConditions", err);
				done();
			}
		});
	},
	/** migrate skills
	* @param {function} callback callback when done
	* @param {number} oldversion old version , -1 if hit recalc
	*/
	migrate = function (callback, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFSkills.migrate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneOne = _.after(3,done),
		/** migrateOldClassSkillValue - converts class skill checkboxes from old autocalc string to number "" or 3.
		* @param {function} callback ?
		* @param {number} oldversion ?
		*/
		migrateOldClassSkillValue = function (callback, oldversion) {
			var done = _.once(function () {
				if (typeof callback === "function") {
					callback();
				}
			}),
			migrateClassSkill = function (skill) {
				var csNm = skill + "-cs";
				getAttrs([csNm], function (v) {
					var cs = 0,
					setter = {};
					cs = parseInt(v[csNm], 10);
					if (isNaN(cs)) {
						if (v[csNm] == "0") {
							cs = 0;
						} else if (v[csNm] && (parseInt(v[csNm], 10) || 0) !== 3) {
							cs = 3;
						} else if (!v[csNm]) {
							cs = 0;
						}
						if (cs === 3) {
							//TAS.debug({"function":"migrateClassSkill","raw":v[csNm],"cs":cs});
							setter[csNm] = cs;
							setAttrs(setter, PFConst.silentParams);
						}
					}
				});
			},
			migrateClassSkillArray = function (skills) {
				skills.forEach(function (skill) {
					migrateClassSkill(skill);
				});
			},
			determineArray = function () {
				migrateClassSkillArray(allTheSkills);
				//not bothering to code correctly to wait since this is almost a year old.
				setAttrs({classSkillsMigrated: 1}, PFConst.silentParams,done);
			};
			getAttrs(["classSkillsMigrated"], function (vm) {
				if (!(parseInt(vm.classSkillsMigrated, 10) || 0)) {
					determineArray();
				}
				done();
			});
		},
		/** setAdvancedMacroCheckbox - part of migrate .66 to 1.00 sets checkbox to unhide advanced
		* skillmacro (investigator) if character sheet already using it.)
		* @param {function} callback ?
		*/
		setAdvancedMacroCheckbox = function (callback) {
			var done = _.once(function () {
				if (typeof callback === "function") {
					callback();
				}
			});
			getAttrs(["adv_macro_show", "skill-invest-query"], function (v) {
				var showAdv = parseInt(v.adv_macro_show, 10) || 0;
				if (v["skill-invest-query"] && !showAdv) {
					setAttrs({adv_macro_show: 1}, PFConst.silentParams, done);
				}
			});
		};
		TAS.debug("at PFSkills.migrate");
		migrateOldClassSkillValue(doneOne);
		migrateMacros(doneOne);
		PFMigrate.migrateMaxSkills(doneOne);
	},
	/* recalculate - updates ALL skills  - calls PFUtilsAsync.setDropdownValue for ability then updateSkill */
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("leaving PFSkills.recalculate");
			resetCommandMacro();
			if (typeof callback === "function") {
				callback();
			}
		});
		TAS.debug("PFSkills.recalculate");
		migrate(function () {
			//TAS.debug"PFSkills.recalculate back from PFSkills.migrate");
			updateMaxSkills();
			recalculateSkills(done, silently);
		}, oldversion);
	},
	events = {
		skillGlobalEventAuto: "change:checks-cond change:phys-skills-cond change:acp",
		skillEventsAuto: "change:REPLACE-ability-mod change:REPLACE-misc-mod",
		skillEventsPlayer: "change:REPLACE-cs change:REPLACE-ranks change:REPLACE-racial change:REPLACE-trait change:REPLACE-feat change:REPLACE-item change:REPLACE-ReqTrain"
	},
	registerEventHandlers = function () {
		//SKILLS************************************************************************
		on("change:total-skill change:total-fcskill change:int-mod change:level change:max-skill-ranks-mod change:unchained_skills-show change:BG-Skill-Use", TAS.callback(function eventUpdateMaxSkills(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "sheetworker") {
				updateMaxSkills(eventInfo);
			}
		}));
		on(events.skillGlobalEventAuto, TAS.callback(function eventGlobalConditionAffectingSkill(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event for " + eventInfo.sourceType);
			if (eventInfo.sourceType === "sheetworker") {
				applyConditions(null,null,eventInfo);
			}
		}));		
		//each skill has a dropdown handler and a skill update handler
		//concat them all up, only happens once so no big deal
		_.each(allTheSkills, function (skill) {
			on((events.skillEventsAuto.replace(/REPLACE/g, skill)), TAS.callback(function eventSkillsAuto(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event for " + skill + ", " + eventInfo.sourceType);
				if (eventInfo.sourceType === "sheetworker") {
					verifyHasSkill(skill, function (hasSkill) {
						if (hasSkill) {
							updateSkill(skill, eventInfo);
						}
					});
				}
			}));
			on((events.skillEventsPlayer.replace(/REPLACE/g, skill)), TAS.callback(function eventSkillsPlayer(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event for " + skill + ", " + eventInfo.sourceType);
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					verifyHasSkill(skill, function (hasSkill) {
						if (hasSkill) {
							updateSkill(skill, eventInfo);
						}
					});
				}
			}));
			on("change:" + skill + "-ability", TAS.callback(function eventSkillDropdownAbility(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				verifyHasSkill(skill, function (hasSkill) {
					if (hasSkill) {
						PFUtilsAsync.setDropdownValue(skill + "-ability", skill + "-ability-mod");
					}
				});
			}));
			on("change:" + skill + "-misc", TAS.callback(function eventSkillMacroAbility(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				verifyHasSkill(skill, function (hasSkill) {
					if (hasSkill) {
						SWUtils.evaluateAndSetNumber(skill + "-misc", skill + "-misc-mod");
					}
				});
			}));
			//these always displayed if rt or not
			if (skill.slice(0, 9) !== "Knowledge" && skill !== "Linguistics" && skill !== "Sleight-of-Hand") {
				on("change:" + skill + "-ReqTrain change:" + skill + "-ranks", TAS.callback(function eventSkillRequiresTrainingRanks(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event for " + skill + ", " + eventInfo.sourceType);
					if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
						verifyHasSkill(skill, function (hasSkill) {
							getAttrs(["enforce_requires_training"], function (v) {
								if (v.enforce_requires_training == "1") {
									resetCommandMacro(eventInfo);
								}
							});
						});
					}
				}));
			}
			//end of skill loop
		});
		//skills affected by size
		_.each(sizeSkills, function (mult, skill) {
			if (mult === 1) {
				on("change:size_skill", TAS.callback(function eventUpdateSizeSkill(eventInfo) {
					if (eventInfo.sourceType === "sheetworker") {
						TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
						updateSkill(skill, eventInfo);
					}
				}));
			} else if (mult === 2) {
				on("change:size_skill_double", TAS.callback(function eventUpdateSizeSkillDouble(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					if (eventInfo.sourceType === "sheetworker") {
						updateSkill(skill, eventInfo);
					}
				}));
			}
		});
		on("change:enforce_requires_training", TAS.callback(function eventRequiresTraining(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				resetCommandMacro(eventInfo);
			}
		}));
		_.each(SWUtils.cartesianAppend(allFillInSkillInstances, ["-name"]), function (skill) {
			on("change:" + skill, TAS.callback(function eventSkillsWithFillInNames(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					var rt = skill.slice(0, -4) + "ReqTrain",
					r = skill.slice(0, -4) + "ranks";
					//if we changed name on a skill that isn't choosable don't bother.
					getAttrs(["enforce_requires_training", rt, r, "unchained_skills-show", "BG-Skill-Use", "artistry_skills-macro", "lore_skills-macro", "craft_skills-macro", "knowledge_skills-macro", "perform_skills-macro", "profession_skills-macro", "misc-skill_skills-macro", "is_npc", "include_skill_totals", "NPC-craft_skills-macro", "NPC-knowledge_skills-macro", "NPC-perform_skills-macro", "NPC-profession_skills-macro", "NPC-misc-skill_skills-macro"], function (v) {
						var isrt = parseInt(v.enforce_requires_training, 10),
						bg = 0,
						isNPC = parseInt(v.is_npc, 10) || 0,
						showBonus = parseInt(v.include_skill_totals, 10) || 0;
						if (!(isrt && parseInt(v[rt], 10) && isNaN(parseInt(v[r], 10)))) {
							bg = isNPC ? 0 : ((parseInt(v["unchained_skills-show"], 10) || 0) && (parseInt(v["BG-Skill-Use"], 10) || 0));
							//TAS.debug"calling updatesubskillmacro: bg:" + bg + ",isrt:" + isrt);
							updateSubSkillMacroBook(bg, isrt, eventInfo, v, isNPC, showBonus);
						}
					});
				}
			}));
		});
		//reset based on config changes
		on("change:unchained_skills-show change:BG-Skill-Use change:include_skill_totals", TAS.callback(function eventResetUnchainedSkills(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				recalculate(eventInfo, function(){resetCommandMacro(eventInfo);});
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFSkills module loaded         ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		migrate: migrate,
		applyConditions:applyConditions,
		backgroundOnlySkills: backgroundOnlySkills,
		allCoreSkills: allCoreSkills,
		skillsWithSpaces: skillsWithSpaces,
		consolidatedSkills: consolidatedSkills,
		coreSkillAbilityDefaults: coreSkillAbilityDefaults,
		allFillInSkillInstances: allFillInSkillInstances,
		sizeSkills: sizeSkills,
		skillsWithSubSkills: skillsWithSubSkills,
		appendToSubSkills: appendToSubSkills,
		resetCommandMacro: resetCommandMacro,
		updateMaxSkills: updateMaxSkills,
		updateSkill: updateSkill,
		updateSubSkillMacroBook: updateSubSkillMacroBook,
		verifyHasSkill: verifyHasSkill
	};
}());
var PFFeatures = PFFeatures || (function () {
	'use strict';
	var 
	featureLists = ["class-ability", "feat", "racial-trait", "trait", "mythic-ability", "mythic-feat",'npc-spell-like-abilities'],
	baseCommandMacro = "/w \"@{character_name}\" &{template:pf_block} @{toggle_attack_accessible} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=^{all-abilities}}} ",
	otherCommandMacros = {
		'class-ability':" [^{original-class-features-list}](~@{character_id}|class-ability_button)",
		'mythic':" [^{mythic-abilities}](~@{character_id}|mythic-ability_button) [^{mythic-feats}](~@{character_id}|mythic-feat_button)",
		'feat':" [^{original-feats-list}](~@{character_id}|REPLACENPCfeat_button)",
		'racial-trait':" [^{original-racial-traits-list}](~@{character_id}|REPLACENPCracial-trait_button)",
		'trait':" [^{original-traits-list}](~@{character_id}|trait_button)",
		'npc-spell-like-abilities': " [^{original-spell-like-abilities-list}](~@{character_id}|npc-spell-like-abilities_button)"
	},
	defaultMacroMap ={
		'feat': 'default',
		'trait': 'default',
		'racial-trait': 'default',
		'class-ability': 'class-ability',
		'mythic-ability': 'mythic-ability',
		'mythic-feat': 'default'
	},
	defaultMacros={
		'default': {
			defaultRepeatingMacro: "&{template:pf_generic} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{name}}} {{description=@{short-description}}}",
			defaultRepeatingMacroMap:{
				'&{template:':{'current':'pf_generic}','old':['pf_block}']},
				'@{toggle_accessible_flag}':{'current':'@{toggle_accessible_flag}'},
				'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
				'{{color=':{'current':'@{rolltemplate_color}}}'},
				'{{header_image=':{'current':'@{header_image-pf_block}}}'},
				'{{character_name=':{'current':'@{character_name}}}'},
				'{{character_id=':{'current':'@{character_id}}}'},
				'{{subtitle}}':{'current':'{{subtitle}}'},
				'{{name=':{'current':'@{name}}}'},
				'{{description=':{'current':'@{short-description}}}','old':[' @{short-description}}}']}},
			defaultDeletedArray: null
		},
		'class-ability': {
			defaultRepeatingMacro: "&{template:pf_block} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{class=**^{class}**: @{class-number}}} {{name=@{name}}} {{description=@{short-description}}}",
			defaultRepeatingMacroMap:{
				'&{template:':{'current':'pf_generic}','old':['pf_block}']},
				'@{toggle_accessible_flag}':{'current':'@{toggle_accessible_flag}'},
				'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
				'{{color=':{'current':'@{rolltemplate_color}}}'},
				'{{header_image=':{'current':'@{header_image-pf_generic}}}'},
				'{{character_name=':{'current':'@{character_name}}}'},
				'{{character_id=':{'current':'@{character_id}}}'},
				'{{subtitle=':{'current':'{{subtitle}}','old':['^{@{rule_category}}}}','Class Ability}}']},
				'{{class=':{'current':'**^{class}**: @{class-number}}}','old':['**Class**: @{class-number}}}'],replacements:[{'from':'Class','to':'class'}]},
				'{{name=':{'current':'@{name}}}'},
				'{{description=':{'current':'@{short-description}}}','old':[' @{short-description}}}']}},
			defaultDeletedArray:['{{Class=**Class**: @{class-number}}}','{{subtitle=^{@{rule_category}}}}']
		},
		'mythic-ability': {
			defaultRepeatingMacro: "&{template:pf_block} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_block}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{class=**^{path}**: @{mythic-number}}} {{name=@{name}}} {{description=@{short-description}}}",
			defaultRepeatingMacroMap:{
				'&{template:':{'current':'pf_generic}','old':['pf_block}']},
				'@{toggle_accessible_flag}':{'current':'@{toggle_accessible_flag}'},
				'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
				'{{color=':{'current':'@{rolltemplate_color}}}'},
				'{{header_image=':{'current':'@{header_image-pf_block}}}'},
				'{{character_name=':{'current':'@{character_name}}}'},
				'{{character_id=':{'current':'@{character_id}}}'},		
				'{{subtitle=':{'current':'{{subtitle}}'},
				'{{class=':{'current':'**^{path}**: @{mythic-number}}}','old':['**Path**: @{mythic-number}}}'],replacements:[{'from':'Path','to':'path'}]},
				'{{name=':{'current':'@{name}}}'},
				'{{description=':{'current':'@{short-description}}}','old':[' @{short-description}}}']}},
			defaultDeletedArray: ['{{subtitle}}','{{Class=**Class**: @{class-number}}}']
		},
		'spell-like-ability': {
			defaultRepeatingMacro: '@{NPC-whisper} &{template:pf_generic} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{name}}} {{^{level}=[[@{level}]]}} {{^{range}=@{range}}} {{^{duration}=@{duration}}} {{^{save}=@{save}, ^{difficulty-class-abbrv} [[@{savedc}]]}} {{^{spell-resistance-abbrv}=@{abil-sr}}} {{description=@{short-description}}}',
			defaultRepeatingMacroMap:{'@{NPC-whisper}':{'current':'@{NPC-whisper}'},
				'&{template:':{'current':'pf_generic}'},
				'@{toggle_accessible_flag}':{'current':'@{toggle_accessible_flag}'},
				'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
				'{{color=':{'current':'@{rolltemplate_color}}}'},
				'{{header_image=':{'current':'@{header_image-pf_block}}}'},
				'{{character_name=':{'current':'@{character_name}}}'},
				'{{character_id=':{'current':'@{character_id}}}'},
				'{{name=':{'current':'@{name}}}'},
				'{{subtitle=':{'current':'{{subtitle}}','old':['^{@{rule_category}}}}','Class Ability}}']},
				'{{^{level}=':{'current':'@{level}}}','old':['[[@{spell_level}]]}}']},
				'{{^{range}=':{'current':'@{range}}}','old':['^{@{range_pick}} [[@{range_numeric}]]}}']},
				'{{^{duration}=':{'current':'@{duration}}}'},
				'{{^{save}=':{'current':'@{save}}}','old':['@{save}, ^{difficulty-class-abbrv} [[@{savedc}]]}}']},
				'{{^{spell-resistance-abbrv}=':{'current':'@{sr}}}','old':['^{@{abil-sr}}}}']},
				'{{description=':{'current':'@{short-description}}}','old':[' @{short-description}}}']}},
			defaultDeletedArray: ['{{Level=@{level}}}','{{Range=@{range}}}','{{Duration=@{duration}}}','{{Save=@{save}}}','{{SR=@{sr}}}',
					'{{^{frequency}=@{used}/@{used|max} ^{@{frequency}} @{rounds_between}}}','{{^{frequency}=@{used}/@{used|max} ^{@{frequency}}}}','{{subtitle=^{@{rule_category}}}}']
		}
	},
	/** resetTopCommandMacro sets orig_ability_header_macro  (macro to plug into pf_block, read by PFAbility.resetCommandMacro)
	*@param {function} callback call when done	
	*/
	resetTopCommandMacro=function(callback){
		var done = _.once(function () {
			TAS.debug("leaving PFFeatures.resetTopCommandMacro");
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["is_npc","NPC-orig_ability_header_macro","orig_ability_header_macro","mythic-adventures-show","use_traits","use_racial_traits","use_feats","use_class_features","use_spell-like-abilities"],function(v){
			var isMythic = 0,
			usesTraits=0,
			usesRacialTraits=0,
			hasMythicMacro=0,
			usesFeats=0,
			usesClass=0,
			usesSLAs=0,
			newMacro="",
			isNPC=0,
			prefix="",
			setter={}
			;
			try {
				isNPC=parseInt(v.is_npc,10)||0;
				prefix=isNPC?"NPC-":"";
				isMythic = parseInt(v["mythic-adventures-show"],10)||0;
				usesFeats = parseInt(v["use_feats"],10)||0;
				usesClass = parseInt(v["use_class_features"],10)||0;
				usesTraits = parseInt(v.use_traits,10)||0;
				usesRacialTraits=parseInt(v.use_racial_traits,10)||0;
				usesSLAs = parseInt(v["use_spell-like-abilities"],10)||0;

				newMacro = 
					(usesClass?otherCommandMacros['class-ability']:"") +
					(usesFeats?otherCommandMacros['feat'].replace(/REPLACENPC/g,prefix):"") +
					(usesSLAs?otherCommandMacros['npc-spell-like-abilities']:"") +
					(usesTraits?otherCommandMacros['trait']:"") + 
					(usesRacialTraits?otherCommandMacros['racial-trait'].replace(/REPLACENPC/g,prefix):"") + 
					(isMythic?otherCommandMacros['mythic']:"") ;
				if (newMacro) {
					//no space in front needed for this one
					newMacro = "{{row01=^{original-abilities-menus}}} {{row02=" + newMacro + "}}";
				}
				if (newMacro!==v[prefix+'orig_ability_header_macro']){
					setter[prefix+'orig_ability_header_macro']=newMacro;
				}
				if (isNPC){
					newMacro = 
						(usesClass?otherCommandMacros['class-ability']:"") +
						(usesFeats?otherCommandMacros['feat'].replace(/REPLACENPC/g,''):"") +
						(usesSLAs?otherCommandMacros['npc-spell-like-abilities']:"") +
						(usesTraits?otherCommandMacros['trait']:"") + 
						(usesRacialTraits?otherCommandMacros['racial-trait'].replace(/REPLACENPC/g,''):"") + 
						(isMythic?otherCommandMacros['mythic']:"") ;
					if (newMacro) {
						//no space in front needed for this one
						newMacro = "{{row01=^{original-abilities-menus}}} {{row02=" + newMacro + "}}";
					}
					if (newMacro!==v.orig_ability_header_macro){
						setter['orig_ability_header_macro']=newMacro;
					}
				}
			} catch(err) {
				TAS.error("PFFeatures.resetTopCommandMacro",err);
			}finally {
				if (_.size(setter)>0){
					setAttrs(setter,PFConst.silentParams,done);
				} else {
					done();
				}
			}
		});
	},
	/** resets the chat menu macro for all repeating lists in abilities tab
	*@param {function} callback call when done
	*/
	resetCommandMacro=function(callback){
		var done = _.once(function () {
			TAS.debug("leaving PFFeatures.resetCommandMacro");
			if (typeof callback === "function") {
				callback();
			}
		});
		
		getAttrs(["is_npc","mythic-adventures-show","use_traits","use_racial_traits","use_class_features","use_feats","use_spell-like-abilities"],function(v){
			var isNPC = parseInt(v.is_npc,10)||0,
			featureList = [],
			doneWithOneButton,
			isMythic = 0,
			usesTraits=0,
			usesRacialTraits=0,
			usesFeats=0,
			usesClass=0,
			usesSLAs=0,
			newMacro="",
			numberLists=0,
			setter={};
			try {
				isMythic = parseInt(v["mythic-adventures-show"],10)||0;
				usesFeats = parseInt(v["use_feats"],10)||0;
				usesClass = parseInt(v["use_class_features"],10)||0;
				usesTraits = parseInt(v.use_traits,10)||0;
				usesRacialTraits=parseInt(v.use_racial_traits,10)||0;
				usesSLAs = parseInt(v["use_spell-like-abilities"],10)||0;
				//TAS.debug("at PFFeatures.resetCommandMacro",v);
				if (usesFeats){
					featureList.push('feat');
				}
				if (usesTraits){
					featureList.push('trait');
				}
				if (usesRacialTraits){
					featureList.push('racial-trait');
				}
				if (isMythic){
					featureList = featureList.concat(['mythic-ability','mythic-feat']);
				}
				if (usesClass){
					featureList.push('class-ability');
				}
				if (usesSLAs){
					featureList.push('npc-spell-like-abilities');
				}
				numberLists = _.size(featureList);
				if (numberLists > 0){
					doneWithOneButton = _.after(numberLists,done);
					_.each(featureList,function(section){
						//TAS.debug"PFFeatures.resetCommandMacros calling resetOne for :"+section);
						PFMenus.resetOneCommandMacro(section,isNPC,doneWithOneButton);
						if (isNPC && (section==='racial-trait' || section==='feat'||section==='ability'||section==='item'||
							section==='ex'||section==='sp'||section==='su') ){
							PFMenus.resetOneCommandMacro(section);
						}
					});
				} else {
					done();
				}
			}catch (err){
				TAS.error("PFFeatures.resetCommandMacro",err);
				done();
			} finally {
				resetTopCommandMacro();
			}
		});
	},
	/** recalculateRepeatingMaxUsed - Parses the macro text "...max-calculation" in the repeating items
	* (such as class-abilities, feats, traits, racial-traits)
	* and sets the used|max value.
	* Loops through all rows in the given repeating section.
	* @param {string} section= the name of the section after the word "repeating_"
	* @param {function} callback when done
	* @param {boolean} silently if T then call setAttrs with {silent:true}
	*/
	recalculateRepeatingMaxUsed = function (section, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getSectionIDs("repeating_" + section, function (ids) {
			var totrows = _.size(ids),
			rowdone = _.after(totrows, done);
			if (totrows > 0) {
				_.each(ids, function (id, index) {
					var prefix = "repeating_" + section + "_" + id;
					SWUtils.evaluateAndSetNumber(prefix + "_max-calculation", prefix + "_used_max", 0, rowdone, silently);
				});
			} else {
				done();
			}
		});
	},
	setNewDefaults = function(callback,section){
		var done = _.once(function(){
			TAS.debug("leaving PFFeatures.setNewDefaults");
			if(typeof callback === "function"){
				callback();
			}
		}),
		sectionToDefaultRuleCategoryMap={
			'feat':'feats',
			'trait':'traits',
			'racial-trait':'racial-traits',
			'mythic-ability':'mythic-abilities',
			'mythic-feat':'mythic-feats',
			'class-ability':'class-features',
			'npc-spell-like-abilities': 'spell-like-abilities'
		},	
		defaultabilitytype,defaultrulecategory,defaultshow;
		defaultshow = (section==='class-abilities'||section==='npc-spell-like-abilities')?'1':'0';
		defaultabilitytype= (section==='npc-spell-like-abilities')?'Sp':'not-applicable';
		defaultrulecategory = sectionToDefaultRuleCategoryMap[section]||'';
		getSectionIDs('repeating_'+section,function(ids){
			var setter={};
			try {
				setter = _.reduce(ids,function(m,id){
					var prefix = 'repeating_'+section+'_'+id+'_';
					try {
						m[prefix+'showinmenu']=defaultshow;
						m[prefix+'ability_type']=defaultabilitytype;
						m[prefix+'rule_category']=defaultrulecategory;
					} catch (errin){
						TAS.error("PFFeatures.setNewDefaults error "+section+" id "+id,errin);
					} finally {
						return m;
					}
				},{});
				setter['migrated_featurelists_defaults']=1;
			} catch (err){
				TAS.error("PFFeatures.setNewDefaults error setting defaults for "+section,err);
			} finally {
				if (_.size(setter)>0){
					setAttrs(setter,PFConst.silentParams,done);
				} else {
					done();
				}
			}
		});
	},
	migrateRepeatingMacros = function(callback){
		var done = _.once(function(){
			TAS.debug("leaving PFFeatures.migrateRepeatingMacros");
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneOne = _.after(_.size(featureLists),function(){
			setAttrs({'migrated_feature_macrosv109':1},PFConst.silentParams,done);
		});
		_.each(featureLists,function(section){
			var defaultName = '',defaultMacro='';
			try {
				defaultName = defaultMacroMap[section]||'default';
				defaultMacro=defaultMacros[defaultName];
				if (!defaultMacro){
					TAS.error("cannot find default macro for section "+section);
					doneOne();
					return;
				}
				PFMacros.migrateRepeatingMacros(doneOne,section,'macro-text',defaultMacro.defaultRepeatingMacro,defaultMacro.defaultRepeatingMacroMap,defaultMacro.defaultDeletedArray,'@{PC-Whisper}');
				if(section==='feat'||section==='racial-trait'){
					PFMacros.migrateRepeatingMacros(null,section,'npc-macro-text',defaultMacro.defaultRepeatingMacro,defaultMacro.defaultRepeatingMacroMap,defaultMacro.defaultDeletedArray,'@{NPC-Whisper}');
				}
			} catch (err){
				TAS.error("PFFeatures.migrateRepeatingMacros error setting up "+section,err);
				doneOne();
			}
		});
	},
	migrate = function (callback,oldversion){
		var done = function(){
			TAS.debug("leaving PFFeatures.migrate");
			if (typeof callback === "function"){
				callback();
			}
		},
		afterNewDefaults = function(){
			getAttrs(['migrated_feature_macrosv109'],function(v){
				if(! parseInt(v.migrated_feature_macrosv109,10)){
					migrateRepeatingMacros(done);
				} else {
					done();
				}
			});
		},
		numLists = _.size(featureLists),
		doneOne = _.after(numLists,afterNewDefaults);
		//TAS.debug"at PFFeatures.migrate");
		getAttrs(['migrated_featurelists_defaults'],function(vm){
			var featuremigrated=0,abilitymigrated=0;
			featuremigrated=parseInt(vm['migrated_featurelists_defaults'],10)||0;
			//so current beta is not screwed up:
			if (!featuremigrated) {
				_.each(featureLists,function(section){
					setNewDefaults(doneOne,section);
				});
			} else {
				afterNewDefaults();
			}
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("leaving PFFeatures.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}), numLists, doneWithList, calculateMaxUses, callRecalcSLAs;
		try {
			//TAS.debug("at PFFeatures.recalculate");
			numLists = _.size(PFConst.repeatingMaxUseSections);
			doneWithList = _.after(numLists, function(){
				resetCommandMacro(done);
			});
			calculateMaxUses = function(){
				_.each(PFConst.repeatingMaxUseSections, function (section) {
					recalculateRepeatingMaxUsed(section, TAS.callback(doneWithList), silently);
				});
			};
			migrate(TAS.callback(calculateMaxUses),oldversion);
		} catch (err) {
			TAS.error("PFFeatures.recalculate, ", err);
			done();
		}
	},
	events = {
		commandMacroFields:["name","used","used_max","showinmenu"]
	},
	registerEventHandlers = function () {
		var tempstr="";
		//GENERIC REPEATING LISTS USED MAX

		_.each(PFConst.repeatingMaxUseSections, function (section) {
			var maxEvent = "change:repeating_" + section + ":max-calculation";
			on(maxEvent, TAS.callback(function eventRepeatingMaxUseSections(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				SWUtils.evaluateAndSetNumber("repeating_" + section + "_max-calculation", "repeating_" + section + "_used_max");
			}));
		});

		on("change:mythic-adventures-show change:use_traits change:use_racial_traits change:use_class_features change:use_feats change:use_spell-like-abilities", TAS.callback(function eventEnableMythicConfig(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" ) {
				resetTopCommandMacro(null,eventInfo);
			}
		}));

		_.each(featureLists, function (section) {
			var macroEvent = "remove:repeating_"+section+" ",
				singleEvent = "change:repeating_" + section + ":";

			macroEvent = _.reduce(events.commandMacroFields,function(m,a){
				m+= singleEvent + a + " ";
				return m;
			},macroEvent);
			on (macroEvent, TAS.callback(function eventRepeatingCommandMacroUpdate(eventInfo){
				var attr;
				attr = SWUtils.getAttributeName(eventInfo.sourceAttribute);
				if ( eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && attr==='used_max')) {
					attr='repeating_'+section+'_showinmenu';
					getAttrs([attr,'is_npc'],function(v){
						var isNPC=parseInt(v.is_npc,10)||0;
						if (parseInt(v[attr],10)===1){
							PFMenus.resetOneCommandMacro(section,isNPC);
						}
					});
				}
			}));
		});
		
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFFeatures module loaded       ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		migrate: migrate,
		recalculateRepeatingMaxUsed: recalculateRepeatingMaxUsed,
		resetCommandMacro:resetCommandMacro,
		resetTopCommandMacro:resetTopCommandMacro
	};
}());
var PFAbility = PFAbility || (function () {
	'use strict';
	var 
	optionFields= ['is_sp','hasposrange','hasuses','hasattack','abil-attacktypestr'],
	optionRepeatingHelperFields =['ability_type','range_numeric','frequency','abil-attack-type'],
	allOptionRepeatingFields=optionFields.concat(optionRepeatingHelperFields),
	tabRuleSorted ={
		'class-features':0,
		'feats':1,
		'monster-rule':8,
		'mythic-abilities':3,
		'mythic-feats':1,
		'other':8,
		'racial-traits':2,
		'special-abilities':5,
		'special-attacks':4,
		'special-qualities':7,
		'spell-like-abilities':6,
		'traits':2
	},
	tabTypeSorted = {
		'Ex':9,
		'Sp':10,
		'Su':11
	},
	categoryAttrs = ['tabcat-1','tabcat0','tabcat1','tabcat2','tabcat3','tabcat4','tabcat5','tabcat6','tabcat7','tabcat8','tabcat9','tabcat10','tabcat11'],
	/** sets tab for an ability. these have multiple checkboxes, not a radio
	*@param {string} id optional id of row
	*@param {function} callback call when done
	*@param {obj} eventInfo from 'on' event change:rule_category
	*/
	setRuleTab = function(id,callback, eventInfo){
		var idStr = SWUtils.getRepeatingIDStr(id),
		prefix = "repeating_ability_" + idStr,
		catfields=[],
		ruleCategoryField=prefix+"rule_category",
		abilityTypeField=prefix+'ability_type',
		fields=[ruleCategoryField,abilityTypeField];
		catfields=_.map(categoryAttrs,function(attr){
			return prefix+attr;
		});
		fields = fields.concat(catfields);
		getAttrs(fields,function(v){
			var setter, ruleType=0,abilityType=0;
			setter = _.reduce(catfields,function(m,attr){
				m[attr]=0;
				return m;
			},{});
			if (v[abilityTypeField] ){
				abilityType= tabTypeSorted[v[abilityTypeField]];
				setter[prefix+'tabcat'+abilityType]=1;
			}
			if (v[ruleCategoryField]) {
				ruleType=tabRuleSorted[v[ruleCategoryField]];
				setter[prefix+'tabcat'+ruleType]=1;
			}
			if (!(ruleType || abilityType)){
				setter[prefix+'tabcat-1']=1;
			}
			//TAS.debug("PFAbility.setRuleTab, setting",setter);
			setAttrs(setter,PFConst.silentParams);
		});
	},
	setRuleTabs = function(){
		getSectionIDs("repeating_ability",function(ids){
			_.each(ids,function(id){
				setRuleTab(id);
			});
		});
	},
	otherCommandMacros = {
		'ex':" [^{extraordinary-abilities-menu}](~@{character_id}|NPCPREFIXex_button)",
		'sp':" [^{spell-like-abilities-menu}](~@{character_id}|NPCPREFIXsp_button)",
		'su':" [^{supernatural-abilities-menu}](~@{character_id}|NPCPREFIXsu_button)"
	},
	/** returns all rule_category and ability_type used
	* @returns {jsobj} {'rules':[values of rule_category], 'types':[valuesof ability_type]}
	*/
	getAbilityTypes = function(callback){
		var done= function(typeObj){
			//TAS.debug('PFFeatures.getAbilityTypes returning with ',typeObj);
			if (typeof callback === "function"){
				callback(typeObj);
			}
		};
		getSectionIDs('repeating_ability',function(ids){
			var fields=[];
			if(!ids || _.size(ids)===0){
				done({'rules':[],'types':[]});
				return;
			}
			_.each(ids,function(id){
				var prefix='repeating_ability_'+id+'_';
				fields.push(prefix+'rule_category');
				fields.push(prefix+'showinmenu');
				fields.push(prefix+'ability_type');
			});
			getAttrs(fields,function(v){
				var basearray=[], rulearray = [], typearray=[];
				basearray = _.chain(ids)
					.map(function(id){
						var retObj={},prefix='repeating_ability_'+id+'_';
						retObj.id =id;
						retObj.showinmenu=parseInt(v[prefix+'showinmenu'],10)||0;
						retObj.rule_category = v[prefix+'rule_category']||'';
						retObj.ability_type=(v[prefix+'ability_type']||'').toLowerCase();
						//TAS.debug("row "+id+" is ",retObj);
						return retObj;
					})
					.filter(function(o){return o.showinmenu;})
					.value();

				if (basearray){
					rulearray = _.chain(basearray)
						.groupBy('rule_category')
						.keys()
						.compact()
						.value();
					typearray= _.chain(basearray)
						.groupBy('ability_type')
						.keys()
						.compact()
						.value();
				}
				if (!rulearray){rulearray=[];}
				if (!typearray){typearray=[];}
				done({'rules':rulearray,'types':typearray});
			});
		});
	},
	/** resetTopCommandMacro sets all-abilities_buttons_macro (menu of ability menus)
	*@param {function} callback call when done	
	*/
	getTopOfMenu=function(callback,isNPC){
		var done = function (str) {
			TAS.debug("leaving PFAbility.getTopOfMenu");
			if (typeof callback === "function") {
				callback(str);
			}
		},
		newMacro="",setter={};
		try {
			newMacro = " @{orig_ability_header_macro}";
			getAbilityTypes(function(used){
				var addlMacros="",
				prefix="";
				try {
					if (isNPC){
						prefix="NPC-";
					}
					if(used.types ){
						_.each(used.types,function(type){
							if(otherCommandMacros[type]){
								addlMacros += otherCommandMacros[type].replace("NPCPREFIX",prefix);
							} else if (type) {
								TAS.warn("cound not find top macro for "+type);
							}
						});
					}
					if(addlMacros){
						newMacro += " {{row03=^{ability-menus}}} {{row04=" + addlMacros + "}}";
					}
					//TAS.debug("PFAbility.getTopOfMenu: done building top macro it is :",newMacro);
				} catch (innererr){
					TAS.error("PFAbility.getTopOfMenu innererr",innererr);
				} finally {
					done(newMacro);
				}
			});
		} catch(err) {
			TAS.error("PFAbility.getTopOfMenu",err);
			done(newMacro);
		}
	},
	resetCommandMacro = function(callback){
		getAttrs(['is_npc'],function(v){
			var isNPC = parseInt(v.is_npc,10)||0;
			getTopOfMenu ( function(header){
				PFMenus.resetOneCommandMacro('ability',isNPC,null,header);
			}, isNPC);
			PFMenus.resetOneCommandMacro('ex',isNPC);
			PFMenus.resetOneCommandMacro('sp',isNPC);
			PFMenus.resetOneCommandMacro('su',isNPC);
			if (isNPC){
				getTopOfMenu ( function(header){
					PFMenus.resetOneCommandMacro('ability',false,null,header);
				});
				PFMenus.resetOneCommandMacro('ex');
				PFMenus.resetOneCommandMacro('sp');
				PFMenus.resetOneCommandMacro('su');
			}
			if (typeof callback === "function"){
				callback();
			}
		});
	},
	defaultMacroMap ={
		'abilities': 'default'
	},
	defaultMacros={
		'default': {
			defaultRepeatingMacro: '&{template:pf_ability} @{toggle_accessible_flag} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_ability}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle=^{@{rule_category}}}} {{name=@{name}}} {{rule_category=@{rule_category}}} {{source=@{class-name}}} {{is_sp=@{is_sp}}} {{hasspellrange=@{range_pick}}} {{spell_range=^{@{range_pick}}}} {{casterlevel=[[@{casterlevel}]]}} {{spell_level=[[@{spell_level}]]}} {{hasposrange=@{hasposrange}}} {{custrange=@{range}}} {{range=[[@{range_numeric}]]}} {{save=@{save}}} {{savedc=[[@{savedc}]]}} {{hassr=@{abil-sr}}} {{sr=^{@{abil-sr}}}} {{hasfrequency=@{hasfrequency}}} {{frequency=^{@{frequency}}}} {{next_cast=@{rounds_between}}} {{hasuses=@{hasuses}}} {{uses=@{used}}} {{uses_max=@{used|max}}} {{cust_category=@{cust-category}}} {{concentration=[[@{Concentration-mod}]]}} {{damage=@{damage-macro-text}}} {{damagetype=@{damage-type}}} {{hasattack=@{hasattack}}} {{attacktype=^{@{abil-attacktypestr}}}} {{targetarea=@{targets}}} {{duration=@{duration}}} {{shortdesc=@{short-description}}} {{description=@{description}}} {{deafened_note=@{SpellFailureNote}}}',
			defaultRepeatingMacroMap:{
				'&{template:':{'current':'pf_ability}'},
				'@{toggle_accessible_flag}':{'current':'@{toggle_accessible_flag}'},
				'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
				'{{color=':{'current':'@{rolltemplate_color}}}'},
				'{{header_image=':{'current':'@{header_image-pf_ability}}}','old':['@{header_image-pf_block}}}']},
				'{{character_name=':{'current':'@{character_name}}}'},
				'{{character_id=':{'current':'@{character_id}}}'},
				'{{subtitle=':{'current':'^{@{rule_category}}}}'},
				'{{name=':{'current':'@{name}}}'},
				'{{rule_category=':{'current':'@{rule_category}}}'},
				'{{source=':{'current':'@{class-name}}}'},
				'{{is_sp=':{'current':'=@{is_sp}}}'},
				'{{hasspellrange=':{'current':'@{range_pick}}}'},
				'{{hassave=':{'current':'@{save}}}'},
				'{{spell_range=':{'current':'^{@{range_pick}}}}'},
				'{{hasposrange=':{'current':'@{hasposrange}}}'},
				'{{custrange=':{'current':'@{range}}}'},
				'{{range=':{'current':'[[@{range_numeric}]]}}'},
				'{{save=':{'current':'@{save}}}'},
				'{{savedc=':{'current':'[[@{savedc}]]}}','old':['@{savedc}}}']},
				'{{casterlevel=':{'current':'[[@{casterlevel}]]}}'},
				'{{spell_level=':{'current':'[[@{spell_level}]]}}'},
				'{{hassr=':{'current':'@{abil-sr}}}'},
				'{{sr=':{'current':'^{@{abil-sr}}}}'},
				'{{^{duration}=':{'current':'@{duration}}}'},
				'{{hasfrequency=':{'current':'@{frequency}}}'},
				'{{frequency=':{'current':'^{@{frequency}}}}'},
				'{{next_cast=':{'current':'@{rounds_between}}}'},
				'{{hasuses=':{'current':'@{hasuses}}}'},
				'{{uses=':{'current':'@{used}}}'},
				'{{uses_max=':{'current':'@{used|max}}}'},
				'{{cust_category=':{'current':'@{cust-category}}}'},
				'{{concentration=':{'current':'[[@{Concentration-mod}]]}}','old':['@{Concentration-mod}}','@{Concentration-mod}}}']},
				'{{damage=':{'current':'@{damage-macro-text}}}'},
				'{{damagetype=':{'current':'@{damage-type}}}'},
				'{{hasattack=':{'current':'@{hasattack}}}'},
				'{{attacktype=':{'current':'^{@{abil-attacktypestr}}}}'},
				'{{targetarea=':{'current':'@{targets}}}'},
				'{{shortdesc=':{'current':'@{short-description}}}'},
				'{{description=':{'current':'@{description}}}'},
				'{{deafened_note=':{'current':'@{SpellFailureNote}}}'}
				},
			defaultDeletedArray: null
		}
	},
	importFromCompendium = function(callback,eventInfo){
		var done=_.once(function(){
			resetCommandMacro();
			TAS.debug("leaving PFAbility.importFromCompendium");
			if(typeof callback === "function"){
				callback();
			}
		}),
		id = SWUtils.getRowId(eventInfo.sourceAttribute), //row doesn't really exist yet so get id from event
		prefix='repeating_ability_'+id+'_';
		//TAS.debug"at PFAbility.importFromCompendium for "+ prefix);
		getAttrs(['is_undead',prefix+'name',prefix+'compendium_category',prefix+'rule_category', prefix+'ability_type_compendium',prefix+'ability_type',prefix+'description',
		prefix+'range_from_compendium',prefix+'target_from_compendium',prefix+'area_from_compendium',prefix+'effect_from_compendium'],function(v){
			var compcat='' , abilitytype='',ability_basis='',location='',setter={},newcat='', abilname ='',silentSetter={}, match, note='',areaEffectText='',newRangeSettings;
			try {
				//TAS.debug("PFAbility.importFromCompendium got values: ",v);
				if(v[prefix+'ability_type_compendium']){
					abilitytype=v[prefix+'ability_type_compendium'];
					setter[prefix+'ability_type']=abilitytype;
					silentSetter[prefix+'ability_type_compendium']="";
				}
				compcat = v[prefix+'compendium_category'];
				silentSetter[prefix+'compendium_category']="";
				if (compcat){
					compcat=compcat.toLowerCase();
					if (compcat==='feats') {
						newcat='feats';
					} else if (compcat==='monster rule'){
						newcat='monster-rule';
					} else if (compcat==='spell'){
						newcat='spell-like-abilities';
					}
					if (newcat === 'monster-rule'){
						if( v[prefix+'description']){
							match=v[prefix+'description'].match(/Location\:\s*(.*)$/i);
							//TAS.debug"matching "+match);
							if(match && match[1]){
								location=SWUtils.trimBoth(match[1].toLowerCase());
								match = location.match(/special qual|sq|special att|special abil|defens|spell/i);
								if (match){
									switch(match[0]){
										case 'special qual':
										case 'sq':
											newcat='special-qualities';break;
										case 'special att':
											newcat='special-attacks';break;
										case 'special abil':
											newcat='special-abilities';break;
										case 'defens':
											newcat='defensive-abilities';break;
										case 'spell':
											newcat='spell-like-abilities';break;
									}
								}
							}
						}
					}
					if(abilitytype==='Sp'  && !newcat){
						newcat='spell-like-abilities';
					}
					if(!abilitytype && newcat==='spell-like-abilities'){
						abilitytype='Sp';
						setter[prefix+'ability_type']='Sp';
					} else if (abilitytype === 'Sp' && !newcat){
						newcat='spell-like-abilities';
					}
					
					if (newcat){
						setter[prefix+'rule_category']=newcat;
					} else {
						note+=compcat;
					}
					if (abilitytype==='Sp'){
						areaEffectText = v[prefix+'target_from_compendium']|| 
							v[prefix+'area_from_compendium']|| v[prefix+'effect_from_compendium']|| "";
						setter[prefix+'targets'] = areaEffectText;
						if(v[prefix+'range_from_compendium']){
							newRangeSettings = PFUtils.parseSpellRangeText(v[prefix+'range_from_compendium'], areaEffectText);
							setter[prefix+"range_pick"] = newRangeSettings.dropdown;
							setter[prefix+"range"] = newRangeSettings.rangetext;
						}
						setter[prefix+'ability-basis']= '@{CHA-mod}';
						
					} else if ( v[prefix+'name']){
						abilname = v[prefix+'name'].tolowercase();
						abilname = abilname.match(/^[^(]+/);
						if(PFDB.specialAttackDCAbilityBase[abilname]){
							ability_basis= PFDB.specialAttackDCAbilityBase[abilname];
						} else {
							ability_basis = 'CON';
						}
						if (ability_basis === 'CON' && parseInt(v.is_undead,10)){
							ability_basis = 'CHA';
						}
						ability_basis ='@{'+ability_basis+'}';
						setter[prefix+'ability-basis']= ability_basis;
					}
				}
			} catch (err){
				TAS.error("PFAbility.importFromCompendium",err);
			} finally {
				if(_.size(silentSetter)>0){
					setAttrs(silentSetter,PFConst.silentParams);
				}
				//TAS.debug"PFAbility.importFromCompendium, setting",setter);
				if (_.size(setter)>0){
					setAttrs(setter,{},done);
				} else {
					done();
				}
			}
			
		});
	},
	setClassName = function(id,callback,eventInfo){
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		}),
		idStr = SWUtils.getRepeatingIDStr(id),
		prefix="repeating_ability_"+idStr,
		clbasisField=prefix+"CL-basis";
		getAttrs([prefix+'CL-basis',prefix+'class-name',"race","class-0-name","class-1-name","class-2-name","class-3-name","class-4-name","class-5-name"],function(v){
			var clBase='',setter={},match;
			try {
				if (v[clbasisField]){
					if (v[clbasisField]==="@{level}"){
						clBase =v["race"];
					} else if (v[clbasisField]==="@{npc-hd-num}"){
						clBase = v["race"];
					} else if (parseInt(v[clbasisField],10)===0){
						clBase ="";
					} else {
						match = v[prefix+"CL-basis"].match(/\d+/);
						if (match){
							clBase=v["class-"+match[0]+"-name"];
						}
					}
					if(v[prefix+'class-name']!==clBase){
						setter[prefix+'class-name']=clBase;
					}
				}
			} catch(err) {
				TAS.error("PFAbility.setClassName",err);
			} finally {
				if (_.size(setter)>0){
					setAttrs(setter,PFConst.silentParams,done);
				} else {
					done();
				}
			}
		});
	},
	setAttackEntryVals = function(spellPrefix,weaponPrefix,v,setter,noName){
		var notes="",attackType="";
		setter = setter||{};
		try {
			attackType=PFUtils.findAbilityInString(v[spellPrefix + "abil-attack-type"]);
			if (v[spellPrefix + "name"]) {
				if(!noName){
					setter[weaponPrefix + "name"] = v[spellPrefix + "name"];
				}
				setter[weaponPrefix + "source-spell-name"] = v[spellPrefix + "name"];
			}
			if (attackType) {
				setter[weaponPrefix + "attack-type"] = v[spellPrefix + "abil-attack-type"];
				if ((/CMB/i).test(attackType)) {
					setter[weaponPrefix + "vs"] = "cmd";
				} else if ((/ranged/i).test(attackType)) {
					setter[weaponPrefix + "vs"] = "touch";
					setter[weaponPrefix + "isranged"] = 1;
					setter[weaponPrefix+"range"] = v[spellPrefix+"range_numeric"];
				} else {
					setter[weaponPrefix + "vs"] = "touch";
				}
			}

			if (v[spellPrefix +"damage-macro-text"]){
				setter[weaponPrefix+"precision_dmg_macro"] = v[spellPrefix+"damage-macro-text"];
				if(attackType){
					setter[weaponPrefix+"critical_dmg_macro"] = v[spellPrefix+"damage-macro-text"];
				} else {
					setter[weaponPrefix+"critical_dmg_macro"]="";
				}
			}
			if (v[spellPrefix+ "damage-type"]){
				setter[weaponPrefix+"precision_dmg_type"] = v[spellPrefix+"damage-type"];
				if(attackType){
					setter[weaponPrefix+"critical_dmg_type"] = v[spellPrefix+"damage-type"];
				}else {
					setter[weaponPrefix+"critical_dmg_type"]="";
				}
			}

			if (v[spellPrefix+"save"]){
				if (notes) { notes += ", ";}
				notes += "Save: "+ v[spellPrefix+"save"] + " DC: [[@{" + spellPrefix + "savedc}]]";
			}
			if ( v[spellPrefix+"sr"]){
				if (notes) { notes += ", ";}
				notes += "Spell resist:"+ v[spellPrefix+"abil-sr"];
			}
			if (notes){
				setter[weaponPrefix+"notes"]=notes;
			}
		} catch (err){
			TAS.error("PFAbility.setAttackEntryVals",err);
		} finally {
			return setter;
		}
	},
	/**Triggered from a button in repeating spells 
	*@param {string} id the row id or null
	*@param {function} callback when done
	*@param {boolean} silently setattrs silent:true
	*@param {object} eventInfo if id is null get id from here.
	*/
	createAttackEntryFromRow = function (id, callback, silently, eventInfo, weaponId) {
		var done = _.once(function () {
			TAS.debug("leaving PFAbility.createAttackEntryFromRow");
			if (typeof callback === "function") {
				callback();
			}
		}),
		attribList = [],
		itemId = id || (eventInfo ? SWUtils.getRowId(eventInfo.sourceAttribute) : ""),
		//idStr = PFUtils.getRepeatingIDStr(itemId),
		item_entry = 'repeating_ability_' + itemId + '_',
		slaPrefix = item_entry , //'repeating_ability_' + idStr,
		attributes = ["range_numeric","damage-macro-text","damage-type","abil-sr","savedc","save","abil-attack-type", "name"]
		;
		//the disabled ones never show up
//		TAS.debug("at PFAbility creatattack entry ");
		if(!itemId){
			TAS.warn("Cannot create usable attack entry from SLA since we cannot identify the row id");
		}
		attributes.forEach(function(attr){
			attribList.push(slaPrefix +  attr);
		});

		//TAS.debug("PFAbility.createAttackEntryFromRow: attribList=" + attribList);
		getAttrs(attribList, function (v) {
			var newRowId="",
			setter = {},
			prefix = "repeating_weapon_",
			idStr="",
			params = {};
			try {
				//TAS.debug("at PFAbility.createAttackEntryFromRow",v);
				if (!PFUtils.findAbilityInString(v[slaPrefix + "abil-attack-type"]) && !v[slaPrefix+"damage-macro-text"]){
					TAS.warn("no attack to create for ability "+ v[slaPrefix+"name"] +", "+ itemId );
				} else {
					if (!weaponId){
						newRowId = generateRowID();
					} else {
						newRowId = weaponId;
					}
					idStr = newRowId+"_";
					prefix += idStr;
					setter = setAttackEntryVals(item_entry, prefix,v,setter,weaponId);
					setter[prefix + "source-ability"] = itemId;
					setter[prefix+"group"]="Special";
				}
			} catch (err) {
				TAS.error("PFAbility.createAttackEntryFromRow", err);
			} finally {
				if (_.size(setter)>0){
					setter[slaPrefix + "create-attack-entry"] = 0;
					if (silently) {
						params = PFConst.silentParams;
					}
					//TAS.debug("PFAbility.createAttackEntryFromRow setting:",setter);
					setAttrs(setter, {}, function(){
						//can do these in parallel
						//TAS.debug("PFAbility.createAttackEntryFromRow came back from setter ");
						PFAttackOptions.resetOption(newRowId);
						PFAttackGrid.resetCommandMacro();
						done();
					});
				} else {
					setter[slaPrefix + "create-attack-entry"] = 0;
					setAttrs(setter,PFConst.silentParams,done);
				}
			}
		});
	},
	updateAssociatedAttack = function (id, callback, silently, eventInfo) {
		var done = _.once(function () {
			TAS.debug("leaving PFAbility.updateAssociatedAttack");
			if (typeof callback === "function") {
				callback();
			}
		}),
		itemId = "", item_entry = "",attrib = "", attributes=[];
		itemId = id || (eventInfo ? SWUtils.getRowId(eventInfo.sourceAttribute) : "");
		item_entry = 'repeating_spells_' + PFUtils.getRepeatingIDStr(itemId);
		attrib = (eventInfo ? SWUtils.getAttributeName(eventInfo.sourceAttribute) : "");
		attributes=[];
		//TAS.debug("at PF Spell like abilities updateAssociatedAttack: for row" + id   );
		if (attrib){
			attributes = [item_entry+attrib];
			if ((/range/i).test(attrib)){
				attributes =[item_entry+'range_pick',item_entry+'range',item_entry+'range_numeric'];
			}
		} else {
			attributes = ["range_pick","range","range_numeric","damage-macro-text","damage-type","sr","savedc","save","abil-attack-type","name"];
		}
		getAttrs(attributes,function(spellVal){
			getSectionIDs("repeating_weapon", function (idarray) { // get the repeating set
				var spellsourcesFields=[];
				spellsourcesFields = _.reduce(idarray,function(memo,currentID){
					memo.push("repeating_weapon_"+currentID+"_source-ability");
					return memo;
				},[]);
				getAttrs(spellsourcesFields,function(v){
					var setter={}, params={},idlist=[];
					try {
						_.each(idarray,function(currentID){
							var prefix = "repeating_weapon_"+currentID+"_";
							if (v[prefix+"source-ability"]===itemId){
								idlist.push(currentID);
								setter= setAttackEntryVals(item_entry, prefix,spellVal,setter);
							}
						});
					} catch (err){
						TAS.error("PFAbility.updateAssociatedAttack",err);
					} finally {
						if (_.size(setter)>0){
							if (silently) {
								params = PFConst.silentParams;
							}
							setAttrs(setter, params, function(){
								PFAttackOptions.resetSomeOptions(idlist);
							});
						} else {
							done();
						}
					}
				});
			});
		});
	},
	updateCharLevel = function(id,callback,eventInfo){
		var done=_.once(function(){
			TAS.debug("leaving updateCharLevel");
			if (typeof callback === "function"){
				callback();
			}
		}),
		idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_ability_"+idStr;
		getAttrs([prefix+"CL-misc-mod",prefix+"CL-basis-mod",prefix+"casterlevel",prefix+"ability_type","buff_CasterLevel-total", "CasterLevel-Penalty"],function(v){
			var clBase=0,cl=0,misc=0,pen=0,isSP=0,setter={};
			try {
				isSP=parseInt(v[prefix+"ability_type"],10)||0;
				clBase = parseInt(v[prefix+"CL-basis-mod"],10)||0;
				misc= parseInt(v[prefix+"CL-misc-mod"],10)||0;
				pen = parseInt(v["CasterLevel-Penalty"],10)||0;
				cl= clBase+misc+pen;
				if (isSP){
					cl+=parseInt(v["buff_CasterLevel-total"],10)||0;
				}
				if (cl !== parseInt(v[prefix+'casterlevel'],10)){
					setter[prefix+'casterlevel']=cl;
				}
			} catch (err){
				TAS.error("PFAbility.updateCharLevel",err);
			} finally {
				if (_.size(setter)){
					setAttrs(setter,{},done);
				} else {
					done();
				}
			}
		});
	},
	updateAbilityRange = function(id, callback, silently, eventInfo){
		var done=_.once(function(){
			TAS.debug("leaving updateAbilityRange");
			if (typeof callback === "function"){
				callback();
			}
		}),
		idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_ability_"+idStr;
		getAttrs([prefix+"range_pick",prefix+"range",prefix+"range_numeric",prefix+"casterlevel",prefix+"ability_type"], function(v){
			var  newRange=0,currRange=0,cl=0,setter={},isSP=0,currPosRange=0;
			try {
				isSP=(v[prefix+'ability_type']==='Sp')?1:0;
				currRange = parseInt(v[prefix+"range_numeric"],10)||0;
				if(isSP){
					cl=parseInt(v[prefix+'casterlevel'],10)||0;
					newRange = PFUtils.findSpellRange(v[prefix+"range"], v[prefix+"range_pick"], cl)||0;
				} else {
					newRange = parseInt(SWUtils.trimBoth(v[prefix+'range']),10)||0;
				}
				if (newRange!== currRange){
					//TAS.debug("updating range");
					setter[prefix+"range_numeric"]=newRange;
				}
				currPosRange = parseInt(v[prefix+'hasposrange'],10)||0;
				if (newRange > 0 && !currPosRange) {
					setter[prefix+'hasposrange']=1;
				} else if (currPosRange) {
					setter[prefix+'hasposrange']=0;
				}
			} catch (err){
				TAS.error("updateAbilityRange",err);
			} finally {
				if (_.size(setter)){
					setAttrs(setter,{},done);
				} else {
					done();
				}
			}
		});
	},
	/** to use in calls to _.invoke or otherwise, sets switch variables to setter for given row
	* @param {jsobj} setter to pass in first var of setAttrs
	* @param {string} id the id of this row, or null if we are within the row context already
	* @param {jsobj} v the values needed returned by getAttrs
	*/
	resetOption = function (setter, id, v, eventInfo){
		var idStr=SWUtils.getRepeatingIDStr(id),
		prefix='repeating_ability_'+idStr,
		isSP='', posRange='', hasUses='', hasFrequency='', hasAttack='', atkstr='', attackStrForDisplay='';
		setter= setter||{};
		try {
			if(!v){return setter;}
			isSP= (v[prefix+'ability_type']==='Sp')?'1':'';
			
			if(isSP !== v[prefix+'is_sp']){
				setter[prefix+'is_sp']=isSP;
			}
			posRange=(parseInt(v[prefix+'range_numeric'],10)||0)>0?'1':'';
			if (posRange !== v[prefix+'hasposrange']) {
				setter[prefix+'hasposrange']=posRange;
			}
			if(v[prefix+'frequency'] && v[prefix+'frequency']!=='not-applicable'){
				hasFrequency='1';
				switch(v[prefix+'frequency']){
					case 'perday':
					case 'permonth':
					case 'hexfreq':
					case 'other':
						hasUses='1';
						break;
				}
			}
			if(hasFrequency !== v[prefix+'hasfrequency']){
				setter[prefix+'hasfrequency']=hasFrequency;
			}
			if (hasUses !== v[prefix+'hasuses']){
				setter[prefix+'hasuses']=hasUses;
			}
			if(PFUtils.findAbilityInString(v[prefix+'abil-attack-type'])){
				hasAttack='1';
			}
			if (hasAttack !== v[prefix+'hasattack']){
				setter[prefix+'hasattack']=hasAttack;
			}
			if(hasAttack){
				atkstr=v[prefix+'abil-attack-type'].toLowerCase();
				if(atkstr.indexOf('melee')>=0){
					attackStrForDisplay='touch';
				} else if (atkstr.indexOf('range')>=0){
					attackStrForDisplay='ranged-touch-ray';
				} else if (atkstr.indexOf('cmb')>=0){
					attackStrForDisplay='combat-maneuver-bonus-abbrv';
				}
			}
			if (attackStrForDisplay !== v[prefix+'abil-attacktypestr']){
				setter[prefix+'abil-attacktypestr']=attackStrForDisplay;
			}
		} catch (err){
			TAS.error("PFAbility.recalcAbilities",err);
		} finally {
			return setter;
		}
	},
	resetOptionAsync = function (id, callback , eventInfo){
		var done = _.once(function(){
			TAS.debug("leaving PFAbility.resetOption");
			if (typeof callback === "function"){
				callback();
			}
		}),
		idStr=SWUtils.getRepeatingIDStr(id),
		prefix='repeating_ability_'+idStr,
		fields=[];
		fields = _.map(allOptionRepeatingFields,function(attr){
			return prefix + attr;
		});
		getAttrs(fields,function(v){
			var setter={};
			try {
				setter = resetOption(setter,id,v);
			} catch (err){
				TAS.error("PFAbility.recalcAbilities",err);
			} finally {
				if (_.size(setter)){
					setAttrs(setter,PFConst.silentParams,done,eventInfo);
				} else {
					done();
				}
			}
		});
	},
	recalcAbilities = function(callback,silently, eventInfo,levelOnly){
		var done = _.once(function(){
			TAS.debug("leaving PFAbility.recalcAbilities");
			if (typeof callback === "function"){
				callback();
			}
		});
		getSectionIDs('repeating_ability',function(ids){
			var numids = _.size(ids),
				doneOne, calllevel;
			if(numids===0){
				done();
				return;
			}
			//TAS.debug("there are "+ numids+" rows to recalc");
			doneOne	= _.after(numids,done);
			//refactor to do all rows at once
			calllevel= function(id){
				PFUtilsAsync.setRepeatingDropdownValue('ability',id,'CL-basis','CL-basis-mod',function(){ 
					//TAS.debug("PFAbility.recalcAbilities calling updateCharLevel for "+id);
					updateCharLevel(id,function(){
						TAS.debug("PFAbility.recalcAbilities calling updateAbilityRange for "+id);
						updateAbilityRange(id,function(){
						//	TAS.debug("PFAbility.recalcAbilities calling updateAssociatedAttack for "+id);
						//	updateAssociatedAttack(id,null,false,null);
							doneOne();
						});
					});
				});
			};
			_.each(ids,function(id){
				calllevel(id);
				if (!levelOnly){
					resetOptionAsync(id);
				}
			});
		});
	},
	migrateRepeatingMacros = function(callback){
		var done = _.once(function(){
			TAS.debug("leaving PFAbility.migrateRepeatingMacros");
			if (typeof callback === "function") {
				callback();
			}
		}),
		migrated = _.once(function(){
			setAttrs({'migrated_ability_macrosv112':1},PFConst.silentParams);
			done();
		}),
		defaultName = '',defaultMacro='',
		section = 'ability';
		getAttrs(['migrated_ability_macrosv112'],function(v){
			try {
				if(!parseInt(v.migrated_ability_macrosv112,10)){
					
					defaultName = defaultMacroMap[section]||'default';
					defaultMacro=defaultMacros[defaultName];
					if (!defaultMacro){
						TAS.error("cannot find default macro for section "+section);
						done();
						return;
					}
					//TAS.debug("PFAbility.migrateRepeatingMacros about to call PFMacros",defaultMacro);
					PFMacros.migrateRepeatingMacros(migrated,section,'macro-text',defaultMacro.defaultRepeatingMacro,defaultMacro.defaultRepeatingMacroMap,defaultMacro.defaultDeletedArray,'@{NPC-whisper}');
				} else {
					migrated();
				} 
			} catch (err){
				TAS.error("PFAbility.migrateRepeatingMacros error setting up "+section,err);
				done();
			}
		});
	},
	migrate = function (callback,silently){
		var done = function(){
			TAS.debug("leaving PFAbility.migrate");
			if (typeof callback === "function"){
				callback();
			}
		};
		migrateRepeatingMacros(done);
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("leaving PFAbility.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneWithList = function(){
			//TAS.debug("now calling resetcommandmacro");
			resetCommandMacro();
			done();
		},
		callRecalcAbilities = function(){
			//TAS.debug("PF1 calling recalcAbilities");
			recalcAbilities(TAS.callback(doneWithList));
			setRuleTabs();
		};
		try {
			//TAS.debug("at PFAbility.recalculate");
			migrate(TAS.callback(callRecalcAbilities));
		} catch (err) {
			TAS.error("PFAbility.recalculate, ", err);
			done();
		}
	},
	events = {
		attackEventsSLA:["damage-macro-text","damage-type","abil-sr","save","abil-attack-type","name","range_numeric"],
		commandMacroFields:["name","used","used_max","showinmenu","ability_type","frequency","rule_category"]
	},
	registerEventHandlers = function () {
		var eventToWatch="",
		macroEvent = "remove:repeating_ability ",
		singleEvent = "change:repeating_ability:";

		macroEvent = _.reduce(events.commandMacroFields,function(m,a){
			m+= singleEvent + a + " ";
			return m;
		},macroEvent);
		on (macroEvent, TAS.callback(function eventRepeatingCommandMacroUpdate(eventInfo){
			var attr;
			attr = SWUtils.getAttributeName(eventInfo.sourceAttribute);
			if ( eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && attr==='used_max')) {
				PFFeatures.resetTopCommandMacro(null,eventInfo);
				resetCommandMacro();
			}
		}));
		on("change:repeating_ability:CL-basis", TAS.callback(function eventAbilityClassDropdown(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			SWUtils.evaluateAndSetNumber('repeating_ability_CL-basis','repeating_ability_CL-basis-mod');
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" ) {
				setClassName(null,null,eventInfo);
			}
		}));
		eventToWatch = _.reduce(optionRepeatingHelperFields,function(m,a){
			m+= 'change:repeating_ability:'+a+' ';
			return m;
		},"");
		on(eventToWatch,	TAS.callback(function eventChangeAbilityTypeFrequencyOrRange(eventInfo){
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || eventInfo.sourceAttribute.indexOf('range')>0 ) {
					resetOptionAsync();
				}
		}));
		on("change:repeating_ability:CL-misc change:repeating_ability:spell_level-misc", 
			TAS.callback(function eventSLAEquationMacro(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			SWUtils.evaluateAndSetNumber(eventInfo.sourceAttribute, eventInfo.sourceAttribute+"-mod");
		}));
		on("change:buff_CasterLevel-total change:CasterLevel-Penalty",
			TAS.callback(function eventAbilityLevelChange(eventInfo){
			if (eventInfo.sourceType === "sheetworker"  ) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				recalcAbilities(null,null,eventInfo,true);
			}
		}));
		on("change:repeating_ability:CL-basis-mod change:repeating_ability:CL-misc-mod",
			TAS.callback(function eventAbilityLevelChange(eventInfo){
			if (eventInfo.sourceType === "sheetworker"  ) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateCharLevel(null,null,eventInfo);
			}
		}));
		on("change:repeating_ability:compendium_category", TAS.callback(function eventAbilityCompendium(eventInfo){
			if (eventInfo.sourceAttribute !== "sheetworker"){
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				importFromCompendium(null,eventInfo);
			}
		}));
		on("change:repeating_ability:create-attack-entry", TAS.callback(function eventcreateAttackEntryFromSLA(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				createAttackEntryFromRow(null,null,false,eventInfo);
			}
		}));
		on("change:repeating_ability:CL-misc-mod change:repeating_ability:CL-basis-mod change:repeating_ability:range_pick change:repeating_ability:range",
			TAS.callback(function eventClassRangeMod(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			//cl-misc-mod, cl-basis-mod  is sheetworker, range_pick and range must be player
			if ( ((/range/i).test(eventInfo.sourceAttribute) && (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" )) || 
				((/CL/i).test(eventInfo.sourceAttribute) && eventInfo.sourceType === "sheetworker") ) {
					updateAbilityRange(null,null,false,eventInfo);
				}
		}));
		eventToWatch = _.reduce(events.attackEventsSLA,function(memo,attr){
			memo+="change:repeating_ability:"+attr+" ";
			return memo;
		},"");
		on(eventToWatch,	TAS.callback(function eventupdateAssociatedSLAttackAttack(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event" + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && !((/attack\-type/i).test(eventInfo.sourceAttribute) ))) {
				updateAssociatedAttack(null,null,null,eventInfo);
			}
		}));
		on("change:repeating_ability:rule_category change:repeating_ability:ability_type", TAS.callback(function eventUpdateSLARuleCat(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event" + eventInfo.sourceType);
			setRuleTab(null,null,eventInfo);
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFAbility module loaded        ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		migrate: migrate,
		migrateRepeatingMacros: migrateRepeatingMacros,
		createAttackEntryFromRow: createAttackEntryFromRow,
		recalcAbilities: recalcAbilities,
		recalculate: recalculate,
		resetCommandMacro: resetCommandMacro
	};
}());
var PFAttacks = PFAttacks || (function () {
	'use strict';
	/** module for repeating_weapon section  */
	/* **********************************ATTACKS PAGE ********************************** */
	var damageRowAttrs=["damage-ability-max","damage-ability-mod","damage-mod","damage_ability_mult","enhance","total-damage"],
	damageRowAttrsLU=_.map(damageRowAttrs,function(a){return '_'+a;}),
	updateRowAttrs=["attack-mod","attack-type","attack-type-mod","crit_conf_mod","crit_confirm",
		"isranged","masterwork","proficiency","total-attack",
		"attack-type_macro_insert","damage-type_macro_insert"].concat(damageRowAttrs),
	updateRowAttrsLU = _.map(updateRowAttrs,function(a){return '_'+a;}),
	updateCharAttrs=["attk_ranged_crit_conf", "attk_ranged2_crit_conf", "attk_melee_crit_conf", 
		"attk_melee2_crit_conf", "attk_cmb_crit_conf", "attk_cmb2_crit_conf","DMG-mod"],

	defaultRepeatingMacro = '&{template:pf_attack} @{toggle_attack_accessible} @{toggle_rounded_flag} {{color=@{rolltemplate_color}}} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name=@{name}}} {{attack=[[ 1d20cs>[[ @{crit-target} ]] + @{attack_macro} ]]}} {{damage=[[@{damage-dice-num}d@{damage-die} + @{damage_macro}]]}} {{crit_confirm=[[ 1d20 + @{attack_macro} + [[ @{crit_conf_mod} ]] ]]}} {{crit_damage=[[ [[ @{damage-dice-num} * (@{crit-multiplier} - 1) ]]d@{damage-die} + ((@{damage_macro}) * [[ @{crit-multiplier} - 1 ]]) ]]}} {{type=@{type}}} {{weapon_notes=@{notes}}} @{iterative_attacks} @{macro_options} {{vs=@{vs}}} {{vs@{vs}=@{vs}}} {{precision_dmg1=@{precision_dmg_macro}}} {{precision_dmg1_type=@{precision_dmg_type}}} {{precision_dmg2=@{global_precision_dmg_macro}}} {{precision_dmg2_type=@{global_precision_dmg_type}}} {{critical_dmg1=@{critical_dmg_macro}}} {{critical_dmg1_type=@{critical_dmg_type}}} {{critical_dmg2=@{global_critical_dmg_macro}}} {{critical_dmg2_type=@{global_critical_dmg_type}}} {{attack1name=@{iterative_attack1_name}}}',
	defaultRepeatingMacroMap={
		'&{template:':{'current':'pf_attack}',old:['pf_generic}','pf_block}']},
		'@{toggle_attack_accessible}':{'current':'@{toggle_attack_accessible}'},
		'@{toggle_rounded_flag}':{'current':'@{toggle_rounded_flag}'},
		'{{color=':{'current':'@{rolltemplate_color}}}'},
		'{{character_name=':{'current':'@{character_name}}}'},
		'{{character_id=':{'current':'@{character_id}}}'},
		'{{subtitle}}':{'current':'{{subtitle}}'},
		'{{name=':{'current':'@{name}}}'},
		'{{attack=':{'current':'[[ 1d20cs>[[ @{crit-target} ]] + @{attack_macro} ]]}}','old':['{{attack=[[ 1d20cs>[[ @{crit-target} ]] + [[ @{total-attack} ]] ]]}}'],'replacements':[{'from':'[[ @{total-attack} ]]','to':'@{attack_macro}'},{'from':'@{total-attack}','to':'@{attack_macro}'}]},
		'{{damage=':{'current':'[[@{damage-dice-num}d@{damage-die} + @{damage_macro}]]}}','old':['[[ @{damage-dice-num}d@{damage-die} + [[ @{total-damage} ]] ]]}}'],'replacements':[{'from':'[[ @{total-damage} ]]','to':'@{damage_macro}'},{'from':'@{total-damage}','to':'@{damage_macro}'}]},
		'{{crit_confirm=':{'current':'[[ 1d20 + @{attack_macro} + [[ @{crit_conf_mod} ]] ]]}}','old':['[[ 1d20 + [[ @{total-attack} ]] ]]}}'],'replacements':[{'from':'[[ @{total-attack} ]]','to':'@{attack_macro} + [[ @{crit_conf_mod} ]]'},{'from':'@{total-attack}','to':'@{attack_macro} + [[ @{crit_conf_mod} ]]'}]},
		'{{crit_damage=':{'current':'[[ [[ @{damage-dice-num} * (@{crit-multiplier} - 1) ]]d@{damage-die} + ((@{damage_macro}) * [[ @{crit-multiplier} - 1 ]]) ]]}}','old':['[[ [[ (@{damage-dice-num} * (@{crit-multiplier} - 1)) ]]d@{damage-die} + [[ (@{total-damage} * (@{crit-multiplier} - 1)) ]] ]]}}'],'replacements':[{'from':'@{total-damage}','to':'(@{damage_macro})'}]},
		'{{type=':{'current':'@{type}}}'},
		'{{weapon_notes=':{'current':'@{notes}}}'},
		'@{iterative_attacks}':{'current':'@{iterative_attacks}'},
		'@{macro_options}':{'current':'@{macro_options}'},
		'{{vs=':{'current':'@{vs}}}'},
		'{{vs@{vs}=':{'current':'@{vs}}}'},
		'{{precision_dmg1=':{'current':'@{precision_dmg_macro}}}'},
		'{{precision_dmg1_type=':{'current':'@{precision_dmg_type}}}'},
		'{{precision_dmg2=':{'current':'@{global_precision_dmg_macro}}}'},
		'{{precision_dmg2_type=':{'current':'@{global_precision_dmg_type}}}'},
		'{{critical_dmg1=':{'current':'@{critical_dmg_macro}}}'},
		'{{critical_dmg1_type=':{'current':'@{critical_dmg_type}}}'},
		'{{critical_dmg2=':{'current':'@{global_critical_dmg_macro}}}'},
		'{{critical_dmg2_type=':{'current':'@{global_critical_dmg_type}}}'},
		'{{attack1name=':{'current':'@{iterative_attack1_name}}}'}
		},
	defaultDeletedMacroAttrs = ['{{description=@{notes}}}','@{toggle_accessible_flag}'],
	defaultIterativeRepeatingMacro='{{attackREPLACE=[[ 1d20cs>[[ @{crit-target} ]] + [[ @{attack_macro} + @{iterative_attackREPLACE_value} ]] [iterative] ]]}} {{damageREPLACE=[[ @{damage-dice-num}d@{damage-die} + @{damage_macro} ]]}} {{crit_confirmREPLACE=[[ 1d20 + [[ @{attack_macro} + @{iterative_attackREPLACE_value} ]] [iterative] + [[ @{crit_conf_mod} ]] ]]}} {{crit_damageREPLACE=[[ [[ @{damage-dice-num} * [[ @{crit-multiplier} - 1 ]] ]]d@{damage-die} + ((@{damage_macro}) * [[ @{crit-multiplier} - 1 ]]) ]]}} {{precision_dmgREPLACE1=@{precision_dmg_macro}}} {{precision_dmgREPLACE2=@{global_precision_dmg_macro}}} {{critical_dmgREPLACE1=@{critical_dmg_macro}}} {{critical_dmgREPLACE2=@{global_critical_dmg_macro}}} {{attackREPLACEname=@{iterative_attackREPLACE_name}}}',
	defaultIterativeRepeatingMacroMap = {
		'{{attackREPLACE=':{'current':'[[ 1d20cs>[[ @{crit-target} ]] + [[ @{attack_macro} + @{iterative_attackREPLACE_value} ]] [iterative] ]]}}', 'old':['[[ 1d20cs>[[ @{crit-target} ]] + [[ @{total-attack} + @{iterative_attackREPLACE_value} ]] ]]}}'],'replacements':[{'from':'[[ @{total-attack} ]]','to':'@{attack_macro}'},{'from':'@{total-attack}','to':'@{attack_macro}'}]},
		'{{damageREPLACE=':{'current':'[[ @{damage-dice-num}d@{damage-die} + @{damage_macro} ]]}}', 'old':['[[ @{damage-dice-num}d@{damage-die} + [[ @{total-damage} ]] ]]}}'],'replacements':[{'from':'[[ @{total-damage} ]]','to':'@{damage_macro}'},{'from':'@{total-damage}','to':'@{damage_macro}'}]},
		'{{crit_confirmREPLACE=':{'current':'[[ 1d20 + [[ @{attack_macro} + @{iterative_attackREPLACE_value} ]] [iterative] + [[ @{crit_conf_mod} ]] ]]}}', 'old':['[[ 1d20 + [[ @{total-attack} + @{iterative_attackREPLACE_value} ]] ]]}}'],'replacements':[{'from':'[[ @{total-attack} + @{iterative_attackREPLACE_value} ]]','to':'[[ @{attack_macro} + @{iterative_attackREPLACE_value} ]] [iterative] + [[ @{crit_conf_mod} ]]'},{'from':'@{total-attack} + @{iterative_attackREPLACE_value}','to':'@{attack_macro} + @{iterative_attackREPLACE_value} + @{crit_conf_mod}'}]},
		'{{crit_damageREPLACE=':{'current':'[[ [[ @{damage-dice-num} * [[ @{crit-multiplier} - 1 ]] ]]d@{damage-die} + ((@{damage_macro}) * [[ @{crit-multiplier} - 1 ]]) ]]}}', 'old':['[[ [[ (@{damage-dice-num} * (@{crit-multiplier} - 1)) ]]d@{damage-die} + [[ (@{total-damage} * (@{crit-multiplier} - 1)) ]] ]]}}'],'replacements':[{'from':'@{total-damage}','to':'(@{damage_macro})'}]},
		'{{precision_dmgREPLACE1=':{'current':'@{precision_dmg_macro}}}'},
		'{{precision_dmgREPLACE2=':{'current':'@{global_precision_dmg_macro}}}'},
		'{{critical_dmgREPLACE1=':{'current':'@{critical_dmg_macro}}}'},
		'{{critical_dmgREPLACE2=':{'current':'@{global_critical_dmg_macro}}}'},
		'{{attackREPLACEname=':{'current':'@{iterative_attackREPLACE_name}}}'}
	},
	defaultIterativeDeletedMacroAttrs=null,
	defaultIterativeAttrName='var_iterative_attackREPLACE_macro',
	defaultIterativeReplaceArray=['2','3','4','5','6','7','8'],
	
	getRepeatingAddInMacroPortion = function (macro, toggle, portion) {
		if (!(macro === "" || macro === "0" || macro === undefined || macro === null || toggle === "" || toggle === "0" || toggle === undefined || toggle === null)) {
			return " " + portion;
		}
		return "";
	},
	updateRepeatingAddInMacro = function (id, eventInfo) {
		var idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_weapon_" + idStr,
		attackType = prefix + "attack-type",
		tattackPlusNm = prefix + "toggle_attack_macro_insert",
		tdamagePlusNm = prefix + "toggle_damage_macro_insert",
		attackPlusNm = prefix + "attack_macro_insert",
		damagePlusNm = prefix + "damage_macro_insert",
		tattackGlobalNm = "toggle_global_attack_macro_insert",
		tdamageGlobalNm = "toggle_global_damage_macro_insert",
		attackGlobalNm = "global_attack_macro_insert",
		damageGlobalNm = "global_damage_macro_insert",
		attackMacroNm = prefix + "attack_macro",
		damageMacroNm = prefix + "damage_macro",
		fields = ["adv_macro_show", attackType, attackGlobalNm, damageGlobalNm, attackPlusNm, damagePlusNm, attackMacroNm, damageMacroNm];
		getAttrs(fields, function (v) {
			var showMacros = parseInt(v.adv_macro_show, 10) || 0,
			newAtkMacro = "[[ @{total-attack} ]]",
			newDmgMacro = "[[ @{total-damage} ]]",
			setter = {};
			if (showMacros) {
				newAtkMacro += getRepeatingAddInMacroPortion(v[attackPlusNm], v[tattackPlusNm], "@{toggle_attack_macro_insert}");
				newAtkMacro += " @{attack-type_macro_insert}";
				newAtkMacro += getRepeatingAddInMacroPortion(v[attackGlobalNm], v[tattackGlobalNm], "@{toggle_global_attack_macro_insert}");
				newDmgMacro += " @{damage-type_macro_insert}";
				newDmgMacro += getRepeatingAddInMacroPortion(v[damagePlusNm], v[tdamagePlusNm], "@{toggle_damage_macro_insert}");
				newDmgMacro += getRepeatingAddInMacroPortion(v[damageGlobalNm], v[tdamageGlobalNm], "@{toggle_global_damage_macro_insert}");
			}
			if (newAtkMacro !== v[attackMacroNm]) {
				setter[attackMacroNm] = newAtkMacro;
			}
			if (newDmgMacro !== v[damageMacroNm]) {
				setter[damageMacroNm] = newDmgMacro;
			}
			if (_.size(setter)) {
				setAttrs(setter);
			}
		});
	},
	setAdvancedMacroCheckbox = function () {
		getAttrs(["adv_macro_show", "global_melee_macro_insert", "global_ranged_macro_insert", "global_cmb_macro_insert", "global_attack_macro_insert", "global_melee_damage_macro_insert", "global_ranged_damage_macro_insert", "global_cmb_damage_macro_insert", "global_damage_macro_insert"], function (v) {
			var showAdv = parseInt(v.adv_macro_show, 10) || 0,
			hasAnyMacros = _.reduce(v, function (tot, value, fieldname) {
				if (fieldname !== "adv_macro_show" && !(value === "" || value === "0" || value === undefined || value === null)) {
					tot += 1;
				}
				return tot;
			}, 0);
			//TAS.debug("setAdvancedMacroCheckbox, checked:" + showAdv + " , has macros:" + hasAnyMacros);
			if (hasAnyMacros && !showAdv) {
				setAttrs({
					adv_macro_show: 1
				}, PFConst.silentParams);
			}
		});
	},
	/********* REPEATING WEAPON FIELDSET *********/
	setRepeatingWeaponInsertMacro = function (id, eventInfo) {
		var done = function () { }, //updateRepeatingAddInMacro(id,eventInfo);},
		idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_weapon_" + idStr,
		attkTypeField = prefix + "attack-type";
		getAttrs([attkTypeField], function (v) {
			var attkType = PFUtils.findAbilityInString(v[attkTypeField]),
			setter = {};
			if (attkType) {
				attkType = attkType.replace('attk-', '');
				setter[prefix + "attack-type_macro_insert"] = PFAttackGrid.attackGridFields[attkType].attackmacro;
				setter[prefix + "damage-type_macro_insert"] = PFAttackGrid.attackGridFields[attkType].damagemacro;
			} else {
				setter[prefix + "attack-type_macro_insert"] = "0";
			}
			//TAS.debug("setRepeatingWeaponInsertMacro",setter);
			setAttrs(setter, {
				silent: true
			}, done);
		});
	},
	/* updateRepeatingWeaponAttack - calculates total-attack
	* also updates attk-effect-total-copy
	* @id {string} optional = id of row, if blank we are within the context of the row
	* @overrideAttr {string} optional = if we are passing in a value this is the fieldname after "repeating_weapon_"
	* @overrideValue {number} optional = if overrideAttr then this should be a number usually int but it won't check
	*/
	updateRepeatingWeaponAttack = function (id, eventInfo) {
		//is it faster to not do the idstr each time? try it with ?:
		var resetOptionsWhenDone = function () {
			PFAttackOptions.resetOption(id, eventInfo);
		},
		idStr = PFUtils.getRepeatingIDStr(id),
		enhanceField = "repeating_weapon_" + idStr + "enhance",
		mwkField = "repeating_weapon_" + idStr + "masterwork",
		attkTypeModField = "repeating_weapon_" + idStr + "attack-type-mod",
		profField = "repeating_weapon_" + idStr + "proficiency",
		attkMacroModField = "repeating_weapon_" + idStr + "attack-mod",
		totalAttackField = "repeating_weapon_" + idStr + "total-attack";
		getAttrs([enhanceField, mwkField, attkTypeModField, profField, attkMacroModField, totalAttackField], function (v) {
			var enhance = (parseInt(v[enhanceField], 10) || 0),
			masterwork = (parseInt(v[mwkField], 10) || 0),
			attkTypeMod = (parseInt(v[attkTypeModField], 10) || 0),
			prof = (parseInt(v[profField], 10) || 0),
			attkMacroMod = (parseInt(v[attkMacroModField], 10) || 0),
			currTotalAttack = (parseInt(v[totalAttackField], 10) || 0),
			newTotalAttack = 0,
			setter = {};
			newTotalAttack = Math.max(enhance, masterwork) + attkTypeMod + prof + attkMacroMod;
			if (newTotalAttack !== currTotalAttack || isNaN(currTotalAttack)) {
				setter[totalAttackField] = newTotalAttack;
				setAttrs(setter, PFConst.silentParams, resetOptionsWhenDone);
			}
		});
	},
	/* updateRepeatingWeaponDamage - updates total-damage*/
	updateRepeatingWeaponDamage = function (id, eventInfo) {
		var resetOptionsWhenDone = function () {
			PFAttackOptions.resetOption(id, eventInfo);
		},
		idStr = PFUtils.getRepeatingIDStr(id),
		maxname = "repeating_weapon_" + idStr + "damage-ability-max",
		modname = "repeating_weapon_" + idStr + "damage-ability-mod",
		totalDamageField = "repeating_weapon_" + idStr + "total-damage",
		enhanceField = "repeating_weapon_" + idStr + "enhance",
		miscDmgField = "repeating_weapon_" + idStr + "damage-mod",
		abilityMultField = "repeating_weapon_" + idStr + "damage_ability_mult";
		getAttrs([maxname, modname, "DMG-mod", totalDamageField, enhanceField, miscDmgField, abilityMultField], function (v) {
			var maxA ,
			ability = parseInt(v[modname], 10) || 0,
			abilityMult = parseFloat(v[abilityMultField], 10) || 1,
			abilityTot,
			globalBuffConds = parseInt(v["DMG-mod"], 10) || 0,
			currTotalDmg = parseInt(v[totalDamageField], 10),
			miscDmg = parseInt(v[miscDmgField], 10) || 0,
			enhance = parseInt(v[enhanceField], 10) || 0,
			totalDamage,
			setter = {};
			maxA = parseInt(v[maxname], 10);
			if(isNaN(maxA)) {
				maxA=99;
			}
			abilityTot = Math.floor(Math.min(abilityMult * ability, maxA));
			totalDamage = abilityTot + globalBuffConds + miscDmg + enhance;

			if (totalDamage !== currTotalDmg || isNaN(currTotalDmg)) {
				//TAS.debug("setting damage to "+totalDamage);
				setter[totalDamageField] = totalDamage;
			}
			if (_.size(setter)) {
				setAttrs(setter, PFConst.silentParams, resetOptionsWhenDone);
			}
		});
	},
	updateRepeatingWeaponCrit = function (id, eventInfo) {
		var idStr = PFUtils.getRepeatingIDStr(id),
		critConfirmTotalField = "repeating_weapon_" + idStr + "crit_conf_mod",
		critConfirmField = "repeating_weapon_" + idStr + "crit_confirm",
		attkTypeField = "repeating_weapon_" + idStr + "attack-type",
		attrs = ["attk_ranged_crit_conf", "attk_ranged2_crit_conf", "attk_melee_crit_conf", "attk_melee2_crit_conf", "attk_cmb_crit_conf", "attk_cmb2_crit_conf", critConfirmTotalField, critConfirmField, attkTypeField];
		getAttrs(attrs, function (v) {
			try {
				var currCritBonus = (parseInt(v[critConfirmTotalField], 10) || 0),
				critConfirmBonus = (parseInt(v[critConfirmField], 10) || 0),
				attkType = PFUtils.findAbilityInString(v[attkTypeField]),
				attkTypeForGrid = (!attkType) ? "" : (attkType.replace('attk-', '')),
				attackTypeBonusField = (!attkTypeForGrid) ? "" : (PFAttackGrid.attackGridFields[attkTypeForGrid].crit),
				attackTypeBonus = (!attackTypeBonusField) ? 0 : (parseInt(v[attackTypeBonusField], 10) || 0),
				newBonus = critConfirmBonus + attackTypeBonus,
				setter = {};
				if (newBonus !== currCritBonus) {
					setter[critConfirmTotalField] = newBonus;
					setAttrs(setter, {
						silent: true
					});
				}
			} catch (err) {
				TAS.error("updateRepeatingWeaponCrit:cannot find " + v[attkTypeField] + " in grid");
			}
		});
	},
	updateRepeatingWeaponsFromCrit = function (attacktype, eventInfo) {
		var globalCritBonusField = PFAttackGrid.attackGridFields[attacktype].crit;
		getSectionIDs("repeating_weapon", function (ids) {
			var attrs = [globalCritBonusField];
			_.each(ids, function (id) {
				var idStr = PFUtils.getRepeatingIDStr(id);
				attrs.push("repeating_weapon_" + idStr + "crit_conf_mod");
				attrs.push("repeating_weapon_" + idStr + "crit_confirm");
				attrs.push("repeating_weapon_" + idStr + "attack-type");
			});
			//TAS.debug("about to get ",attrs);
			getAttrs(attrs, function (v) {
				var globalCritBonus = parseInt(v[globalCritBonusField], 10) || 0,
				setter = {};
				_.each(ids, function (id) {
					var idStr = PFUtils.getRepeatingIDStr(id),
					attackTypeField = "repeating_weapon_" + idStr + "attack-type",
					rowCritTotField = "",
					rowCrit = 0,
					rowTot = 0,
					currRowTot = 0;
					//TAS.debug("row:"+id+" attacktypefield:"+v[attackTypeField]+", ability:"+ PFUtils.findAbilityInString(v[attackTypeField]) +", type is:"+attacktype);
					if (PFUtils.findAbilityInString(v[attackTypeField]) === ("attk-" + attacktype)) {
						//TAS.debug("this row equal");
						rowCritTotField = "repeating_weapon_" + idStr + "crit_conf_mod";
						currRowTot = parseInt(v[rowCritTotField], 10) || 0;
						rowTot = globalCritBonus + (parseInt(v["repeating_weapon_" + idStr + "crit_confirm"], 10) || 0);
						//TAS.debug("global:"+globalCritBonus+", this row:"+currRowTot+", plus "+v["repeating_weapon_" + idStr + "crit_confirm"] );
						if (rowTot !== currRowTot) {
							setter[rowCritTotField] = rowTot;
						}
					}
				});
				if (_.size(setter) > 0) {
					setAttrs(setter, {
						silent: true
					});
				}
			});
		});
	},
	setRepeatingWeaponRangedFlag = function(id){
		var idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_weapon_" + idStr,
		attypeAttr=prefix+"attack-type",
		isRangedAttr=prefix+"isranged";
		getAttrs([attypeAttr,isRangedAttr],function(v){
			var setter={},
			newIsRanged=0,
			attackType="";
			attackType=PFUtils.findAbilityInString(v[attypeAttr]);
			if ((/ranged/i).test(attackType)) {
				newIsRanged=1;
			}
			if ((parseInt(v[isRangedAttr],10)||0) !== newIsRanged){
				setter[isRangedAttr]=newIsRanged;
				setAttrs(setter,PFConst.silentParams);
			}
		});

	},
	getRecalculatedDamageOnly=function(id,v){
		var prefix = 'repeating_weapon_' + SWUtils.getRepeatingIDStr(id),
			enhance = (parseInt(v[prefix+ "enhance"], 10) || 0),
			abilitydmg = parseInt(v[prefix+ "damage-ability-mod"], 10) || 0,
			abilityMult = parseFloat(v[prefix+ "damage_ability_mult"], 10) || 1,
			currTotalDmg = parseInt(v[prefix+ "total-damage"], 10),
			dmgMacroMod = parseInt(v[prefix+ "damage-mod"], 10) || 0,
			maxAbility = parseInt(v[prefix+ "damage-ability-max"], 10),
			globalBuffConds = v["DMG-mod"], 
			abilityTotDmg=0,
			newTotalDamage=0,
			localsetter={};
		try {
			if(isNaN(maxAbility)) {
				maxAbility=99;
			}
			abilityTotDmg = Math.floor(Math.min(abilityMult * abilitydmg, maxAbility));
			newTotalDamage = abilityTotDmg + globalBuffConds + dmgMacroMod + enhance;
			if (newTotalDamage !== currTotalDmg || isNaN(currTotalDmg)) {
				localsetter[prefix+ "total-damage"] = newTotalDamage;
			}
		} catch (err){
			TAS.error("PFAttacks.recalculateAttack for id " + id,err);
		} finally {
			return localsetter;
		}
	},
	/* updateRepeatingWeaponDamages - updates all attacks when DMG-mod changes */
	updateRepeatingWeaponDamages = function (callback) {
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		});
		getSectionIDs("repeating_weapon", function (ids) {
			var fields = SWUtils.cartesianAppend(['repeating_weapon_'],ids,damageRowAttrsLU);
			fields.push("DMG-mod");
			getAttrs(fields,function(v){
				var setter;
				v["DMG-mod"]= parseInt(v["DMG-mod"],10)||0;
				setter = _.reduce(ids,function(m,id){
					var xtra=getRecalculatedDamageOnly(id,v);
					_.extend(m,xtra);
					return m;
				},{});
				if(_.size(setter)){
					setAttrs(setter,{},done);
				} else {
					done();
				}
			});
		});
	},		

	/* this is faster than looping through the 3 parent lists */
	updateAssociatedAttacksFromParents = function(callback){
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		});
		getSectionIDs('repeating_weapon',function(ids){
			var doneOne = _.after(_.size(ids),function(){
				done();
			}),
			attrs = _.map(ids,function(id){
				return ['repeating_weapon_'+id+'_source-item','repeating_weapon_'+id+'_source-spell','repeating_weapon_'+id+'_source-ability'];
			});
			attrs = _.flatten(attrs);
			getAttrs(attrs,function(v){
				_.each(ids,function(id){
					doneOne();
					if(v['repeating_weapon_'+id+'_source-spell']) {
						PFInventory.createAttackEntryFromRow('repeating_item_'+v['repeating_weapon_'+id+'_source-item']+'_create-attack-entry',doneOne,true,id);
					} else if (v['repeating_weapon_'+id+'_source-item']) {
						PFSpells.createAttackEntryFromRow('repeating_spells_'+v['repeating_weapon_'+id+'_source-spell']+'_create-attack-entry',doneOne,true,id);
					} else if (v['repeating_weapon_'+id+'_source-item']) {
						PFAbility.createAttackEntryFromRow('repeating_ability_'+v['repeating_weapon_'+id+'_source-ability']+'_create-attack-entry',doneOne,true,id);
					} else {
						doneOne();
					}
				});
			});
		});
	},
	
	getRecalculatedAttack = function(id,v){
		var prefix = 'repeating_weapon_'+id+'_',
			isRanged=parseInt(v[prefix+"isranged"],10)||0,
			enhance = (parseInt(v[prefix+ "enhance"], 10) || 0),
			masterwork = (parseInt(v[prefix+ "masterwork"], 10) || 0),
			attkTypeMod = (parseInt(v[prefix+ "attack-type-mod"], 10) || 0),
			prof = (parseInt(v[prefix+ "proficiency"], 10) || 0),
			attkMacroMod = (parseInt(v[prefix+ "attack-mod"], 10) || 0),
			currTotalAttack = parseInt(v[prefix+ "total-attack"], 10),
			abilitydmg = parseInt(v[prefix+ "damage-ability-mod"], 10) || 0,
			abilityMult = parseFloat(v[prefix+ "damage_ability_mult"], 10) || 1,
			currTotalDmg = parseInt(v[prefix+ "total-damage"], 10),
			dmgMacroMod = parseInt(v[prefix+ "damage-mod"], 10) || 0,
			maxAbility = parseInt(v[prefix+ "damage-ability-max"], 10),
			currCritBonus = (parseInt(v[prefix+ "crit_conf_mod"], 10) || 0),
			critConfirmBonus = (parseInt(v[prefix+ "crit_confirm"], 10) || 0),
			attkType = PFUtils.findAbilityInString(v[prefix+ "attack-type"]),
			globalBuffConds = v["DMG-mod"], 
			attkTypeForGrid='',
			attackTypeCritBonusField='',
			attackTypeCritBonus =0,
			newCritBonus=0,
			abilityTotDmg=0,
			newTotalDamage=0,
			newTotalAttack=0,
			localsetter={};
		try{
			newTotalAttack = Math.max(enhance, masterwork) + attkTypeMod + prof + attkMacroMod;
			if (newTotalAttack !== currTotalAttack || isNaN(currTotalAttack)) {
				localsetter[prefix+ "total-attack"] = newTotalAttack;
			}
			if(isNaN(maxAbility)) {
				maxAbility=99;
			}
			abilityTotDmg = Math.floor(Math.min(abilityMult * abilitydmg, maxAbility));
			newTotalDamage = abilityTotDmg + globalBuffConds + dmgMacroMod + enhance;
			if (newTotalDamage !== currTotalDmg || isNaN(currTotalDmg)) {
				//TAS.debug("setting damage to "+newTotalDamage);
				localsetter[prefix+ "total-damage"] = newTotalDamage;
			}
			if(attkType){
				if((/range/i).test(attkType)){
					if(!isRanged){
						localsetter[prefix+"isranged"]=1;
					}
				} else if (isRanged){
					localsetter[prefix+"isranged"]=0;
				}
				attkTypeForGrid = attkType.replace('attk-','');
				//TAS.debug("at update attack attkTypeForGrid="+attkTypeForGrid+", comparing to:",PFAttackGrid.attackGridFields);
				if(attkTypeForGrid){
					attackTypeCritBonusField = PFAttackGrid.attackGridFields[attkTypeForGrid].crit;
					attackTypeCritBonus = (!attackTypeCritBonusField) ? 0 : v[attackTypeCritBonusField];
					if(v[prefix + "attack-type_macro_insert"] !== PFAttackGrid.attackGridFields[attkTypeForGrid].attackmacro){
						localsetter[prefix + "attack-type_macro_insert"] = PFAttackGrid.attackGridFields[attkTypeForGrid].attackmacro;
					}
					if (v[prefix + "damage-type_macro_insert"]!==PFAttackGrid.attackGridFields[attkTypeForGrid].damagemacro){
						localsetter[prefix + "damage-type_macro_insert"] = PFAttackGrid.attackGridFields[attkTypeForGrid].damagemacro;
					}
				}
			}
			newCritBonus = critConfirmBonus + attackTypeCritBonus;
			if (newCritBonus !== currCritBonus) {
				localsetter[prefix+ "crit_conf_mod"] = newCritBonus;
			}
			if (!attkTypeForGrid) {
				if (v[prefix + "attack-type_macro_insert"]!=="0"){
					localsetter[prefix + "attack-type_macro_insert"] = "0";
				}
				if (v[prefix + "damage-type_macro_insert"]!=="0"){
					localsetter[prefix + "damage-type_macro_insert"] = "0";
				}
			}
		} catch (err){
			TAS.error("PFAttacks.recalculateAttack for id " + id,err);
		} finally {
			return localsetter;
		}
	},
	updateAllRowsNonCalcFields = function(ids,callback){
		var done = function(){
			if(typeof callback ==="function"){
				callback();
			}
		},
		doneWithAllRows = _.after(_.size(ids),done),
		fields;
		fields = SWUtils.cartesianAppend(['repeating_weapon_'],ids,updateRowAttrsLU);
		fields=fields.concat(updateCharAttrs);
		getAttrs(fields,function(v){
			var charAttMap={},	setter;
			//set global values to int so we don't have to do it over and over per row.
			charAttMap = _.object(_.map(updateCharAttrs,function(attr){
				return [attr, parseInt(v[attr],10)||0];
			}));
			_.extend(v,charAttMap);
			setter = _.reduce(ids,function(m,id){
				var xtra=getRecalculatedAttack(id,v);
				_.extend(m,xtra);
				return m;
			},{});
			if(_.size(setter)){
				setAttrs(setter,{},done);
			} else {
				done();
			}
		});
	},
	recalcCalculatedFields = function(ids,callback){
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		}),
		doneWithCalculatedFields = _.after(_.size(ids),done),
		fields;
		fields =_.chain(ids)
			.map(function(id){
				var prefix = "repeating_weapon_" + id + "_";
				return [prefix + "damage",prefix + "attack",prefix + "damage-mod",prefix + "attack-mod"];
			})
			.flatten()
			.value();
		getAttrs(fields,function(v){
			try{
				_.each(ids,function (id) {
					var doneWithField =_.after(4,doneWithCalculatedFields),
					prefix = "repeating_weapon_" + id + "_";
					if((!v[prefix + "damage"] || v[prefix + "damage"]==="0"|| v[prefix + "damage"]==="+0") && parseInt(v[prefix+"damage-mod"],10)===0){
						doneWithField();
					} else {
						SWUtils.evaluateAndSetNumber(prefix + "damage", prefix + "damage-mod",0,doneWithField,true);
					}
					if((!v[prefix + "attack"] || v[prefix + "attack"]==="0" || v[prefix + "attack"]==="+0") && parseInt(v[prefix+"attack-mod"],10)===0){
						doneWithField();
					} else {
						SWUtils.evaluateAndSetNumber(prefix + "attack", prefix + "attack-mod",0,doneWithField,true);
					}
					SWUtils.setDropdownValue(prefix + "attack-type",prefix +"attack-type-mod",PFUtils.findAbilityInString,doneWithField,true);
					SWUtils.setDropdownValue(prefix + "damage-ability",prefix +"damage-ability-mod",PFUtils.findAbilityInString,doneWithField,true);
				});
			}catch(err){
				TAS.error("recalcCalculatedFIelds",err);
				done();
			}
		});
	},
	recalculateRepeatingWeapons = function(callback){
		var done = _.once(function(){
			TAS.debug("leaving PFAttacks.recalculateRepeatingWeapons");
			if (typeof callback === "function"){
				callback();
			}
		});
		getSectionIDs("repeating_weapon", function (ids) {
			recalcCalculatedFields(ids,function(){
				updateAllRowsNonCalcFields(ids,done);
			});
		});
	},
	setNewDefaults = function(callback){
		var done = _.once(function(){
			TAS.debug("leaving PFAttacks.setNewDefaults");
			if(typeof callback === "function"){
				callback();
			}
		}),
		finishedMigrating=_.once(function(){
			setAttrs({'migrated_attacklist_defaults111':1},PFConst.silentParams,done);
		});
		//TAS.debug("At PFAttacks.setNewDefaults");
		getAttrs(['size','migrated_attacklist_defaults111'],function(vsize){
			var defaultSize = 0;
			if(parseInt(vsize['migrated_attacklist_defaults111'],10)){
				done();
				return;
			}
			defaultSize = parseInt(vsize['size'],10)||0;
			getSectionIDs('repeating_weapon',function(ids){
				var fields;
				if (!(ids || _.size(ids))){
					finishedMigrating();
					return;
				}
				fields= SWUtils.cartesianAppend(['repeating_weapon_'],ids,['_damage-dice-num','_damage-die']);
				getAttrs(fields,function(v){
					var setter={};
					try {
						setter = _.reduce(ids,function(m,id){
							var prefix = 'repeating_weapon_'+id+'_';
							try {
								m[prefix+'default_size']=defaultSize;
								if(v[prefix+'damage-dice-num']){
									m[prefix+'default_damage-dice-num']=v[prefix+'damage-dice-num'];
								} else {
									m[prefix+'default_damage-dice-num']=0;
									m[prefix+'damage-dice-num']=0;
								}
								if(v[prefix+'damage-die']){
									m[prefix+'default_damage-die']=v[prefix+'damage-die'];
								} else {
									m[prefix+'default_damage-die']=0;
									m[prefix+'damage-die']=0;
								}
							} catch (errin){
								TAS.error("PFAttacks.setNewDefaults errin id "+id,errin);
							} finally {
								return m;
							}
						},{});
					} catch (errout){
						TAS.error("PFAttacks.setNewDefaults errout ",errout);
					} finally {
						if (_.size(setter)){
							setAttrs(setter,PFConst.silentParams,finishedMigrating);
						} else {
							done();
						}
					}
				});
			});
		});
	},
	migrateRepeatingMacros = function (callback){
		var done = _.once(function(){
			if(typeof callback === "function"){
				callback();
			}
		}),
		migratedIteratives = function(){
			setAttrs({'migrated_attack_macrosv1':1},PFConst.silentParams,done);
		},
		migrated = _.after(2,function(){
			PFMacros.migrateRepeatingMacrosMult(migratedIteratives,'weapon',defaultIterativeAttrName,defaultIterativeRepeatingMacro,defaultIterativeRepeatingMacroMap,defaultIterativeDeletedMacroAttrs,defaultIterativeReplaceArray);
		});
		PFMacros.migrateRepeatingMacros(migrated,'weapon','macro-text',defaultRepeatingMacro,defaultRepeatingMacroMap,defaultDeletedMacroAttrs,'@{PC-Whisper}');
		PFMacros.migrateRepeatingMacros(migrated,'weapon','npc-macro-text',defaultRepeatingMacro,defaultRepeatingMacroMap,defaultDeletedMacroAttrs,'@{NPC-Whisper}');
	},
	migrate = function(callback, oldversion){
		var done=_.once(function(){
			TAS.debug("leaving PFAttacks.migrate");
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs([ "migrated_damage-multiplier","migrated_attack_macrosv1"],function(v){
			var migrateDamage = 0, migrateMacrosv1=0,migrateIteratives=0;
			migrateDamage = parseInt(v["migrated_damage-multiplier"], 10) || 0;
			migrateMacrosv1 = parseInt(v["migrated_attack_macrosv1"], 10) || 0;
			getSectionIDs('repeating_weapon',function(ids){
				var callmigrateMacrostov1,callmigrateMacrostov64,callmigrateRepeatingDamage,callSetDefaults;
				try{
					if (!ids || _.size(ids)<=0){
						setAttrs({"migrated_damage-multiplier":1,'migrated_attack_macrosv1':1,'migrated_attacklist_defaults111':1},
							PFConst.silentParams,done);
						return;
					}
					callSetDefaults = function(){
						setNewDefaults(done);
					};
					callmigrateMacrostov1=function(){
						if(!migrateMacrosv1){migrateRepeatingMacros(callSetDefaults);}
						else { callSetDefaults();}
					};
					callmigrateRepeatingDamage =function(){
						if(!migrateDamage){PFMigrate.migrateRepeatingDamage(ids,callmigrateMacrostov1);}
						else {callmigrateMacrostov1();}
					};
					callmigrateRepeatingDamage();
				} catch (err){
					TAS.error("PFAttacks.migrate",err);
					done();
				} finally {					
				}
			});
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = function () {
			TAS.info("leaving PFAttacks.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		};
		TAS.debug("at PFAttacks.recalculate");
		PFAttackGrid.recalculate( function(){
			migrate(function(){
				setAdvancedMacroCheckbox();
				recalculateRepeatingWeapons();
				PFAttackGrid.resetCommandMacro();
				PFAttackOptions.recalculate();
				updateAssociatedAttacksFromParents();
				done();
			},oldversion);
		}  ,silently,oldversion);
	},
	registerEventHandlers = function () {
		_.each(PFAttackGrid.attackGridFields, function (attackFields, attack) {
			on("change:" + attackFields.crit, TAS.callback(function eventAttackCrit(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					PFAttacks.updateRepeatingWeaponsFromCrit(attack, eventInfo);
				}
			}));
		});
		on("change:repeating_weapon:attack-type-mod change:repeating_weapon:attack-mod", TAS.callback(function eventUpdateRepeatingWeaponAttackSheet(eventInfo) {
			if (eventInfo.sourceType === "sheetworker") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateRepeatingWeaponAttack(null, eventInfo);
			}
		}));
		on("change:repeating_weapon:masterwork change:repeating_weapon:proficiency", TAS.callback(function eventUpdateRepeatingWeaponAttackPlayer(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateRepeatingWeaponAttack(null, eventInfo);
			}
		}));
		on("change:repeating_weapon:damage-ability-mod change:repeating_weapon:damage-mod", TAS.callback(function eventUpdateRepeatingWeaponDamageSheet(eventInfo) {
			if (eventInfo.sourceType === "sheetworker") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateRepeatingWeaponDamage(null, eventInfo);
			}
		}));
		on("change:repeating_weapon:damage_ability_mult change:repeating_weapon:damage-ability-max", TAS.callback(function eventUpdateRepeatingWeaponDamagePlayer(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateRepeatingWeaponDamage(null, eventInfo);
			}
		}));
		on("change:repeating_weapon:attack-type", TAS.callback(function eventHandleRepeatingAttackDropdown(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			PFUtilsAsync.setRepeatingDropdownValue("weapon", null, "attack-type", "attack-type-mod");
			updateRepeatingWeaponCrit(null, eventInfo);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				setRepeatingWeaponInsertMacro(null, eventInfo);
				setRepeatingWeaponRangedFlag();
			}
		}));
		on("change:repeating_weapon:damage-ability", TAS.callback(function eventHandleRepeatingDamageDropdown(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			PFUtilsAsync.setRepeatingDropdownValue("weapon", null, "damage-ability", "damage-ability-mod");
		}));
		on("change:repeating_weapon:damage", TAS.callback(function eventRepeatingWeaponDamage(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			SWUtils.evaluateAndSetNumber("repeating_weapon_damage", "repeating_weapon_damage-mod");
		}));
		on("change:repeating_weapon:attack", TAS.callback(function eventRepeatingWeaponAttack(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			SWUtils.evaluateAndSetNumber("repeating_weapon_attack", "repeating_weapon_attack-mod");
		}));
		on("change:repeating_weapon:enhance", TAS.callback(function eventUpdateRepeatingWeaponAttackAndDamage(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateRepeatingWeaponAttack(null, eventInfo);
				updateRepeatingWeaponDamage();
			}
		}));
		on("change:repeating_weapon:crit_confirm", TAS.callback(function eventWeaponCritConfirmBonus(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateRepeatingWeaponCrit(null, eventInfo);
			}
		}));
		on("change:repeating_weapon:damage-dice-num change:repeating_weapon:damage-die", TAS.callback(function eventWeaponDice(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				getAttrs([eventInfo.sourceAttribute,'size','repeating_weapon_default_size'],function(v){
					var attr=SWUtils.getAttributeName(eventInfo.sourceAttribute),
					newname='repeating_weapon_default_'+attr,
					currSize =parseInt(v.size,10)||0,
					defSize=parseInt(v.repeating_weapon_default_size,10)||0,
					setter={};
					if(defSize===currSize){
						setter[newname]=v[eventInfo.sourceAttribute];
						setAttrs(setter,PFConst.silentParams);
					}
				});
			}
		}));
		on("remove:repeating_weapon change:repeating_weapon:attack-type change:_reporder_repeating_weapon change:repeating_weapon:group change:repeating_weapon:name change:include_attack_totals", TAS.callback(function eventRepeatingWeaponChange(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				PFAttackGrid.resetCommandMacro(eventInfo);
			}
		}));
		
		on("change:dmg-mod", TAS.callback(function eventUpdateRepeatingWeaponDamageTotal(eventInfo) {
			if (eventInfo.sourceType === "sheetworker") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateRepeatingWeaponDamages(eventInfo);
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFAttacks module loaded        ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		migrate: migrate,
		recalculate: recalculate,
		setAdvancedMacroCheckbox: setAdvancedMacroCheckbox,
		recalculateRepeatingWeapons: recalculateRepeatingWeapons,
		setRepeatingWeaponInsertMacro: setRepeatingWeaponInsertMacro,
		setRepeatingWeaponRangedFlag: setRepeatingWeaponRangedFlag,
		updateRepeatingWeaponAttack: updateRepeatingWeaponAttack,
		updateRepeatingWeaponCrit: updateRepeatingWeaponCrit,
		updateRepeatingWeaponDamage: updateRepeatingWeaponDamage,
		updateRepeatingWeaponDamages: updateRepeatingWeaponDamages,
		updateRepeatingWeaponsFromCrit: updateRepeatingWeaponsFromCrit
	};
}());
var PFPsionic = PFPsionic || (function () {
	'use strict';
	var
	/* **************PSIONIC************** */
	updatePsionicBonusPower = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["selected-ability-psionic-power", "psionic-level-total", "ability-psionic-power"], function (v) {
			SWUtils.evaluateExpression(v["selected-ability-psionic-power"], function (value) {
				var ability = 0,
				currentTotal = 0,
				newTotal = 0,
				params = {},
				finished = false;
				try {
					ability = parseInt(value, 10) || 0;
					currentTotal = parseInt(v["ability-psionic-power"], 10) || 0;
					newTotal = Math.floor(ability * (parseInt(v["psionic-level-total"], 10) || 0) * 0.5);
					//TAS.debug("ability=" + ability, "newTotal=" + newTotal, "currentTotal=" + currentTotal);
					if (currentTotal !== newTotal) {
						if (silently) {
							params = PFConst.silentParams;
						}
						finished = true;
						setAttrs({
							"ability-psionic-power": newTotal
						}, params, done);
					}
				} catch (err) {
					TAS.error("PFPsionic.updatePsionicBonusPower", err);
				} finally {
					if (!finished) {
						done();
					}
				}
			});
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("Leaving PFPsionic.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["psionics-show"], function (v) {
			try {
				if (v["psionics-show"] == "1") {
					updatePsionicBonusPower(done, silently);
				} else {
					done();
				}
			} catch (err2) {
				TAS.error("PFPsionic.recalculate", err2);
				done();
			}
		});
	},
	registerEventHandlers = function () {
		on("change:psionic-level change:psionic-level-misc", TAS.callback(function eventUpdatePsionicLevel(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				SWUtils.updateRowTotal(["psionic-level-total", "psionic-level", "psionic-level-misc"]);
			}
		}));
		on("change:class-psionic-power change:ability-psionic-power change:misc-psionic-power", TAS.callback(function eventUpdatePsionicPower(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && eventInfo.sourceAttribute==='ability-psionic-power')) {
				SWUtils.updateRowTotal(["psionic-power_max", "class-psionic-power", "ability-psionic-power", "misc-psionic-power"]);
			}
		}));
		on("change:selected-ability-psionic-power change:psionic-level-total", TAS.callback(function eventUpdatePsionicBonusPower(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updatePsionicBonusPower();
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFPsionic module loaded        ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		updatePsionicBonusPower: updatePsionicBonusPower
	};
}());
var PFMythic = PFMythic || (function () {
	'use strict';
	var
	/* updateMythicPathHP
	* Updates total at bottom of Mythic Path Information grid */
	updateMythicPathHP = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["mythic-tier", "mythic-hp", "total-mythic-hp"], function (values) {
			var tot = 0,
			currTot = 0,
			setter = {},
			params = {};
			try {
				tot = (parseInt(values["mythic-tier"], 10) || 0) * (parseInt(values["mythic-hp"], 10) || 0);
				currTot = parseInt(values["total-mythic-hp"], 10) || 0;
				//TAS.debug("tot=" + tot + ", currTot=" + currTot);
				if (currTot !== tot) {
					setter["total-mythic-hp"] = tot;
				}
			} catch (err) {
				TAS.error("PFMythic.updateTierMythicPower error", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/* updateTierMythicPower sets tier mp*/
	updateTierMythicPower = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		//TAS.debug("entered updateTierMythicPower");
		getAttrs(["tier-mythic-power", "mythic-tier"], function (values) {
			var totalTier,
			curr,
			setter = {},
			params = {},
			finished = false;
			try {
				totalTier = 3 + 2 * (parseInt(values["mythic-tier"], 10) || 0);
				curr = parseInt(values["tier-mythic-power"], 10) || 0;
				//TAS.debug("totalTier=" + totalTier + ", curr=" + curr);
				if (curr !== totalTier) {
					setter["tier-mythic-power"] = totalTier;
				}
			} catch (err) {
				TAS.error("PFMythic.updateTierMythicPower error", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("Leaving PFMythic.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["mythic-adventures-show"], function (v) {
			try {
				if (v["mythic-adventures-show"] == "1") {
					updateMythicPathHP(done,silently);
					updateTierMythicPower();
				} else {
					done();
				}
			} catch (err2) {
				TAS.error("PFMythic.recalculate", err2);
				done();
			}
		});
	},
	registerEventHandlers = function () {
		//mythic path and power
		on("change:mythic-tier change:mythic-hp", TAS.callback(function eventupdateMythicPathHP(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateMythicPathHP();
				updateTierMythicPower();
			}
		}));
		//mythic path
		on("change:mythic-hp", TAS.callback(function eventUpdateTierMythicPower(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateMythicPathHP();
			}
		}));
		on("change:misc-mythic-power change:tier-mythic-power", TAS.callback(function eventUpdateMythicPower(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && eventInfo.sourceAttribute==='tier-mythic-power')) {
				SWUtils.updateRowTotal(["mythic-power_max", "tier-mythic-power", "misc-mythic-power"]);
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFMythic module loaded         ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		updateTierMythicPower: updateTierMythicPower,
		updateMythicPathHP: updateMythicPathHP
	};
}());
var PFHealth = PFHealth || (function () {
	'use strict';
	var 
	/*setWoundLevel sets would level based on current HP when you already have all fields.
	* sets  @{condition-Wounds} based on :
	*@hp current hp
	*@grazed {int} hp  value for grazed level
	*@wounded {int} hp value for wounded level
	*@critical {int} hp value for critical level
	*@currWounds {int}  value of @{condition-Wounds}
	*/
	setWoundLevel = function (hp, grazed, wounded, critical, currWounds) {
		var setWounds = 0;
		if (hp <= grazed) {
			if (hp > wounded) {
				setWounds = 1;
			} else if (hp > critical) {
				setWounds = 2;
			} else {
				setWounds = 3;
			}
		}
		//TAS.debug("PFHealth.setWoundLevel, hp:"+hp+", currWounds:"+currWounds+", setWounds:"+setWounds);
		if (setWounds !== currWounds) {
			setAttrs({
				"condition-Wounds": setWounds
			});
		}
	},
	/*setWoundLevelLookup - looks up data needed to set current would level.
	* calls setWoundLevel
	* @hp {int} the current hit points. will look up if this is not set.
	*/
	setWoundLevelLookup = function (hp) {
		//TAS.debug"PFHealth.setWoundLevelLookup, hp passed in is:" + hp);
		getAttrs(["HP", "HP_grazed", "HP_wounded", "HP_critical", "condition-Wounds"], function (v) {
			if (isNaN(parseInt(hp, 10))) {
				hp = parseInt(v["HP"], 10) || 0;
			}
			//TAS.debug("PFHealth.setWoundLevelLookup",v);
			setWoundLevel(hp, parseInt(v["HP_grazed"], 10) || 0, parseInt(v["HP_wounded"], 10) || 0, parseInt(v["HP_critical"], 10) || 0, parseInt(v["condition-Wounds"], 10) || 0);
		});
	},
	/*setWoundThreshholds - sets wound thresholds when you already have hp data.
	* Also calls setWoundLevel
	* @hp {int} = current hit points @{HP}
	* @maxHP {int} = max hp @{HP|max}
	* @currWoundLevel {int} = @{condition-Wounds}
	* @abilityMod {int} = usually @{CON-mod} or mod of whataver ability is used. 0 if no ability (like undead)
	*/
	setWoundThreshholds = function (hp, maxHP, currWoundLevel, abilityMod) {
		var grazed = Math.floor(maxHP * 0.75),
		wounded = Math.floor(maxHP * 0.5),
		critical = Math.floor(maxHP * 0.25),
		disabled = ((abilityMod > 0 ? abilityMod : 0) * -1);
		getAttrs(["HP_grazed", "HP_wounded", "HP_critical", "HP_disabled"], function (v) {
			var setter = {};
			if ((parseInt(v["HP_grazed"], 10) || 0) !== grazed) {
				setter["HP_grazed"] = grazed;
			}
			if ((parseInt(v["HP_wounded"], 10) || 0) !== wounded) {
				setter["HP_wounded"] = wounded;
			}
			if ((parseInt(v["HP_critical"], 10) || 0) !== critical) {
				setter["HP_critical"] = critical;
			}
			if ((parseInt(v["HP_disabled"], 10) || 0) !== disabled) {
				setter["HP_disabled"] = disabled;
			}
			if (_.size(setter) > 0) {
				setAttrs(setter, PFConst.silentParams);
			}
		});
		setWoundLevel(hp, grazed, wounded, critical, currWoundLevel);
	},
	/*setWoundThreshholdsLookup
	* Sets wound thresholds by looking up values for "are we even useing wound threshold rules?" and the max hit points.
	* Calls the other setWoundThresholds
	* If Wound Threshholds are not used, makes sure that condition-Wounds is set to 0.
	*/
	setWoundThreshholdsLookup = function (eventInfo) {
		getAttrs(["HP", "HP_max", "wound_threshold-show", "condition-Wounds", "HP-ability-mod"], function (v) {
			if (v["wound_threshold-show"] == "1") {
				setWoundThreshholds(parseInt(v["HP"], 10) || 0, parseInt(v["HP_max"], 10) || 0, parseInt(v["condition-Wounds"], 10) || 0, parseInt(v["HP-ability-mod"], 10) || 0);
			} else if ((parseInt(v["condition-Wounds"], 10) || 0) > 0) {
				setAttrs({
					"condition-Wounds": "0"
				});
			}
		});
	},
	/* updateCurrHP- when updating hp, check nonLethalDmg level and wound threshold levels*/
	updateCurrHP = function (hp, temphp, nonLethalDmg, usesWounds, hpAbility, hpAbilityMod, staggered) {
		if (hpAbility != "0") {
			if (nonLethalDmg >= (hp + temphp + (usesWounds ? (1 + hpAbilityMod) : 0))) {
				setAttrs({
					"condition-Staggered": "1"
				});
			} else if (staggered == "1") {
				setAttrs({
					"condition-Staggered": "0"
				});
			}
		}
		if (usesWounds) {
			setWoundLevelLookup(hp);
		}
	},
	/* updateCurrHPLookup - looks up data and calls updateCurrHP */
	updateCurrHPLookup = function () {
		getAttrs(["HP", "HP-temp", "non-lethal-damage", "wound_threshold-show", "HP-ability", "HP-ability-mod", "condition-Staggered"], function (v) {
			//TAS.debug("PFHealth.updateCurrHPLookup",v);
			updateCurrHP(parseInt(v["HP"], 10) || 0, parseInt(v["HP-temp"], 10) || 0, parseInt(v["non-lethal-damage"], 10) || 0, v["wound_threshold-show"] == "1" ? 1 : 0, v["HP-ability"], parseInt(v["HP-ability-mod"], 10) || 0, v["condition-Staggered"]);
		});
	},
	/** updateMaxHPLookup
	* sets max HP
	* @param {function} callback when done
	* @param {boolean} silently if T then call setAttrs with {silent:True}
	* @param {boolean} forceReset recalculates max HP and sets HP to it.
	* @param {object} eventInfo unused
	*/
	updateMaxHPLookup = function (callback, silently,forceReset,eventInfo) {
		var done = _.once(function () {
			TAS.debug("leaving updateMaxHPLookup");
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["HP", "HP_max", "HP-ability", "HP-ability-mod", "level", "total-hp", "total-mythic-hp", "condition-Drained", "HP-formula-mod", "HP-temp", "mythic-adventures-show", "wound_threshold-show", 
			"condition-Wounds", "non-lethal-damage", "condition-Staggered", "hp_ability_bonus"], function (v) {
			var abilityMod = parseInt(v["HP-ability-mod"], 10) || 0,
			abilityBonus = (abilityMod * (parseInt(v["level"], 10) || 0)),
			currHPMax = parseInt(v["HP_max"], 10) || 0,
			currHP = parseInt(v["HP"], 10) || 0,
			tempHP = parseInt(v["HP-temp"], 10) || 0,
			nonLethal = parseInt(v["non-lethal-damage"], 10) || 0,
			newHPMax = 0,
			currWoundLevel = 0,
			usesWounds = 0,
			setter={};
			try {
				//TAS.debug("at updateMaxHPLookup",v);
				newHPMax = (abilityBonus + (parseInt(v["total-hp"], 10) || 0) + (parseInt(v["HP-formula-mod"], 10) || 0) + (5 * (parseInt(v["condition-Drained"], 10) || 0))) + (v["mythic-adventures-show"] == "1" ? (parseInt(v["total-mythic-hp"], 10) || 0) : 0);
				if (forceReset || currHPMax !== newHPMax) {
					setter = {
						"HP_max": newHPMax,
						"non-lethal-damage_max": newHPMax,
						"hp_ability_bonus": abilityBonus
					};
					if (forceReset) {
						setter["HP"]=newHPMax;
						currHP=newHPMax;
						if (nonLethal !== 0){
							nonLethal=0;
							setter["condition-Staggered"] = 0;
							setter["non-lethal-damage"] = 0;
						}
					}
					usesWounds= parseInt(v["wound_threshold-show"],10)||0;
					if (usesWounds) {
						if (forceReset){
							setter["condition-Wounds"] = 0;
							currWoundLevel = 0;
						} else {
							currWoundLevel = (parseInt(v["condition-Wounds"], 10) || 0);
						}
						if (currHPMax !== newHPMax){
							setWoundThreshholds(currHP + tempHP, newHPMax, currWoundLevel, abilityMod);
						}
					}
				}
			} catch (err) {
				TAS.error("PFHealth.updateMaxHPLookup", err);
			} finally {
				if (_.size(setter)>0){
					setAttrs(setter, PFConst.silentParams, done);
				} else {
					done();
				}
			}
		});
	},
	/* updateTempMaxHP
	* sets temp hp
	*/
	updateTempMaxHP = function (callback, silently,forceReset) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["HP-temp", "HP-temp_max", "HP-temp-misc", "buff_HP-temp-total"], function (v) {
			var newHPTempMax,
			currHPTemp,
			newHPTemp,
			params = {};
			try {
				//TAS.debug("at updateTempMaxHP",v);
				newHPTempMax = (parseInt(v["HP-temp-misc"], 10) || 0) + (parseInt(v["buff_HP-temp-total"], 10) || 0);
				currHPTemp = parseInt(v["HP-temp"], 10) || 0;
				newHPTemp = forceReset ? newHPTempMax : (currHPTemp + newHPTempMax - currHPTemp);
				if (forceReset || newHPTemp !== currHPTemp) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs({
						"HP-temp": newHPTemp,
						"HP-temp_max": newHPTempMax
					}, params, function () {
						updateCurrHPLookup(); //check for change due to non lethal
						done();
					});
				} else {
					done();
				}
			} catch (err) {
				TAS.error("updateTempMaxHP", err);
				done();
			}
		});
	},
	setToPFS = function (callback,eventInfo){
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		});
		setAttrs({'use_prestige_fame':1, 'auto_calc_hp':1, 'autohp_percent':1,'maxhp_lvl1':1},
		PFConst.silentParams, function (){
			if (eventInfo){
				PFClassRaceGrid.autoCalcClassHpGrid(done,false,eventInfo);
			}
		});
	},
	migrate = function(callback,  oldversion){
		var done = _.once(function(){
			TAS.debug("leaving PFHealth.migrate 2");
			if (typeof callback === "function"){
				callback();
			}
		});
		PFMigrate.migrateHPMisc(done);
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFHealth.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		callUpdateMaxHPLookup = _.once(function () {
			updateMaxHPLookup(done, silently);
		}),
		callUpdateTempHP = _.once(function () {
			updateTempMaxHP(callUpdateMaxHPLookup);
		});
		TAS.debug("at PFHealth.recalculate");
		migrate(callUpdateTempHP,oldversion);
	},
	registerEventHandlers = function () {
		on("change:set_pfs",TAS.callback(function eventsetPFSFlag(eventInfo){
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if(eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				getAttrs(["set_pfs"],function(v){
					if (parseInt(v.set_pfs,10)){
						setToPFS(null,eventInfo);
					}
				});
			}
		}));
		//hp************************************************************************
		on("change:hp-ability-mod change:level change:total-hp change:total-mythic-hp change:hp-formula-mod change:HP-misc", TAS.callback(function eventUpdateHPPlayerMisc(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api" || (eventInfo.sourceType === "sheetworker" && eventInfo.sourceAttribute !== "hp-misc")) {
				updateMaxHPLookup();
			}
		}));
		on("change:mythic-adventures-show", TAS.callback(function eventUpdateHPPlayer(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				getAttrs(["total-mythic-hp"], function (v) {
					if ((parseInt(v["total-mythic-hp"], 10) || 0) > 0) {
						updateMaxHPLookup();
					}
				});
			}
		}));
		on("change:hp-temp-misc", TAS.callback(function eventUpdateTempHP(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateTempMaxHP();
			}
		}));
		on("change:HP_reset", TAS.callback(function eventResetHP(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateMaxHPLookup(null,null,true);
				updateTempMaxHP(null,null,true);
				setAttrs({
					"HP_reset": "0"
				}, PFConst.silentParams);
			}
		}));
		on("change:HP change:non-lethal-damage", TAS.callback(function eventUpdateHPCurr(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateCurrHPLookup(eventInfo);
			}
		}));
		on("change:wound_threshold-show", TAS.callback(function eventResetConditionWounds(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				setWoundThreshholdsLookup(eventInfo);
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFHealth module loaded         ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		migrate:migrate,
		recalculate: recalculate,
		setWoundLevel: setWoundLevel,
		setWoundLevelLookup: setWoundLevelLookup,
		setWoundThreshholds: setWoundThreshholds,
		setWoundThreshholdsLookup: setWoundThreshholdsLookup,
		updateCurrHP: updateCurrHP,
		updateCurrHPLookup: updateCurrHPLookup,
		updateMaxHPLookup: updateMaxHPLookup,
		updateTempMaxHP: updateTempMaxHP,
		setToPFS: setToPFS
	};
}());
var PFSaves = PFSaves || (function () {
	'use strict';
	var saveTypes = ["Fort", "Ref", "Will"],
	applyConditions = function (callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["condition-Fear", "condition-Sickened", "condition-Drained", "condition-Wounds", "saves-cond", "has_endurance_feat", "wounds_gritty_mode", "wound_threshold-show"], function (v) {
			var fear = 0,
			sickened = 0,
			drained = 0,
			wounds = 0,
			currCond = 0,
			newCond = 0,
			params = {},
			setter = {};
			try {
				fear = parseInt(v["condition-Fear"], 10) || 0;
				sickened = parseInt(v["condition-Sickened"], 10) || 0;
				drained = parseInt(v["condition-Drained"], 10) || 0;
				wounds = (parseInt(v["wound_threshold-show"], 10) || 0) * PFUtils.getWoundPenalty((parseInt(v["condition-Wounds"], 10) || 0), (parseInt(v.has_endurance_feat, 10) || 0), (parseInt(v.wounds_gritty_mode, 10) || 0));
				currCond = parseInt(v["saves-cond"], 10) || 0;
				newCond = drained - fear - sickened - wounds;
				if (currCond !== newCond) {
					setter["saves-cond"] = newCond;
				}
			} catch (err) {
				TAS.error("PFSaves.applyConditions", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	/* updateSave - updates the saves for a character
	* @save = type of save: Fort, Ref, Will  (first character capitalized)
	*/
	updateSave = function (save, callback, silently) {
		var fields = [save, "total-" + save, save + "-ability-mod", save + "-trait", save + "-enhance", save + "-resist", save + "-misc", "saves-cond", "buff_" + save + "-total"];
		SWUtils.updateRowTotal(fields, 0, [], false, callback, silently);
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("leaving PFSaves.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		saved = _.after(3, function () {
			//TAS.debug"finished 3 saves");
			done();
		});
		TAS.debug("at PFSaves.recalculate");
		try {
			applyConditions(function () {
				try {
					updateSave("Fort", saved, silently);
					updateSave("Ref", saved, silently);
					updateSave("Will", saved, silently);
				} catch (err2) {
					TAS.error("PFSaves.recalculate inner saves", err2);
					done();
				}
			}, silently);
		} catch (err) {
			TAS.error("PFSaves.recalculate OUTER", err);
			done();
		}
	},
	events = {
		saveEventsAuto: "change:saves-cond change:total-REPLACE change:REPLACE-ability-mod",
		saveEventsPlayer: "change:REPLACE-trait change:REPLACE-enhance change:REPLACE-resist change:REPLACE-misc"
	},
	registerEventHandlers = function () {
		_.each(saveTypes, function (save) {
			var eventToWatch = events.saveEventsAuto.replace(/REPLACE/g, save);
			on(eventToWatch, TAS.callback(function eventUpdateSaveAuto(eventInfo) {
				if (eventInfo.sourceType === "sheetworker") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event for " + save + ": " + eventInfo.sourceType);
					updateSave(save, eventInfo);
				}
			}));
		});
		_.each(saveTypes, function (save) {
			var eventToWatch = events.saveEventsPlayer.replace(/REPLACE/g, save);
			on(eventToWatch, TAS.callback(function eventUpdateSavePlayer(eventInfo) {
				if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event for " + save + ": " + eventInfo.sourceType);
					updateSave(save, eventInfo);
				}
			}));
		});
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFSaves module loaded          ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		saveTypes: saveTypes,
		applyConditions: applyConditions,
		updateSave: updateSave
	};
}());
var PFSize = PFSize || (function () {
	'use strict';
	var
	sizeModToEasySizeMap={
		'-8':8,
		'-4':7,
		'-2':6,
		'-1':5,
		 '0':4,
		 '1':3,
		 '2':2,
		 '4':1,
		 '8':0
	},
	/** getSizeFromText - returns size mod based on size display name
	* @param {string} sizeDisplay size in english (medium, large, gargantuan, tiny, etc)
	* @returns {jsobj} map of {"size":size mod for AC,"skillSize": size mod for fly}
	*/
	getSizeFromText = function (sizeDisplay) {
		var sizeMap = {
			"size": 0,
			"skillSize": 0
		};
		try {
			if (sizeDisplay) {
				sizeDisplay = sizeDisplay.toLowerCase();
				switch (sizeDisplay) {
					case "medium":
						break;
					case "colossal":
						sizeMap.size = -8;
						sizeMap.skillSize = -8;
						break;
					case "gargantuan":
						sizeMap.size = -4;
						sizeMap.skillSize = -6;
						break;
					case "huge":
						sizeMap.size = -2;
						sizeMap.skillSize = -4;
						break;
					case "large":
						sizeMap.size = -1;
						sizeMap.skillSize = -2;
						break;
					case "small":
						sizeMap.size = 1;
						sizeMap.skillSize = 2;
						break;
					case "tiny":
						sizeMap.size = 2;
						sizeMap.skillSize = 4;
						break;
					case "diminutive":
						sizeMap.size = 4;
						sizeMap.skillSize = 6;
						break;
					case "fine":
						sizeMap.size = 8;
						sizeMap.skillSize = 8;
						break;
					default:
						break;
				}
			}
		} catch (err) {
			TAS.error("get size from text:" + sizeDisplay, err);
			sizeMap.size = 0;
			sizeMap.skillSize = 0;
		} finally {
			return sizeMap;
		}
	},
	/**returns number of levels size went up or down
	* ex: Med to Lg is +1, Med to Sm is -1, Md to Tiny is -2, etc
	@param {int} currSize new size mod , usually value of @{size}
	@param {int} defaultSize default size mod, for sheet it is value of @{default_char_size}
	          for weapon it is @{repeating_weapon_$X_default_size}
	@returns {int} difference in sizes (not difference in size mods)
	*/
	getSizeLevelChange = function (currSize,defaultSize) {
		var newSize,oldSize,levelChange;
		newSize=sizeModToEasySizeMap[String(currSize)];
		oldSize=sizeModToEasySizeMap[String(defaultSize)];
		levelChange = newSize-oldSize;
		return levelChange;
	},
	/**updateDamageDice returns new dice for weapon/attack damage change due to size
	*@param {int} sizediff difference in LEVELS of size (Medium to Large is 1, Medium to Small is -1)
	*@param {int} defaultSize size modifier, necessary since different rules for small
	*@param {int} currDice num dice from 1 to n
	*@param {int} currDie num sides of die : valid only from 1 to 12
	*@returns {jsobj} {dice:n,die:n}
	*/
	updateDamageDice=function(sizediff,defaultSize,currDice,currDie){
		var diceSizes = { 1:["1d1"], 2:["1d2"], 3:["1d3"],   
			4:["1d4"],
			5:["1d6"],
			6:["1d8","2d4"],
			7:["1d10"],
			8:["2d6","3d4","1d12"],
			9:["2d8","4d4"],    10:["3d6","5d4"],    11:["3d8","6d4","2d10"],
			12:["4d6","7d4","2d12"],    13:["4d8","8d4","9d4","5d6","3d10"],
			14:["6d6","5d8","10d4","11d4","9d4","3d12"],
			15:["6d8","7d6","12d4","13d4","4d10"],
			16:["8d6","7d8","14d4","15d4","4d12"],
			17:["8d8","16d4","9d6","10d6","11d6","5d10","17d4","18d4","19d4","5d12"],
			18:["12d6","20d4","9d8","7d10","6d12","21d4","22d4","23d4"],
			19:["12d8","24d4","13d6","14d6","15d6","8d10"],
			20:["16d6","13d8","10d10","8d12"]
		},
		currSize=0,
		dicestring="",
		newDice=0,newDie=0,matches,
		rowdiff=0, currow=0, newrow=0, newrowstring="",
		reversedDiceSizes=_.reduce(diceSizes,function(memo,pairs,idx){
			_.each(pairs,function(pair){ memo[pair]=idx;  }); 
			return memo;
		  },{});
		try {
			currDice=parseInt(currDice,10);
			currDie=parseInt(currDie,10);
			if(!(isNaN(currDice)||isNaN(currDie))){
				dicestring=currDice+"d"+currDie;
				currSize=sizeModToEasySizeMap[String(defaultSize)];
				if (currDice<=0 || currDie > 12 ) {return null;}
				if (currDie===4 && currDice >24){ currDice=24;}
				else if (currDie===6 && currDice > 16) {currDice=16;}
				else if (currDie===8 && currDice > 13) {currDice=13;}
				else if (currDie===10 && currDice > 10) {currDice=10;}
				else if (currDie===12 && currDice > 8) {currDice=8;}
				currow=parseInt(reversedDiceSizes[dicestring],10)||0;
				if (!currow){return null;}
				while (sizediff !== 0){
					if (sizediff > 0){
						if  ((currDie<=6 && currDice===1)|| currSize <=3) {
							rowdiff=1;
						} else {
							rowdiff=2;
						}  
					} else if (sizediff<0) {
						if  ((currDie<=8 && currDice===1)||currSize<=4 ) {
							rowdiff=-1;
						} else {
							rowdiff = -2;
						}
					}
					newrow = currow + rowdiff;
					newrow = Math.min(Math.max(newrow,1),20);
					dicestring = diceSizes[newrow][0];
					matches=dicestring.match(/(\d+)d(\d+)/);
					currDice=parseInt(matches[1],10);
					currDie=parseInt(matches[2],10);
					currow =newrow;
					if (sizediff >0 ) {
						sizediff--;
						if (currow===20){break;}
					} else {
						sizediff++;
						if (currow===1) {break;}
					}
					TAS.debug("updateDamageDice: currow is now"+currow+", diff still:"+sizediff);
				}
			}
		} catch(err){
			TAS.error("updateDamageDice: ",err);
		} finally {
			return {"dice":currDice,"die":currDie};
		}
	},
	updateSize = function (eventInfo, callback, silently) {
		var done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		});
		getAttrs(["size", "old_size", "default_char_size", "CMD-size", "size_display"], function (v) {
			var size =  0,
			oldSize=0,
			defaultSize=0,
			currSize = 0,
			cmbsize = 0,
			levelChange = 0,
			skillSize = 0,
			doubleSkill = 0,
			sizeDisplay = "Medium",
			forceCurr=0,
			params = {},
			setter = {};
			try {
				//TAS.debug("At PFSize.updateSize",v);
				size = parseInt(v.size, 10) || 0;
				if(v.old_size==='x' ){
					forceCurr=true;
					currSize=(parseInt(v["CMD-size"], 10) || 0) * -1;
					defaultSize=currSize;
				} else {
					currSize = parseInt(v.old_size,10)||0;
					defaultSize = parseInt(v.default_char_size,10)||0;
				}
				
				switch (size) {
					case 0:
						break;
					case -8:
						skillSize = -8;
						sizeDisplay = "Colossal";
						break;
					case -4:
						skillSize = -6;
						sizeDisplay = "Gargantuan";
						break;
					case -2:
						skillSize = -4;
						sizeDisplay = "Huge";
						break;
					case -1:
						skillSize = -2;
						sizeDisplay = "Large";
						break;
					case 1:
						skillSize = 2;
						sizeDisplay = "Small";
						break;
					case 2:
						skillSize = 4;
						sizeDisplay = "Tiny";
						break;
					case 4:
						skillSize = 6;
						sizeDisplay = "Diminutive";
						break;
					case 8:
						skillSize = 8;
						sizeDisplay = "Fine";
						break;
				}
				doubleSkill = 2 * skillSize;
				cmbsize = size * -1;
				//here is where we tell attacks damage dice to change.
				levelChange = getSizeLevelChange(currSize,defaultSize);
				if (size !== currSize) {
					setter.size_skill = skillSize;
					setter.old_size = size;
					setter["CMD-size"] = cmbsize;
					setter.size_skill_double = doubleSkill;
					setter.size_display = sizeDisplay;
				} else if (forceCurr){
					setter.old_size= size;
					setter.default_char_size = size;
				} else if (v["size_display"] !== sizeDisplay) {
					setter.size_display = sizeDisplay;
				}
			} catch (err) {
				TAS.error("PFSize.updateSize", err);
			} finally {
				if (_.size(setter) > 0) {
					if (silently) {
						params = PFConst.silentParams;
					}
					setAttrs(setter, params, done);
				} else {
					done();
				}
			}
		});
	},
	migrate = function (callback){
		PFMigrate.migrateSize(callback);
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("Leaving PFSize.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		});
		TAS.debug("At PFSize.recalculate");
		updateSize(null, done, silently);
	},
	registerEventHandlers = function () {
		//size
		on("change:size", TAS.callback(function eventUpdateSize(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updateSize();
			PFEncumbrance.updateLoadsAndLift();
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFSize module loaded           ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		migrate: migrate,
		recalculate: recalculate,
		updateDamageDice: updateDamageDice,
		updateSize: updateSize,
		getSizeFromText: getSizeFromText
	};
}());
var PFInitiative = PFInitiative || (function () {
	'use strict';
	/* updateInitiative * updates the init*/
	var updateInitiative = function (callback, silently) {
		getAttrs(['nodex-toggle'],function(v){
			if (parseInt(v['nodex-toggle'],10)) {
				//if lose dex then lose ability mod no matter what ability it is, since init is a dex check:
				//http://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9tga
				SWUtils.updateRowTotal(["init", "init-trait", "init-misc-mod","checks-cond"], 0, ["condition-Deafened"], false, callback, silently);
			} else {
				SWUtils.updateRowTotal(["init", "init-ability-mod", "init-trait", "init-misc-mod","checks-cond"], 0, ["condition-Deafened"], false, callback, silently);
			}
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.info("Leaving PFInitiative.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		});
		updateInitiative(done, silently);
	},
	registerEventHandlers = function () {
		on("change:init-trait change:condition-Deafened ", TAS.callback(function eventUpdateInitPlayer(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				updateInitiative();
			}
		}));
		on("change:init-ability-mod change:init-misc-mod change:checks-cond change:nodex-toggle", TAS.callback(function eventUpdateInitSheet(eventInfo) {
			if (eventInfo.sourceType === "sheetworker") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				updateInitiative();
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFInitiative module loaded     ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		updateInitiative: updateInitiative
	};
}());
var PFChecks = PFChecks || (function () {
	'use strict';
	var
	/* PFChecks.applyConditions - handles changes to skill and ability checks due to conditions AND buffs.
	* Reads in condition that affect Ability and Skill checks and updates condition fields.
	* checks-cond, Phys-skills-cond, Perception-cond.
	*/
	applyConditions = function (callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		};
		getAttrs(["condition-Blinded", "condition-Fear", "condition-Drained", "condition-Sickened", "condition-Wounds", "has_endurance_feat", "wounds_gritty_mode", "checks-cond", "Phys-skills-cond", "Perception-cond", "buff_Check-total", "wound_threshold-show", "CasterLevel-Penalty"], function (v) {
			//there is no Fascinated, if we add it then:
			//,"condition-Fascinated" -4 to perception
			var setter = {},
			params = {}, buffCheck = 0, drained = 0, fear = 0, sick = 0, woundPenalty = 0, wounds = 0, allSkillsMod = 0, casterlevel = 0, blindedMod = 0, currAllSkills = 0, currPhysSkills = 0, currPerSkills = 0, currCaster = 0;
			try {
				buffCheck = parseInt(v["buff_Check-total"], 10) || 0;
				drained = parseInt(v["condition-Drained"], 10) || 0;
				fear = -1 * (parseInt(v["condition-Fear"], 10) || 0);
				sick = -1 * (parseInt(v["condition-Sickened"], 10) || 0);
				woundPenalty = PFUtils.getWoundPenalty((parseInt(v["condition-Wounds"], 10) || 0), (parseInt(v.has_endurance_feat, 10) || 0), (parseInt(v.wounds_gritty_mode, 10) || 0));
				wounds = (parseInt(v["wound_threshold-show"], 10) || 0) * woundPenalty;
				allSkillsMod = buffCheck + drained + fear + sick + wounds;
				casterlevel = drained + wounds;
				blindedMod = -2 * (parseInt(v["condition-Blinded"], 10) || 0);
				currAllSkills = parseInt(v["checks-cond"], 10) || 0;
				currPhysSkills = parseInt(v["Phys-skills-cond"], 10) || 0;
				currPerSkills = parseInt(v["Perception-cond"], 10) || 0;
				currCaster = parseInt(v["CasterLevel-Penalty"], 10) || 0;
				if (allSkillsMod !== currAllSkills || isNaN(currAllSkills)) {
					setter["checks-cond"] = allSkillsMod;
				}
				if (blindedMod !== currPhysSkills || isNaN(currPhysSkills)) {
					setter["Phys-skills-cond"] = blindedMod;
				}
				if (blindedMod !== currPerSkills || isNaN(currPerSkills)) {
					setter["Perception-cond"] = blindedMod;
				}
				if (casterlevel !== currCaster || isNaN(currCaster)) {
					setter["CasterLevel-Penalty"] = casterlevel;
				}
			} catch (err) {
				TAS.error("PFChecks.applyConditions", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {}, done);
				} else {
					done();
				}
			}
		});
	};
	console.log(PFLog.l + '   PFChecks module loaded         ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		applyConditions: applyConditions
	};
}());
var PFConditions = PFConditions || (function () {
	'use strict';
	var
	/* updateGrapple Ensures Grapple and Pin are mutually exclusive */
	updateGrapple = function () {
		getAttrs(["condition-Pinned", "condition-Grappled"], function (values) {
			if (values["condition-Pinned"] !== "0" && values["condition-Grappled"] !== "0") {
				setAttrs({
					"condition-Pinned": "0"
				});
			} else {
				//user hit either pinned and it undid grapple, or hit grapple first time.
				PFAbilityScores.applyConditions();
			}
		});
	},
	/* updatePin Ensures Grapple and Pin are mutually exclusive */
	updatePin = function () {
		getAttrs(["condition-Pinned", "condition-Grappled"], function (values) {
			if (values["condition-Pinned"] !== "0" && values["condition-Grappled"] !== "0") {
				setAttrs({
					"condition-Grappled": "0"
				});
			} else {
				//user hit grapple and it  undid pinned, or hit pinned first time.
				PFAbilityScores.applyConditions();
			}
		});
	},
	/* updates drain for condition status panel */
	updateDrainCheckbox = function (callback,silently,eventInfo) {
		getAttrs(["condition-Drained", "condition_is_drained"], function (v) {
			var levels = parseInt(v["condition-Drained"], 10) || 0,
			drained = parseInt(v["condition_is_drained"], 10) || 0;
			if (levels !== 0 && drained === 0) {
				setAttrs({
					"condition_is_drained": "1"
				}, PFConst.silentParams);
			} else if (levels === 0 && drained !== 0) {
				setAttrs({
					"condition_is_drained": "0"
				}, PFConst.silentParams);
			}
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("Leaving PFConditions.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		});
		updateDrainCheckbox();
		PFAbilityScores.applyConditions(done);
	},
	events = {
		conditionEventsEither: {
			"change:condition-grappled": [updateGrapple, PFAttackGrid.applyConditions],
			"change:condition-pinned": [updatePin, PFDefense.applyConditions],
			"change:condition-wounds change:has_endurance_feat change:wounds_gritty_mode": [PFChecks.applyConditions, PFSaves.applyConditions, PFAttackGrid.applyConditions, PFDefense.applyConditions]
		},
		conditionEventsPlayer: {
			"change:condition-Sickened": [PFAttackGrid.updateDamage, PFChecks.applyConditions, PFSaves.applyConditions, PFAttackGrid.applyConditions],
			"change:condition-stunned": [PFDefense.updateDefenses, PFDefense.applyConditions],
			"change:condition-Flat-Footed": [PFDefense.updateDefenses],
			"change:condition-deafened": [PFInitiative.updateInitiative, PFSpellCasterClasses.applyConditions],
			"change:condition-fatigued": [PFAbilityScores.applyConditions],
			"change:condition-entangled": [PFAbilityScores.applyConditions, PFAttackGrid.applyConditions],
			"change:condition-drained": [updateDrainCheckbox, PFHealth.updateMaxHPLookup, PFChecks.applyConditions, PFSaves.applyConditions, PFAttackGrid.applyConditions, PFDefense.applyConditions],
			"change:condition-fear": [PFChecks.applyConditions, PFSaves.applyConditions, PFAttackGrid.applyConditions],
			"change:condition-blinded": [PFChecks.applyConditions, PFDefense.applyConditions],
			"change:condition-cowering": [PFDefense.applyConditions],
			"change:condition-invisible": [PFDefense.updateDefenses, PFDefense.applyConditions, PFAttackGrid.applyConditions],
			"change:condition-dazzled": [PFAttackGrid.applyConditions],
			"change:condition-prone": [PFAttackGrid.applyConditions],
			"change:condition-Helpless": [PFAbilityScores.applyConditions]
		}
	},
	registerEventHandlers = function () {
		_.each(events.conditionEventsPlayer, function (functions, eventToWatch) {
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function eventConditionEventsPlayer(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
						methodToCall(null,null,eventInfo);
					}
				}));
			});
		});
		_.each(events.conditionEventsEither, function (functions, eventToWatch) {
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function eventConditionEventsEither(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					methodToCall(null,null,eventInfo);
				}));
			});
		});
		on("change:Perception-cond", TAS.callback(function eventUpdateSkillPerceptionCond(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			PFSkills.verifyHasSkill("Perception",function(hasSkill){
				if (hasSkill){
					PFSkills.updateSkill("Perception", eventInfo);
				} else {
					PFSkills.updateSkill("CS-Perception", eventInfo);
				}
			});
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFConditions module loaded     ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		updateGrapple: updateGrapple,
		updatePin: updatePin,
		updateDrainCheckbox: updateDrainCheckbox
	};
}());
var PFBuffs = PFBuffs || (function () {
	'use strict';
	var buffColumns = PFAbilityScores.abilities.concat(["Ranged", "Melee", "DMG", "AC", "Touch", "CMD", "HP-temp", "Fort", "Will", "Ref", "Check", "CasterLevel"]),
	//why did i make this? it just repeats the ability scores
	allBuffColumns = buffColumns, //buffColumns.concat(PFAbilityScores.abilities),
	/* this is so old no one will be using it*/
	migrate = function (outerCallback) {
		var done = _.once(function () {
			TAS.debug("leaving PFBuffs.migrate");
			if (typeof outerCallback === "function") {
				outerCallback();
			}
		});
		getAttrs(["migrated_buffs", "migrated_effects"], function (v) {
			var setter = {};
			try {
				if (v.migrated_buffs != "1") {
					setter.migrated_buffs = 1;
				}
				if (v.migrated_effects != "1") {
					setter.migrated_effects = 1;
				}
			} catch (err) {
				TAS.error("PFBuffs.migrate", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, {
						silent: true
					}, done);
				} else {
					done();
				}
			}
		});
	},
	/** createTotalBuffEntry - used by parseNPC
	 * adds enabled buff for a new sheet where this is the only buff so sets total as well.
	 * adds attributes to array passed in
	 * @param {string} name name of buff row  for buff-name
	 * @param {string} bufftype  -string from buffColumns
	 * @param {string} buffmacro ?
	 * @param {number} modamount - value for the buff
	 * @param {jsobjectmap} newRowAttrs - object of {name:value} to pass to setAttrs
	 * @return {jsobjectmap} return newRowAttrs after adding maps to it.
	 */
	createTotalBuffEntry = function (name, bufftype, buffmacro, modamount, newRowAttrs) {
		var newRowId = generateRowID();
		newRowAttrs = newRowAttrs||{};
		newRowAttrs["repeating_buff_" + newRowId + "_buff-name"] = name;
		newRowAttrs["repeating_buff_" + newRowId + "_buff-" + bufftype + "_macro-text"] = buffmacro;
		newRowAttrs["repeating_buff_" + newRowId + "_buff-" + bufftype] = modamount;
		newRowAttrs["repeating_buff_" + newRowId + "_buff-" + bufftype + "-show"] = "1";
		newRowAttrs["repeating_buff_" + newRowId + "_buff-enable_toggle"] = "1";
		newRowAttrs["buff_" + bufftype + "-total"] = modamount;
		return newRowAttrs;
	},
	resetStatuspanel = function (callback) {
		var done = _.once(function () { if (typeof callback === "function") { callback(); } }),
		buffTotalsColumns, fields;
		try {
			buffTotalsColumns = _.extend(
			_.map(allBuffColumns, function (col) {
				return "buff_" + col + "-total";
			}),
			_.map(PFAbilityScores.abilities, function (col) {
				return "buff_" + col + "-total_penalty";
			})
			);
			fields = SWUtils.cartesianAppend(["buff_"], buffColumns, ["-total", "_exists"]).concat(
				SWUtils.cartesianAppend(["buff_"], PFAbilityScores.abilities, ["-total", "-total_penalty", "_exists", "_penalty_exists"])
			);
			getAttrs(fields, function (v) {
				var setter = {};
				try {
					setter = _.reduce(allBuffColumns, function (memo, col) {
						var val, field, exists;
						try {
							val = parseInt(v["buff_" + col + "-total"], 10) || 0; field = "buff_" + col + "_exists"; exists = parseInt(v[field], 10) || 0;
							if (val !== 0 && !exists) {
								memo[field] = "1";
							} else if (val === 0 && exists) {
								memo[field] = "";
							}
						} catch (erri1) { } finally {
							return memo;
						}
					}, setter);
					setter = _.reduce(PFAbilityScores.abilities, function (memo, col) {
						var val, field, exists;
						try {
							val = parseInt(v["buff_" + col + "-total_penalty"], 10) || 0; field = "buff_" + col + "_penalty_exists"; exists = parseInt(v[field], 10) || 0;
							if (val !== 0 && !exists) {
								memo[field] = "1";
							} else if (val === 0 && exists) {
								memo[field] = "";
							}
						} catch (erri1) { } finally {
							return memo;
						}
					}, setter);
				} catch (err) {
					TAS.error("PFBuffs.resetStatuspanel error inside calculate exists", err);
				} finally {
					if (_.size(setter) > 0) {
						setAttrs(setter, { silent: true }, done);
					} else {
						done();
					}
				}
			});
		} catch (errO) {
			TAS.error("PFBuffs.resetStatuspanel error creating field array, abort:", errO);
			done();
		}
	},
	/* Sets 1 or 0 for buffexists in status panel - only called by updateBuffTotals. */
	toggleBuffStatusPanel = function (col, val) {
		var field = "buff_" + col + "_exists";
		getAttrs([field], function (v) {
			var setter = {};
			try {
				if (val !== 0 && v[field] != "1") {
					setter[field] = "1";
				} else if (val === 0 && v[field] == "1") {
					setter[field] = "";
				}
			} catch (err) {
				TAS.error("PFBuffs.toggleBuffStatusPanel", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, { silent: true });
				}
			}
		});
	},
	setBuff = function (id, col, callback, silently) {
		var done = function () {
			if (typeof callback === "function") {
				callback();
			}
		},
		idStr = PFUtils.getRepeatingIDStr(id),
		prefix = "repeating_buff_" + idStr + "buff-" + col;
		SWUtils.evaluateAndSetNumber(prefix + "_macro-text", prefix,0,done);
	},
	updateBuffTotals = function (col, callback) {
		var done = _.once(function () {
			TAS.debug("leaving PFBuffs.updateBuffTotals");
			if (typeof callback === "function") {
				callback();
			}
		}),
		isAbility = (PFAbilityScores.abilities.indexOf(col) >= 0);
		try {
			TAS.repeating('buff').attrs('buff_' + col + '-total', 'buff_' + col + '-total_penalty').fields('buff-' + col, 'buff-enable_toggle', 'buff-' + col + '-show').reduce(function (m, r) {
				try {
					var tempM = (r.I['buff-' + col] * ((r.I['buff-enable_toggle']||0) & (r.I['buff-' + col + '-show']||0)));
					tempM=tempM||0;
					if (!(isAbility && tempM < 0)) {
						m.mod += tempM;
					} else {
						m.pen += tempM;
					}
				} catch (err) {
					TAS.error("PFBuffs.updateBuffTotals error:" + col, err);
				} finally {
					return m;
				}
			}, {
				mod: 0,
				pen: 0
			}, function (m, r, a) {
				try {
					//TAS.debug('setting buff_' + col + '-total to '+ (m.mod||0));
					a.S['buff_' + col + '-total'] = m.mod||0;
					toggleBuffStatusPanel(col, m.mod);
					if (isAbility) {
						a.S['buff_' + col + '-total_penalty'] = m.pen||0;
						//TAS.debug("now also check ability penalty status");
						toggleBuffStatusPanel(col + "_penalty", m.pen);
					}
				} catch (errfinalset){
					TAS.error("error setting buff_" + col + "-total");
				}
			}).execute(done);
		} catch (err2) {
			TAS.error("PFBuffs.updateBuffTotals error:" + col, err2);
			done();
		}
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			resetStatuspanel();
			TAS.debug("Leaving PFBuffs.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		numColumns = _.size(allBuffColumns),
		columnDone = _.after(numColumns, done),
		colsDoneCount = 0,
		recalculateBuffColumn = function (ids, col) {
			var rowtotal = _.size(ids),
				totalItUp = _.once(function () {
					colsDoneCount++;
					updateBuffTotals(col, columnDone);
				}),
				rowDone;
			if (rowtotal <=0){
				totalItUp();
				return;
			}
			rowDone = _.after(rowtotal, function () {
				totalItUp();
			});
			try {
				_.each(ids, function (id) {
					try {
						getAttrs(['repeating_buff_'+id+'_buff-enable_toggle',
						'repeating_buff_'+id+'_buff-' + col + '-show'],function(v){
							if (parseInt(v['repeating_buff_'+id+'_buff-enable_toggle'],10) && 
								parseInt(v['repeating_buff_'+id+'_buff-' + col + '-show'],10) ) {
									setBuff(id, col, rowDone, silently);
							} else {
								rowDone();
							}
						});
					} catch (err) {
						TAS.error("PFBuffs.recalculate_recalculateBuffColumn:" + col + ", rowid" + id, err);
						rowDone();
					}
				});
			} catch (err2) {
				TAS.error("PFBuffs.recalculate_recalculateBuffColumn OUTER error:" + col, err2);
				totalItUp();
			}
		};
		getSectionIDs("repeating_buff", function (ids) {
			//TAS.debug("pfbuffsrecalculate there are " + _.size(ids) + " rows and " + numColumns + " columns");
			try {
				if (_.size(ids) > 0) {
					_.each(allBuffColumns, function (col) {
						recalculateBuffColumn(ids, col);
					});
				} else {
					_.each(allBuffColumns, function (col) {
						updateBuffTotals(col, columnDone, silently);
					});
				}
			} catch (err) {
				TAS.error("PFBuffs.recalculate_recalcbuffs", err);
				//what to do? just quit
				done();
			}
		});
	},
	events = {
		// events pass in the column updated macro-text is "either", buffs are auto only
		buffTotalNonAbilityEvents: {
			//ranged and attack are in the PFAttackGrid module
			"Fort": [PFSaves.updateSave],
			"Will": [PFSaves.updateSave],
			"Ref": [PFSaves.updateSave]
		},
		buffTotalAbilityEvents: {
			"STR": [PFAbilityScores.updateAbilityScore],
			"DEX": [PFAbilityScores.updateAbilityScore],
			"CON": [PFAbilityScores.updateAbilityScore],
			"INT": [PFAbilityScores.updateAbilityScore],
			"WIS": [PFAbilityScores.updateAbilityScore],
			"CHA": [PFAbilityScores.updateAbilityScore]
		},
		// events do NOT pass in column updated
		buffTotalEventsNoParam: {
			"DMG": [PFAttackGrid.updateDamage],
			"AC": [PFDefense.updateDefenses],
			"Touch": [PFDefense.updateDefenses],
			"CMD": [PFDefense.updateDefenses],
			"HP-temp": [PFHealth.updateTempMaxHP],
			"Check": [PFChecks.applyConditions]
		}
	},
	registerEventHandlers = function () {
		//BUFFS
		_.each(buffColumns, function (col) {
			//Evaluate macro text upon change
			var eventToWatch = "change:repeating_buff:buff-" + col + "_macro-text";
			on(eventToWatch, TAS.callback(function eventBuffMacroText(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " for column " + col + ", event: " + eventInfo.sourceType);
				setBuff(null, col);
			}));
			//Update total for a buff upon Mod change
			eventToWatch = "change:repeating_buff:buff-" + col + " change:repeating_buff:buff-" + col + "-show";
			on(eventToWatch, TAS.callback(function PFBuffs_updateBuffTotalsShow(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "sheetworker" || /show/i.test(eventInfo.sourceAttribute)) {
					updateBuffTotals(col);
				}
			}));
		});
		on("change:repeating_buff:buff-enable_toggle remove:repeating_buff", TAS.callback(function PFBuffs_updateBuffTotalsToggle(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "sheetworker" || /toggle/i.test(eventInfo.sourceAttribute)) {
				_.each(buffColumns, function (col) {
					updateBuffTotals(col);
				});
			}
		}));
		//generic easy buff total updates
		_.each(events.buffTotalNonAbilityEvents, function (functions, col) {
			var eventToWatch = "change:buff_" + col + "-total";
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function event_updateBuffNonAbilityEvents(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					if (eventInfo.sourceType === "sheetworker") {
						methodToCall(col, eventInfo);
					}
				}));
			});
		});
		_.each(events.buffTotalAbilityEvents, function (functions, col) {
			var eventToWatch = "change:buff_" + col + "-total change:buff_" + col + "-total_penalty";
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function event_updateBuffAbilityEvents(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					if (eventInfo.sourceType === "sheetworker") {
						methodToCall(col, eventInfo);
					}
				}));
			});
		});
		_.each(events.buffTotalEventsNoParam, function (functions, col) {
			var eventToWatch = "change:buff_" + col + "-total";
			_.each(functions, function (methodToCall) {
				on(eventToWatch, TAS.callback(function eventBuffTotalNoParam(eventInfo) {
					TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
					if (eventInfo.sourceType === "sheetworker") {
						methodToCall(null,false, eventInfo);
					}
				}));
			});
		});
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFBuffs module loaded          ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		recalculate: recalculate,
		createTotalBuffEntry: createTotalBuffEntry,
		buffColumns: buffColumns,
		migrate: migrate,
		setBuff: setBuff,
		resetStatuspanel: resetStatuspanel,
		updateBuffTotals: updateBuffTotals
	};
}());
var PFNPC = PFNPC || (function () {
	'use strict';
	var
	/* setToNPC when first setting a sheet , set other default config settings
	* also switch to NPC page for when user leaves ocnfig page.
	*/
	setToNPC = function (callback,eventInfo){
		var done = _.once(function(){
			if (typeof callback === "function"){
				callback();
			}
		});
		getAttrs(["npc-hd","npc-hd-num","level","npc-cr","is_newsheet"],function(v){
			//determine if this is a new sheet. if so set default config choices:
			if ( parseInt(v.is_newsheet,10) || (  !(  parseInt(v['npc-hd'],10)  || parseInt(v['npc-hd-num'],10) || parseInt(v['level'],10) || parseInt(v['npc-cr'],10) ))) {
				setAttrs({ 'auto_calc_hp':1, 'autohp_percent':1, 'maxhp_lvl1':0, 'normal_macro_show': 1, 'max-dex-source':3, 
					'use_traits':0 , 'use_racial_traits':0, 'tab':8, 'is_v1':1}, PFConst.silentParams, done);
			} else {
				//should we do something? at least recalc the commandmacros?
				done();
			}
		});
	},
	recalculate = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFNPC.recalculate");
			if (typeof callback === "function") { callback(); }
		});
		PFMigrate.migrateNPC(done,silently);
	},
	registerEventHandlers = function () {
		on("change:is_npc", TAS.callback(function eventSetIsNPCFlag(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				getAttrs(['is_npc'],function(v){
					if (parseInt(v.is_npc,10)===1){
						setToNPC(eventInfo);
					}
				});
			}
		}));
	};
	registerEventHandlers();
	console.log(PFLog.l + '   PFNPC module loaded            ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		setToNPC: setToNPC,
		recalculate: recalculate
	};
}());
var PFNPCParser = PFNPCParser || (function () {
	'use strict';
	var 
	npcCompendiumAttributesPlayer = ["character_name", "type_compendium", "dr_compendium", "sr_compendium", "xp_compendium", "bab_compendium", 
		"init_compendium", "npc_hp_compendium", "ac_compendium", "fort_compendium", "ref_compendium", "will_compendium", "senses_compendium", 
		"size_compendium", "str_compendium", "dex_compendium", "con_compendium", "int_compendium", "wis_compendium", "cha_compendium", 
		"speed_compendium", "space_compendium", "reach_compendium", "npc-special-attacks", "npc-spellike-ability-text", "npc-melee-attacks-text", 
		"npc-ranged-attacks-text", "npc-spells-known-text", "npc-feats-text", "cr_compendium", "npc-feats-text", "skills_compendium", 
		"racial_mods_compendium", "SQ_compendium", "content_compendium"],

	/* ******************************** PARSING ******************************** */

	/** returns number from a string, first looks at end of string, then beginning, then anywhere in middle
	* so it works with both compendium (number at end) and SRD ("init " number at beginning) or just a string number
	*@param {string} initstring from the compendium entry
	*@returns {int} the initiative modifier
	*/
	getNPCInit = function (initstring) {
		var numberInit;
		if ((/[\-\+]{0,1}\d+$/).test(initstring)) {
			numberInit = parseInt(initstring.match(/[\-\+]{0,1}\d+$/), 10);
		} else if ((/^(Init\s){0,1}[\-\+]{0,1}\d+/i).test(initstring)) {
			numberInit = parseInt(initstring.match(/[\-\+]{0,1}\d+$/), 10);
		} else if ((/^[\-\+]{0,1}\d+$/).test(initstring)) {
			numberInit = parseInt(initstring.match(/^[\-\+]{0,1}\d+$/), 10);
		} else if ((/[\-\+]{0,1}\d+/).test(initstring)) {
			numberInit = parseInt(initstring.match(/[\-\+]{0,1}\d+/), 10);
		}
		if (!isNaN(numberInit)) {
			return numberInit;
		}
		return 0;
	},
	/**getAbilityAndMod- returns the number and mod for an ability
	* @param {string} numberAsString the ability score -a number in string form
	* @returns {base: number or '-', mod:number}
	*/
	getAbilityAndMod = function (numberAsString) {
		var base = parseInt(numberAsString, 10),
		mod = 0;
		if (!isNaN(base)) {
			mod = Math.floor((base - 10) / 2);
			return {
				"base": base,
				"mod": mod
			};
		}
		if (/dash|\-|8212|—/i.test(numberAsString)) {
			return {
				"base": "-",
				"mod": 0
			};
		}
		return {
			"base": 10,
			"mod": 0
		};
	},
	/** parseNPChp - parses statblock hp string such as 203 (14d10+126)
	* @param {string} hpstring - string format: "15 (3d8 + 2d8 + 4) Fast Healing 5"  can have multiple xdy, and any string left after ) is considered healing note.
	* @param {int} abilityMod: number representing ability score mod (normally CON-mod)
	* @returns {object} {hp:0,hdie1:0,hdice1:0,hdie2:0,hdice2:0,misc:0,heal:""}
	*  where hdie1 d hdice1 is racial, and 2 is class, can go up to n classes
	*/
	parseNPChp = function (hpstring, abilityMod) {
		var newHP = 0,
		plus = 0,
		matches,
		hparray = {
			hp: 0,
			hdie1: 0,
			hdice1: 0,
			basehp: 0,
			misc: 0,
			heal: ""
		},
		totalAbility = 0,
		matchessub,
		i = 0,
		tempstr = "",
		tempHD = 0,
		tempHdn = 0,
		tempmisc = 0,
		calcHP = 0;
		abilityMod = abilityMod || 0;
		if ((/^hp\s/i).test(hpstring)){
			hpstring = hpstring.slice(3);
		}
		//TAS.debug"parseNPChp", hpstring, abilityMod);
		newHP = parseInt(hpstring, 10);
		if (!isNaN(newHP)) {
			hparray.hp = newHP;
			if (hpstring.indexOf("(") > 0) {
				hpstring = hpstring.slice(hpstring.indexOf("(") + 1);
			}
			matches = hpstring.match(/\d+d\d+/ig);
			if (matches) {
				for (i = 0; i < matches.length; i++) {
					tempstr = matches[i];
					matchessub = tempstr.match(/(\d+)d(\d+)/i);
					if (matchessub && matchessub[1] && matchessub[2]) {
						tempHdn = parseInt(matchessub[1], 10) || 0;
						tempHD = parseInt(matchessub[2], 10) || 0;
						if (i > 0 && tempHD === 8 && hparray.hdie1 !== 8) {
							hparray["hdice" + (i + 1)] = hparray.hdice1;
							hparray["hdie" + (i + 1)] = hparray.hdie1;
							hparray.hdice1 = tempHdn;
							hparray.hdie1 = tempHD;
						} else {
							hparray["hdice" + (i + 1)] = tempHdn;
							hparray["hdie" + (i + 1)] = tempHD;
						}
					}
				}
			}
			//skip to next
			if (i > 0) {
				i--;
				hpstring = hpstring.slice(hpstring.indexOf(matches[i]) + matches[i].length);
			}
			// some entries have "plus" instead of "+"
			matches = hpstring.match(/\s*?([+\-]\s*\d+)\s*?|\s*?plus\s(\d+)\s*?/);
			if (matches) {
				hpstring = hpstring.slice(matches.index + matches[0].length);
				if (matches[1]) {
					plus = parseInt(matches[1].replace(/\s/g, ''), 10) || 0;
				} else if (matches[2]) {
					plus = parseInt(matches[2], 10) || 0;
				}
			} 
			//bug in compendium: no minus sign, so adds mod to end of die:
			//  instead of 1d8-1 it's 1d81, 1 dee 81 !
			// see Flying Squirrel
			if (!matches && hparray.hdie1 > 10 && (abilityMod < 0 || (hparray.hdie1 !== 12 && hparray.hdie1 !== 20))) {
				plus = hparray.hdie1 % 10;
				plus = -1 * plus;
				hparray.hdie1 = Math.floor(hparray.hdie1 / 10);
				TAS.warn("negative in compendium: plus is -1 * hit die mod 10");
			}
			totalAbility = abilityMod * hparray.hdice1;
			tempmisc = plus - totalAbility;
			//TAS.debug"plus "+plus +" minus con:"+totalAbility+" = "+ tempmisc);
			//misc is any bonus to the dice that is not due to CON modifier
			hparray.misc = tempmisc;
			if (hpstring.indexOf(")") >= 0) {
				hpstring = hpstring.slice(hpstring.indexOf(")") + 1);
			}
			if (hpstring.indexOf(";") === 0) {
				hpstring = hpstring.slice(1);
			}
			if (hpstring.length > 0) {
				hparray.heal = hpstring;
			}
		}
		//set the base hp to only the hd average, so will be less than what is in statblock
		hparray.basehp = PFUtils.getAvgHP(hparray.hdice1, hparray.hdie1);
		//check total, if does not match, add more
		calcHP = PFUtils.getAvgHP(hparray.hdice1, hparray.hdie1) + tempmisc+ (abilityMod *hparray.hdice1);
		if (calcHP && calcHP !== newHP) {
			//wtf?
			TAS.warn("parseNPChp, hp not adding right, should be:" + newHP + " but getNPCHP returns " + calcHP,hparray);
			hparray.misc += (newHP - calcHP);
		}

		//check:
		//basehp=newHP-abilityMod
		return hparray;
	},
	/** parseNPCAC - parses AC string from statblock
	* @param {string} acstring - format: "24, Touch 24, Flat-footed 16 (+6 Deflection, +7 Dex, +1 Dodge, +1 Armor, +1 Shield, +1 Size, +6 Natural) some note can go here"
	* can start with "AC " or not.
	* if it doesn't add up then the bonus will be added to misc.
	* (others include: Luck, Sacred/Profane, Circumstance, Enhancement, Insight, Morale) - these ALL go to CMD too (and dodge, deflection).
	* @param {string} cmdStr string for cmd , just checks for a number in the string
	* @param {int} abilityMod - to apply, usually dex.
	* @param {int} sizeMod - ac mod due to size.
	* @returns {ac:10,touch:10,ff:10,armor:0,shield:0,deflect:0,dex:0,dodge:0,natural:0,misc:0,note:,size:0,acbuff:0,altability:""}
	*/
	parseNPCAC = function (acstring, cmdStr, abilityMod, sizeMod) {
		var matches,
		tempnum = 0,
		tempstr='',
		acMap = {
			ac: 10,
			touch: 10,
			ff: 10,
			armor: 0,
			shield: 0,
			deflect: 0,
			dex: 0,
			dodge: 0,
			natural: 0,
			misc: 0,
			note: "",
			size: 0,
			altability: "",
			acbuff: 0,
			uncanny: 0 ,
			cmd: 10,
			notes:''
		};
		abilityMod = abilityMod || 0;
		sizeMod = sizeMod || 0;
		//TAS.debug"parseNPCAC: string:" + acstring + ", ability:" + abilityMod + ", size:" + sizeMod);
		try {
			if ((/^ac\s/i).test(acstring)){
				acstring = acstring.slice(3);
			}
			acMap.ac = parseInt(acstring,10)||0;
			if ((/[\-\+]{0,1}\d+/).test(cmdStr)){
				matches=cmdStr.match(/[\-\+]{0,1}\d+/);
				acMap.cmd = parseInt(matches,10)||0;
				tempstr=cmdStr.slice(matches.index+matches[0].length);
				if(tempstr){
					acMap.notes=tempstr;
				}
			}
			//get other AC totals
			matches = acstring.match(/Touch\s*?(\d+)/i);
			if (matches && matches[1]) {
				acMap.touch = parseInt(matches[1], 10);
			}
			matches = acstring.match(/Flat\-footed\s*?(\d+)/i);
			if (matches && matches[1]) {
				acMap.ff = parseInt(matches[1], 10);
			}
			//get modifiers compendium has all negatives as "1" intead of "-1"
			matches = acstring.match(/([+\-]??\d+)\s*?Deflect[,\i\s]/i);
			if (matches && matches[1]) {
				acMap.deflect = parseInt(matches[1], 10);
			}
			matches = acstring.match(/([+\-]??\d+)\s*?Nat[,u\s]/i);
			if (matches && matches[1]) {
				acMap.natural = parseInt(matches[1], 10);
			}
			matches = acstring.match(/([+\-]??\d+)\s*?Dodge/i);
			if (matches && matches[1]) {
				acMap.dodge = parseInt(matches[1], 10);
			}
			matches = acstring.match(/([+\-]??\d+)\s*?Size/i);
			if (matches && matches[1]) {
				acMap.size = parseInt(matches[1], 10);
			}
			//compendium size wrong: missing minus sign.
			// see Marilith
			if (acMap.size !== sizeMod) {
				acMap.size = sizeMod;
			}
			matches = acstring.match(/([+\-]??\d+)\s*?armor/i);
			if (matches && matches[1]) {
				acMap.armor = parseInt(matches[1], 10);
			}
			matches = acstring.match(/([+\-]??\d+)\s*?shield/i);
			if (matches && matches[1]) {
				acMap.shield = parseInt(matches[1], 10);
			}
			matches = acstring.match(/\)\s*?(.*)/);
			if (matches && matches[1]) {
				acMap.note = matches[1];
			}
			//get ability modifier, should be Dex by default.
			matches = acstring.match(/([+\-]??\d+)\s*?Dex/i);
			if (matches && matches[1]) {
				acMap.dex = parseInt(matches[1],10)||0;
				//if different then set, compendium error no minus
				// see Fire Giant.
				if (abilityMod !== acMap.dex) {
					acMap.dex = abilityMod;
				}
			} else {
				matches = acstring.match(/([+\-]??\d+)\s*?(Wis|Int|Str|Con|Cha)/i);
				if (matches && matches[1] && matches[2]) {
					acMap.dex = parseInt(matches[1], 10) || 0;
					//should not happen anymore since 6th printing of PRD they removed abilities that change ability to AC, now
					// just add dodge instead.
					acMap.altability = matches[2].toUppercase();
				}
			}
			//check total for any other (untyped, Luck, Sacred/Profane, Circumstance, Enhancement, Insight, Morale)
			//touch - if touch does not add up put difference in misc. (AC not match we'll put in a buff row)
			// we need to track a seperate ac misc buff/penalty. we can put it in buffs.
			tempnum = acMap.dodge + acMap.dex + acMap.deflect + acMap.size + 10;
			if (acMap.touch !== tempnum) {
				acMap.misc = (acMap.touch - tempnum);
			}
			//if AC does not add up, even including misc found above, then put it in ac buff row.
			tempnum = acMap.armor + acMap.shield + acMap.dodge + acMap.dex + acMap.natural + acMap.deflect + acMap.size + acMap.misc + 10;
			if (acMap.ac !== tempnum) {
				acMap.acbuff = (acMap.ac - tempnum);
			}
			//check for not caught flat footed
			if (acMap.ac === acMap.ff && (acMap.dex > 0 || acMap.dodge > 0)) {
				acMap.uncanny = 1;
			}
		} catch (err){
			TAS.error("parseNPCAC",err);
		} finally {
			return acMap;
		}
	},
	/* parseSpeed -returns object with speeds {land:base,fly:xx,swim:xx} etc*/
	parseSpeed = function (speedstr) {
		var speeds = speedstr.split(/,\s*/),
		retobj;
		retobj = _.reduce(speeds, function (memo, speedComponent, idx) {
			var matches,
			speedNum = 0;
			try {
				if (idx === 0) {
					speedNum = parseInt(speedComponent.match(/(\d+)/)[1], 10) || 0;
					if (speedNum) {
						memo["land"] = speedNum;
					}
				} else {
					matches = speedComponent.match(/([\w]+)\s*(\d+)/);
					if (matches) {
						speedNum = parseInt(matches[2], 10) || 0;
						if (speedNum) {
							memo[matches[1].toLowerCase()] = speedNum;
							if (/fly/i.test(matches[1])) {
								matches = speedComponent.match(/\(([\w]+)\)/);
								if (matches && matches[1].length > 0) {
									memo["flyability"] = matches[1];
								}
							}
						}
					}
				}
			} catch (err) {
				TAS.error("parseSped", err);
			} finally {
				return memo;
			}
		}, {});
		return retobj;
	},
	/* getAtkNameFromStr get names of an attack or special attack
	* { Name :(full str up to first parens) , abilityName (without pluses the base ability ), basename (ability name lower case no spces)}
	* for instance: Mwk Longsword +6/+1 would be : {name:Mwk longsword +6/+1, abilityName:Longsword, basename: longsword}
	*/
	getAtkNameFromStr = function (abilitystr) {
		var matches = abilitystr.match(/^\s*([^\(]+)/),
		name = '',
		abilityName = '',
		basename = '';
		if (matches && matches[1]) {
			name = (matches[1]);
			name = SWUtils.trimBoth(name);
			abilityName = name.replace(/\d+d\d+|\-\d+|\+|\d+|\//g, '');
			abilityName = SWUtils.trimBoth(abilityName);
			abilityName = abilityName[0].toUpperCase() + abilityName.slice(1);
			basename = abilityName.toLowerCase();
			basename = basename.replace(/ray|cone|aura|mwk/ig, '');
			basename = basename.replace(/\s+/g, '');
		}
		return {
			'name': name,
			'basename': basename,
			'abilityName': abilityName
		};
	},
	/*parseReach - parses reach string from compendium or statblock
	* returns the default reach, rest of the string (if any), and an array of exceptions and reaches if any.
	*  (for instance, diplodacus
	* @returns = {reach:number (5,10,15 etc), reachNotes:"rest of string", reachExceptions:[['Bite':10],['Claw':5]]}
	*/
	parseReach = function (reachStr) {
		var numerator = 0,
		denominator = 1,
		tempInt = 0,
		tempFloat = 0.0,
		tempstr,
		restOf = "",
		matches,
		exceptionstr = "",
		tempArray = [],
		reachExceptions = [],
		retobj = {
			reach: 5,
			reachNotes: "",
			reachExceptions: []
		};
		if (!reachStr) {
			return null;
		}
		reachStr = reachStr.replace(/^\s+|\s+$/g, '');
		if (reachStr.slice(0, 5) === "2-1/2" || reachStr.slice(0, 4) === "21/2") {
			retobj.reach = 2.5;
			exceptionstr = reachStr.slice(5);
		} else {
			matches = reachStr.match(/^\s*(\d*\.?\d*)?\s*(.*)\s*$/);
			if (matches) {
				tempFloat = parseFloat(matches[1]);
				restOf = matches[2];
				if (!/\(|;/.test(reachStr) && /with/i.test(reachStr)) {
					retobj.reach = 5;
					exceptionstr = reachStr;
				} else {
					retobj.reach = tempFloat;
				}
				if (restOf && restOf.length > 0) {
					exceptionstr = restOf;
				}
			} else {
				exceptionstr = reachStr;
			}
		}
		if (exceptionstr) {
			exceptionstr = exceptionstr.replace('(', '').replace(')', '').replace(';', '').replace(/ft\./ig, '').replace(/ft/ig, '').replace(/^\s+|\s+$/g, '');
		}
		if (exceptionstr) {
			retobj.reachNotes = exceptionstr;
			tempstr = exceptionstr.toLowerCase().replace(/with\s/ig, '');
			tempArray = tempstr.split(/,\s*/);
			reachExceptions = _.reduce(tempArray, function (memo, exceptioninstance) {
				var reachExceptions = [],
				matches;
				if (!exceptioninstance) {
					return memo;
				}
				//not necessary since changed split(',') to split(/,\s*/)
				//exceptioninstance = exceptioninstance.replace(/^\s+|\s+$/g, '');
				if (exceptioninstance.slice(0, 5) === "2-1/2" || exceptioninstance.slice(0, 4) === "21/2") {
					tempstr = exceptioninstance.slice(5);
					if (tempstr) {
						reachExceptions.push(tempstr.replace(/^\s+|\s+$/g, ''));
						reachExceptions.push(2.5);
						memo.push(reachExceptions);
					}
				} else {
					matches = exceptioninstance.match(/(\d+)\s*(.*)/);
					if (matches) {
						reachExceptions.push(matches[2].replace(/^\s+|\s+$/g, ''));
						reachExceptions.push(matches[1]);
						memo.push(reachExceptions);
					}
				}
				return memo;
			}, []);
			if (reachExceptions && reachExceptions.length > 0) {
				retobj.reachExceptions = reachExceptions;
			}
		}
		return retobj;
	},
	getCreatureClassSkills = function (creatureType) {
		var typeToCheck = creatureType.toLowerCase().replace(/\s/g, ''),
		classSkills,
		subSkills;
		try {
			subSkills = _.find(PFDB.creatureTypeClassSkills, function (skills, mainType) {
				var reg = new RegExp(mainType);
				return reg.test(typeToCheck);
			});
			if (subSkills && subSkills.length > 0) {
				classSkills = subSkills;
			}
			subSkills = _.find(PFDB.creatureSubtypeClassSkills, function (skills, mainType) {
				var reg = new RegExp(mainType);
				return reg.test(typeToCheck);
			});
			if (subSkills) {
				if (classSkills) {
					classSkills = classSkills.concat(subSkills);
				} else {
					classSkills = subSkills;
				}
			}
		} catch (err) {
			TAS.error("parseCreatureClassSkills", err);
		} finally {
			if (classSkills) {
				return classSkills;
			}
			return [];
		}
	},
	/*assignPrimarySecondary
	* to each attack in array, assigns attack.naturaltype='primary|secondary' and sometimes attack.dmgMult=1.5
	* returns attacks for chaining.
	*/
	assignPrimarySecondary = function (attacks) {
		var attackGroups,
		attacksToCheck = _.filter(attacks, function (attack) {
			return (attack.type === 'natural');
		});
		if (_.size(attacksToCheck) <= 0) {
			return attacks;
		}
		if (_.size(attacksToCheck) === 1) {
			attacksToCheck[0].naturaltype = 'primary';
			if((attacksToCheck[0].iter && attacksToCheck[0].iter.length ===1) || isNaN(parseInt(attacksToCheck[0].iter,10))){
				attacksToCheck[0].dmgMult = 1.5;
			}
		} else {
			attackGroups = _.groupBy(attacksToCheck, function (attack) {
				return PFDB.primaryNaturalAttacksRegExp.exec(attack.name);
			});
			if (_.size(attackGroups) === 1) {
				_.each(attacksToCheck, function (attack) {
					attack.naturaltype = 'primary';
				});
			} else {
				_.each(attacksToCheck, function (attack) {
					if (PFDB.primaryNaturalAttacksRegExp.test(attack.name)) {
						attack.naturaltype = 'primary';
					} else {
						attack.naturaltype = 'secondary';
					}
				});
			}
		}
		return attacks;
	},
	/*buildImportantFeatObj - saves feats that require updates to the sheet in an object, no spaces and all lowercase.
	* returns sub objects for feats that only apply to certain attacks, and a criticaldamage subobject.
	* for instance:::  obj.weaponfinesse=1 obj.criticaldamage.bleedingcritical:1 obj.longsword.weaponfocus:1
	* @returns object of feats   as  {featname:1,feat2name:1, attacks:{attack1name:{featname:1}}, criticaldamage:{featname:1}}
	*/
	buildImportantFeatObj = function (featlist) {
		return _.chain(featlist)
		.filter( function(feat){if (!feat) {return false;} return true;})
		.filter( function (feat) {
			return PFDB.importantFeatRegExp.test(feat);
		})
		.map(function(feat){
			
			TAS.debug("checking <" + feat + "> for ending letter");
			//if there is an "endnote" letter indicator at the end then remove it
			feat = SWUtils.trimBoth(feat);
			if ((/\b[A-Z]$/i).test(feat)) {
				feat = feat.slice(0,-2);
				feat=SWUtils.trimBoth(feat);
			}
			return feat;
		})
		.reduce(function (memo, feat) {
			var origfeat = feat,
			atktype = "",
			matches,
			attacks = {},
			attack = {},
			crits = {},
			skills = {},
			skill = "";
			try {
				if (feat.indexOf('(') >= 0) {
					matches = /(.*?)\((.*)\)/.exec(feat);
					feat = matches[1];
					atktype = matches[2];
					feat = SWUtils.trimBoth(feat);
					atktype = SWUtils.trimBoth(atktype);
				}
				feat = feat.replace(/\s/g, '').toLowerCase();
				if (feat === 'improvedcritical' || feat === 'criticalmastery') {
					return memo;
				}
				if (feat.indexOf('critical') > 0) {
					atktype = feat;
					feat = "criticaldamage";
				} else if (feat.indexOf('skillfocus') >= 0) {
					skill = atktype.replace(' ', '-');
					skill = skill[0].toUpperCase() + skill.slice(1);
				}
				memo[feat] = 1;
				switch (feat) {
					case 'weaponfinesse':
					case 'improvedcritical':
						if (memo.attacks) {
							attacks = memo.attacks;
						}
						if (attacks[atktype]) {
							attack = attacks[atktype];
						}
						attack[feat] = 1;
						attacks[atktype] = attack;
						memo.attacks = attacks;
						break;
					case 'criticaldamage':
						if (memo.criticaldamage) {
							crits = memo.criticaldamage;
						}
						crits[atktype] = 1; //or put sickening?
						memo.criticaldamage = crits;
						break;
					case 'skillfocus':
						if (memo.skillfocuses) {
							skills = memo.skillfocuses;
						}
						if (skill) {
							skills[skill] = 1;
							memo.skillfocuses = skills;
						} 
						break;
				}
			} catch (err) {
				TAS.error("buildImportantFeatObj error:", err);
				memo[feat] = 1;
			} finally {
				return memo;
			}
		}, {}).value();
	},
	/* parseAttacks -parse atttack string one at a time, returns arrays grouped by full attacks
	* the name of the attack starts with Group 0, Group 1, etc.
	* @atktypestr "melee" or "ranged"
	* @returns array of {enh:0,mwk:0,name:"",atktype:"melee",type:"",countFullBAB:1,plus:"",plusamount:"",plustype:"",note:"",iter:[],dmgdice:0,dmgdie:0,crit:20,critmult:2,dmgbonus:0}
	*/
	parseAttack = function (atkstr, atktypestr, addgroups, groupidx, isUndead) {
		var matches, currpos = 0, name = "", iteratives, i = 0, tempInt = 0,
			beforeBetweenAfterParens, bonus = "", origStr = atkstr, countspaces = 0,
			abilityBaseName = '', tempstr = "", tempidx = 0, names, attackdescs,
		retobj = {
			enh: 0,
			mwk: 0,
			name: "",
			basename: "",
			atktype: "melee",
			type: "",
			range: "",
			countFullBAB: 1,
			iter: [],
			dmgdice: 0,
			dmgdie: 0,
			dmgtype: "",
			crit: 20,
			critmult: 2,
			dmgbonus: 0,
			plus: "",
			plusamount: "",
			plustype: "",
			note: ""
		};
		try {
			//TAS.debug"parseAttack: "+atkstr);
			if (addgroups) {
				//retobj.name += "Group " + groupidx + ": ";
				retobj.group = 'Full attack ' + groupidx;
			}
			names = getAtkNameFromStr(atkstr);
			retobj.name += names.name;
			retobj.basename = names.basename;
			atkstr = SWUtils.trimBoth(atkstr);
			//if stars with #, it means number of attacks
			matches = atkstr.match(/^(\d+)\s*/);
			if (matches && matches[1]) {
				retobj.countFullBAB = parseInt(matches[1], 10) || 1;
				atkstr = atkstr.slice(matches[0].length);
				//retobj.name += (matches[1] + " ");
			}
			//starts with +number(enh) or mwk
			matches = atkstr.match(/^([+\-]\d+)\s*|^(mwk)\s*/i);
			if (matches) {
				//starts with +n, is weapon
				//retobj.name += matches[0];
				if (matches[1]) {
					retobj.enh = parseInt(matches[1], 10) || 0;
				} else if (matches[2] && (/mwk/i).test(matches[2])) {
					retobj.mwk = 1;
				}
				retobj.type = "weapon";
				atkstr = atkstr.slice(matches[0].length);
			}
			//TAS.debug("############################","PFNPCParser.parseAttacks the regex is: "+PFDB.combatManeuversRegExp);
			if (atktypestr === 'melee' && PFDB.combatManeuversRegExp.test(retobj.basename)) {
				retobj.atktype = 'cmb';
				retobj.vs = 'cmd';
			} else if (PFDB.cmbMonsterSrch.test(retobj.basename)) {
				retobj.atktype = 'cmb';
				retobj.type = 'natural';
				retobj.vs = 'cmd';
			} else if ((/web/i).test(retobj.basename)) {
				retobj.atktype = 'ranged';
				retobj.type = 'special';
				retobj.vs = 'touch';
				retobj.range = 10;
			} else if ((/touch/i).test(retobj.basename)) {
				if ((/ranged/i).test(retobj.basename)) {
					retobj.atktype = 'ranged';
				} else {
					retobj.atktype = 'melee';
				}
				retobj.vs = 'touch';
			} else if ((/special/i).test(atktypestr)) {
				retobj.atktype = 'special';
				retobj.type = 'special';
			} else {
				retobj.atktype = atktypestr;
			}
			if (!retobj.type) {
				if (PFDB.naturalAttackRegExp.test(retobj.basename)) {
					retobj.type = "natural";
				} else if (PFDB.unarmedAttacksRegExp.test(name)) {
					retobj.type = "unarmed";
				} else {
					retobj.type = "weapon";
				}
			}
			if (!retobj.vs) {
				if ((/touch|web/i).test(retobj.name)) {
					retobj.vs = 'touch';
					if ((/ranged|web/i).test(retobj.name)) {
						retobj.atktype = 'ranged';
						if ((/web/i).test(retobj.basename)) {
							retobj.range = 10;
						}
					}
				}
			}
			//skip past name
			//if the attack value is -n, then it may skip past the- and go to n
			// for compendium treated as -n, for statblock results in +n
			matches = atkstr.match(/\s*([^0-9+\/\+\(]+)/);
			if (matches && matches[0]) {
				if (matches.index) {
					tempidx = matches.index;
				}
				atkstr = atkstr.slice(tempidx + matches[0].length);
			}
			if (atkstr) {
				//after name split rest by parenthesis
				// format: name   attack bonus ( damage ) plus additional
				beforeBetweenAfterParens = atkstr.split(/\(|\)/);
				//attack amounts before paren
				iteratives = beforeBetweenAfterParens[0].split(/\//);
				if ((/\d/).test(iteratives[0])) {
					retobj.iter = _.map(iteratives, function (iter, index) {
						if (/^[+\-]/.test(iter)) {
							return parseInt(iter, 10) || 0;
						}
						//minus missing assume minus
						return -1 * (parseInt(iter, 10) || 0);
					});
				} else if (retobj.atktype === 'cmb') {
					retobj.iter[0] = 0;
				}
				//damage between parens
				if (beforeBetweenAfterParens[1]) {
					attackdescs = beforeBetweenAfterParens[1].split(/,\s*/);
					//split on commas and strip out non damage, put damage in tempstr
					tempstr = _.reduce(attackdescs, function (memo, subattack) {
						if ((/ft\./i).test(subattack)) {
							retobj.range = subattack;
						} else if (/D[Cc]\s\d+/.test(subattack)) {
							matches = subattack.match(/(D[Cc]\s\d+)/);
							retobj.DC = matches[1].toUpperCase();
							retobj.DCability= PFDB.specialAttackDCAbilityBase[retobj.basename]||'CON';
							if (isUndead && retobj.DCability === 'CON'){
								retobj.DCability='CHA';
							}
							retobj.dcequation = PFUtils.getDCString(retobj.DCability, 'npc-hd-num', isUndead);
						} else if ((/freq|day|constant|at.will/i).test(subattack)) {
							retobj.frequency = subattack;
						} else if ((/AC|hp/).test(subattack) || !(/\d|plus/).test(subattack)) {
							//if no number or 'plus' don't know what to do so stick it in note.
							retobj.note += subattack + ', ';
						} else {
							memo += subattack + ' ';
						}
						return memo;
					}, "");
					//TAS.debug"now left with :"+tempstr);
					// find damage
					//damage dice and die
					matches = tempstr.match(/^(\d+)d(\d+)\s*/i);
					if (matches && matches[1]) {
						retobj.dmgdice = parseInt(matches[1], 10) || 0;
						tempInt = parseInt(matches[2], 10) || 0;
						//compendium bug no minus:
						if ( (tempInt!==3 && tempInt % 2) || tempInt > 12) {
							retobj.dmgdie = Math.floor(tempInt / 10);
							retobj.dmgbonus = -1 * (tempInt % 10);
						} else {
							retobj.dmgdie = tempInt;
						}
						bonus = tempstr.slice(matches[0].length);
					} else {
						//flat damage
						matches = tempstr.match(/^([+\-]??\d+)\s*/);
						if (matches) {
							//flat number
							retobj.dmgbonus = parseInt(matches[1], 10) || 0;
							bonus = beforeBetweenAfterParens[1].slice(matches[1].length);
						}
					}
					//any text after damage is 'plus' or damage type
					if (bonus) {
						//look for plus
						matches = bonus.match(/plus(.*)/i);
						if (matches) {
							tempstr = matches[1].replace(/^\s+|\s+$/g, '');
							bonus = bonus.slice(0, matches.index).replace(/^\s+|\s+$/g, '');
							if (/\d+d\d+/i.test(tempstr)) {
								matches = tempstr.match(/(\d+d\d+)\s*([\w\s]*)/);
								retobj.plusamount = matches[1];
								if (matches[2]) {
									retobj.plustype = matches[2].replace(/^\s+|\s+$/g, '');
								}
							} else {
								retobj.plus = tempstr;
							}
						}
						bonus = bonus.replace(/^\s+|\s+$/g, '');
						matches = bonus.match(/\s|\//g);
						if (matches) {
							countspaces = matches.length - 1;
						}
						if (retobj.dmgbonus === 0) {
							matches = bonus.match(/\s|\//g);
							if (matches) {
								countspaces = matches.length - 1;
							}
							matches = bonus.match(/(x\d+)|(\/\d+\-??20)|([+\-]??\d+)/ig);
							_.each(matches, function (match, index) {
								bonus = bonus.slice(match.length);
								if (/^[+\-]/.test(match)) {
									retobj.dmgbonus = (parseInt(match, 10) || 0);
								} else if (/^[x\u00d7]\d+/.test(match)) {
									match = match.slice(1);
									retobj.critmult = parseInt(match, 10) || 2;
								} else if (/^\d+/.test(match)) {
									//minus missing
									retobj.dmgbonus = ((-1) * (parseInt(match, 10) || 0));
								} else if (match.indexOf('20') >= 0) {
									match = match.replace('20', '').replace('-', '').replace('/', '');
									if (match && match.length > 0) {
										retobj.crit = parseInt(match, 10) || 20;
									}
								}
							});
						}
						bonus = bonus.slice(countspaces);
						if (bonus && bonus.length > 0) {
							retobj.dmgtype += bonus;
						}
					}
					if (retobj.atktype !== 'cmb' && !retobj.iter[0] && retobj.dmgtype && retobj.dmgdice && retobj.dmgdie && !retobj.plusamount && !retobj.plustype && (!(/bludg|slash|pierc/i).test(retobj.dmgtype))) {
						retobj.plustype = retobj.dmgtype;
						tempstr = String(retobj.dmgdice) + "d" + String(retobj.dmgdie);
						if (retobj.dmgbonus) {
							if (retobj.dmgbonus > 0) {
								tempstr += "+" + retobj.dmgbonus;
							} else {
								tempstr += "-" + Math.abs(retobj.dmgbonus);
							}
						}
						retobj.plusamount = tempstr;
						retobj.dmgtype = "";
						retobj.dmgdice = 0;
						retobj.dmgdie = 0;
					}
				}
				//any notes at end
				i = 2;
				while (i < beforeBetweenAfterParens.length) {
					//can use filter then reduce, or use each, or use easy for loop.
					retobj.note += beforeBetweenAfterParens[i].replace(/^\s+|\s+$/g, '');
					i++;
				}
			}
			if (retobj.note) {
				retobj.note = retobj.note.replace(/^\s+|\s+$/g, '');
			}
		} catch (err) {
			TAS.error("parseAttack: error parsing:" + atkstr, err);
			if (retobj.name) {
				retobj.name += " ";
			}
			retobj.name += "Could not parse attack!";
			retobj.note = origStr + " , error: ";
			retobj.note += err;
		} finally {
			return retobj;
		}
	},
	parseAttacks = function (atkstr, atktypestr, cmbval) {
		var atkarrayout,
		atkarraysub,
		attacksouter,
		addgroups = false;
		atkarrayout = atkstr.split(/\sor\s/i);
		if (atkarrayout.length > 1) {
			addgroups = true;
		}
		attacksouter = _.reduce(atkarrayout, function (memoout, atkstrout, groupidx) {
			var atkarray = atkstrout.split(/,\s*(?![^\(\)]*\))/),
			attacks;
			if (atkarray.length > 1) {
				addgroups = true;
			}
			TAS.debug('parseattacks outer group: ' + groupidx);
			attacks = _.reduce(atkarray, function (memo, atkstr) {
				var retobj;
				TAS.debug('parseattacks: ' + atkstr);
				retobj = parseAttack(atkstr, atktypestr, addgroups, groupidx, cmbval);
				if (retobj) {
					memo.push(retobj);
				}
				return memo;
			}, []);
			return memoout.concat(attacks);
		}, []);
		return attacksouter;
	},
	parseFeats = function (featstring) {
		var feats=[];
		if (!featstring) {return [];}
		feats = featstring.match(/((?:[^(),]|\([^()]*\))+)/g);
		feats = SWUtils.trimBoth(feats);
		return feats;
	},
	parseSkillRacialBonuses = function (racialstr) {
		//abilitymods = modify default ability score for a skill
		var abilitieslower = _.map(PFAbilityScores.abilities, function (ab) {
			return ab.toLowerCase();
		}),
		allCoreSkillsLower = _.map(PFSkills.allCoreSkills, function (skill) {
			return skill.toLowerCase();
		}),
		skillsWithSubSkillsLower = _.map(PFSkills.skillsWithSubSkills, function (skill) {
			return skill.toLowerCase();
		}),
		skillsWithSpaces = PFSkills.skillsWithSpaces,
		temparray,
		modifiers = [],
		abilitymodstr = "",
		abilitymodlower = "",
		ability = "",
		setability = false,
		tempskill = "",
		matches,
		skillmods = {},
		skillnotes = [],
		abilitymods = {},
		retobj = {
			"skillmods": skillmods,
			"skillnotes": skillnotes,
			"abilitymods": abilitymods
		};
		if (!racialstr) {
			return retobj;
		}
		temparray = racialstr.split(';');
		if (temparray.length > 1) {
			racialstr = temparray[0];
			abilitymodstr = temparray[1];
		}
		if (abilitymodstr) {
			try {
				abilitymodlower = abilitymodstr.toLowerCase();
				ability = _.find(abilitieslower, function (ab) {
					return abilitymodlower.indexOf(ab) >= 0;
				});
				if (ability) {
					tempskill = _.find(allCoreSkillsLower, function (skill) {
						return abilitymodlower.indexOf(skill) >= 0;
					});
					if (tempskill) {
						abilitymods[tempskill[0].toUpperCase() + tempskill.slice(1)] = ability.toLowerCase();
						setability = true;
					}
				}
			} catch (err1) {
				TAS.error("parseSkillRacialBonuses inner", err1);
			}
			if (!setability) {
				skillnotes.push(abilitymodstr);
			}
		}
		modifiers = racialstr.split(/,\s*/);
		_.each(modifiers, function (modstr) {
			var modstrlower = modstr.toLowerCase(),
			mod = 0,
			moddedTitle,
			modded = "",
			tempstr = "",
			exceptionstr = "",
			conditionmod = 0,
			conditionstr = "",
			hasSubSkill = false,
			matches;
			try {
				matches = modstr.match(/\s*([+\-]\d+)\s*(?:on|to)?\s*([\w]+)\s*([\w\s]+)?\s*(\([^)]*\))?/);
				if (!matches) {
					//is an exception or note
					tempskill = _.find(allCoreSkillsLower, function (skill) {
						return modstrlower.indexOf(skill) >= 0;
					});
					if (tempskill) {
						ability = _.find(abilitieslower, function (ab) {
							return modstrlower.indexOf(ab) >= 0;
						});
						if (ability) {
							abilitymods[tempskill.toLowerCase()] = ability;
						} else {
							skillnotes.push(modstr);
						}
					} else {
						skillnotes.push(modstr);
					}
					return;
				}
				exceptionstr = matches[3];
				mod = parseInt(matches[1], 10) || 0;
				modded = matches[2];
				if (!_.contains(allCoreSkillsLower, modded.toLowerCase())) {
					TAS.warn("does not match " + modded);
					// +8 Sleight of Hand
					tempskill = _.find(skillsWithSpaces, function (skill) {
						return modstrlower.indexOf(skill) >= 0;
					});
					if (!tempskill || tempskill.length < 1) {
						//not sure what this is
						skillnotes.push(modstr);
						return;
					}
					temparray = tempskill.split(/\s/);
					temparray = _.map(temparray, function (part) {
						if (part === "of") {
							return "of";
						}
						return part[0].toUpperCase() + part.slice(1);
					});
					modded = temparray.join('-');
					exceptionstr = exceptionstr.slice(tempskill.length - tempskill.indexOf(' ') + 1);
				}
				if (exceptionstr) {
					//entire thing is a "when" exception
					skillnotes.push(modstr);
					return;
				}
				moddedTitle = modded[0].toUpperCase() + modded.slice(1);
				if (!matches[4]) {
					skillmods[moddedTitle] = mod;
					return;
				}
				//if craft, knowledge, etc
				exceptionstr = matches[4].replace(/^\s+|\(|\)|\s+$/g, '');
				if (_.contains(skillsWithSubSkillsLower, modded.toLowerCase())) {
					exceptionstr = exceptionstr[0].toUpperCase() + exceptionstr.slice(1);
					if (modded.toLowerCase() === "knowledge") {
						moddedTitle += "-" + exceptionstr;
					} else {
						moddedTitle += "[" + exceptionstr + "]";
					}
					skillmods[moddedTitle] = mod;
				} else {
					//has bonus
					matches = exceptionstr.match(/([+\-]\d+)\s(.*)$/);
					if (matches && matches[1]) {
						conditionmod = parseInt(matches[1], 10) || 0;
						if (matches[2]) {
							conditionstr = matches[2];
						}
						conditionmod = conditionmod - mod;
						skillmods[moddedTitle] = mod;
						tempstr = ((conditionmod > 0) ? "+" : "") + conditionmod + " " + moddedTitle + " " + conditionstr;
						skillnotes.push(tempstr);
					} else {
						skillnotes.push(modstr);
					}
				}
			} catch (err) {
				TAS.error("parseSkillRacialBonuses outer error", err);
				skillnotes.push(modstr);
			}
		});
		return retobj;
	},
	parseSkills = function (skillstr) {
		var rawSkills = skillstr.match(/[\w][\w\s]+\s*(?:\([\w\s,]+\))?\s*[+\-]\d+[,]??/g),
		skills = _.reduce(rawSkills, function (memo, skill) {
			var matches = skill.match(/^([\w][\w\s]+[\w])\s*(\([\w\s,]+\))??([+\s]+\d+)$/),
			tempskill = "",
			tempval = 0,
			tempskill2 = "",
			subskills;
			if (matches) {
				tempval = parseInt(matches[3], 10) || 0;
				tempskill = matches[1].replace(/^\s+|\s+$/g, '');
				tempskill = tempskill[0].toUpperCase() + tempskill.slice(1);
				tempskill = tempskill.replace(/\s/g, '-');
				if (matches[2]) {
					subskills = matches[2].split(/,\s*/);
					_.each(subskills, function (subskill) {
						subskill = subskill.replace(/^\s+|,|\(|\)|\s+$/g, '');
						subskill = subskill[0].toUpperCase() + subskill.slice(1);
						if (tempskill === "Knowledge") {
							subskill = "-" + subskill;
						} else {
							subskill = "[" + subskill + "]";
						}
						memo[tempskill + subskill] = tempval;
					});
				} else {
					memo[tempskill] = tempval;
				}
			}
			return memo;
		}, {});
		return skills || {};
	},
	parseAbilityScores = function (v) {
		var aS = {};
		aS.str = getAbilityAndMod(v["str_compendium"]);
		aS.dex = getAbilityAndMod(v["dex_compendium"]);
		aS.con = getAbilityAndMod(v["con_compendium"]);
		aS.wis = getAbilityAndMod(v["wis_compendium"]);
		aS['int'] = getAbilityAndMod(v["int_compendium"]);
		aS.cha = getAbilityAndMod(v["cha_compendium"]);
		return aS;
	},
	parseSpecialAttack = function (setter,sastr) {
		var origsastr, names, tempstr, tempstr2, match, matches, parensplit,
		atktyp = 'special',baseability="",
		abilitytype="",
		isAttack = false,
		retobj = {};
		try {
			origsastr = sastr;
			names = getAtkNameFromStr(sastr);
			if (sastr.indexOf('(') >= 0) {
				if (PFDB.spAttackAttacksPreProcess.test(names.basename)) {
					//preprocess
					if ((/rake/i).test(names.basename)) {
						sastr = PFUtils.removeUptoFirstComma(sastr, true);
					} else if ((/rend/i).test(names.basename)) {
						sastr = PFUtils.removeUptoFirstComma(sastr);
					} else if ((/web/i).test(names.basename)) {
						sastr = PFUtils.removeUptoFirstComma(sastr, true);
						sastr = 'web ' + sastr;
						atktyp = 'ranged';
					}
					isAttack = true;
				} else if (PFDB.spAttackAttacks.test(names.basename)) {
					isAttack = true;
				}
			} else if ((/damage|drain|dmg/i).test(names.basename) && !(/blood|energy/i).test(names.basename) && PFDB.abilitySrch.test(names.basename)) {
				match = names.basename.match(/damage|drain/i);
				names.AbilityName = 'Ability ' + match[0];
				sastr = names.AbilityName + ' (' + sastr + ')';
				isAttack = true;
			}
			
			if (isAttack) {
				retobj = parseAttack(sastr, atktyp, false, 0);
				retobj.specialtype = 'attack';
				retobj.group = 'Special';
				retobj.name = (names.AbilityName && names.AbilityName.slice(0,7)==='Ability')?names.AbilityName:names.name;
				retobj.basename = names.basename;
			}
			if (!isAttack) {
				retobj.name = names.abilityName || names.name;
				retobj.basename = names.basename;
				retobj.specialtype = 'ability';
				retobj.rule_category="special-attacks";
				matches= (/usable\severy/i).exec(origsastr);
				if (matches){
					retobj.frequency='everyrounds';
					tempstr = origsastr.slice(matches.index+matches[0].length);
					tempstr2= PFUtils.getDiceDieString(tempstr);
					if (tempstr2){
						retobj.used=tempstr2;
						matches= tempstr.match(/rounds|days|minutes/i);
						if (matches){
							retobj.used += " "+ matches[0];
						}
					}
				}
				if(PFDB.specialAttackDCAbilityBase[retobj.basename]){
					retobj.DCability= PFDB.specialAttackDCAbilityBase[retobj.basename];
					if (parseInt(setter['is_undead'],10)===1 && retobj.DCability === 'CON'){
						retobj.DCability='CHA';
					}
				}
				retobj.shortdesc = PFUtils.replaceDCString(PFUtils.replaceDiceDieString(origsastr),
							retobj.DCability, 'npc-hd-num', setter.is_undead);
			}
			abilitytype=PFUtils.getSpecialAbilityTypeFromString(sastr);
			if (abilitytype) {
				retobj.ability_type=abilitytype;
			}
		} catch (err) {
			TAS.error("parseSpecialAttack", err);
		} finally {
			return retobj;
		}
	},
	parseSpecialAttacks = function (setter,saString,cmb) {
		var retarray ;
		if (!saString) {
			return {};
		}
		retarray = saString.split(/,\s*(?![^\(\)]*\))/);
		return _.reduce(retarray, function (memo, sa) {
			var retobj,
			tempstr,
			names;
			try {
				retobj = parseSpecialAttack(setter,sa);
			} catch (err) {
				TAS.error("parseSpecialAttacks", err);
				retobj = {};
				retobj.name = sa;
				retobj.specialtype = 'ability';
				retobj.rule_category="special-attacks";
			} finally {
				memo.push(retobj);
				return memo;
			}
		}, []);
	},
	parseSpecialAbilities = function (str) {
		var saObj = {}, initiallines, lines, extralines, contentstr,tempstr, lastLineIndex=0;
		saObj.description = [];
		saObj.specialAbilities = [];
		//We break on last period, 3 spaces, or newline that is before an (Su), (Ex), or (Sp) this because sometimes special abilities 
		// do not have newlines between them. (also go back to beginning of string if it's the first one)
		//also looks for  "words:" as first word after newline or period since some abilities are like that (dragons). (and sometimes spells does not have colon at end as in faerie dragon.)
		initiallines = str.split(/(?:\s\s\s|\r\n|^|[\.\n\v\f\r\x85\u2028\u2029])(?=\s*spells[:\s]|\s*[\w\s]+:|[^\.\v\r\n\x85\u2028\u2029]+(?:\(Su\):??|\(Ex\):??|\(Sp\):??))/i);
		//split the last one by newlines:
		if (_.size(initiallines>1)) {
			lastLineIndex = _.size(lines)-1 ;
			extralines = initiallines[lastLineIndex].split(/\s\s\s|\r\n|[\n\v\f\r\x85\u2028\u2029]/);
			if (_.size(extralines)>1){
				lines = initiallines.slice(0,lastLineIndex).concat(extralines);
			} 
		}
		if (!lines) {
			lines = initiallines;
		}
		lines = _.filter(lines,function(line){
			if(!line) {return false;}
			return true;
		});
		saObj = _.reduce(lines, function (memo, line) {
			var spObj = {}, trimmedline = '', splitter = '',tempstr='', startIdx, endIdx = -1, matches, abilitytype='',foundSpecialNoType=false;
			try {
				trimmedline = line.replace(/^[^\w]+|[^\w]+$/g, '');
				if (trimmedline) {
					matches = trimmedline.match(/\(Su\):??|\(Ex\):??|\(Sp\):??/i);
					if (!matches || matches === null){
						matches = trimmedline.match(/^Spells[:\s]|^[\w\s]+:/i);//first one only
						if (matches && matches[0].length<20 && PFDB.monsterRules.test(matches[0]) ) {
							foundSpecialNoType=true;
							spObj.name = SWUtils.trimBoth(matches[0].replace(':',''));
							startIdx =  matches[0].length+1;
							spObj.description = SWUtils.trimBoth(trimmedline.slice(startIdx));
							memo.specialAbilities.push(spObj);
						}
						if (!foundSpecialNoType && trimmedline.toLowerCase() !== 'special abilities') {
							//this is just part of the description
							memo.description.push(trimmedline);
						}
											
					} else if (matches && matches.index>0 ) {
						tempstr=trimmedline.slice(0,matches.index);
						spObj.name = SWUtils.trimBoth(tempstr);
						spObj.basename = spObj.name.replace(/\s/g,'').toLowerCase();
						spObj.rule_category='special-abilities';
						spObj.ability_type=matches[0][1].toUpperCase()+matches[0][2].toLowerCase();
						startIdx = matches.index + matches[0].length + 1;
						spObj.description = SWUtils.trimBoth(trimmedline.slice(startIdx));
						matches=spObj.description.match(/(\d+d\d+) (?:points of){0,1}(.*?) damage/i);
						if(matches){
							if(matches[1]){
								spObj.extraDamage = '[['+matches[1]+']]';
							}
							if (matches[2]){
								spObj.extraDamageType = matches[2];
							}
						} else {
							matches=spObj.description.match(/([a-z]) for (\d+d\d+) (rounds|minutes|hours|days)/i);
							if(matches){
								if(matches[2]){
									spObj.extraDamage = '[['+matches[2]+']] '+matches[3]||'';
								}
								if(matches[1]){
									spObj.extraDamageType = matches[1];
								}
							}
						}
//				retobj.shortdesc = PFUtils.replaceDCString(PFUtils.replaceDiceDieString(origsastr),
	//						retobj.DCability, 'npc-hd-num', setter.is_undead);
						
						//before dc is usually 'the save'
						matches = spObj.description.match(/dc is (cha|con|wis|int|str|dex)[a-zA-Z]*.based/i);
						//TAS.debug"parseSpecialAbilities looking for DC ability it is: ",matches);
						if(matches && matches[1]){
							tempstr=matches[1].toUpperCase();
							spObj.DCability = tempstr;
							//TAS.debug"parseSpecialAbilities setting DC ability to "+tempstr);
						} else if(PFDB.specialAttackDCAbilityBase[spObj.basename]){
							spObj.DCability= PFDB.specialAttackDCAbilityBase[spObj.basename];
							//TAS.debug"parseSpecialAbilities setting DC ability to "+spObj.DCability+" based on "+ spObj.basename);
						}
						//bfore dc could be 'must make a', 'fails a'
						matches = spObj.description.match(/DC (\d+) (Will|Fort|Ref)[a-zA-Z]* save/i);
						if (matches){
							if(matches[1]){
								spObj.DC= matches[1];
							}
							if(matches[2]){
								tempstr=matches[2][0].toUpperCase()+ matches[2].slice(1).toLowerCase();
								spObj.save=tempstr;
							}
						} else {
							matches = spObj.description.match(/(Will|Fort|Ref)[a-zA-Z]* DC (\d+) ([^),.])/i);
							if (matches){
								if(matches[1]){
									tempstr=matches[1][0].toUpperCase()+ matches[1].slice(1).toLowerCase();
									spObj.save=tempstr;
									if (matches[3]){
										spObj.save += ' '+matches[3];
									}
								}
								if(matches[2]){
									spObj.DC=matches[2];
								}
							}
						}
						memo.specialAbilities.push(spObj);
					}
				}
			} catch (err) {
				TAS.error('parseSpecialAbilities error parsing: ' + line + ' error is' + err);
			} finally {
				return memo;
			}
		}, saObj);
		//TAS.debug("parseSpecialAbilities returning",saObj);
		return saObj;
	},
	parseSpecialQualities = function (str){
		var matches, rawAbilities, saObjs=[];
		if (str){
			//TAS.debug("PFNPCParser.parseSpecialQualities: "+str);
			//skip over "SQ" in front
			matches = str.match(/^SQ[\s:]*/i);
			if (matches){
				str = str.slice(matches[0].length);
			}
			rawAbilities = str.split(/,\s*/);
			//TAS.debug("found the following:", rawAbilities);
			_.each(rawAbilities,function(ability){
				var saAb={},type="";
				saAb.name=ability;
				type=PFUtils.getSpecialAbilityTypeFromString(ability);
				if(type){
					saAb.ability_type=type;
				}
				saAb.rule_category='special-qualities';
				saObjs.push(saAb);
			});
			//TAS.debug"returning ", saObjs);
			return saObjs;
		}
		return null;
	},
	parseSLAs = function (spLAstr) {
		var lines, clname = '', lastFreq = '', tempstr='', lastPerDay = 0, slas = {};
		try {
			slas.spellLikeAbilities = [];
			slas.CL = 0;
			slas.concentration = 0;
			slas.classname = "";
			lines = spLAstr.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/);
			_.each(lines, function (line) {
				var matches, slatdivider, SLAArray, freqStr = "", slaofTypeStr = "", thisSlaObj = {},rawDC=0, tempstr2='',
				slatype = "", numPerDay = 0, slasOfType, header=0, row=0, hasSpellLevel=0, freqIsPer=0, tempsplit;
				try {
					//TAS.debug"parsing "+line);
					if ((/CL\s*\d+/i).test(line) || (/concentrat/i).test(line) ||
					(/psychic\smagic/i).test(line) || (/spell.like.abilit/i).test(line)) {
						header=1;
					} else if ((/\u2013|\u2014|-/).test(line)) {
						row = 1;
					} 
					if (header){
						if ((/CL\s*\d+/i).test(line)) {
							matches = line.match(/CL\s*(\d+)/i);
							if (matches[1]) {
								slas.CL = parseInt(matches[1], 10) || 0;
							}
						}
						if ((/concentrat/i).test(line)) {
							matches = line.match(/concentrat[\w]*\s*[+\-]??(\d+)/i);
							if (matches[1]) {
								slas.concentration = parseInt(matches[1], 10) || 0;
							}
						}
						if ((/psychic\smagic/i).test(line)) {
							slas.classname = 'Psychic Magic';
						} else {
							slas.classname = 'Spell-like abilities';
						}
					} else if (row) {
						//TAS.debug"splitting line "+line);
						matches = line.match(/\u2013|\u2014|\-/);
						slaofTypeStr = line.slice(matches.index+1);
						freqStr = SWUtils.trimBoth(line.slice(0,matches.index)).toLowerCase();
						matches = freqStr.match(/constant|will|day|month/i);
						if (matches && matches[0]) {
							slatype = matches[0].toLowerCase();
							thisSlaObj.type = slatype;
							if (slatype === 'day' || slatype==='month') {
								freqIsPer=1;
								matches = freqStr.match(/\d+/);
								if (matches && matches[0]) {
									numPerDay = parseInt(matches[0], 10) || 0;
									thisSlaObj.perDay = numPerDay;
								}
							}
						} else {
							tempsplit = freqStr.split('/');
							if (tempsplit.length>=2){
								freqIsPer=1;
								matches = tempsplit[0].match(/\d+/);
								if (matches && matches[0]) {
									numPerDay = parseInt(matches[0], 10) || 0;
									thisSlaObj.perDay = numPerDay;
								}
								slatype='other';
								thisSlaObj.type = slatype;
								thisSlaObj.otherPer=tempsplit[1];
							}
						}
						//TAS.debug"the frequency is " + slatype + " and are " + numPerDay + " per that");
						slasOfType = slaofTypeStr.split(/,\s*(?![^\(\)]*\))/);
						SLAArray = _.reduce(slasOfType, function (memo, sla) {
							var thissla = {}, dcstr = '';
							try {
								thissla.type = slatype;
								if (freqIsPer && numPerDay > 0) {
									thissla.perDay = numPerDay;
								}
								//look for spell level.
								matches = sla.match(/level\s*(\d+)/i);
								if (matches){
									if (matches[1]){
										//TAS.debug"spell level match on "+ sla+ " Is " + matches[1]);
										thissla.spell_level = parseInt(matches[1],10)||0;
										hasSpellLevel=1;
									}
									sla = sla.replace(matches[0],'');
								}

								matches = sla.match(/D[Cc]\s*\d+/);
								if (matches){
									tempstr2 = sla.replace(matches[0],'');
									tempstr =matches[0].match(/\d+/);
									rawDC=parseInt(tempstr,10)||0;
									thissla.DC = rawDC;
									matches = tempstr2.match(/\b(fortitude|willpower|reflex|fort|will|ref)\b([^,]+,)/i);
									if(matches){
										thissla.save=matches[0]; //type of save up to first comma after it
									}
									
								}
								//if parenthesis, name should be only what is in parens,
								if (sla.indexOf('(')>0){
									thissla.name= sla.slice(0,sla.indexOf('(')-1);
									tempstr = sla.slice(sla.indexOf('(')-1);
									//sla= tempstr;
									//summon spells have levels
									thissla.shortdesc = tempstr;
								} else {
									thissla.name = sla;
								}
								if (thissla.spell_level && (/^summon/i).test(thissla.name )){
									thissla.name += " Level "+ String(thissla.spell_level);
								}
								memo.push(thissla);
							} catch(errslain){
								TAS.error("parseSLAs, error reducing to SLAArray for: "+sla ,errslain);
								if(!thissla.name){
									thissla.name= sla;
								} else {
									thissla.description=sla;
								}
								memo.push(thissla);
							} finally {
								return memo;
							}
						}, []);
						if (SLAArray && _.size(SLAArray) > 0) {
							thisSlaObj.type = slatype;
							if (freqIsPer && numPerDay > 0) {
								thisSlaObj.perDay = numPerDay;
							}
							thisSlaObj.SLAs = SLAArray;
							slas.spellLikeAbilities.push(thisSlaObj);
						}
					} else {
						TAS.warn("Cannot parse " + line);
						return;
					}
				} catch (ierr) {
					TAS.error("parseSLAs error parsing" + line, ierr);
				}
			});
		} catch (err) {
			TAS.error("parseSLAs", err);
		} finally {
			if (slas.spellLikeAbilities && _.size(slas.spellLikeAbilities) > 0) {
				return slas;
			}
			return null;
		}
	},
	/** parseSpells - parses spell string from compendium and returns js object
	*@param {string} spellstr the block of spells known text ex: "Sorcerer Spells Known (CL 8th)\r\n3rd (3/day)-Fireball (DC12)," etc
	*@returns {jsobject} {classname:"name",CL:#,concentration:#,
	* spells:{
	*	0:[{name:spellname,DC:#}],
	*   1:[{name:spellname},{name:spellname}]
	* }}
	*/
	parseSpells = function (spellstr) {
		var lines, spells = {};
		spells.classLevel = -1;
		spells.concentration = -1;
		spells.classname = "";
		spells.spellsByLevel = [];

		if (!spellstr) {
			return null;
		}
		lines = spellstr.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/);
		spells = _.reduce(lines, function (omemo, line) {
			var matches,
			spellarray,
			slatdivider,
			splittedSpells,
			dcstr,
			tempstr, 
			temparray=[],
			match,
			thislvl = {},
			slasOfType;
			thislvl.perDay = -1;
			thislvl.spellLevel = -1;
			try {
				if (spells.classLevel === -1 && (/C[Ll]\s*\d+/i).test(line)) {
					matches = line.match(/C[Ll]\s*(\d+)/i);
					if (matches && matches[1]) {
						spells.classLevel = parseInt(matches[1], 10) || 0;
					}
					matches = line.match(/concentrat[\w]*\s*[+\-]??(\d+)/i);
					if (matches && matches[1]) {
						spells.concentration = parseInt(matches[1], 10) || 0;
					}
					matches = line.match(/([\w\s]*)spells\sknown/i);
					if (matches && matches[1]) {
						spells.classname = matches[1].replace(/^\s|\s$/g, '');
						spells.classname = spells.classname[0].toUpperCase() + spells.classname[1];
					}
				} else {
					//look for endash, emdash, or dash
					slatdivider = line.split(/\u2013|\u2014|-/);
					if (slatdivider && slatdivider[0]) {
						matches = slatdivider[0].match(/^(\d+)/);
						if (matches && matches[1]) {
							thislvl.spellLevel = parseInt(matches[1], 10) || 0;
							matches = slatdivider[0].match(/(\d+)\/day/i);
							if (matches && matches[1]) {
								thislvl.perDay = parseInt(matches[1], 10) || 0;
							}
						} else {
							match = slatdivider[0].match(/opposition schools\s*/i);
							if (match) {
								tempstr = slatdivider[0].slice(match.index + match[0].length);
								spells.oppositionschools = tempstr;			
							} else {
								//stuff is here but what? add to notes
								spells.spellnotes = slatdivider[0];
							}
						}
					}
					if (slatdivider && slatdivider[1]) {
						splittedSpells = slatdivider[1].split(',');
						spellarray = _.reduce(splittedSpells, function (memo, spell) {
							var thisspell = {};
							try {
								matches = spell.split(/\(dc/i);
								thisspell.name = matches[0].replace(/^\s|\s$/g, '');
								if (matches[1]) {
									dcstr = matches[1];
									matches = dcstr.match(/\d+/);
									if (matches && matches[0]) {
										thisspell.DC = parseInt(matches[0], 10) || 0;
									}
								}
								memo.push(thisspell);
							} catch (errinner) {
								TAS.error("PFNPCParser.parseSpells errinner:",errinner);
							}
							finally {
								return memo;
							}
						}, []);
						if (thislvl.spellLevel >= 0 && spellarray && spellarray.length > 0) {
							thislvl.spells = spellarray;
							omemo.spellsByLevel.push(thislvl);
						}
					}
				}
			} catch (err) {
				TAS.error("PFNPCParser.parseSpells",err);
			}
			finally {
				return omemo;
			}
		}, spells);
		return spells;
	},
	parseSpace = function (spaceStr) {
		var retstr = spaceStr,
		matches,
		tempFloat;
		try {
			matches = spaceStr.match(/\s*(\d*\.?\d*)?/);
			if (matches) {
				tempFloat = parseFloat(matches[1]);
				if (!isNaN) {
					retstr = String(tempFloat);
				}
			}
		} finally {
			return retstr;
		}
	},
	getCasterObj = function (spellObj, abilityScores, healthObj, isSLA) {
		var caster = {};
		if (!spellObj || !abilityScores || !healthObj) { return null; }
		try {
			//TAS.debug"getCasterObj spellObj,abilities,health are:", spellObj, abilityScores, healthObj);
			caster.abilityMod = 0;
			caster.CL = 0;
			caster.concentrationBonus = 0;
			if (isSLA) {
				caster.classname = "Spell-like abilities";
				caster.ability = 'CHA';
				caster.abilityMod = abilityScores.cha.mod;
			} else {
				if (spellObj.classname) {
					caster.classname = spellObj.classname;
					if (PFDB.casterDefaultAbility[spellObj.classname] && abilityScores[PFDB.casterDefaultAbility[spellObj.classname]]) {
						caster.ability = PFDB.casterDefaultAbility[spellObj.classname].toUpperCase();
						caster.abilityMod = abilityScores[PFDB.casterDefaultAbility[spellObj.classname]].mod;
					}
				} else {
					//assume sorcerer
					caster.classname = 'Sorcerer';
					caster.ability = 'CHA';
					caster.abilityMod = abilityScores.cha.mod;
				}
			}
			if (spellObj.CL) {
				caster.CL = spellObj.CL;
			} else {
				//assume HD
				caster.CL = healthObj.hdice1;
			}
			if (spellObj.concentration) {
				caster.concentrationBonus = parseInt(spellObj.concentration, 10) - parseInt(caster.abilityMod, 10) - parseInt(caster.CL, 10);
			}
			if (spellObj.oppositionschools){
				caster.oppositionschools = spellObj.oppositionschools;
				spellObj.oppositionschools = null;
			}
			if (spellObj.spellnotes){
				caster.spellnotes = spellObj.spellnotes;
				spellObj.spellnotes = null;
			}
			
		} catch (err) {
			TAS.error("getCasterObj error trying to create obj returning null", err);
			caster = null;
		} finally {
			//TAS.debug"returning ", caster);
			return caster;
		}
	},
	setCasterFields = function (setter, casterObj, classidx) {
		var alreadyPresent = false;
		try {
			//TAS.debug"setCasterFields");
			classidx = classidx || 0;
			if (classidx < 0) { classidx = 0; }
			if (setter["spellclass-" + classidx + "-name"] || setter["spellclass-" + classidx + "-level"]) {
				if (!(parseInt(setter["spellclass-" + classidx + "-level"], 10) === parseInt(casterObj.CL, 10) &&
					PFUtils.findAbilityInString(setter["Concentration-" + classidx + "-ability"]) === casterObj.ability.toUpperCase())) {
					classidx++;
				} else {
					alreadyPresent = true;
				}
			}
			if (classidx > 2) {
				TAS.error("Could not setCasterFields, 0,1,2 spellclasses already defined:" +
				setter["spellclass-0-name"] + ", " + setter["spellclass-1-name"] + ", " + setter["spellclass-2-name"], classidx);
				casterObj.pageClassIdx = -1;
			} else if (alreadyPresent) {
				setter["spellclass-" + classidx + "-name"] = setter["spellclass-" + classidx + "-name"] + " and " + casterObj.classname;
				casterObj.pageClassIdx = classidx;
			} else {
				setter["spellclass-" + classidx + "-name"] = casterObj.classname;
				//should add class here ? setter['class-'+what+'-name']
				setter["spellclass-" + classidx + "-level"] = casterObj.CL;//if they have hit dice, this will make it increase? not if we don'tdo class-x-level
				setter["spellclass-" + classidx + "-level-total"] = casterObj.CL;
				if ((/wizard|cleric|druid|paladin|ranger|investigator|shaman|witch|alchemist|warpriest/i).test(casterObj.classname)){
					setter["spellclass-" + classidx + "-casting_type"] =2;//prepared
				} else {
					setter["spellclass-" + classidx + "-casting_type"] = 1;//spontaneous
				}
				if (casterObj.ability) {
					setter["Concentration-" + classidx + "-ability"] = "@{" + casterObj.ability + "-mod}";
				}
				setter["Concentration-" + classidx + "-mod"] = casterObj.abilityMod;
				if (casterObj.concentrationBonus) {
					setter["Concentration-" + classidx + "-misc"] = casterObj.concentrationBonus;
				}
				casterObj.pageClassIdx = classidx;
				if (casterObj.oppositionschools){
					setter["spellclass-" + classidx + "-oppositionschool-0"]=casterObj.oppositionschools;
				}
				if (casterObj.spellnotes){
					setter["spellclass-" + classidx + "-notes"]=casterObj.spellnotes;
				}
			}
		} catch (err) {
			TAS.error("setSLACasterFields", err);
		} finally {
			return setter;
		}
	},
	/** createSpellEntries
	*@param {jsobject} setter - map to pass to setAttrs
	*@param {jsobject} spellObj obj like: {classname:"name",CL:#,concentration:#,
	*	spells:{
	*		0:[{name:spellname,DC:#}],
	*		1:[{name:spellname},{name:spellname}]
	*	}}
	*@param {?} casterObj ?
	*@param {?} section ?
	*@returns {jsobject} setter
	*/
	createSpellEntries = function (setter, spellObj, casterObj, section) {
		section = section || 'spells';
		setter = setter || {};
		if (!spellObj || !casterObj) {
			return setter;
		}
		_.each(spellObj.spellsByLevel, function (spellLevel) {
			var thisSpellLevel = parseInt(spellLevel.spellLevel, 10) || 0, baseDC = 0, perdayPrefix = "";
			try {
				//TAS.debug"now look at level " + thisSpellLevel + " spells", spellLevel);
				perdayPrefix = "spellclass-" + casterObj.pageClassIdx + "-level-" + thisSpellLevel;
				if (spellLevel.perDay) {
					setter[perdayPrefix + "-class"] = spellLevel.perDay;
					setter[perdayPrefix + "-spells-per-day_max"] = spellLevel.perDay;
					setter[perdayPrefix + "-spells-per-day"] = spellLevel.perDay;
				}
				baseDC = 10 + thisSpellLevel + (parseInt(casterObj.abilityMod, 10) || 0);
			} catch (errlvl) {
				TAS.error("createSpellEntries error setting spells per day", errlvl);
			}
			setter = _.reduce(spellLevel.spells, function (memo, spell) {
				var newRowId = generateRowID(), thisDC = 0,
				prefix = "repeating_" + section + "_" + newRowId + "_";
				try {
					setter[prefix + "name"] = (spell.name[0].toUpperCase() + spell.name.slice(1));
					setter[prefix + "classnumber"] = casterObj.pageClassIdx;
					setter[prefix + "spellclass"] = casterObj.classname;
					setter[prefix + "spell_level"] = thisSpellLevel;
					if (spell.DC) {
						thisDC = parseInt(spell.DC, 10) || 0;
						if (thisDC !== baseDC) {
							setter[prefix + "DC_misc"] = thisDC - baseDC;
						}
						setter[prefix + "savedc"] = thisDC;
					}
					if (casterObj.concentration) {
						setter[prefix + "Concentration-mod"] = casterObj.concentration;
					}
				} catch (err) {
					TAS.error("createSpellEntries error setting spell :", spell, err);
				} finally {
					return setter;
				}
			}, setter);
		});
		return setter;
	},
	createSLAEntries = function (setter, slaObj, casterObj, section) {
		var defaultLevel=0;
		section = section || 'ability';
		setter = setter || {};
		if (!slaObj || !casterObj) {
			return setter;
		}
		defaultLevel = parseInt(setter.level,10)||0;
		
		_.each(slaObj.spellLikeAbilities, function (perDaySLAs) {
			var thisPerDay = parseInt(perDaySLAs.perDay, 10) || 0,
			freqType = perDaySLAs.type;
			//TAS.debug" at one set of SLAs, freq:" + freqType + " and perday:" + thisPerDay, perDaySLAs);
			setter = _.reduce(perDaySLAs.SLAs, function (memo, SLA) {
				var newRowId, prefix = "repeating_" + section + "_" + newRowId + "_",
				casterAbility, dcTot = 0, dcMod = 0, sdstr = "", charlvl=0,clmisc=0,tempint=0,slmisc=0,
				casterlevel=0;
				try {
					newRowId = generateRowID();
					prefix = "repeating_" + section + "_" + newRowId + "_";
					memo[prefix + "name"] = (SLA.name[0].toUpperCase() + SLA.name.slice(1));
					memo[prefix + "ability_type"] = 'Sp';
					memo[prefix + "rule_category"] = 'spell-like-abilities';
					memo[prefix + 'showinmenu'] = '1';
					if (casterObj.ability ) {
						casterAbility=casterObj.ability;
						memo[prefix + "ability-basis"] = "@{"+casterObj.ability+"-mod}";
					} else {
						casterAbility="CHA";
						memo[prefix + "ability-basis"] = "@{CHA-mod}";
					}
					memo[prefix + "CL-basis"] = "@{npc-hd-num}";
					memo[prefix + "CL-basis-mod"] = setter.level;
					if(setter['race']){
						memo[prefix+"class-name"]=setter['race'];
					}
//					//TAS.debug"CREATE SLA casterObj.CL: " + casterObj.CL + ", level:" + setter.level + " when processing "+ SLA );
					if(casterObj.CL){
						tempint = setter.level||0;
						if (tempint > 0){
							memo[prefix+"CL-misc"]= casterObj.CL - tempint  ;
							memo[prefix+"CL-misc-mod"]= casterObj.CL - tempint  ;
						}
						casterlevel  = casterObj.CL;
					} else {
						casterlevel = setter.level||0;
					}

					memo[prefix+'casterlevel']= casterlevel;
					//assume 1/2? or calc based on DC?
					if (SLA.spell_level){
						if (SLA.spell_level === defaultLevel){
							memo[prefix + "spell_level-basis"]="@{casterlevel}";
						} else if (SLA.spell_level === Math.floor(defaultLevel/2)){
							memo[prefix + "spell_level-basis"]="floor(@{casterlevel}/2)";
						} else {
							memo[prefix + "spell_level-basis"]="0";
							memo[prefix+"spell_level-misc"]=SLA.spell_level;
						}
					} else {
						memo[prefix + "spell_level-basis"]="floor(@{casterlevel}/2)";
					}
					//memo[prefix+"classnumber"]=casterObj.pageClassIdx;
					//memo[prefix+"spellclass"]=casterObj.classname;
					switch(freqType){
						case 'day':
							memo[prefix + "frequency"] = 'perday';
							memo[prefix + "used"] = thisPerDay;
							memo[prefix + "used_max"] = thisPerDay;
							memo[prefix + "max-calculation"]=thisPerDay;
							memo[prefix + "hasfrequency"] = '1';
							memo[prefix + "hasuses"] = '1';
							break;
						case 'will':
							memo[prefix + "frequency"] = 'atwill';
							memo[prefix + "hasfrequency"] = '1';
							break;
						case 'constant':
							memo[prefix + "frequency"] = "constant";
							memo[prefix + "hasfrequency"] = '1';
							break;
						case 'month':
							memo[prefix + "frequency"] = "permonth";
							memo[prefix + "used"] = thisPerDay;
							memo[prefix + "used_max"] = thisPerDay;
							memo[prefix + "max-calculation"]=thisPerDay;
							memo[prefix + "hasfrequency"] = '1';
							memo[prefix + "hasuses"] = '1';
							break;
						case 'everyrounds':
							memo[prefix + "frequency"] = "everyrounds";
							memo[prefix + "hasfrequency"] = '1';
							memo[prefix + "rounds_between"] = SLA.used||'';
							break;
						case 'other':
							memo[prefix + "frequency"] = "other";
							memo[prefix + "used"] = thisPerDay;
							memo[prefix + "used_max"] = thisPerDay;
							memo[prefix + "max-calculation"]=thisPerDay;
							memo[prefix + "hasfrequency"] = '1';
							memo[prefix + "hasuses"] = '1';
							if (slaObj.otherPer){
								sdstr = "Frequency per :"+slaObj.otherPer;
							}
							break;
					}
					if (SLA.save){
						memo[prefix + "save"] = SLA.save;
					}
					if (SLA.DC) {
						try {
							if (!SLA.save){
								memo[prefix + "save"]  = "See Text";
							}
							if (casterObj.abilityMod ) {
								tempint=0;
								if (SLA.spell_level){
									tempint = 10+casterObj.abilityMod+SLA.spell_level;
								} else {
									tempint = 10+casterObj.abilityMod + Math.floor( casterlevel /2);
								}
								if (tempint !== SLA.DC){
									memo[prefix+"spell_level-misc"]= (SLA.DC - tempint);
									memo[prefix+"spell_level-misc-mod"]= (SLA.DC - tempint);
								}
							}
						} catch (err3){
							TAS.error("createSLAentries, error trying to calculate DC: "+SLA,err3);
						}
					}
					if (SLA.description){
						memo[prefix+"description"]= SLA.description;
					}
					if (SLA.shortdesc){
						if (sdstr){
							sdstr = SLA.shortdesc +", "+ sdstr;
						} else {
							sdstr = SLA.shortdesc;
						}
					}
					if (sdstr) {
						memo[prefix + "short-description"] = sdstr;
					}
				} catch (err) {
					TAS.error("createSLAEntries error setting SLA :", SLA, err);
				} finally {
					return memo;
				}
			}, setter);
		});
		return setter;
	},
	/*createAttacks - creates rows in repeating_weapon
	* @attacklist = array of {enh:0,name:"",type:"",countFullBAB:1,plus:"",note:"",iter:[],dmgdice:0,dmgdie:0,crit:20,critmult:2,dmgbonus:0};
	* @setter = the map to pass to setAttrs
	* @returns setterf
	*/
	createAttacks = function (attacklist, setter, attackGrid, abilityScores, importantFeats, defaultReach, exceptionReaches, sizeMap) {
		setter = setter || {};
		if (!attacklist || _.size(attacklist)===0) {
			return setter;
		}
		//TAS.debug"create attacks:", attacklist, attackGrid, abilityScores, importantFeats, defaultReach, exceptionReaches);
		setter = _.reduce(attacklist, function (memo, attack) {
			var newRowId = generateRowID(),
			prefix = "repeating_weapon_" + newRowId + "_",
			i = 0, iterativeNum = 0, basebonus = 0, tempInt = 0, dmgmult = 1, dmgmod = 0, tohitbonus = 0,
			name = "", tempstr = "", basename = "", iterZero = NaN,
			reach, newRowId2, prefix2;
			//TAS.debug"creating attack row id:" + newRowId);
			try {
				//TAS.debug"looking at attack:", attack);
				tohitbonus = Math.max(attack.enh, attack.mwk);
				basename = attack.basename;
				//basename.replace(/^group.*?:\s*/,'');
				name += attack.name;
				if (attack.plus) {
					name += " Plus " + attack.plus;
				}
				memo[prefix + "name"] = name;
				memo[prefix+"default_size"]=sizeMap.size;
				if (attack.atktype === 'ranged') {
					basebonus = attackGrid.ranged;
					memo[prefix + "attack-type"] = "@{attk-ranged}";
					memo[prefix + "attack-type-mod"] = attackGrid.ranged;
					memo[prefix + "isranged"] = 1;
				} else if (attack.atktype === 'cmb') {
					basebonus = attackGrid.cmb;
					memo[prefix + "attack-type"] = "@{CMB}";
					memo[prefix + "attack-type-mod"] = attackGrid.cmb;
					basebonus = 0;
				} else if (attack.atktype === 'special') {
					basebonus = 0;
					memo[prefix + "attack-type-mod"] = 0;
					memo[prefix + "total-attack"] = 0;
				} else {
					//assume all attacks use weapon finesse
					if (importantFeats.weaponfinesse) {
						basebonus = attackGrid.melee2;
						memo[prefix + "attack-type"] = "@{attk-melee2}";
						memo[prefix + "attack-type-mod"] = attackGrid.melee2;
					} else {
						basebonus = attackGrid.melee;
						memo[prefix + "attack-type"] = "@{attk-melee}";
						memo[prefix + "attack-type-mod"] = attackGrid.melee;
					}
					memo[prefix + "damage-ability"] = "@{STR-mod}";
					if (attack.type === 'natural') {
						if (attack.naturaltype === 'secondary') {
							dmgmult = 0.5;
							memo[prefix + "damage_ability_mult"] = 0.5;
						} else if (attack.dmgMult && attack.dmgMult === 1.5) {
							memo[prefix + "damage_ability_mult"] = 1.5;
							dmgmult = 1.5;
						}
					}
					if (dmgmult === 1) {
						dmgmod = abilityScores.str.mod;
					} else {
						dmgmod = Math.floor(dmgmult * abilityScores.str.mod);
					}
					memo[prefix + "damage-ability-mod"] = dmgmod;
				}
				if (attack.enh) {
					memo[prefix + "enhance"] = attack.enh;
				}
				if (attack.mwk) {
					memo[prefix + "masterwork"] = "1";
				}
				if (attack.iter && attack.iter.length > 0) {
					iterZero = parseInt(attack.iter[0], 10);
				}
				if (!isNaN(iterZero)) {
					memo[prefix + "attack"] = iterZero - tohitbonus - basebonus;
					memo[prefix + "attack-mod"] = iterZero - tohitbonus - basebonus;
					memo[prefix + "total-attack"] = iterZero;
				} else if (attack.atktype === 'cmb') {
					if ((/swallowwhole|pin/i).test(attack.basename)) {
						//if confirming crit add +5
						memo[prefix + "attack"] = 5;
						memo[prefix + "attack-mod"] = 5;
						memo[prefix + "total-attack"] = attackGrid.cmb + 5;
					} else {
						memo[prefix + "total-attack"] = attackGrid.cmb;
					}
				} else {
					memo[prefix + "total-attack"] = 0;
				}
				if (attack.crit !== 20) {
					memo[prefix + "crit-target"] = attack.crit;
				}
				if (attack.critmult !== 2 && attack.critmult) {
					memo[prefix + "crit-multiplier"] = attack.critmult;
				}
				if (importantFeats.criticalfocus) {
					memo[prefix + "crit_conf_mod"] = 4;
				}
				//somewhere this is getting lost:  just bandaid it:
				if (!memo[prefix + "total-attack"]) {
					memo[prefix + "total-attack"] = 0;
				}
				memo[prefix + "damage-dice-num"] = attack.dmgdice;
				memo[prefix + "default_damage-dice-num"] = attack.dmgdice;
				memo[prefix + "damage-die"] = attack.dmgdie;
				memo[prefix + "default_damage-die"] = attack.dmgdie;
				memo[prefix + "damage"] = attack.dmgbonus - attack.enh - dmgmod;
				memo[prefix + "damage-mod"] = attack.dmgbonus - attack.enh - dmgmod;
				memo[prefix + "total-damage"] = attack.dmgbonus;
				if (attack.note) {
					memo[prefix + "notes"] = "(" + attack.type + ") " + attack.note;
				} else {
					memo[prefix + "notes"] = "(" + attack.type + ")";
				}
				if (attack.iter.length > 1) {
					for (i = 1; i < attack.iter.length; i++) {
						iterativeNum = i + 1;
						//TAS.debug"at iteration " + iterativeNum + ", difference is :" + (attack.iter[i] - attack.iter[0]));
						memo[prefix + "toggle_iterative_attack" + iterativeNum] = "@{var_iterative_attack" + iterativeNum + "_macro}";
						memo[prefix + "iterative_attack" + iterativeNum + "_value"] = (attack.iter[i] - attack.iter[0]);
					}
				} else if (attack.countFullBAB > 1) {
					for (i = 1; i < attack.countFullBAB; i++) {
						iterativeNum = i + 1;
						memo[prefix + "toggle_iterative_attack" + iterativeNum] = "@{var_iterative_attack" + iterativeNum + "_macro}";
						memo[prefix + "iterative_attack" + iterativeNum + "_value"] = 0;
					}
				}
				// plus extra damage  **********************
				if (attack.plusamount) {
					memo[prefix + "precision_dmg_macro"] = "[[" + attack.plusamount + "]]";
					if (attack.plustype) {
						memo[prefix + "precision_dmg_type"] = attack.plustype;
					}
				} else if (attack.plus) {
					memo[prefix + "precision_dmg_type"] =attack.plus;
					memo[prefix + "precision_dmg_macro"] =  "Plus";
				}
				if (attack.dmgtype) {
					memo[prefix + "notes"] = memo[prefix + "notes"] + ", damage type:" + attack.dmgtype;
				}
				//reach **************************
				if (attack.range) {
					tempInt = parseInt(attack.range, 10);
					if (isNaN(tempInt)) {
						memo[prefix + "notes"] = memo[prefix + "notes"] + ", range:" + attack.range;
					}
				} else if ((/tongue/i).test(attack.name)) {
					reach = defaultReach * 3;
					memo[prefix + "range"] = reach;
				} else if (attack.atktype === "melee") {
					if (exceptionReaches && exceptionReaches.length > 0) {
						//TAS.log("looking for match",exceptionReaches);
						reach = _.filter(exceptionReaches, function (reacharray) {
							//TAS.log("matching "+basename+" with "+reacharray[0]);
							if (basename.indexOf(reacharray[0]) >= 0) {
								//TAS.log("it matches!"+reacharray[0]);
								return true;
							}
							return false;
						});
						//TAS.log(reach);
						if (reach && reach[0] && reach[0][1]) {
							memo[prefix + "range"] = reach[0][1];
						} else if (defaultReach) {
							memo[prefix + "range"] = defaultReach;
						}
					} else if (defaultReach) {
						memo[prefix + "range"] = defaultReach;
					}
				}
				if (attack.group) {
					memo[prefix + "group"] = attack.group;
				}
				if (attack.dc) {
					memo[prefix + "notes"] = memo[prefix + "notes"] + " " + attack.dc + attack.dcequation ? (" " + attack.dcequation) : '';
				}
			} catch (err) {
				TAS.error("createattacks error on:", attack, err);
			} finally {
				return memo;
			}
		}, setter);
		//TAS.debug("end of create attacks returning:", setter);
		return setter;
	},
	createACEntries = function (setter, acMap, abilityScores, importantFeats, hpMap, bab) {
		var acAbility = "DEX",
		acDexDef = abilityScores.dex.mod,
		calcCMD=0,
		altbab = 0;
		try {
			//TAS.debug("acMap", acMap);
			if (acMap.altability) {
				//this should no longer happen.
				//TAS.debug("different ability score for AC!");
				acAbility = acMap.altability.toUpperCase();
				if (acAbility !== "DEX") {
					setter["AC-ability"] = "( ((@{XXX-mod} + [[ @{max-dex-source} ]]) - abs(@{XXX-mod} - [[ @{max-dex-source} ]])) / 2 )".replace(/XXX/g, acAbility);
					setter["CMD-ability2"] = "( ((@{XXX-mod} + [[ @{max-dex-source} ]]) - abs(@{XXX-mod} - [[ @{max-dex-source} ]])) / 2 )".replace(/XXX/g, acAbility);
					switch (acMap.altability.toLowerCase()) {
						case 'wis':
							acDexDef = abilityScores.wis.mod;
							break;
						case 'int':
							acDexDef = abilityScores['int'].mod;
							break;
						case 'cha':
							acDexDef = abilityScores.cha.mod;
							break;
						case 'con':
							acDexDef = abilityScores.con.mod;
							break;
						default:
							acDexDef = abilityScores.dex.mod;
							break;
					}
					setter["AC-ability-mod"] = acDexDef;
				}
			}
			//has uncanny dodge
			if (acMap.uncanny) {
				setter["FF-ability"] = "@{XXX-mod}".replace(/XXX/g, acAbility);
				setter["FF-ability-mod"] = acDexDef;
				setter["CMD-ability"] = "( ((@{XXX-mod} + [[ @{max-dex-source} ]]) - abs(@{XXX-mod} - [[ @{max-dex-source} ]])) / 2 )".replace(/XXX/g, acAbility);
				setter["CMD-ability"] = acDexDef;
				setter["uncanny_dodge"] = 1;
				setter["uncanny_cmd_dodge"] = 1;
			}
			altbab=bab;
			if (importantFeats.defensivecombattraining) {
				setter['hd_not_bab']=1;
				altbab = (hpMap.hdice1||0) + (hpMap.hdice2||0);
			}
			try {
				calcCMD = altbab + abilityScores.str.mod + acDexDef + (-1 * acMap.size);
				if (isNaN(acMap.cmd) || calcCMD === acMap.cmd) {
					setter["CMD"]= calcCMD;
				} else {
					setter["CMD"] = acMap.cmd;
					setter["CMD-misc"] = (acMap.cmd - calcCMD);
				}
			} catch (err2){
				TAS.error("createACEntries error trying to calculate CMD",err2);
			}

			setter["AC"] = acMap.ac;
			setter["Touch"] = acMap.touch;
			setter["Flat-Footed"] = acMap.ff;
			setter["AC-deflect"] = acMap.deflect;
			setter["AC-dodge"] = acMap.dodge;
			setter["AC-misc"] = acMap.misc;
			setter["AC-natural"] = acMap.natural;
			if (acMap.armor) {
				setter["armor3-equipped"] = "1";
				setter["armor3-acbonus"] = acMap.armor;
				setter["armor3"]="Armor bonus";
				setter["AC-armor"] = acMap.armor;
			}
			if (acMap.shield) {
				setter["shield3-equipped"] = "1";
				setter["shield3-acbonus"] = acMap.shield;
				setter["shield3"]="Shield bonus";
				setter["AC-shield"] = acMap.shield;
			}
			if (acMap.notes){
				setter['defense-notes']=acMap.notes;
			}
			if (acMap.acbuff) {
				setter = PFBuffs.createTotalBuffEntry("AC adjustment from import", "AC", acMap.acbuff, acMap.acbuff, setter);
			}
		} catch (err) { } finally {
			return setter;
		}
	},
	createSkillEntries = function (setter, skills, racial, abilityScores, importantFeats, classSkills, isUndead) {
		var npcSkillsWithFillInNames = ["Craft", "Perform", "Profession"],
		craftLevel = -1, performLevel = -1, professionLevel = -1, runningTot = 0, counter = 0,
		tempAbilities = PFSkills.coreSkillAbilityDefaults,
		tempstr = "",
		skillfeats = /skillfocus|intimidatingprowess/i;
		try {
			if (racial) {
				if (racial.abilitymods && _.size(racial.abilitymods) > 0) {
					//set default ability for skill and substitute adjustments, make sure to use copy not original
					tempAbilities = _.extend({}, PFSkills.coreSkillAbilityDefaults, racial.abilitymods);
					setter = _.reduce(racial.abilitymods, function (memo, ability, skill) {
						memo[skill + "-ability"] = "@{" + ability.toUpperCase() + "-mod}";
						memo[skill + "-ability-mod"] = abilityScores[ability].mod;
						return memo;
					}, setter);
				}
				if (racial.skillmods && _.size(racial.skillmods) > 0) {
					setter = _.reduce(racial.skillmods, function (memo, mod, skill) {
						memo[skill + "-racial"] = mod;
						return memo;
					}, setter);
				}
				if (racial.skillnotes && racial.skillnotes.length > 0) {
					tempstr = "";
					_.each(racial.skillnotes, function (note) {
						tempstr += note + ", ";
					});
					tempstr.replace(/,\s$/, '');
					if (tempstr) {
						setter["Skill-notes"] = tempstr;
					}
				}
			}
			if (importantFeats && _.size(importantFeats) > 0) {
				setter = _.reduce(importantFeats, function (memo, val, feat) {
					if (/intimidatingprowess/i.test(feat)) {
						memo["Intimidate-misc"] = '@{STR-mod}';
						memo["Intimidate-misc-mod"] = abilityScores.str.mod;
					} else if (/skillfocus/i.test(feat)) {
						_.each(val, function (val2, skill) {
							memo[skill + "-feat"] = 3;
						});
					}
					return memo;
				}, setter);
			}
			if (classSkills && _.size(classSkills) > 0) {
				setter = _.reduce(classSkills, function (memo, skill) {
					try {
						if (skill === "Knowledge") {
							_.each(PFSkills.knowledgeSkills, function (kSkill) {
								memo[kSkill + "-cs"] = 3;
							});
						} else if (_.contains(PFSkills.coreSkillsWithFillInNames, skill)) {
							_.each(PFSkills.allFillInSkillInstances[skill], function (subskill) {
								memo[subskill + '-cs'] = 3;
							});
						} else {
							memo[skill + "-cs"] = 3;
						}
					} catch (err) {
						TAS.error("createSkillEntries", err);
					} finally {
						return memo;
					}
				}, setter);
			}
			setter = _.reduce(skills, function (memo, tot, skill) {
				var ability = "", tempint = 0, abilitymod = 0, ranks = 0;
				try {
					tot = parseInt(tot, 10);
					if (tempAbilities[skill]) {
						ability = tempAbilities[skill];
						abilitymod = abilityScores[ability] ? abilityScores[ability].mod : 0;
						abilitymod = parseInt(abilitymod, 10);
						//TAS.debug("now setting " + skill + ", total:" + tot);
						memo[skill] = tot;
						ranks = tot;
						ranks -= abilitymod;
						if (racial && racial.skillmods && racial.skillmods[skill]) {
							ranks -= parseInt(racial.skillmods[skill], 10);
						}
						if (parseInt(memo[skill + "-feat"], 10) > 0) {
							ranks -= parseInt(memo[skill + "-feat"], 10);
						}
						if (parseInt(memo[skill + "-cs"], 10) > 0) {
							ranks -= 3;
						}
						memo[skill + "-ranks"] = ranks;
						memo[skill + "-ability-mod"] = abilitymod;
						runningTot++;
					} else {
						TAS.warn("createSkillEntries, skill " + skill + " not found");
					}
				} catch (err) {
					TAS.error("createSkillEntries inner reduce", err);
				} finally {
					return memo;
				}
			}, setter);
		} catch (errouter) {
			TAS.error("at createskillEntries OUTER error", errouter);
		} finally {
			return setter;
		}
	},
	createInitEntries = function (setter, baseInit, abilityScores, importantFeats) {
		var initMisc = 0;
		try {
			initMisc = baseInit - abilityScores.dex.mod;
			setter["init"] = baseInit;
			setter["init-misc"] = initMisc;
			setter["init-misc-mod"] = initMisc;
			setter["init-ability-mod"] = abilityScores.dex.mod;
		} catch (err) {
			TAS.error("createInitEntries", err);
		} finally {
			return setter;
		}
	},
	createHPAbilityModEntry = function (setter, abilityScores, isUndead) {
		try {
			if (isUndead || abilityScores.con.base === "-") {
				setter["HP-ability"] = "@{CHA-mod}";
				setter["HP-ability-mod"] = abilityScores.cha.mod;
			} else {
				setter["HP-ability-mod"] = abilityScores.con.mod;
			}
		} finally {
			return setter;
		}
	},
	createHealthEntries = function (setter, abilityScores, isUndead, hpMap) {
		var currlevel=0;
		try {
			setter["npc-hd-num"] = hpMap.hdice1;
			setter["level"] =hpMap.hdice1;
			setter["npc-hd"] = hpMap.hdie1;
			setter["HP"] = hpMap.hp;
			setter["HP_max"] = hpMap.hp;
			setter["non-lethal-damage_max"] = hpMap.hp;
			setter["auto_calc_hp"] = "1";
			//NPC: add to race row of class/race grid
			if (hpMap.basehp) {
				setter["NPC-HP"] = hpMap.basehp;
			}
			//bonuses
			if (hpMap.misc) {
				setter["HP-formula-macro-text"] = hpMap.misc;
				setter["HP-formula-mod"] = hpMap.misc;
			}
			if (hpMap.heal) {
				setter["npc-heal-conditions"] = hpMap.heal;
			}
		} catch (err) {
			TAS.error("createHealthEntries", err);
		} finally {
			return setter;
		}
	},
	createSpeedEntries = function (setter, speedMap, importantFeats) {
		var tempstr = "";
		try {
			_.each(speedMap, function (speed, stype) {
				switch (stype) {
					case 'land':
						setter["speed-base"] = speed;
						setter["speed-modified"] = speed;
						break;
					case 'fly':
						setter["speed-fly"] = speed;
						break;
					case 'climb':
						setter["speed-climb"] = speed;
						break;
					case 'swim':
						setter["speed-swim"] = speed;
						break;
					case 'flyability':
						tempstr += "Fly (" + speed + ")";
						break;
					default:
						setter["speed-misc"] = speed;
						if (tempstr.length > 0) {
							tempstr += ", ";
						}
						tempstr += stype + " " + speed;
						break;
				}
			});
			if (tempstr) {
				setter["speed-notes"] = tempstr;
			}
			if (importantFeats.run) {
				setter["run-mult"] = 5;
			}
		} catch (err) {
			TAS.error("parseAndSetSpeed error, speedMap", speedMap, err);
		} finally {
			return setter;
		}
	},
	createSaveEntries = function (setter, abilityScores, isUndead, baseSaves, v) {
		var fortMisc,
		refMisc,
		willMisc,
		tempNote = "",
		tempstr = "";
		try {
			fortMisc = baseSaves.baseFort - abilityScores.con.mod;
			refMisc = baseSaves.baseRef - abilityScores.dex.mod;
			willMisc = baseSaves.baseWill - abilityScores.wis.mod;
			if (isUndead || abilityScores.con.base === "-") {
				fortMisc = baseSaves.baseFort - abilityScores.cha.mod;
				setter["Fort-ability"] = "@{CHA-mod}";
				setter["Fort-ability-mod"] = abilityScores.cha.mod;
			} else {
				setter["Fort-ability-mod"] = abilityScores.con.mod;
			}
			setter["npc-Fort"] = fortMisc;
			setter["Fort"] = baseSaves.baseFort;
			tempNote = "";
			tempstr = PFUtils.getNoteAfterNumber(v["fort_compendium"]);
			if (tempstr) {
				tempNote += ("Fortitude " + tempstr);
			}
			setter["npc-Ref"] = refMisc;
			setter["Ref"] = baseSaves.baseRef;
			if (abilityScores.dex.mod !== 0) {
				setter["Ref-ability-mod"] = abilityScores.dex.mod;
			}
			tempstr = PFUtils.getNoteAfterNumber(v["ref_compendium"]);
			if (tempstr) {
				tempNote += ("Reflex " + tempstr);
			}
			setter["npc-Will"] = willMisc;
			setter["Will"] = baseSaves.baseWill;
			if (abilityScores.wis.mod !== 0) {
				setter["Will-ability-mod"] = abilityScores.wis.mod;
			}
			tempstr = PFUtils.getNoteAfterNumber(v["will_compendium"]);
			if (tempstr) {
				tempNote += ("Willpower " + tempstr);
			}
			if (tempNote) {
				setter["saves_notes"] = tempNote;
				setter["toggle_save_notes"] = "1";
			}
		} catch (err) {
			TAS.error("createSaveEntries", err);
		} finally {
			return setter;
		}
	},
	createAbilityScoreEntries = function (setter, abilityScores) {
		try {
			setter["STR-base"] = abilityScores.str.base;
			setter["DEX-base"] = abilityScores.dex.base;
			setter["CON-base"] = abilityScores.con.base;
			setter["WIS-base"] = abilityScores.wis.base;
			setter["INT-base"] = abilityScores['int'].base;
			setter["CHA-base"] = abilityScores.cha.base;
			setter["STR"] = abilityScores.str.base;
			setter["DEX"] = abilityScores.dex.base;
			setter["CON"] = abilityScores.con.base;
			setter["WIS"] = abilityScores.wis.base;
			setter["INT"] = abilityScores['int'].base;
			setter["CHA"] = abilityScores.cha.base;
			setter["STR-mod"] = abilityScores.str.mod;
			setter["DEX-mod"] = abilityScores.dex.mod;
			setter["CON-mod"] = abilityScores.con.mod;
			setter["WIS-mod"] = abilityScores.wis.mod;
			setter["INT-mod"] = abilityScores['int'].mod;
			setter["CHA-mod"] = abilityScores.cha.mod;
		} catch (err) {
			TAS.error("createAbilityScoreEntries", err);
		} finally {
			return setter;
		}
	},
	parseAndCreateAttacks = function (setter, abilityScores, sizeMap, importantFeats, bab, attackGrid, reachObj, v) {
		var attacklist,
		attackArrays,
		defReach = 5,
		tempCMB=0,
		miscCMB=0,
		newCMB=0,
		reachExceptions = [];
		try {
			if (reachObj) {
				if (reachObj.reach) {
					defReach = reachObj.reach;
				}
				if (reachObj.reachExceptions) {
					reachExceptions = reachObj.reachExceptions;
				}
			}
			setter["bab"] = bab;
			setter["npc-bab"] = bab;
			setter["melee-ability-mod"] = abilityScores.str.mod;
			setter["attk-melee"] = abilityScores.str.mod + bab + sizeMap.size;
			attackGrid.melee = abilityScores.str.mod + bab + sizeMap.size;
			setter["ranged-ability-mod"] = abilityScores.dex.mod;
			setter["attk-ranged"] = abilityScores.dex.mod + bab + sizeMap.size;
			attackGrid.ranged = abilityScores.dex.mod + bab + sizeMap.size;
			if (importantFeats.criticalfocus) {
				setter["cmb_crit_conf"] = 4;
				setter["ranged_crit_conf"] = 4;
				setter["melee_crit_conf"] = 4;
			}
			if (importantFeats.weaponfinesse) {
				setter["melee2-ability"] = "@{DEX-mod}";
				setter["melee2-ability-mod"] = abilityScores.dex.mod;
				setter["attk-melee2"] = abilityScores.dex.mod + bab + sizeMap.size;
				attackGrid.melee2 = abilityScores.dex.mod + bab + sizeMap.size;
				setter["attk_melee2_note"] = 'Weapon Finesse';
				if (importantFeats.criticalfocus) {
					setter["melee2_crit_conf"] = 4;
				}
			}
			try {
				if (importantFeats.agilemaneuvers) {
					setter["CMB-ability"] = "@{DEX-mod}";
					setter["CMB-ability-mod"] = abilityScores.dex.mod;
					newCMB=abilityScores.dex.mod + bab - sizeMap.size;
					setter["cmb_desc"] = 'Agile Maneuvers';
				} else {
					setter["CMB-ability-mod"] = abilityScores.str.mod;
					newCMB=abilityScores.str.mod + bab - sizeMap.size;
				}
				tempCMB = parseInt(v.CMB,10);
				if (newCMB === tempCMB || isNaN(tempCMB)){
					setter["CMB"] = newCMB;
					attackGrid.cmb = newCMB;
				} else {
					miscCMB = tempCMB - newCMB;
					setter["CMB"] = tempCMB;
					attackGrid.cmb = tempCMB;
					setter["attk-CMB-misc"] = miscCMB;
				}
				
			} catch (errC) {
				TAS.error("parseAndCreateAttacks error creating CMB attack types", errC);
			}
			// Attacks *****************************
			if (v["npc-melee-attacks-text"]) {
				try {
					attacklist = parseAttacks(v["npc-melee-attacks-text"], "melee");
					assignPrimarySecondary(attacklist);
					setter = createAttacks(attacklist, setter, attackGrid, abilityScores, importantFeats, defReach, reachExceptions, sizeMap);
				} catch (errM) {
					TAS.error("parseAndCreateAttacks error creating melee attacks", errM);
				}
			}
			if (v["npc-ranged-attacks-text"]) {
				try {
					attacklist = parseAttacks(v["npc-ranged-attacks-text"], "ranged");
					setter = createAttacks(attacklist, setter, attackGrid, abilityScores, importantFeats, null, null, sizeMap);
				} catch (errR) {
					TAS.error("parseAndCreateAttacks error creating ranged attacks", errR);
				}
			}
		} catch (err) {
			TAS.error("parseAndCreateAttacks", err);
		} finally {
			return setter;
		}
	},
	/*createFeatEntries
	*@returns setter */
	createFeatEntries = function (setter, featlist) {
		return _.reduce(featlist, function (memo, feat) {
			var newRowId = generateRowID(),
			prefix="repeating_ability_"+newRowId+"_";
			memo[prefix+"name"] = feat;
			memo[prefix+"rule_category"]="feats";
			memo[prefix+"showinmenu"]="1";
			memo[prefix+"CL-basis"]="@{npc-hd-num}";
			memo[prefix+"CL-basis-mod"]=setter.level||0;
			if (setter["race"]) {
				memo[prefix + 'class-name'] = setter["race"];
			}
			memo[prefix+"row_id"]=newRowId;
			memo[prefix + "frequency"] = 'not-applicable';//'not-applicable';
			memo[prefix + 'ability_type'] = '';//'not-applicable';
			return memo;
		}, setter);
	},
	/*createFeatureEntries
	*@returns setter */
	createFeatureEntries = function (setter, abilitylist, abilityScoreMap) {
		var attrs = {}, creatureRace = "", tempint=0,dc=0,abilityMod=0,charlevel=0,calcDC=0;
		try {
			//TAS.debug("at createFeatureEntries:", abilitylist);
			charlevel = Math.floor((parseInt(setter.level,10)||0)/2);
			creatureRace = setter["race"];
			attrs = _.chain(abilitylist).map(function (ability) {
				var match=null,tempstr;
				//copy only settings we want to keep and return them in a new obj.
				//TAS.debug("first iter: ", ability);
				try {
					ability.description = ability.description || '';
					if (ability.note){
						if (ability.description) {
							ability.description += ', ';
						}
						ability.description += ability.note.replace(/,\s$/, '');
					}
					if (ability.other) {
						if (ability.description) {
							ability.description += ', ';
						}
						ability.description += ability.other.replace(/,\s$/, '');
						ability.other = null;
					}
					if(!ability.ability_type){
						if (ability.name){
							tempstr=PFUtils.getSpecialAbilityTypeFromString(ability.name);
							if(tempstr){
								ability.ability_type=tempstr;
								ability.name = ability.name.replace(/\b(Su|Ex|Sp)\b/i,'').replace('()','');
							}
						}
					}
				} catch (err3) {
					TAS.error("createFeatureEntries err3",err3);
				} finally {
					//TAS.debug("this ability is:", ability);
					return ability;
				}
			}).filter(function (ability) {
				if (ability.name) {
					return true;
				}
				return false;
			}).reduce(function (memo, ability) {
				var newRowId, prefix;
				try {
					newRowId = generateRowID();
					prefix = "repeating_ability_" + newRowId + "_";
					memo[prefix + "name"] = ability.name;
					memo[prefix + "row_id"] = newRowId;
					memo[prefix + "showinmenu"]='1';
					if (ability.shortdesc) {
						memo[prefix + 'short-description'] = ability.shortdesc;
					}
					if (ability.description) {
						memo[prefix + 'description'] = ability.description;
					}
					if (ability.used) {
						if(ability.frequency&& ability.frequency==='everyrounds'){
							memo[prefix+"frequency"] = ability.frequency;
							memo[prefix+'rounds_between']=ability.used;
						} else {
							if(ability.frequency){
								memo[prefix + "frequency"] = ability.frequency;
							} else {
								memo[prefix + "frequency"] = 'perday';
							}
							memo[prefix + 'used'] = ability.used;
							memo[prefix + 'used_max'] = ability.used;
							memo[prefix + 'max-calculation'] = ability.used;
						}
					} else {
						memo[prefix + "frequency"] = 'not-applicable';//'not-applicable';
					}
					if (ability.dmgtype) {
						memo[prefix+"damage-type"]= ability.dmgtype;
					}
					if (ability.rule_category){
						memo[prefix+ 'rule_category'] = ability.rule_category;
					}
					if (ability.ability_type) {
						memo[prefix + 'ability_type'] = ability.ability_type;
					} else {
						memo[prefix + 'ability_type'] = '';//'not-applicable';
					}
					memo[prefix+"CL-basis"]="@{npc-hd-num}";
					memo[prefix+"CL-basis-mod"]=setter.level||0;					
					if (creatureRace) {
						memo[prefix + 'class-name'] = creatureRace;
					}
					if(ability.save){
						memo[prefix + 'save'] = ability.save;
					}
					
					if(ability.DCability){
						memo[prefix+'ability-basis']='@{'+ability.DCability.toUpperCase()+'-mod}';
						abilityMod = abilityScoreMap[ability.DCability.toLowerCase()].mod;
					} else if (ability.ability_type==='Sp' || setter.is_undead){
						memo[prefix+'ability-basis']='@{CHA-mod}';
						abilityMod = abilityScoreMap.cha.mod;
					} else {
						memo[prefix+'ability-basis']='@{CON-mod}';
						abilityMod = abilityScoreMap.con.mod;
					}
					if(ability.extraDamage){
						memo[prefix+'damage-macro-text']=ability.extraDamage;
					}
					if(ability.extraDamageType){
						memo[prefix+'damage-type']=ability.extraDamageType;
					}
					memo[prefix + "spell_level-basis"]="floor(@{casterlevel}/2)";
					if (ability.DC){
						dc =parseInt(ability.DC,10)||0;
						calcDC=  abilityMod + charlevel +10;
						tempint = dc - calcDC;
						if (tempint !== 0){
							memo[prefix+"spell_level-misc"]= tempint;
							memo[prefix+"spell_level-misc-mod"]= tempint;
						}
					}
					
				} catch (ierr2) {
					TAS.error("createFeatureEntries", ierr2);
				} finally {
					return memo;
				}
			}, {}).value();
			//TAS.debug"createFeatureAttrs adding " + _.size(attrs) + " to " + _.size(setter), attrs);
			setter = _.extend(setter, attrs);
		} catch (err) {
			TAS.error("createFeatureEntries", err);
		} finally {
			return setter;
		}
	},
	/** appends values of objects in sa2 to sa1 if name already exists in sa1
	* by reference
	* @param {Array} sa1 Array of {} js objects:list of special abilities maps. Must have 'name' property to compare
	* @param {Array} sa2 Array of {} js objects:list of special abilities maps. Must have 'name' property to compare
	* @returns {Array} sa2 concatenated with sa2, for any duplicates, we add properties from the sa2 version to sa1, but do not overwrite.
	*/
	combineSpecialAbilities = function (sa1, sa2) {
		var combined;
		combined = _.map(sa1, function ( sa) {
			var existingSA;
			try {
				existingSA = _.findWhere(sa2, { 'name': sa.name });
				if (existingSA) {
					_.each(_.keys(existingSA),function(key){
						//TAS.debug("combining abilties: "+sa[key]+ " plus "+ existingSA[key]);
						if (key==='description'){
							sa.description = ((sa.description) ? (sa.description + ", ") : "") + (existingSA.description||"");
						} else if (key === 'shortdesc'){
							sa.shortdesc = ((sa.shortdesc) ? (sa.shortdesc + ", ") : "") + (existingSA.shortdesc||"");
						} else if ( !sa[key] && existingSA[key]){
							sa[key]=existingSA[key];
						}
					});
				}
			} catch (err1) {
				TAS.error("combineSpecialAbilities err1", err1);
			} finally {
				return sa;
			}
		});
		sa2 = _.reject(sa2,function(sa){
				if (_.findWhere(sa1,{'name':sa.name})){
					return true;
				}
				return false;
			});

		combined = _.union(combined, sa2);
		return combined;
	},
	createClassEntries = function (setter, characterClass) {
		var sumlvls =0, currlvls = 0,i=0,startidx=0,alreadyPresent=false;
		try {
			if (characterClass.CL && characterClass.classname){
				for (i=0;i<7;i++){
					if (setter["class-" + i + "-name"] || setter["class-" + i + "-level"]>0 ){
						startidx=i;
						if (setter["class-" + i + "-name"].toLowerCase() === characterClass.classname.toLowerCase()){
							alreadyPresent=true;
							break;
						}
					}
				}
				if (startidx>=6){
					TAS.warning("too many classes, cannot add " + characterClass.classname);
				} else {
					setter["class-" + startidx + "-name"] = characterClass.classname||"";
					setter["class-" + startidx + "-level"] = characterClass.CL||0;
				}
				if(characterClass.CL){
					currlvls = parseInt(setter.level,10)||0;
					currlvls += characterClass.CL||0;
					setter.level = currlvls;
				}
			}
		} catch (err){
			TAS.error("createClassEntries",err);
		} finally {
			return setter;
		}
	},

	/**************************** THE BIG ONE ***********************/
	/*importFromCompendium - imports all stuff*/
	importFromCompendium = function (eventInfo, callback, errorCallback) {
		var done = _.once(function(){
			TAS.info("##############################################");
			TAS.info("Leaving importFromCompendium");
			if (typeof callback === "function"){
				callback();
			}
		}),
		errorDone = _.once(function(){
			TAS.info("##############################################");
			TAS.info("Leaving importFromCompendium NOTHING DONE");
			if (typeof errorCallback === "function"){
				errorCallback();
			}
		}),
		fields = npcCompendiumAttributesPlayer.concat(["is_npc", "alignment"]);
		getAttrs(fields, function (v) {
			var setter = {}, abilityScores = {}, sizeMap = {}, speedMap = {}, hpMap = {}, acMap = {},
			importantFeats = {}, reachObj = {}, racialModsMap = {}, skillsMap = {}, attackGrid = {},
			baseFort = parseInt(v.fort_compendium, 10) || 0,
			baseRef = parseInt(v.ref_compendium, 10) || 0,
			baseWill = parseInt(v.will_compendium, 10) || 0,
			bab = parseInt(v["bab_compendium"], 10) || 0,
			reachExceptions = [],
			isUndead = false, specAbilObj = {}, npcdesc = '',
			tempNote = "", tempstr = "",
			tempInt = 0, tempFloat = 0.0, tempobj=null, baseInit = 0, initMisc = 0, spellcastingclass = -1,
			cr, featlist, attacklist, hpMod, tempArray, spellObj, casterObj,
			matches, attackArray, classSkillArray, specialAttacks, SLAs, attackArrays,
			specialAbilities = {},
			specialQualities=[],
			match,
			baseSaves = {};
			//TAS.debug("importFromCompendium", v);
			try {
				//some basics ***************************************************
				setter['level']=0;
				setter["is_npc"] = "1";
				setter['is_v1'] = "1";
				setter['PFSheet_Version'] =String((PFConst.version.toFixed(2)));
				setter=PFMigrate.getAllMigrateFlags(setter);
				if (v.xp_compendium) {
					setter["npc-xp"] = v.xp_compendium;
				}
				if(v.cr_compendium){
					cr = v.cr_compendium.replace(/\s*cr\s*/i,'');
					cr = SWUtils.trimBoth(cr);
					setter["npc-cr"] = cr;
				}
				setter["PC-Whisper"] = "/w gm";
				//Creature Race and Type *****************************************************
				//undead means use CHA instead of CON
				if (v.type_compendium) {
					setter["npc-type"] = v.type_compendium;
				}
				isUndead = ((/undead/i).test(v.type_compendium)||(/undead/i).test(v.character_name));
				if (isUndead) {
					setter["is_undead"] = "1";
					TAS.warn("is undead! ");
				}
				if (v.character_name){
					setter["race"] = v["character_name"];
				}

				/****************** class(es)******************************/
				if (v.class_compendium) {
					setter["add_class"]=1;
					tempInt=0;
					matches = v.class_compendium.split(/\s*,\s*/g);
					_.each(matches,function(classstr){
						var  lvl=0, localmatch = classstr.match(/\d+/),
							newclassstr=classstr;
							tempInt++;
						if (match){
							lvl = parseInt(match[0],10)||0;
							newclassstr = classstr.slice(0,match.index);
							if(( match.index+match[0].length) <= classstr.length){
								newclassstr += classstr.slice(match.index+match[0].length);
							}
						}
						setter = createClassEntries (setter,{'classname':classstr,'CL':lvl});
					});
					if(tempInt>1){
						setter["multiclassed"]=1;
						setter["class1_show"]=1;
					}
					tempInt=0;
				}
				// Ability Scores *****************************************************************
				abilityScores = parseAbilityScores(v);
				setter = createAbilityScoreEntries(setter, abilityScores, isUndead);
				// Size **********************************************************************
				sizeMap = PFSize.getSizeFromText(v.size_compendium);
				if (sizeMap && sizeMap.size !== 0) {
					setter.size = sizeMap.size;
					setter['default_char_size']=sizeMap.size;
					setter['old_size']=sizeMap.size;
					setter.size_skill = sizeMap.skillSize;
					setter["CMD-size"] = (sizeMap.size * -1);
					setter.size_skill_double = (sizeMap.skillSize * 2);
				} else {
					sizeMap = {'size':0,'size_skill':0,'CMD-size':0,'size_skill_double':0};
					setter['size']=0;
					setter['default_char_size']=0;
					setter['old_size']=0;
				}
				// Feats *********************************************************************
				if (v["npc-feats-text"]) {
					try {
						featlist = parseFeats(v["npc-feats-text"]);
						if (featlist && _.size(featlist) > 0) {
							setter = createFeatEntries(setter, featlist);
							importantFeats = buildImportantFeatObj(featlist);
						}
					} catch (featerr) {
						TAS.error("error parsing feats", featerr);
						if (!importantFeats) {
							importantFeats = {};
						}
					}
				}
				// Initiative *****************************************************************
				baseInit = getNPCInit(v.init_compendium);
				createInitEntries(setter, baseInit, abilityScores, importantFeats);
				/********************** Saves and defense ************************/
				baseSaves = {
					'baseFort': baseFort,
					'baseRef': baseRef,
					'baseWill': baseWill
				};
				if (v.dr_compendium) {
					setter["DR"] = v.dr_compendium;
				}
				if (v.sr_compendium) {
					setter["SR"] = v.sr_compendium;
					setter["SR-macro-text"] = v.sr_compendium;
				}
				createSaveEntries(setter, abilityScores, isUndead, baseSaves, v);

				//hit points ****************************
				createHPAbilityModEntry(setter, abilityScores, isUndead);
				hpMod = parseInt(setter["HP-ability-mod"], 10);
				//TAS.debug("calling parse hp with con mod of :" + hpMod);
				hpMap = parseNPChp(v["npc_hp_compendium"], hpMod);
				createHealthEntries(setter, abilityScores, isUndead, hpMap);
				
				//AC ************************************************
				acMap = parseNPCAC(v["ac_compendium"], v.CMD, abilityScores.dex.mod, sizeMap.size);
				createACEntries(setter, acMap, abilityScores, importantFeats, hpMap, bab);
				// Reach *******************************************
				//TAS.debug("about to find reach: " + v.reach_compendium);
				reachObj = parseReach(v.reach_compendium);
				if (reachObj) {
					setter.reach = reachObj.reach;
					if (reachObj.reachNotes) {
						setter["reach-notes"] = reachObj.reachNotes;
					}
				} else {
					reachObj = {};
					reachObj.reach = 5;
					reachObj.reachExceptions = [];
				}
				// Attacks *********************************************************
				parseAndCreateAttacks(setter, abilityScores, sizeMap, importantFeats, bab, attackGrid, reachObj, v);
				//TAS.debug("after parseAndCreateAttacks attrnum:" + _.size(setter));
				//special Attacks ***************************************************
				specialAttacks = parseSpecialAttacks(setter, v["npc-special-attacks"], attackGrid.cmb);
				if (specialAttacks && specialAttacks.length > 0) {
					attackArrays = _.groupBy(specialAttacks, 'specialtype');
					setter = createAttacks(attackArrays.attack, setter, attackGrid, abilityScores, importantFeats, null, null, sizeMap);
					specialAbilities = attackArrays.ability;
					//TAS.debug("after createSpecialAttackEntries attrnum:" + _.size(setter));
				}
				//spells***************************************************
				//TAS.debug("checking for spells");
				if (v["npc-spells-known-text"]) {
					//advance index
					spellcastingclass = 0;
					setter['use_spells']=1;
					//TAS.debug("has some spells");
					spellObj = parseSpells(v["npc-spells-known-text"]);
					//TAS.debug("the spells are:",spellObj);
					if (spellObj) {
						setter['use_spells']=1;
						casterObj = getCasterObj(spellObj, abilityScores, hpMap);
						//do not add caster levels to hit dice or it gets screwed up
						//setter = createClassEntries (setter,casterObj);
						setter = setCasterFields(setter, casterObj, spellcastingclass);
						setter = createSpellEntries(setter, spellObj, casterObj);
					}
				}
				//Spell-like-abilities***************************************************
				//TAS.debug("checking for SLAs");
				if (v["npc-spellike-ability-text"]) {
					SLAs = parseSLAs(v["npc-spellike-ability-text"]);
					if (SLAs) {
						//TAS.debug("the SLAs are:", SLAs);
						casterObj = getCasterObj(SLAs, abilityScores, hpMap, true);
						setter = createSLAEntries(setter, SLAs, casterObj);
					}
				}
	//TAS.debug("before parsing special abilities are:", specialAbilities);
				// content and special abilities ***************************
				if (v.content_compendium) {
					//TAS.debug("before parseSpecialAbilities attrnum:"+_.size(setter));
					specAbilObj = parseSpecialAbilities(v.content_compendium);
					
					//TAS.debug("returned from parse special ablities with", specAbilObj);
					if (specAbilObj) {
						if (specAbilObj.description && _.size(specAbilObj.description) > 0) {
							npcdesc = _.reduce(specAbilObj.description, function (memo, line) {
								memo += " ";
								memo += line;
								return memo;
							}, "");
							setter["character_description"] = npcdesc;
						}
						if (specAbilObj.specialAbilities) {
							specialAbilities = combineSpecialAbilities(specialAbilities, specAbilObj.specialAbilities);
						}
					} else {
						v['character-description']=v.content_compendium;
					}
					//TAS.debug("now special abilities are:", specialAbilities);
				}
				if (v.SQ_compendium) {
					//TAS.debug("found special qualities");
					specialQualities =  parseSpecialQualities(v.SQ_compendium);
					if (specialQualities){
						specialAbilities = combineSpecialAbilities(specialAbilities, specialQualities);
					}
				}
				if (specialAbilities && _.size(specialAbilities) > 0) {
					setter = createFeatureEntries(setter, specialAbilities, abilityScores);
					//look for sneak attack
					tempobj = _.find(specialAbilities,function(atkobj){return (/sneak.attack/i).test(atkobj.name);});
					if(tempobj){
						setter['global_precision_dmg_macro']='[[[[floor((@{level}+1)/2)]]d6]]';
						setter['global_precision_dmg_type']= tempobj.name;
					}
					
					//TAS.debug("after createFeatureEntries attrnum:" + _.size(setter));
				}

				// Misc *********************************************
				if (v.senses_compendium) {
					match = v.senses_compendium.match(/perception/i);
					if (match){
						setter["vision"] = v.senses_compendium.slice(0,match.index-1);
					} else {
						setter["vision"] = v.senses_compendium;
					}
				}
				if (v.speed_compendium) {
					speedMap = parseSpeed(v.speed_compendium);
					setter = createSpeedEntries(setter, speedMap, importantFeats);
				}
				if (v.alignment) {
					setter["alignment"] = v.alignment.toUpperCase();
				}
				if (v.space_compendium) {
					setter["space"] = parseSpace(v.space_compendium);
				}
				//TAS.debug("before skills attrnum:" + _.size(setter));
				// skills *********************************************************
				if (v.skills_compendium) {
					skillsMap = parseSkills(v.skills_compendium);
					classSkillArray = getCreatureClassSkills(v.type_compendium);
					if (v.racial_mods_compendium) {
						racialModsMap = parseSkillRacialBonuses(v.racial_mods_compendium);
					}
					if (skillsMap && _.size(skillsMap) > 0) {
						setter = createSkillEntries(setter, skillsMap, racialModsMap, abilityScores, importantFeats, classSkillArray, isUndead);
						//TAS.debug("after createSkillEntries attrnum:" + _.size(setter));
					}
				}
			} catch (err2) {
				TAS.error("importFromCompendium outer at end", err2);
			} finally {
				if (_.size(setter) > 0) {
					setter["npc_import_now"]=0;
					setter['npc-compimport-show']=0;
					TAS.info("##############################################","END OF importFromCompendium");
					TAS.debug("END OF importFromCompendium",setter);
					setAttrs(setter, PFConst.silentParams, done);
				} else {
					setter["npc_import_now"]=0;
					setter['npc-compimport-show']=0;
					setAttrs(setter, PFConst.silentParams, errorDone);
				}
			}
		});
	},
	registerEventHandlers = function () {
	};
	registerEventHandlers();
	console.log(PFLog.l + '   NPCParser module loaded        ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		importFromCompendium: importFromCompendium,
		importNPC: importFromCompendium
	};
}());
var HLImport = HLImport || (function() {
	'use strict';

	var parseNum = function(num)
	{
		if (_.isUndefined(num) || num === "")
			return 0;
		return (parseInt(num) || 0);
	},

	buildList = function(objArray, propName) { return _.map(objArray, function (item) { return item[propName]; }).join(", "); },

	getSizeMod = function(size)
	{
		switch(size.toLowerCase())
		{
			case "colossal":
				return -8;
				break;
			case "gargantuan":
				return -4;
				break
			case "huge":
				return -2;
				break;
			case "large":
				return -1;
				break;
			case "small":
				return 1;
				break;
			case "tiny":
				return 2;
				break;
			case "diminutive":
				return 4;
				break;
			case "fine":
				return 8;
				break;
			default:
				return 0;
		}
	},

	// Make sure "stuff" is an array
	arrayify = function(stuff)
	{
		if (_.isUndefined(stuff))
			return [];
		if (Array.isArray(stuff))
			return stuff;
		return new Array(stuff);
	},

	importInit = function(attrs,initObj)
	{
		attrs["init-misc"] = parseNum(initObj._total)-parseNum(initObj._attrtext);
		attrs["init-ability"] = "@{"+initObj._attrname.substr(0,3).toUpperCase()+"-mod}";
		attrs["init_notes"] = initObj.situationalmodifiers._text;
	},

	importAbilityScores = function(attrs,attributes)
	{
		attributes.forEach(function(abScore) {
			var abName = abScore._name.substr(0,3).toUpperCase();
			var base = parseNum(abScore.attrvalue._base);
			var modifier = parseNum(abScore.attrvalue._modified) - base;  // Modifier is the total difference between what HL is reporting as the character's base ability score and the final modified ability score
			attrs[abName+"-base"] = base;
			// If the modifier is positive, assume it's an enhancement bonus; otherwise, assume it's a penalty
			if (modifier > 0)
				attrs[abName+"-enhance"] = modifier;
			else
				attrs[abName+"-penalty"] = modifier;
		});
	},

	importSaves = function(attrs,saves)
	{
		// Since the XML doesn't break this down by class, add it all to class 0
		var i = 0;
		var saveNotes = saves.allsaves.situationalmodifiers._text;
		for (i = 0; i < saves.save.length; i++)
		{
			var save = saves.save[i];
			var abbr = save._abbr;
			
			attrs["class-0-"+abbr] = parseNum(save._base);
			attrs[abbr+"-resist"] = parseNum(save._fromresist);
			attrs[abbr+"-misc"] = parseNum(save._save)-parseNum(save._base)-parseNum(save._fromresist)-parseNum(save._fromattr);
			
			if (save.situationalmodifiers._text !== "" && saveNotes.indexOf(save.situationalmodifiers._text) === -1)
				saveNotes = saveNotes + "\n**"+abbr+":** " + save.situationalmodifiers._text;
				
		}
		attrs["Save-notes"] = saveNotes.trim();
	},
	
	// Find an existing repeatable item with the same name, or generate new row ID
	getOrMakeRowID = function(featIDList,name)
	{
		var attrNames = Object.values(featIDList);
		var rows = Object.keys(featIDList);
		
		var attrMatch = _.find(attrNames, function(currentAttrName)
		{
			var attrName = currentAttrName;
			// Eliminate anything in parentheses, dice expressions, and "x#" (we use that to indicate we've taken a feat more than once) before comparing names
			attrName = attrName.replace(/ x[0-9]+$/,"").trim();

			if (attrName === name)
			{
				var ID = rows[_.indexOf(attrNames,currentAttrName)];
				if (!_.isUndefined(ID))
					return true;
			}
			return false;
		});
		if (!_.isUndefined(attrMatch))
			return rows[_.indexOf(attrNames,attrMatch)];
		return generateRowID();
	},

	// Find an existing repeatable item with the same name, or generate new row ID; extra processing for items
	getOrMakeItemRowID = function(featIDList,name)
	{
		var attrNames = Object.values(featIDList);
		var rows = Object.keys(featIDList);
		
		var compareName = name.replace(/\(.*\)/,"").replace(/\+\d+/,"").toLowerCase().replace("masterwork","").trim();
		var attrMatch = _.find(attrNames, function(currentAttrName)
		{
			var attrName = currentAttrName;
			// Eliminate anything in parentheses, dice expressions, and "x#" (we use that to indicate we've taken a feat more than once) before comparing names
			attrName = attrName.replace(/\(.*\)/,"").replace(/\+\d+/,"").toLowerCase().replace("masterwork","").trim();

			if (attrName === compareName)
			{
				var ID = rows[_.indexOf(attrNames,currentAttrName)];
				if (!_.isUndefined(ID))
					return true;
			}
			return false;
		});
		if (!_.isUndefined(attrMatch))
			return rows[_.indexOf(attrNames,attrMatch)];
		return generateRowID();
	},

	// Find an existing repeatable item with the same name and spellclass, or generate new row ID
	getOrMakeSpellRowID = function(featIDList,name,spellclass)
	{
		var attrMatch = _.find(featIDList, function(currentFeat)
		{
			if (currentFeat.name === name && currentFeat.spellclass === spellclass)
				return true;
			return false;
		});
		if (!_.isUndefined(attrMatch))
			return attrMatch.rowID;
		return generateRowID();
	},

	getOrMakeClassRowID = function(featIDList,name)
	{
		var attrObjs = Object.values(featIDList);
		var rows = Object.keys(featIDList);
		
		var attrMatch = _.find(attrObjs, function(currentAttrObj)
		{
			var attrName = currentAttrObj.name;
			// Eliminate anything in parentheses, dice expressions, and "x#" (we use that to indicate we've taken a feat more than once) before comparing names
			name = name.replace(/\(.+\)/g,"").replace(/\d+d\d+(\+\d*)*/g,"").replace(/\+\d+/g,"").trim();
			attrName = attrName.replace(/\(.+\)/g,"").replace(/\d+d\d+(\+\d*)*/g,"").replace(/\+\d+/g,"").trim();

			if (attrName === name)
				return true;
			return false;
		});
		if (!_.isUndefined(attrMatch))
			return attrMatch.rowID;
		return generateRowID();
	},

	importFeats = function(attrs,feats,featIDList,resources)
	{
		var repeatPrefix = "repeating_ability";
		var skipList = [];
		var featNames = _.map(feats, function(feat) { return feat._name; } );
		_.each(feats, function(feat)
		{
			// Early exit if we already dealt with another copy of this feat
			if (_.contains(skipList,feat._name))
				return;

			// Count the number of times the feat is listed, so we can indicate that in the feat name
			var taken = _.filter(featNames,function(featName) { return featName === feat._name; } ).length;

			var row = getOrMakeRowID(featIDList,feat._name);
			if (!_.isUndefined(featIDList[row]))
				delete featIDList[row];
			
			if (taken > 1)
				attrs[repeatPrefix+"_"+row+"_name"] = feat._name + " x" + taken;
			else
				attrs[repeatPrefix+"_"+row+"_name"] = feat._name;
			attrs[repeatPrefix+"_"+row+"_description"] = feat.description;
			attrs[repeatPrefix+"_"+row+"_rule_category"] = "feats";
			skipList.push(feat._name);
			if (_.contains(Object.keys(resources),feat._name))
				attrs[repeatPrefix+"_"+row+"_max-calculation"] = resources[feat._name]._max;
		});
	},

	// Hero Lab stores armor and shields identically, so so assume anything with "shield" or "klar" in the name is a shield
	nameIsShield = function(name)
	{
		if (name.toLowerCase().indexOf("shield") !== -1 || name.toLowerCase().indexOf("klar") !== -1)
			return true;
		return false;
	},

	importItems = function(items,resources,armorPenalties,armor,weapons)
	{
		var repeatPrefix = "repeating_item";
		getSectionIDs(repeatPrefix, function(idarray) {
			var itemNameAttrs = _.union(_.map(idarray,function(id) { return repeatPrefix+"_"+id+"_name"; 		}),["shield3-acp","shield3-spell-fail"]);
			getAttrs(itemNameAttrs, function(names) {
			
				// Pull out the shield attributes before we build the ID list
				var shieldACP = parseNum(names["shield3-acp"]);
				var shieldASF = parseNum(names["shield3-spell-fail"]);
				if (!_.isUndefined(names["shield3-acp"]))
					delete names["shield3-acp"];
				if (!_.isUndefined(names["shield3-spell-fail"]))
					delete names["shield3-spell-fail"];

				var itemIDList = _.object(_.map(names,function(name,attr) {
					return [attr.substring(repeatPrefix.length+1,(attr.indexOf("_name"))),name];
				}));
				var itemsList = [];
				var attrs = {};
				var armorNames = _.map(armor, function(obj) { return obj._name; });
				var weaponNames = _.map(weapons, function(obj) { return obj._name; });
				
				// List of words that indicate an item is masterwork
				var masterworkWords = ["mithral","adamantine","angelskin","darkleaf","darkwood","dragonhide","eel","fire-forged","frost-forged","greenwood","paueliel"]
				_.each(items,function(item)
				{
					var row = getOrMakeItemRowID(itemIDList,item._name);
					if (!_.isUndefined(itemIDList[row]))
						delete itemIDList[row];
					itemsList.push(item._name);
					
					repeatPrefix = "repeating_item_" + row;
					attrs[repeatPrefix+"_name"] = item._name;
					attrs[repeatPrefix+"_item-weight"] = item.weight._value;
					attrs[repeatPrefix+"_value"] = (parseFloat(item.cost._value) / parseInt(item._quantity) );
					attrs[repeatPrefix+"_description"] = item.description;
		
					if (_.contains(Object.keys(resources),item._name) && item._quantity === "1" && resources[item._name]._max !== "1")
					{
						attrs[repeatPrefix+"_qty"] = resources[item._name]._left;
						attrs[repeatPrefix+"_qty_max"] = resources[item._name]._max;
					}
					else
						attrs[repeatPrefix+"_qty"] = item._quantity;
		
					if (!_.isUndefined(item.itempower))
						_.each(arrayify(item.itempower), function(itemPower) { itemsList.push(itemPower._name); });
						
					// check if this is a weapon
					var weaponCompareName = item._name;
					// If this is a shield (but not a klar), the attack name will be "Heavy/light shield bash"
					if (item._name.toLowerCase().indexOf("shield") !== -1)
					{
						var attackName;
						if (item._name.toLowerCase().indexOf("heavy" !== -1))
							attackName = "heavy shield bash";
						else
							attackName = "light shield bash";
						weaponCompareName = (_.find(weaponNames,function(name) { if (name.toLowerCase().indexOf(attackName) !== -1) return true; return false;}) || item._name);
					}
					if (_.contains(weaponNames, weaponCompareName))
					{
						var weaponObj = weapons[_.indexOf(weaponNames,weaponCompareName)];
						attrs[repeatPrefix+"_item-wpenhance"] = parseNum(weaponObj._name.match(/\+\d+/));
						
						if (!_.isUndefined(weaponObj._typetext))
							attrs[repeatPrefix+"_item-dmg-type"] = weaponObj._typetext;
						
						// Check to see if item name includes any words that indicate this is a masterwork item
						if ((weaponCompareName.toLowerCase().indexOf("masterwork") !== -1) || _.intersection(masterworkWords,item._name.toLowerCase().split(" ")).length > 0)
							attrs[repeatPrefix+"_item-masterwork"] = 1;
							
						if (!_.isUndefined(weaponObj._damage))
						{
							var weaponDice = weaponObj._damage.match(/\d+d\d+/);
							if (weaponDice.length > 0)
							{
								attrs[repeatPrefix+"_item-damage-dice-num"] = parseNum(weaponDice[0].split("d")[0]);
								attrs[repeatPrefix+"_item-damage-die"] = parseNum(weaponDice[0].split("d")[1]);
							}
						}
						
						if (!_.isUndefined(weaponObj._crit))
						{
							var critArray = weaponObj._crit.split("/");
							if (critArray.length > 1)
								attrs[repeatPrefix+"_item-crit-target"] = parseNum(critArray[0].match(/\d+/)[0]);
							else
								attrs[repeatPrefix+"_item-crit-target"] = 20;
							attrs[repeatPrefix+"_item-crit-multiplier"] = parseNum(critArray[critArray.length-1].replace(/\D/g,""));
						}
						
						if (!_.isUndefined(weaponObj.rangedattack) && !_.isUndefined(weaponObj.rangedattack._rangeincvalue))
							attrs[repeatPrefix+"_item-range"] = parseNum(weaponObj.rangedattack._rangeincvalue);
					}

					// check if this is armor
					// If this is a klar, the armor name will be different
					var armorCompareName = item._name;
					if (item._name.toLowerCase().indexOf("klar") !== -1)
					{
						armorCompareName = (_.find(armorNames,function(name) { if (name.toLowerCase().indexOf("klar") !== -1) return true; return false;}) || item._name);
					}
					if (_.contains(armorNames, armorCompareName))
					{
						var armorObj = armor[_.indexOf(armorNames,armorCompareName)];
						
						// Item is a shield
						if (nameIsShield(item._name))
						{
							var enhancement = parseNum(armorCompareName.match(/\+\d+/));
							var ACbonus  = parseNum(armorObj._ac) - enhancement;
							attrs[repeatPrefix+"_item-acbonus"] = ACbonus;
							attrs[repeatPrefix+"_item-acenhance"] = enhancement;
							if (!_.isUndefined(armorObj._equipped) && armorObj._equipped === "yes")
							{
								attrs[repeatPrefix+"_item-acp"] = shieldACP;
								attrs[repeatPrefix+"_item-spell-fail"] = shieldASF;
								attrs["shield3"] = item._name;
								attrs["shield3-acbonus"] = ACbonus;
								attrs["shield3-enhance"] = enhancement;
							}
						}
						else
						{
							var enhancement = parseNum(item._name.match(/\+\d+/));
							var ACbonus  = parseNum(armorObj._ac) - enhancement;
							attrs[repeatPrefix+"_item-acbonus"] = ACbonus;
							attrs[repeatPrefix+"_item-acenhance"] = enhancement;
							if (!_.isUndefined(armorObj._equipped) && armorObj._equipped === "yes")
							{
								attrs["armor3-acp"] = attrs[repeatPrefix+"_item-acp"] = armorPenalties.ACP - shieldACP;
								attrs["armor3-spell-fail"] = attrs[repeatPrefix+"_item-spell-fail"] = armorPenalties.spellfail - shieldASF;
								if (armorPenalties.maxDex == 99)
									attrs["armor3-max-dex"] = attrs[repeatPrefix+"_item-max-dex"] = "";
								else
									attrs["armor3-max-dex"] = attrs[repeatPrefix+"_item-max-dex"] = armorPenalties.maxDex;
								attrs["armor3"] = item._name;
								attrs["armor3-acbonus"] = ACbonus;
								attrs["armor3-enhance"] = enhancement;
							}
						}
					}
				});
				setAttrs(attrs);
			});
		});
	},

	importTraits = function(attrs,traits,traitIDList,resources)
	{
		var repeatPrefix = "repeating_ability";
		traits.forEach(function(trait)
		{
			var row = getOrMakeRowID(traitIDList,trait._name);
			if (!_.isUndefined(traitIDList[row]))
				delete traitIDList[row];
			attrs[repeatPrefix+"_"+row+"_name"] = trait._name;
			attrs[repeatPrefix+"_"+row+"_description"] = trait.description;
			attrs[repeatPrefix+"_"+row+"_rule_category"] = "traits";
			if (_.contains(Object.keys(resources),trait._name))
				attrs[repeatPrefix+"_"+row+"_max-calculation"] = resources[trait._name]._max;
		});
	},

	importSLAs = function(attrs,SLAs,SLAsIDList,resources)
	{
		var repeatPrefix = "repeating_ability";
		SLAs.forEach(function(SLA)
		{
			var row = getOrMakeRowID(SLAsIDList,SLA._name);
			if (!_.isUndefined(SLAsIDList[row]))
				delete SLAsIDList[row];
			attrs[repeatPrefix+"_"+row+"_name"] = SLA._name;
			attrs[repeatPrefix+"_"+row+"_description"] = SLA.description;
			attrs[repeatPrefix+"_"+row+"_rule_category"] = "spell-like-abilities";
			attrs[repeatPrefix+"_"+row+"_ability_type"] = "Sp";
			if (_.contains(Object.keys(resources),SLA._name))
				attrs[repeatPrefix+"_"+row+"_max-calculation"] = resources[SLA._name]._max;
		});
	},

	importFeatures = function(attrs,featureList,specials,archetypes,resources)
	{
		var specNameList = _.map(specials,function(special) { return special._name;});
		var skipList = [];
		_.each(specials, function(special)
		{
			var name = special._name;
			var repeatPrefix = "repeating_ability",row,classSource = -1;
			var cleanName = name.replace(/ x[0-9]+$/,"").replace(/\(([^\)]+)\)/g,"").trim();
			if (_.contains(skipList,cleanName))
				return;
			var multiList = _.filter(specNameList, function(spec) { return (spec.replace(/\(([^\)]+)\)/g,"").trim() === cleanName); });
			if (multiList.length > 1)
			{
				skipList.push(cleanName);
				var parenList = _.map(multiList, function(item) { return item.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")",""); });
				name = name.replace(/\(([^\)]+)\)/,"("+_.uniq(parenList).join(", ")+")");
			}
			row = getOrMakeClassRowID(featureList, name);
			repeatPrefix = "repeating_ability_" + row;
			if (!_.isUndefined(featureList[row]))
				delete featureList[row];
			else	// If we created a new row for this, set rule category
			{
				// Import if it has a "specsource", assume it's a class feature
				if (special.specsource)
					attrs[repeatPrefix+"_rule_category"] = "class-features";
				else
					attrs[repeatPrefix+"_rule_category"] = "racial-traits";
			}
			classSource = getClassSource(arrayify(special.specsource),archetypes);
			attrs[repeatPrefix+"_name"] = name;
			attrs[repeatPrefix+"_description"] = special.description;

			if (classSource !== -1)
			{
				attrs[repeatPrefix+"_CL-basis"] = "@{class-"+classSource+"-level}";
				attrs[repeatPrefix+"_class-name"] = Object.keys(archetypes)[classSource];
			}

			if (_.contains(Object.keys(resources),special._name))
				attrs[repeatPrefix+"_max-calculation"] = resources[special._name]._max;
				
			if (!_.isUndefined(special._type))
				attrs[repeatPrefix+"_ability_type"] = special._type.substr(0,2);
		});
	},

	importClasses = function(attrs, classes)
	{
		var classList = new Object();
		
		var i = 0;
		var classObj;
		while (i < classes.length)
		{
			classObj = classes[i];

			// We can only handle 5 classes
			if (i >= 5)
				return;
			classList[classObj._name.replace(/\(([^\)]+)\)/g,"").replace("(","").replace(")","").trim()] = classObj;
			attrs["class-"+i+"-name"] = classObj._name;
			attrs["class-"+i+"-level"] = classObj._level;
			
			i++;
		}

		return classList;
	},

	// Import spellclasses; presence in spellclasses node means it's a spellcaster, but some of the data is in the classes node
	importSpellClasses = function(attrs, spellclasses,classes,abScores)
	{
		var spellClassesList = new Object();

		var i, j, abMod = 0, currentAbMod, spellslots, spelllevel, casterlevel, concmod, spellpenmod;
		var spellClassIndex = 0;
		for (i = 0; i < spellclasses.length; i++)
		{
			var spellClass = spellclasses[i];
			// Only 3 spellclasses on character sheet, so if they somehow have more...
			if (spellClassIndex >= 3)
				return spellClassesList;

			var spellClassName = spellClass._name.replace(/\(([^\)]+)\)/g,"").replace("(","").replace(")","").trim();
			var classIndex = _.indexOf(Object.keys(classes),_.find(Object.keys(classes),function(className)
			{
				if (className.toLowerCase().indexOf(spellClassName.toLowerCase()) !== -1)
					return true;
				return false;
			}));
			
			if (classIndex !== -1)
			{
				casterlevel = parseNum(classes[spellClassName]._casterlevel);
				attrs["spellclass-"+spellClassIndex] = classIndex;
				attrs["spellclass-"+spellClassIndex+"-level-misc"] = casterlevel - parseNum(classes[spellClassName]._level);
				
				if (!_.isUndefined(classes[spellClassName].arcanespellfailure))
					attrs["armor3-spell-fail"] = parseNum(classes[spellClassName].arcanespellfailure._value);
					
				// Make a guess at which ability modifier is used for this class
				if (!_.isUndefined(classes[spellClassName]._basespelldc))
					abMod = parseNum(classes[spellClassName]._basespelldc) - 10;
				if (!_.isUndefined(classes[spellClassName]._basespelldc))
				{
					// Start at the fourth ability score (Intelligence), so we skip the physical abilities
					for (j = 3; j < abScores.length; j++)
					{
						if (parseNum(abScores[j].attrbonus._modified) === abMod)
						{
							var attr = {}
							attr["Concentration-"+spellClassIndex+"-ability"] = "@{"+abScores[j]._name.substr(0,3).toUpperCase()+"-mod}";
							setAttrs(attr);
							break;
						}
					}
				}

				if (abMod !== 0)
				{
					// Calculate misc mods to concentration
					if (!_.isUndefined(classes[spellClassName]._concentrationcheck))
					{
						concmod = parseNum(classes[spellClassName]._concentrationcheck) - casterlevel - abMod;
						attrs["Concentration-"+spellClassIndex+"-misc"] = concmod;
					}

					// Calculate misc mods to spell penetration
					if (!_.isUndefined(classes[spellClassName].overcomespellresistance))
					{
						spellpenmod = parseNum(classes[spellClassName].overcomespellresistance) - casterlevel;
						attrs["spellclass-"+spellClassIndex+"-SP_misc"] = spellpenmod;
					}

					// Populate spells / day; Hero Lab includes bonus slots, so remove those
					if (!_.isUndefined(spellclasses[i].spelllevel))
					{
						spellclasses[i].spelllevel = arrayify(spellclasses[i].spelllevel);
						for (j = 0; j < spellclasses[i].spelllevel.length; j++)
						{
							spellslots = parseNum(spellclasses[i].spelllevel[j]._maxcasts);
							spelllevel = parseNum(spellclasses[i].spelllevel[j]._level);
							if (spelllevel > 0)
								spellslots = spellslots - bonusSpellSlots(abMod,spelllevel);
							attrs["spellclass-"+spellClassIndex+"-level-"+spelllevel+"-class"] = spellslots;
						}
					}
				}
				spellClassesList[spellClassName] = classes[Object.keys(classes)[classIndex]];
				spellClassIndex++;
			}
		}
		
		return spellClassesList;
	},

	importSpells = function(spells,spellclasses)
	{
		console.log("Import spells");
		var repeatPrefix = "repeating_spells";
		getSectionIDs(repeatPrefix, function(idarray) {
			var spellNameAttrs = _.union(_.map(idarray,function(id) { return repeatPrefix+"_"+id+"_name"; 		}),_.map(idarray,function(id) { return repeatPrefix+"_"+id+"_spellclass_number"; 		}));
			getAttrs(spellNameAttrs, function(spellAttrs) {
				var spellObjList = {};
				var spellKeys = Object.keys(spellAttrs);
				_.each(spellKeys,function(spellKey) {
					var rowID;
					if (spellKey.indexOf("_name") !== -1)
					{
						rowID = spellKey.substring(repeatPrefix.length+1,(spellKey.indexOf("_name")));
						if (_.isUndefined(spellObjList[rowID]))
							spellObjList[rowID] = {rowID: rowID};
						spellObjList[rowID].name = spellAttrs[spellKey];
					}
					if (spellKey.indexOf("_spellclass_number") !== -1)
					{
						rowID = spellKey.substring(repeatPrefix.length+1,(spellKey.indexOf("_spellclass_number")));
						if (_.isUndefined(spellObjList[rowID]))
							spellObjList[rowID] = {rowID: rowID};
						spellObjList[rowID].spellclass = spellAttrs[spellKey];
					}
				});

				var spellClassesKeys = Object.keys(spellclasses);
				var attrs = {};
				_.each(spells, function(spell) {
					var rowID, spellClass, spellName, school, level;

					// Search for a repeating spell with the same name and spellclass; if not found, make new row
					level = parseNum(spell._level);
					repeatPrefix = "repeating_spells_";
					spellClass = _.indexOf(spellClassesKeys,spell._class);
					spellName = spell._name.replace(/\(x\d+\)/,"").trim();
					rowID = getOrMakeSpellRowID(spellObjList,spellName,spellClass);
					if (_.isUndefined(rowID))
					{
						console.log("Undefined spell row ID!");
						console.log(spell);
					}
					// Update prefix with ID
					repeatPrefix = repeatPrefix + rowID;
					
					attrs[repeatPrefix+"_name"] = spellName;
					attrs[repeatPrefix+"_spell_level"] = level;
					attrs[repeatPrefix+"_spellclass_number"] = spellClass;
					attrs[repeatPrefix+"_components"] = spell._componenttext.replace("Divine Focus", "DF").replace("Focus","F").replace("Material","M").replace("Verbal","V").replace("Somatic","S").replace(" or ","/");
					attrs[repeatPrefix+"_range"] = spell._range;
					attrs[repeatPrefix+"_duration"] = spell._duration;
					attrs[repeatPrefix+"_save"] = spell._save.replace(/DC \d+/,"").trim();
					attrs[repeatPrefix+"_cast-time"] = spell._casttime;
					attrs[repeatPrefix+"_sr"] = spell._resist.replace("harmless","Harmless");
					attrs[repeatPrefix+"_DC_misc"] = parseNum(spell._dc) - parseNum(spellclasses[(spell._class !== "") ? spell._class:Object.keys(spellclasses)[0]]._basespelldc) - level;
		
					if (spell._area !== "")
						attrs[repeatPrefix+"_targets"] = spell._area;
					else if (spell._effect !== "")
						attrs[repeatPrefix+"_targets"] = spell._effect;
					else
						attrs[repeatPrefix+"_targets"] = spell._target;
					
					school = spell._schooltext;
					if (spell._subschooltext !== "")
						school = school + " (" + spell._subschooltext + ")";
					if (spell._descriptortext !== "")
						school = school + " [" + spell._descriptortext + "]";
					attrs[repeatPrefix+"_school"] = school;
					
					attrs[repeatPrefix+"_description"] = spell.description;
				});
				setAttrs(attrs);
			});
		});
	},

	calcHitDice = function(hitdice)
	{
		var dice = hitdice.match(/\d+d\d/g);
		var numDice = 0;
		var i = 0;
		while (i < dice.length)
		{
			numDice += parseInt(dice[i].split("d")[0]);
			i++;
		}
		return numDice;
	},

	// Builds an object collection of archetypes, with the appropriate classes as the keys, in the order they're entered in the character sheet; use this to determine class specials come from
	buildArchetypeArray = function(classes)
	{
		var archetypes = new Object();
		
		_.each(classes, function (classObj, className) {
			if (classObj._name.indexOf("(") === -1)
			{
				archetypes[className] = [];
				return;
			}
			var archeString = classObj._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
			var archeList = archeString.split(",");
			archeList = _.map(archeList,function(arche) { return arche.trim(); });
			archetypes[className] = archeList;
		});
		return archetypes;
	},

	// Returns the array number of the class that grants a feature; returns -1 if we can't find the class
	getClassSource = function(sources,archetypes)
	{
		// If there's no listed source, it isn't from a class
		if (!sources.length)
			return -1;
	
		// Grab an array of class names from the archetypes object
		var classes = Object.keys(archetypes);

		// Check if source is a class, first
		var intersect = _.intersection(sources,classes);
		if (intersect.length)
			return classes.indexOf(intersect[0]);
			
		// If not a class, check for an archetype as a source, and return the associated class
		var className = _.find(classes, function(item) { return (_.intersection(archetypes[item],sources).length); });
		if (className)
			return classes.indexOf(className);
			
		return -1;
	},
	
	bonusSpellSlots = function(abilMod,spellLevel) { return Math.max(0, Math.floor((abilMod + 4 - spellLevel) / 4)); },

	importSkills = function(attrs,skills,size,ACP)
	{
		// Ripped from the PF character sheet JS
		var skillSize;
		switch (Math.abs(size)){
			case 0: skillSize=0;break;
			case 1: skillSize=2;break;
			case 2: skillSize=4;break;
			case 4: skillSize=6;break;
			case 8: skillSize=8;break;
			case 16: skillSize=10;break;
			default: skillSize=0;
		}
		if(size<0) {skillSize=skillSize*-1;}

		// Clear out all existing skills data
		_.extend(attrs, { "acrobatics-ability":"", "acrobatics-cs":"", "acrobatics-ranks":"", "acrobatics-class":"", "acrobatics-ability-mod":"", "acrobatics-racial":"", "acrobatics-feat":"", "acrobatics-item":"", "acrobatics-size":"", "acrobatics-acp":"", "acrobatics-misc":"", "acrobatics-reqtrain":"", "artistry-ability":"", "artistry-cs":"", "artistry-ranks":"", "artistry-class":"", "artistry-ability-mod":"", "artistry-racial":"", "artistry-feat":"", "artistry-item":"", "artistry-size":"", "artistry-acp":"", "artistry-misc":"", "artistry-reqtrain":"", "artistry2-ability":"", "artistry2-cs":"", "artistry2-ranks":"", "artistry2-class":"", "artistry2-ability-mod":"", "artistry2-racial":"", "artistry2-feat":"", "artistry2-item":"", "artistry2-size":"", "artistry2-acp":"", "artistry2-misc":"", "artistry2-reqtrain":"", "artistry3-ability":"", "artistry3-cs":"", "artistry3-ranks":"", "artistry3-class":"", "artistry3-ability-mod":"", "artistry3-racial":"", "artistry3-feat":"", "artistry3-item":"", "artistry3-size":"", "artistry3-acp":"", "artistry3-misc":"", "artistry3-reqtrain":"", "appraise-ability":"", "appraise-cs":"", "appraise-ranks":"", "appraise-class":"", "appraise-ability-mod":"", "appraise-racial":"", "appraise-feat":"", "appraise-item":"", "appraise-size":"", "appraise-acp":"", "appraise-misc":"", "appraise-reqtrain":"", "bluff-ability":"", "bluff-cs":"", "bluff-ranks":"", "bluff-class":"", "bluff-ability-mod":"", "bluff-racial":"", "bluff-feat":"", "bluff-item":"", "bluff-size":"", "bluff-acp":"", "bluff-misc":"", "bluff-reqtrain":"", "climb-ability":"", "climb-cs":"", "climb-ranks":"", "climb-class":"", "climb-ability-mod":"", "climb-racial":"", "climb-feat":"", "climb-item":"", "climb-size":"", "climb-acp":"", "climb-misc":"", "climb-reqtrain":"", "craft-ability":"", "craft-cs":"", "craft-ranks":"", "craft-class":"", "craft-ability-mod":"", "craft-racial":"", "craft-feat":"", "craft-item":"", "craft-size":"", "craft-acp":"", "craft-misc":"", "craft-reqtrain":"", "craft2-ability":"", "craft2-cs":"", "craft2-ranks":"", "craft2-class":"", "craft2-ability-mod":"", "craft2-racial":"", "craft2-feat":"", "craft2-item":"", "craft2-size":"", "craft2-acp":"", "craft2-misc":"", "craft2-reqtrain":"", "craft3-ability":"", "craft3-cs":"", "craft3-ranks":"", "craft3-class":"", "craft3-ability-mod":"", "craft3-racial":"", "craft3-feat":"", "craft3-item":"", "craft3-size":"", "craft3-acp":"", "craft3-misc":"", "craft3-reqtrain":"", "diplomacy-ability":"", "diplomacy-cs":"", "diplomacy-ranks":"", "diplomacy-class":"", "diplomacy-ability-mod":"", "diplomacy-racial":"", "diplomacy-feat":"", "diplomacy-item":"", "diplomacy-size":"", "diplomacy-acp":"", "diplomacy-misc":"", "diplomacy-reqtrain":"", "disable-device-ability":"", "disable-device-cs":"", "disable-device-ranks":"", "disable-device-class":"", "disable-device-ability-mod":"", "disable-device-racial":"", "disable-device-feat":"", "disable-device-item":"", "disable-device-size":"", "disable-device-acp":"", "disable-device-misc":"", "disable-device-reqtrain":"", "disguise-ability":"", "disguise-cs":"", "disguise-ranks":"", "disguise-class":"", "disguise-ability-mod":"", "disguise-racial":"", "disguise-feat":"", "disguise-item":"", "disguise-size":"", "disguise-acp":"", "disguise-misc":"", "disguise-reqtrain":"", "escape-artist-ability":"", "escape-artist-cs":"", "escape-artist-ranks":"", "escape-artist-class":"", "escape-artist-ability-mod":"", "escape-artist-racial":"", "escape-artist-feat":"", "escape-artist-item":"", "escape-artist-size":"", "escape-artist-acp":"", "escape-artist-misc":"", "escape-artist-reqtrain":"", "fly-ability":"", "fly-cs":"", "fly-ranks":"", "fly-class":"", "fly-ability-mod":"", "fly-racial":"", "fly-feat":"", "fly-item":"", "fly-size":"", "fly-acp":"", "fly-misc":"", "fly-reqtrain":"", "handle-animal-ability":"", "handle-animal-cs":"", "handle-animal-ranks":"", "handle-animal-class":"", "handle-animal-ability-mod":"", "handle-animal-racial":"", "handle-animal-feat":"", "handle-animal-item":"", "handle-animal-size":"", "handle-animal-acp":"", "handle-animal-misc":"", "handle-animal-reqtrain":"", "heal-ability":"", "heal-cs":"", "heal-ranks":"", "heal-class":"", "heal-ability-mod":"", "heal-racial":"", "heal-feat":"", "heal-item":"", "heal-size":"", "heal-acp":"", "heal-misc":"", "heal-reqtrain":"", "intimidate-ability":"", "intimidate-cs":"", "intimidate-ranks":"", "intimidate-class":"", "intimidate-ability-mod":"", "intimidate-racial":"", "intimidate-feat":"", "intimidate-item":"", "intimidate-size":"", "intimidate-acp":"", "intimidate-misc":"", "intimidate-reqtrain":"", "linguistics-ability":"", "linguistics-cs":"", "linguistics-ranks":"", "linguistics-class":"", "linguistics-ability-mod":"", "linguistics-racial":"", "linguistics-feat":"", "linguistics-item":"", "linguistics-size":"", "linguistics-acp":"", "linguistics-misc":"", "linguistics-reqtrain":"", "lore-ability":"", "lore-cs":"", "lore-ranks":"", "lore-class":"", "lore-ability-mod":"", "lore-racial":"", "lore-feat":"", "lore-item":"", "lore-size":"", "lore-acp":"", "lore-misc":"", "lore-reqtrain":"", "lore2-ability":"", "lore2-cs":"", "lore2-ranks":"", "lore2-class":"", "lore2-ability-mod":"", "lore2-racial":"", "lore2-feat":"", "lore2-item":"", "lore2-size":"", "lore2-acp":"", "lore2-misc":"", "lore2-reqtrain":"", "lore3-ability":"", "lore3-cs":"", "lore3-ranks":"", "lore3-class":"", "lore3-ability-mod":"", "lore3-racial":"", "lore3-feat":"", "lore3-item":"", "lore3-size":"", "lore3-acp":"", "lore3-misc":"", "lore3-reqtrain":"", "knowledge-arcana-ability":"", "knowledge-arcana-cs":"", "knowledge-arcana-ranks":"", "knowledge-arcana-class":"", "knowledge-arcana-ability-mod":"", "knowledge-arcana-racial":"", "knowledge-arcana-feat":"", "knowledge-arcana-item":"", "knowledge-arcana-size":"", "knowledge-arcana-acp":"", "knowledge-arcana-misc":"", "knowledge-arcana-reqtrain":"", "knowledge-dungeoneering-ability":"", "knowledge-dungeoneering-cs":"", "knowledge-dungeoneering-ranks":"", "knowledge-dungeoneering-class":"", "knowledge-dungeoneering-ability-mod":"", "knowledge-dungeoneering-racial":"", "knowledge-dungeoneering-feat":"", "knowledge-dungeoneering-item":"", "knowledge-dungeoneering-size":"", "knowledge-dungeoneering-acp":"", "knowledge-dungeoneering-misc":"", "knowledge-dungeoneering-reqtrain":"", "knowledge-engineering-ability":"", "knowledge-engineering-cs":"", "knowledge-engineering-ranks":"", "knowledge-engineering-class":"", "knowledge-engineering-ability-mod":"", "knowledge-engineering-racial":"", "knowledge-engineering-feat":"", "knowledge-engineering-item":"", "knowledge-engineering-size":"", "knowledge-engineering-acp":"", "knowledge-engineering-misc":"", "knowledge-engineering-reqtrain":"", "knowledge-geography-ability":"", "knowledge-geography-cs":"", "knowledge-geography-ranks":"", "knowledge-geography-class":"", "knowledge-geography-ability-mod":"", "knowledge-geography-racial":"", "knowledge-geography-feat":"", "knowledge-geography-item":"", "knowledge-geography-size":"", "knowledge-geography-acp":"", "knowledge-geography-misc":"", "knowledge-geography-reqtrain":"", "knowledge-history-ability":"", "knowledge-history-cs":"", "knowledge-history-ranks":"", "knowledge-history-class":"", "knowledge-history-ability-mod":"", "knowledge-history-racial":"", "knowledge-history-feat":"", "knowledge-history-item":"", "knowledge-history-size":"", "knowledge-history-acp":"", "knowledge-history-misc":"", "knowledge-history-reqtrain":"", "knowledge-local-ability":"", "knowledge-local-cs":"", "knowledge-local-ranks":"", "knowledge-local-class":"", "knowledge-local-ability-mod":"", "knowledge-local-racial":"", "knowledge-local-feat":"", "knowledge-local-item":"", "knowledge-local-size":"", "knowledge-local-acp":"", "knowledge-local-misc":"", "knowledge-local-reqtrain":"", "knowledge-nature-ability":"", "knowledge-nature-cs":"", "knowledge-nature-ranks":"", "knowledge-nature-class":"", "knowledge-nature-ability-mod":"", "knowledge-nature-racial":"", "knowledge-nature-feat":"", "knowledge-nature-item":"", "knowledge-nature-size":"", "knowledge-nature-acp":"", "knowledge-nature-misc":"", "knowledge-nature-reqtrain":"", "knowledge-nobility-ability":"", "knowledge-nobility-cs":"", "knowledge-nobility-ranks":"", "knowledge-nobility-class":"", "knowledge-nobility-ability-mod":"", "knowledge-nobility-racial":"", "knowledge-nobility-feat":"", "knowledge-nobility-item":"", "knowledge-nobility-size":"", "knowledge-nobility-acp":"", "knowledge-nobility-misc":"", "knowledge-nobility-reqtrain":"", "knowledge-planes-ability":"", "knowledge-planes-cs":"", "knowledge-planes-ranks":"", "knowledge-planes-class":"", "knowledge-planes-ability-mod":"", "knowledge-planes-racial":"", "knowledge-planes-feat":"", "knowledge-planes-item":"", "knowledge-planes-size":"", "knowledge-planes-acp":"", "knowledge-planes-misc":"", "knowledge-planes-reqtrain":"", "knowledge-religion-ability":"", "knowledge-religion-cs":"", "knowledge-religion-ranks":"", "knowledge-religion-class":"", "knowledge-religion-ability-mod":"", "knowledge-religion-racial":"", "knowledge-religion-feat":"", "knowledge-religion-item":"", "knowledge-religion-size":"", "knowledge-religion-acp":"", "knowledge-religion-misc":"", "knowledge-religion-reqtrain":"", "perception-ability":"", "perception-cs":"", "perception-ranks":"", "perception-class":"", "perception-ability-mod":"", "perception-racial":"", "perception-feat":"", "perception-item":"", "perception-size":"", "perception-acp":"", "perception-misc":"", "perception-reqtrain":"", "perform-ability":"", "perform-cs":"", "perform-ranks":"", "perform-class":"", "perform-ability-mod":"", "perform-racial":"", "perform-feat":"", "perform-item":"", "perform-size":"", "perform-acp":"", "perform-misc":"", "perform-reqtrain":"", "perform2-ability":"", "perform2-cs":"", "perform2-ranks":"", "perform2-class":"", "perform2-ability-mod":"", "perform2-racial":"", "perform2-feat":"", "perform2-item":"", "perform2-size":"", "perform2-acp":"", "perform2-misc":"", "perform2-reqtrain":"", "perform3-ability":"", "perform3-cs":"", "perform3-ranks":"", "perform3-class":"", "perform3-ability-mod":"", "perform3-racial":"", "perform3-feat":"", "perform3-item":"", "perform3-size":"", "perform3-acp":"", "perform3-misc":"", "perform3-reqtrain":"", "profession-ability":"", "profession-cs":"", "profession-ranks":"", "profession-class":"", "profession-ability-mod":"", "profession-racial":"", "profession-feat":"", "profession-item":"", "profession-size":"", "profession-acp":"", "profession-misc":"", "profession-reqtrain":"", "profession2-ability":"", "profession2-cs":"", "profession2-ranks":"", "profession2-class":"", "profession2-ability-mod":"", "profession2-racial":"", "profession2-feat":"", "profession2-item":"", "profession2-size":"", "profession2-acp":"", "profession2-misc":"", "profession2-reqtrain":"", "profession3-ability":"", "profession3-cs":"", "profession3-ranks":"", "profession3-class":"", "profession3-ability-mod":"", "profession3-racial":"", "profession3-feat":"", "profession3-item":"", "profession3-size":"", "profession3-acp":"", "profession3-misc":"", "profession3-reqtrain":"", "ride-ability":"", "ride-cs":"", "ride-ranks":"", "ride-class":"", "ride-ability-mod":"", "ride-racial":"", "ride-feat":"", "ride-item":"", "ride-size":"", "ride-acp":"", "ride-misc":"", "ride-reqtrain":"", "sense-motive-ability":"", "sense-motive-cs":"", "sense-motive-ranks":"", "sense-motive-class":"", "sense-motive-ability-mod":"", "sense-motive-racial":"", "sense-motive-feat":"", "sense-motive-item":"", "sense-motive-size":"", "sense-motive-acp":"", "sense-motive-misc":"", "sense-motive-reqtrain":"", "sleight-of-hand-ability":"", "sleight-of-hand-cs":"", "sleight-of-hand-ranks":"", "sleight-of-hand-class":"", "sleight-of-hand-ability-mod":"", "sleight-of-hand-racial":"", "sleight-of-hand-feat":"", "sleight-of-hand-item":"", "sleight-of-hand-size":"", "sleight-of-hand-acp":"", "sleight-of-hand-misc":"", "sleight-of-hand-reqtrain":"", "spellcraft-ability":"", "spellcraft-cs":"", "spellcraft-ranks":"", "spellcraft-class":"", "spellcraft-ability-mod":"", "spellcraft-racial":"", "spellcraft-feat":"", "spellcraft-item":"", "spellcraft-size":"", "spellcraft-acp":"", "spellcraft-misc":"", "spellcraft-reqtrain":"", "stealth-ability":"", " stealth-cs":"", "stealth-ranks":"", "stealth-class":"", "stealth-ability-mod":"", "stealth-racial":"", "stealth-feat":"", "stealth-item":"", "stealth-size":"", "stealth-acp":"", "stealth-misc":"", "stealth-reqtrain":"", "survival-ability":"", "survival-cs":"", "survival-ranks":"", "survival-class":"", "survival-ability-mod":"", "survival-racial":"", "survival-feat":"", "survival-item":"", "survival-size":"", "survival-acp":"", "survival-misc":"", "survival-reqtrain":"", "swim-ability":"", "swim-cs":"", "swim-ranks":"", "swim-class":"", "swim-ability-mod":"", "swim-racial":"", "swim-feat":"", "swim-item":"", "swim-size":"", "swim-acp":"", "swim-misc":"", "swim-reqtrain":"", "use-magic-device-ability":"", "use-magic-device-cs":"", "use-magic-device-ranks":"", "use-magic-device-class":"", "use-magic-device-ability-mod":"", "use-magic-device-racial":"", "use-magic-device-feat":"", "use-magic-device-item":"", "use-magic-device-size":"", "use-magic-device-acp":"", "use-magic-device-misc":"", "use-magic-device-reqtrain":"", "misc-skill-0-ability":"", "misc-skill-0-cs":"", "misc-skill-0-ranks":"", "misc-skill-0-class":"", "misc-skill-0-ability-mod":"", "misc-skill-0-racial":"", "misc-skill-0-feat":"", "misc-skill-0-item":"", "misc-skill-0-size":"", "misc-skill-0-acp":"", "misc-skill-0-misc":"", "misc-skill-0-reqtrain":"", "misc-skill-1-ability":"", "misc-skill-1-cs":"", "misc-skill-1-ranks":"", "misc-skill-1-class":"", "misc-skill-1-ability-mod":"", "misc-skill-1-racial":"", "misc-skill-1-feat":"", "misc-skill-1-item":"", "misc-skill-1-size":"", "misc-skill-1-acp":"", "misc-skill-1-misc":"", "misc-skill-1-reqtrain":"", "misc-skill-2-ability":"", "misc-skill-2-cs":"", "misc-skill-2-ranks":"", "misc-skill-2-class":"", "misc-skill-2-ability-mod":"", "misc-skill-2-racial":"", "misc-skill-2-feat":"", "misc-skill-2-item":"", "misc-skill-2-size":"", "misc-skill-2-acp":"", "misc-skill-2-misc":"", "misc-skill-2-reqtrain":"", "misc-skill-3-ability":"", "misc-skill-3-cs":"", "misc-skill-3-ranks":"", "misc-skill-3-class":"", "misc-skill-3-ability-mod":"", "misc-skill-3-racial":"", "misc-skill-3-feat":"", "misc-skill-3-item":"", "misc-skill-3-size":"", "misc-skill-3-acp":"", "misc-skill-3-misc":"", "misc-skill-3-reqtrain":"", "misc-skill-4-ability":"", "misc-skill-4-cs":"", "misc-skill-4-ranks":"", "misc-skill-4-class":"", "misc-skill-4-ability-mod":"", "misc-skill-4-racial":"", "misc-skill-4-feat":"", "misc-skill-4-item":"", "misc-skill-4-size":"", "misc-skill-4-acp":"", "misc-skill-4-misc":"", "misc-skill-4-reqtrain":"", "misc-skill-5-ability":"", "misc-skill-5-cs":"", "misc-skill-5-ranks":"", "misc-skill-5-class":"", "misc-skill-5-ability-mod":"", "misc-skill-5-racial":"", "misc-skill-5-feat":"", "misc-skill-5-item":"", "misc-skill-5-size":"", "misc-skill-5-acp":"", "misc-skill-5-misc":"", "misc-skill-5-reqtrain":"", "craft-name":"", "craft2-name":"", "craft3-name":"", "lore-name":"", "perform-name":"", "perform2-name":"", "perform3-name":"", "profession-name":"", "profession2-name":"", "profession3-name":"", "misc-skill-0-name":"", "misc-skill-1-name":"", "misc-skill-2-name":"", "misc-skill-3-name":"", "misc-skill-4-name":"", "misc-skill-5-name":"" });
		
		// Keep track of which of these skills we're on
		var craft = 1;
		var perform = 1;
		var profession = 1;
		var artistry = 1;
		var lore = 1;
		var misc = 0;
		
		var i = 0;
		var skill;
		var skillMisc;
		var skillAttrPrefix;
		for (i = 0; i < skills.length; i++)
		{
			/*if (_.isUndefined(skill._name))
			{
				continue;
			}*/
			skill = skills[i];
			console.log(skill._name);
			// Figure out where we're putting this skill on the character sheet
			if (skill._name.indexOf("Craft") !== -1)
			{
				if (craft === 1)
				{
					skillAttrPrefix = "craft";
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
						attrs["craft-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					craft++;
				}
				else if (craft <= 3)
				{
					skillAttrPrefix = "craft" + craft;
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
						attrs["craft"+craft+"-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					craft++;
				}
				else
				{
					if (misc <= 5)
					{
						skillAttrPrefix = "misc-skill-" + misc;
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
							attrs[skillAttrPrefix+"-name"] = skill._name;
						misc++;
					}
					else
						console.log("Ran out of misc skills for " + skill._name + "!");
				}
			}
			else if (skill._name.indexOf("Perform") !== -1)
			{
				if (perform === 1)
				{
					skillAttrPrefix = "perform";
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
						attrs["perform-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					perform++;
				}
				else if (perform <= 3)
				{
					skillAttrPrefix = "perform" + perform;
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
						attrs["perform"+perform+"-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					perform++;
				}
				else
				{
					if (misc <= 5)
					{
						skillAttrPrefix = "misc-skill-" + misc;
						if (skill._name.match(/\(([^\)]+)\)/) !== null)
							attrs[skillAttrPrefix+"-name"] = skill._name;
						misc++;
					}
					else
						console.log("Ran out of misc skills for " + skill._name + "!");
				}
			}
			else if (skill._name.indexOf("Profession") !== -1)
			{
				if (profession === 1)
				{
					skillAttrPrefix = "profession";
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
						attrs["profession-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					profession++;
				}
				else if (profession <= 3)
				{
					skillAttrPrefix = "profession" + profession;
					if (skill._name.match(/\(([^\)]+)\)/) !== null)
						attrs["profession"+profession+"-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					profession++;
				}
				else
				{
					if (misc <= 5)
					{
						skillAttrPrefix = "misc-skill-" + misc;
						if (skill._name.match(/\(([^\)]+)\)/) !== null)
							attrs[skillAttrPrefix+"-name"] = skill._name;
						misc++;
					}
					else
						console.log("Ran out of misc skills for " + skill._name + "!");
				}
			}
			else if (skill._name.indexOf("Knowledge") !== -1)
			{
				switch(skill._name.match(/\(([^\)]+)\)/g)[0])
				{
					case "(arcana)":
					case "(dungeoneering)":
					case "(engineering)":
					case "(geography)":
					case "(history)":
					case "(local)":
					case "(nature)":
					case "(nobility)":
					case "(planes)":
					case "(religion)":
						skillAttrPrefix = skill._name.toLowerCase().replace(/\s/g,"-").replace("(","").replace(")","");
						break;
					default:
						skillAttrPrefix = "misc-skill-" + misc;
						attrs[skillAttrPrefix+"-name"] = skill._name;
						misc++;
				}
			}
			else if (skill._name.indexOf("Artistry") !== -1)
			{
				if (artistry === 1)
				{
					skillAttrPrefix = "artistry";
					attrs["artistry-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					artistry++;
				}
				else if (artistry <= 3)
				{
					skillAttrPrefix = "artistry" + artistry;
					attrs["artistry"+artistry+"-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					artistry++;
				}
				else
				{
					if (misc <= 5)
					{
						skillAttrPrefix = "misc-skill-" + misc;
						attrs[skillAttrPrefix+"-name"] = skill._name;
						misc++;
					}
					else
						console.log("Ran out of misc skills for " + skill._name + "!");
				}
			}
			else if (skill._name.indexOf("Lore") !== -1)
			{
				if (lore === 1)
				{
					skillAttrPrefix = "lore";
					attrs["lore-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					lore++;
				}
				else if (lore <= 3)
				{
					skillAttrPrefix = "lore" + lore;
					attrs["lore"+lore+"-name"] = skill._name.match(/\(([^\)]+)\)/)[0].replace("(","").replace(")","");
					lore++;
				}
				else
				{
					if (misc <= 5)
					{
						skillAttrPrefix = "misc-skill-" + misc;
						attrs[skillAttrPrefix+"-name"] = skill._name;
						misc++;
					}
					else
						console.log("Ran out of misc skills for " + skill._name + "!");
				}
			}
			else
				skillAttrPrefix = skill._name.toLowerCase().replace(/\s/g,"-").replace("(","").replace(")","").replace("-hand","-Hand").replace("e-device","e-Device").replace("-artist","-Artist").replace("-animal","-Animal");
			
			attrs[skillAttrPrefix+"-ranks"] = parseNum(skill._ranks);
			attrs[skillAttrPrefix+"-ability"] = "@{"+skill._attrname+"-mod}";
			
			if (skill._classskill === "yes") attrs[skillAttrPrefix+"-cs"] = 3;
			
			skillMisc = parseNum(skill._value) - parseNum(skill._ranks)- parseNum(skill._attrbonus);
			if (parseNum(skill._ranks) != 0 && skill._classskill === "yes")
				skillMisc -= 3;
			if (skill._armorcheck === "yes")
				skillMisc -= ACP;
			if (skill._name === "Fly")
				skillMisc -= skillSize;
			if (skill._name === "Stealth")
				skillMisc -= (2 * skillSize);
			attrs[skillAttrPrefix+"-misc"] = skillMisc;
			
			if (skill._trainedonly === "yes") attrs[skillAttrPrefix+"-ReqTrain"] = 1;
		
			// Add situation modifiers to the macro
			if (!_.isUndefined(skill.situationalmodifiers.situationalmodifier))
			{
				var macro = "@{PC-whisper} &{template:pf_generic} {{color=@{rolltemplate_color}}} {{header_image=@{header_image-pf_generic-skill}}} @{toggle_rounded_flag} {{character_name=@{character_name}}} {{character_id=@{character_id}}} {{subtitle}} {{name="+skill._name+"}} {{Check=[[ @{skill-query} + [[ @{"+skillAttrPrefix+"} ]] ]]}}";
				skill.situationalmodifiers.situationalmodifier = arrayify(skill.situationalmodifiers.situationalmodifier);
				var j = 0;
				while (j < skill.situationalmodifiers.situationalmodifier.length)
				{
					macro = macro + " {{" + skill.situationalmodifiers.situationalmodifier[j]._source + "=" + skill.situationalmodifiers.situationalmodifier[j]._text+"}}"
					j++;
				}
				attrs[skillAttrPrefix+"-macro"] = macro;
			}
		}
	},

	// Import ACP and Max Dex; these aren't included under items, but the final values are listed in penalties
	importPenalties = function(attrs,penalties)
	{
		var ACP = 0;
		var i = 0;
		while (i < penalties.length)
		{
			if (penalties[i]._name === "Armor Check Penalty")
			{
				ACP = parseNum(penalties[i]._value);
				attrs["armor3-acp"] = ACP;
			}
			else if (penalties[i]._name === "Max Dex Bonus")
				attrs["armor3-max-dex"] = Math.min(99, parseNum(penalties[i]._value));	// Hero Lab uses 1000 for Max Dex when player doesn't have one; cap it at 99 to match sheet default
			i++;
		}
		return ACP;
	},
	
	importAC = function(attrs,acObj)
	{
		attrs["AC-natural"] = parseNum(acObj._fromnatural);
		attrs["AC-deflect"] = parseNum(acObj._fromdeflect);
		attrs["AC-dodge"] = parseNum(acObj._fromdodge);
		
		// Are we replacing Dex to AC with something else?
		if (acObj._fromdexterity === "")
		{
			if (acObj._fromcharisma !== "")
			{
				attrs["AC-ability"] = "( ((@{CHA-mod} + [[ @{max-dex-source} ]]) - abs(@{CHA-mod} - [[ @{max-dex-source} ]])) / 2 )";
				attrs["AC-misc"] = parseNum(acObj._ac) - 10 - parseNum(acObj._fromarmor) - parseNum(acObj._fromshield) - parseNum(acObj._fromcharisma) - parseNum(acObj._fromsize) - parseNum(acObj._fromnatural) - parseNum(acObj._fromdeflect) - parseNum(acObj._fromdodge);
			}
			else if (acObj._fromwisdom !== "")
			{
				attrs["AC-ability"] = "( ((@{WIS-mod} + [[ @{max-dex-source} ]]) - abs(@{WIS-mod} - [[ @{max-dex-source} ]])) / 2 )";
				attrs["AC-misc"] = parseNum(acObj._ac) - 10 - parseNum(acObj._fromarmor) - parseNum(acObj._fromshield) - parseNum(acObj._fromwisdom) - parseNum(acObj._fromsize) - parseNum(acObj._fromnatural) - parseNum(acObj._fromdeflect) - parseNum(acObj._fromdodge);
			}
			else
				attrs["AC-misc"] = parseNum(acObj._ac) - 10 - parseNum(acObj._fromarmor) - parseNum(acObj._fromshield) - parseNum(acObj._fromdexterity) - parseNum(acObj._fromsize) - parseNum(acObj._fromnatural) - parseNum(acObj._fromdeflect) - parseNum(acObj._fromdodge);
		}
	},
	
	importCharacter = function(characterObj)
	{
		var attrs = {};
		
		importAbilityScores(attrs,characterObj.attributes.attribute);
		importSaves(attrs,characterObj.saves);
		var classes, spellClasses, archetypes = {};
		// Class objects won't exist for creatures w/o class levels, such as animals
		if (!_.isUndefined(characterObj.classes.class))
		{
			// Class will be an array if multiclassed, but a single object if single-classed; make it an array, just to be safe
			characterObj.classes.class = arrayify(characterObj.classes.class);

			classes = importClasses(attrs, characterObj.classes.class);

			// If any of the character's classes is a spellcaster, it'll be listed here, too
			if (!_.isUndefined(characterObj.spellclasses.spellclass))
			{
				characterObj.spellclasses.spellclass = arrayify(characterObj.spellclasses.spellclass);
				spellClasses = importSpellClasses(attrs, characterObj.spellclasses.spellclass,classes,characterObj.attributes.attribute);
				
				// Well, it's a spellcaster, so let's import those spells, too!
				var spellsArray = arrayify(characterObj.spellsknown.spell).concat(arrayify(characterObj.spellbook.spell)).concat(arrayify(characterObj.spellsmemorized.spell));
				var spellNames = [];
				spellsArray = _.reject(spellsArray,function(spell) { if (_.contains(spellNames,spell._name)) return true; spellNames.concat(spell._name); return false; });
				importSpells(spellsArray,spellClasses);
				/*if (!_.isUndefined(characterObj.spellsknown.spell))
				{
					characterObj.spellsknown.spell = arrayify(characterObj.spellsknown.spell);
					importSpells(characterObj.spellsknown.spell,spellClasses);
				}
				if (!_.isUndefined(characterObj.spellbook.spell))
				{
					characterObj.spellbook.spell = arrayify(characterObj.spellbook.spell);
					importSpells(characterObj.spellbook.spell,spellClasses);
				}
				if (!_.isUndefined(characterObj.spellsmemorized.spell))
				{
					characterObj.spellsmemorized.spell = arrayify(characterObj.spellsmemorized.spell);
					importSpells(characterObj.spellsmemorized.spell,spellClasses);
				}*/
			}
			
			// Need to keep track of what archetypes the character has, since class feature source could be an archetype
			archetypes = buildArchetypeArray(classes);
		}
		
		importAC(attrs,characterObj.armorclass);
		characterObj.penalties.penalty = arrayify(characterObj.penalties.penalty);
		var ACP = importPenalties(attrs,characterObj.penalties.penalty);

		// Build an object we can pass to the item importing, so we can attach this to the inventory item
		var armorPenalties = {};
		armorPenalties.ACP = parseNum(attrs["armor3-acp"]);
		armorPenalties.maxDex = parseNum(attrs["armor3-max-dex"]);
		armorPenalties.spellfail = parseNum(attrs["armor3-spell-fail"]);
		
		// We might change these values if we're using a shield, so don't set them outside of item import
		if (!_.isUndefined(attrs["armor3-acp"]))
			delete attrs["armor3-acp"];
		if (!_.isUndefined(attrs["armor3-spell-fail"]))
			delete attrs["armor3-spell-fail"];
		
		var armor = _.reject(arrayify(characterObj.defenses.armor || {}),function(item) { return _.isUndefined(item._name); });
		var weapons = _.reject(arrayify(characterObj.melee.weapon || {}).concat(arrayify(characterObj.ranged.weapon || {})),function(item) { return _.isUndefined(item._name); });

		// "Tracked Resources" is a list of uses, either a quantity of items, charges, or uses per day
		var resources = _.object(_.map(characterObj.trackedresources.trackedresource, function (resource) { return [resource._name,resource];}));
		
		// Make an array of items, both magic and mundane
		var items = _.reject(arrayify(characterObj.magicitems.item || {}).concat(arrayify(characterObj.gear.item || {})),function(item) { return _.isUndefined(item._name); });
		
		// "Specials" could include items, so we need to filter them out
		var itemNames = _.map(items, function(obj) { return obj._name; });
		var specials = _.reject(arrayify(characterObj.attack.special).concat(arrayify(characterObj.defenses.special),arrayify(characterObj.otherspecials.special),arrayify(characterObj.movement.special)), function(obj) { return _.contains(itemNames, obj._name); });

		importItems(items,resources,armorPenalties,armor,weapons);
		
		getSectionIDs("repeating_ability", function(idarray) {
			var abilityNameAttrs = _.union(_.map(idarray,function(id) { return "repeating_ability_"+id+"_name"; 		}),_.map(idarray,function(id) { return "repeating_ability_"+id+"_rule_category"; }));
			getAttrs(abilityNameAttrs, function(abilityAttrs) {
				var abilityObjList = {};
				var abilityKeys = Object.keys(abilityAttrs);
				var asyncAttrs = {};
				_.each(abilityKeys,function(abilityKey) {
					var rowID;
					if (abilityKey.indexOf("_name") !== -1)
					{
						rowID = abilityKey.substring("repeating_ability_".length,(abilityKey.indexOf("_name")));
						if (_.isUndefined(abilityObjList[rowID]))
							abilityObjList[rowID] = {rowID: rowID};
						abilityObjList[rowID].name = abilityAttrs[abilityKey];
					}
					if (abilityKey.indexOf("_rule_category") !== -1)
					{
						rowID = abilityKey.substring("repeating_ability_".length,(abilityKey.indexOf("_rule_category")));
						if (_.isUndefined(abilityObjList[rowID]))
							abilityObjList[rowID] = {rowID: rowID};
						abilityObjList[rowID].rulecategory = abilityAttrs[abilityKey];
					}
				});

				if (!_.isUndefined(characterObj.feats.feat))
				{
					var featsArray = _.filter(abilityObjList,_.matcher({rulecategory:"feats"}));
					var featsList = {};
					_.each(featsArray, function(obj){ featsList[obj.rowID] = obj.name; });
					characterObj.feats.feat = arrayify(characterObj.feats.feat);
					importFeats(asyncAttrs, characterObj.feats.feat, featsList, resources);
				}

				if (!_.isUndefined(characterObj.traits.trait))
				{
					var traitsArray = _.filter(abilityObjList,_.matcher({rulecategory:"traits"}));
					var traitsList = {};
					_.each(traitsArray, function(obj){ traitsList[obj.rowID] = obj.name; });
					characterObj.traits.trait = arrayify(characterObj.traits.trait);
					importTraits(asyncAttrs, characterObj.traits.trait, traitsList, resources);
				}

				if (!_.isUndefined(characterObj.spelllike.special))
				{
					var SLAsArray = _.filter(abilityObjList,_.matcher({rulecategory:"spell-like-abilities"}));
					var SLAsList = {};
					_.each(SLAsArray, function(obj){ SLAsList[obj.rowID] = obj.name; });
					characterObj.spelllike.special = arrayify(characterObj.spelllike.special);
					importSLAs(asyncAttrs, characterObj.spelllike.special, SLAsList, resources);
				}
				
				var featuresArray = _.filter(abilityObjList, function (obj) { if (obj.rulecategory === "traits" || obj.rulecategory === "feats") return false; return true; });
				var featuresList = {};
				_.each(featuresArray, function(obj){ featuresList[obj.rowID] = obj; });
				importFeatures(asyncAttrs, featuresList, specials, archetypes, resources);

				setAttrs(asyncAttrs);
			});
		});

		attrs["experience"] = parseFloat(characterObj.xp._total);

		attrs["class-0-bab"] = parseNum(characterObj.attack._baseattack);
		
		// Set max hp; remove Con mod from hp first, since the sheet will add that in
		// Since the XML doesn't break this down by class, add it all to class 0
		var level = calcHitDice(characterObj.health._hitdice);
		attrs["class-0-hp"] = (parseNum(characterObj.health._hitpoints) - (level * parseNum(characterObj.attributes.attribute[2].attrbonus._modified)));
		importInit(attrs,characterObj.initiative);
		var racialHD = level - parseNum(characterObj.classes._level);
		if (racialHD > 0)
			attrs["npc-hd-num"] = racialHD;

		var size = getSizeMod(characterObj.size._name);
		attrs["size"] = size;
		attrs["default_char_size"] = size;

		characterObj.skills.skill = arrayify(characterObj.skills.skill);
		importSkills(attrs,characterObj.skills.skill,size,ACP);
		
		if (!_.isUndefined(characterObj.senses.special))
		{
			characterObj.senses.special = arrayify(characterObj.senses.special);
			attrs["vision"] = buildList(characterObj.senses.special, "_shortname");
		}

		if (!_.isUndefined(characterObj.damagereduction.special))
		{
			characterObj.damagereduction.special = arrayify(characterObj.damagereduction.special);
			attrs["DR"] = buildList(characterObj.damagereduction.special, "_shortname");
		}

		if (!_.isUndefined(characterObj.resistances.special))
		{
			characterObj.resistances.special = arrayify(characterObj.resistances.special);
			attrs["resistances"] = buildList(characterObj.resistances.special, "_shortname");
		}

		if (!_.isUndefined(characterObj.immunities.special))
		{
			characterObj.immunities.special = arrayify(characterObj.immunities.special);
			attrs["immunities"] = buildList(characterObj.immunities.special, "_shortname");
		}

		if (!_.isUndefined(characterObj.weaknesses.special))
		{
			characterObj.weaknesses.special = arrayify(characterObj.weaknesses.special);
			attrs["weaknesses"] = buildList(characterObj.weaknesses.special, "_shortname");
		}
		if (!_.isUndefined(characterObj.languages.language))
		{
			characterObj.languages.language = arrayify(characterObj.languages.language);
			attrs["languages"] = buildList(characterObj.languages.language, "_name");
		}

		attrs["character_name"] = characterObj._name;
		attrs["player-name"] = characterObj._playername;
		attrs["deity"] = characterObj.deity._name;
		attrs["race"] = characterObj.race._racetext.substr(0,1).toUpperCase()+characterObj.race._racetext.substr(1,1000);
		attrs["alignment"] = characterObj.alignment._name;
		attrs["gender"] = characterObj.personal._gender;
		attrs["age"] = characterObj.personal._age;
		attrs["height"] = characterObj.personal.charheight._text;
		attrs["weight"] = characterObj.personal.charweight._text;
		attrs["hair"] = characterObj.personal._hair;
		attrs["eyes"] = characterObj.personal._eyes;
		attrs["skin"] = characterObj.personal._skin;

		attrs["npc-cr"] = characterObj.challengerating._text.replace("CR ","");
		attrs["npc-xp"] = characterObj.xpaward._value;
		
		if (!_.isUndefined(characterObj.favoredclasses.favoredclass))
		{
			characterObj.favoredclasses.favoredclass = arrayify(characterObj.favoredclasses.favoredclass);
			attrs["class-favored"] = buildList(characterObj.favoredclasses.favoredclass, "_name");
		}
		setAttrs(attrs,{},function() { PFSheet.recalculateCore(); });
	},
	registerEventHandlers = function() {
		on("change:herolab_import", function(eventInfo) {
			getAttrs(["herolab_import"], function(values) {
				var xmlObj;
				if (_.isUndefined(values.herolab_import))
					return;
				try {
					xmlObj = JSON.parse(values.herolab_import);
					if (_.isArray(xmlObj.document.public.character))
						importCharacter(xmlObj.document.public.character[0]);
					else
						importCharacter(xmlObj.document.public.character);
					setAttrs({herolab_import:""},{silent: true});
				}
				catch(err) {console.log(err);setAttrs({herolab_import: err.message},{silent: true});}
			});
		});
	};
	registerEventHandlers();
	console.log(PFLog.l + '   HLImport module loaded         ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	return {
		importCharacter: importCharacter
	};
}());
var PFSheet = PFSheet || (function () {
	'use strict';
	var expandAll = function () {
		getAttrs(["expandall"], function (v) {
			var skilltab = "4",
			setter = {};
			if (v["expandall"] == "1") {
				//set expandall to 0
				//set tabs to "all"
				//set conditions and buffs to "show"
				//set all others to default (which is "show")
				setAttrs({
					"expandall": "0",
					pagetab: "99",
					abilities_tab: "99",
					skills_tab: "99",
					spellclass_tab: "99",
					spells_tab: "99",
					npc_spellclass_tab: "0",
					equipment_tab: "99",
					"conditions-show": "1",
					"buffstop-show": "1",
					"character-details-show": "",
					"ability-scores-show": "",
					"health-and-wounds-show": "",
					"initiative-and-speeds-show": "",
					"experience-and-hero-points-show": "",
					"class-info-show": "",
					"mythic-info-show": "",
					"psionic-info-show": "",
					"abilities-show": "",
					"defense-values-show": "",
					"special-defenses-show": "",
					"armor-penalties-show": "",
					"saves-show": "",
					"armor-shield-show": "",
					"defense-notes-show": "",
					"attack-bonuses-show": "",
					"attack-notes-show": "",
					"attack-options-show": "",
					"attacks-show": "",
					"skills-show": "",
					"skill_options-show": "",
					"skill-ranks-show": "",
					"skill-notes-show": "",
					"artistry-show": "",
					"craft-show": "",
					"knowledge-show": "",
					"lore-show": "",
					"perform-show": "",
					"profession-show": "",
					"misc-show": "",
					"currency-show": "",
					"inventory-show": "",
					"carried-weight-show": "",
					"loads-show": "",
					"domains0-show": "",
					"spellsPerDay0-show": "",
					"spell_ranges0-show": "",
					"domains1-show": "",
					"spellsPerDay1-show": "",
					"spell_ranges1-show": "",
					"domains2-show": "",
					"spellsPerDay2-show": "",
					"spell_ranges2-show": "",
					"spelloptions-show": "",
					"newspells-show": "",
					"npc-quick_stats-show": "",
					"npc-defense-show": "",
					"options_defense_options-show": "",
					"npc-offense-show": "",
					"npc-speed-show": "",
					"npc-space-show": "",
					"npc-special-attacks-show": "",
					"npc-repeating_weapons-show": "",
					"npc-spell-like-abilities-show": "",
					"npc-spells-show": "",
					"npc-tactics-show": "",
					"npc-before-combat-show": "",
					"npc-during-combat-show": "",
					"npc-morale-show": "",
					"npc-base-statistics-show": "",
					"npc-statistics-show": "",
					"npc-feats-show": "",
					"npc-mythic-feats-show": "",
					"npc-skills-show": "",
					"npc-cgear-show": "",
					"npc-ogear-show": "",
					"npc-special-abilities-show": "",
					"header-image-show": "",
					"pathfinder-unchained-show": "",
					"pathfinder-mythic-adventures-show": "",
					"pathfinder-psionics-show": "",
					"roll-template-info-show": "",
					"sheet-config-show": "",
					"sheetcleanup-show": "",
					"buff-min-show": "",
					"buff-expand-show": "",
					"buff-column-show": "",
					"class-ability-min-show": "",
					"class-ability-expand-show": "",
					"class-ability-column-show": "",
					"feat-min-show": "",
					"feat-expand-show": "",
					"feat-column-show": "",
					"racial-trait-min-show": "0",
					"racial-trait-expand-show": "",
					"racial-trait-column-show": "",
					"traits-min-show": "0",
					"traits-expand-show": "",
					"traits-column-show": "",
					"mythic-min-show": "0",
					"mythic-expand-show": "",
					"mythic-column-show": "",
					"mythic-feats-min-show": "",
					"mythic-feats-expand-show": "",
					"mythic-feats-column-show": "",
					"weapon-min-show": "",
					"weapon-expand-show": "",
					"weapon-column-show": "",
					"item-min-show": "",
					"item-expand-show": "",
					"item-column-show": "",
					"newspells-min-show": "",
					"newspells-expand-show": "",
					"newspells-column-show": "",
					"npcweapon-min-show": "",
					"npcweapon-expand-show": "",
					"npcweapon-column-show": "",
					"npc-spell-like-abilities-min-show": "",
					"npc-spell-like-abilities-expand-show": "",
					"npc-spell-like-abilities-column-show": "",
					"npcnewspells-min-show": "",
					"npcnewspells-expand-show": "",
					"npcnewspells-column-show": "",
					"npcfeat-min-show": "",
					"npcfeat-expand-show": "",
					"npcfeat-column-show": "",
					"npcmythic-feats-min-show": "",
					"npcmythic-feats-expand-show": "",
					"npcmythic-feats-column-show": "",
					"npc-special-abilities-min-show": "",
					"npc-special-abilities-expand-show": "",
					"npc-special-abilities-column-show": ""
				});
				//now go through repeating sections and expand those to be sure users can see them.
				_.each(PFConst.repeatingSections, function (section) {
					var rsection = "repeating_" + section;
					getSectionIDs(rsection, function (ids) {
						var setter = _.reduce(ids, function (memo, id) {
							var prefix = rsection + "_" + id + "_";
							switch (section) {
								case 'weapon':
									memo[prefix + "add-damage-show"] = "";
									memo[prefix + "iterative-attacks-show"] = "";
									memo[prefix + "macro-text-show"] = "";
									break;
								case 'buff':
									memo[prefix + "options-show"] = "";
									memo[prefix + "description-show"] = "";
									break;
								case 'spells':
									memo[prefix + "spell-misc-show"] = "";
									memo[prefix + "description-show"] = "";
									memo[prefix + "macro-text-show"] = "";
									break;
								case 'class-ability':
								case 'feat':
								case 'racial-trait':
								case 'trait':
								case 'mythic-ability':
								case 'mythic-feat':
								case 'item':
									memo[prefix + "description-show"] = "";
									memo[prefix + "macro-text-show"] = "";
									break;
								case 'npc-spell-like-abilities':
									memo[prefix + "macro-text-show"] = "";
									break;
							}
							memo[prefix + "row-show"] = "";
							memo[prefix + "ids-show"] = "";
							return memo;
						}, {});
						setAttrs(setter, {
							silent: true
						});
					});
				});
			}
		});
	},

	/** Sets any values if sheet created brand new. Makes sure all migrations up to date.
	* makes sure NPC value set. 
	*/
	setupNewSheet = function(callback){
		var done = _.once(function(){
			setAttrs({'is_newsheet':0, 'is_v1':1, 'PFSheet_Version': String((PFConst.version.toFixed(2))) },PFConst.silentParams,function(){
				if (typeof callback === "function"){
					callback();
				}
			});
		});
		
		getAttrs(['is_npc', 'set_pfs'],function(v){
			var isNPC = parseInt(v.is_npc,10)||0,
			isPFS = parseInt(v.set_pfs,10)||0;
			PFMigrate.setAllMigrateFlags(function(){
				if (isNPC){
					PFNPC.setToNPC(done);
				} else if (isPFS){
					PFHealth.setToPFS(done);
				} else {
					done();
				}
			});
		});
	},
	recalcExpressions = function (callback, silently, oldversion) {
		var countEqs = _.size(PFConst.equationMacros),
		done = _.once(function () {
			TAS.debug("leaving PFSheet.recalcExpressions");
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneOne = _.after(countEqs, done);
		try {
			_.each(PFConst.equationMacros, function (writeField, readField) {
				try {
					SWUtils.evaluateAndSetNumber(readField, writeField, 0, doneOne, silently);
				} catch (err) {
					TAS.error("PFSheet.recalcExpressions", err);
					doneOne();
				}
			});
		} catch (err2) {
			TAS.error("PFSheet.recalcExpressions OUTER wtf how did this happen?", err2);
		} finally {
			done();
		}
	},
	recalcDropdowns = function (callback, silently, oldversion) {
		var countEqs = _.size(PFConst.dropdowns),
		done = _.once(function () {
			if (typeof callback === "function") {
				callback();
			}
		}),
		doneOne = _.after(countEqs, done);
		try {
			_.each(PFConst.dropdowns, function (writeField, readField) {
				try {
					PFUtilsAsync.setDropdownValue(readField, writeField, doneOne, silently);
				} catch (err) {
					TAS.error("PFSheet.recalcDropdowns", err);
					doneOne();
				}
			});
		} catch (err2) {
			TAS.error("PFSheet.recalcDropdowns OUTER wtf how did this happen?", err2);
		} finally {
			done();
		}
	},
	migrate = function (oldversion, callback, errorCallback) {
		var done = _.once(function () {
			TAS.debug("leaving PFSheet.migrate");
			if (typeof callback === "function") {
				callback();
			}
		}),
		errorDone = _.once(function (){
			TAS.warn("leaving migrate ERROR UPGRADE NOT FINISHED");
			if (typeof errorCallback === "function") {
				errorCallback();
			} else {
				done();
			}
		}),
		doneOne;
		try {
			//don't need to check if oldversion > 0 since this is only called if it is.
			TAS.debug("At PFSheet.migrate from oldversion:"+oldversion);
			if (oldversion < 1.0) {
				doneOne=_.after(7,function(){
					TAS.info("we finished calling all the migrates");
					done();
				});
				PFMigrate.migrateConfigFlags(TAS.callback( function (){
					PFInventory.migrate(doneOne,oldversion);
					PFSkills.migrate(doneOne,oldversion);
					PFHealth.migrate(doneOne,oldversion);
					PFAttacks.migrate(doneOne,oldversion);
					PFAbility.migrate(doneOne,oldversion);
					PFFeatures.migrate(doneOne,oldversion);
					PFSpells.migrate(doneOne,oldversion);
				}));
			} else {
				if (oldversion < 1.02) {
					PFAbility.migrate(null,oldversion);
					PFFeatures.migrate(null,oldversion);
				}
				if (oldversion < 1.05){
					PFAttackGrid.resetCommandMacro();
					PFSpells.resetCommandMacro();
					PFInventory.resetCommandMacro();
					PFAttackOptions.resetOptions();
				}
				if (oldversion < 1.07){
					PFInventory.migrate(null,oldversion);
				}
				if (oldversion < 1.10){
					PFMigrate.migrateAbilityListFlags();
					PFFeatures.migrate(null,oldversion);
				}
				if (oldversion < 1.12){
					PFAbility.migrate(null,oldversion);
					PFFeatures.resetCommandMacro();
					PFAttacks.recalculate();
					PFAbility.resetCommandMacro();
				}
				if (oldversion < 1.13){
					PFAbility.recalculate();
				}
				if (oldversion < 1.15){
					PFInventory.resetCommandMacro();					
					PFSkills.resetCommandMacro();
					PFAbility.resetCommandMacro();
				}
			}
		} catch (err) {
			TAS.error("PFSheet.migrate", err);
			//errorDone();
		} finally {
			done();
		}
	},
	recalculateParallelModules = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFSheet.recalculateParallelModules");
			if (typeof callback === "function") {
				callback();
			}
		}),
		parallelRecalcFuncs = [
			PFSpellCasterClasses.recalculate, 
			PFSaves.recalculate,
			PFFeatures.recalculate,
			PFPsionic.recalculate,
			PFSkills.recalculate,
			PFAbility.recalculate,
			PFInitiative.recalculate,
			PFAttacks.recalculate
		],		
		numberModules = _.size(parallelRecalcFuncs),
		doneOneModuleInner = _.after(numberModules, done),
		curr = 0,
		currstarted = 0,

		doneOneModule = function () {
			curr++;
			TAS.info("PFSheet.recalculateParallelModules, finished " + curr + " modules");
			doneOneModuleInner();
		};

		TAS.debug("at recalculateParallelModules! there are "+numberModules +" modules");
		try {
			_.each(parallelRecalcFuncs, function (methodToCall) {
				try {
					currstarted++;
					TAS.info("starting " + currstarted + " parallel modules");
					methodToCall(doneOneModule, silently, oldversion);
				} catch (err) {
					TAS.error("PFSheet.recalculateParallelModules", err);
					doneOneModule();
				}
			});
		} catch (err2) {
			TAS.error("PFSheet.recalculateParallelModules OUTER error!", err2);
			done();
		}
	},
	recalculateDefenseAndEncumbrance = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFSheet.recalculateDefenseAndEncumbrance");
			if (typeof callback === "function") {
				callback();
			}
		}),
		callEncumbrance = _.after(2, function () {
			PFEncumbrance.recalculate(done, silently, oldversion);
		});
		PFInventory.recalculate(callEncumbrance, silently, oldversion);
		PFDefense.recalculate(callEncumbrance, silently, oldversion);
	},
	recalculateCore = function (callback, silently, oldversion) {
		var done = _.once(function () {
			TAS.debug("leaving PFSheet.recalculateCore");
			if (typeof callback === "function") {
				callback();
			}
		}),
		sizeOnce = _.once(function(){
			PFSize.recalculate(done,silently,oldversion);
		}),
		healthOnce = _.once (function(){
			PFHealth.recalculate(sizeOnce,silently,oldversion);
		}),
		npcOnce = _.once(function(){
			PFNPC.recalculate(healthOnce,silently,oldversion);
		}),
		mythicOnce = _.once(function(){
			PFMythic.recalculate(npcOnce, silently, oldversion);
		}),
		expressionsOnce = _.once(function () {
			recalcExpressions(mythicOnce, silently, oldversion);
		}),
		dropdownsOnce = _.once(function () {
			recalcDropdowns(expressionsOnce, silently, oldversion);
		}),
		conditioncheckOnce = _.once(function () {
			PFChecks.applyConditions(dropdownsOnce, silently, oldversion);
		}),
		classOnce = _.once(function () {
			PFClassRaceGrid.recalculate(conditioncheckOnce, silently, oldversion);
		}),
		abilityScoresOnce = _.once(function () {
			PFAbilityScores.recalculate(classOnce, silently, oldversion);
		}),
		abilityAffectingConditionsOnce = _.once(function () {
			PFConditions.recalculate(abilityScoresOnce, silently, oldversion);
		}),
		buffsOnce = _.once(function () {
			PFBuffs.recalculate(abilityAffectingConditionsOnce, silently, oldversion);
		});

		PFMigrate.migrateConfigFlags(buffsOnce);
		
		//TAS.debug("at recalculateCore!!!!");

	},
	/** recalculate - all pages in sheet!  
	*@param {number} oldversion the current version attribute
	*@param {function} callback when done if no errors
	*@param {function} errorCallback  call this if we get an error
	*/
	recalculate = function (oldversion, callback, silently) {
		var done = function () {
			TAS.info("leaving PFSheet.recalculate");
			if (typeof callback === "function") {
				callback();
			}
		},
		callParallel = TAS.callback(function callRecalculateParallelModules() {
			recalculateParallelModules(TAS.callback(done), silently, oldversion);
		}),
		callEncumbrance = TAS.callback(function callRecalculateDefenseAndEncumbrance() {
			recalculateDefenseAndEncumbrance(TAS.callback(callParallel), silently, oldversion);
		});
		recalculateCore(callEncumbrance, silently, oldversion);

	},
	/* checkForUpdate looks at current version of page in PFSheet_Version and compares to code PFConst.version
	*  calls recalulateSheet if versions don't match or if recalculate button was pressed.*/
	checkForUpdate = function () {
		var done = function () {
			setAttrs({ recalc1: 0, migrate1: 0, is_newsheet: 0}, PFConst.silentParams);
		},
		errorDone = _.once(function (){
			TAS.warn("leaving checkForUpdate ERROR UPGRADE NOT FINISHED DO NOT RESET VERSION");
			setAttrs({ recalc1: 0, migrate1: 0 }, { silent: true });
		});
		getAttrs(['PFSheet_Version', 'migrate1', 'recalc1', 'is_newsheet', 'is_v1', 'hp', 'hp_max', 'npc-hd', 'npc-hd-num',
		'race', 'class-0-name', 'npc-type', 'level'], function (v) {
			var setter = {},
			setAny = 0,
			migrateSheet=false,
			newSheet= false,
			recalc = false,
			currVer = parseFloat(v.PFSheet_Version, 10) || 0,
			setUpgradeFinished = function() {
				setAttrs({ recalc1: 0, migrate1: 0, is_newsheet: 0, PFSheet_Version: String((PFConst.version.toFixed(2))) }, PFConst.silentParams, function() {
					if (currVer < 1.0) {
						recalculate(currVer, null, false);
					}
				});
			};
			TAS.notice("Attributes at version: " + currVer);
			if (parseInt(v["recalc1"],10) ){
				//HIT RECALC
				currVer = -1;
				recalc = true;
			} else if (parseInt(v["migrate1"],10)) {
				migrateSheet =true;
			} else if  ( parseInt(v["is_newsheet"],10) || (currVer === 0 &&  (parseInt(v.is_v1,10) || (  !(parseInt(v.hp, 10) || parseInt(v.hp_max, 10) || parseInt(v['npc-hd'], 10) || parseInt(v['npc-hd-num'], 10) ||
				v.race || v['class-0-name'] || v['npc-type'] || parseInt(v['level'], 10))))) ) {
				//NEW SHEET:
				newSheet=true;
			} else if (currVer !== PFConst.version) {
				migrateSheet = true;
			}
			if (newSheet) {
				setupNewSheet(done);
			} else if (migrateSheet){
				migrate(currVer, setUpgradeFinished, errorDone);
			} else if (recalc) {
				recalculate(currVer, done, false);
			} else  {
				done();
			}
		});
	},
	registerEventHandlers = function () {
		on("sheet:opened", TAS.callback(function eventSheetOpened() {
			//eventInfo has undefined values for this event.
			checkForUpdate();
		}));
		on("change:recalc1 change:migrate1", TAS.callback(function eventRecaluateSheet(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				checkForUpdate();
			}
		}));
		on("change:expandall", function (eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				expandAll();
			}
		});
		//GENERIC DROPDOWNS
		_.each(PFConst.dropdowns, function (write, read) {
			on("change:" + read, TAS.callback(function eventGenericDropdowns(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				PFUtilsAsync.setDropdownValue(read, write);
			}));
		});
		//GENERIC EQUATIONS
		_.each(PFConst.equationMacros, function (write, read) {
			on("change:" + read, TAS.callback(function eventGenericEquationMacro(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				SWUtils.evaluateAndSetNumber(read, write);
			}));
		});

		on("change:repeating_weapon:source-item", TAS.callback(function eventUpdateAttackSourceItem(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				getAttrs([eventInfo.sourceAttribute],function(v){
					var weaponId = SWUtils.getRowId(eventInfo.sourceAttribute),
					sourceId = v[eventInfo.sourceAttribute];
					//TAS.debug("PFSheet new item id: " + sourceId + " this row weapon id: "+weaponId, v);
					if (sourceId){
						sourceId = 'repeating_item_'+sourceId+'_create-attack-entry';
						PFInventory.createAttackEntryFromRow(sourceId,null,false,weaponId);
					}
				});
			}
		}));
		on("change:repeating_weapon:source-ability", TAS.callback(function eventUpdateAttackSourceAbility(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				getAttrs([eventInfo.sourceAttribute],function(v){
					var weaponId = SWUtils.getRowId(eventInfo.sourceAttribute),
					sourceId = v[eventInfo.sourceAttribute];
					if (sourceId){
						PFAbility.createAttackEntryFromRow(sourceId,null,false,null,weaponId);
					}
				});
			}
		}));
		on("change:repeating_weapon:source-spell", TAS.callback(function eventUpdateAttackSourceSpell(eventInfo) {
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				getAttrs([eventInfo.sourceAttribute],function(v){
					var weaponId = SWUtils.getRowId(eventInfo.sourceAttribute),
					sourceId = v[eventInfo.sourceAttribute];
					if (sourceId){
						PFSpells.createAttackEntryFromRow(sourceId,null,false,null,weaponId);
					}
				});
			}
		}));
		
		// PARSE CREATE NPC MONSTER
		on("change:npc_import_now", TAS.callback(function eventParseMonsterImport(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType === "api") {
				getAttrs(['npc_import_now'], function (v) {
					if ((parseInt(v.npc_import_now, 10) || 0) === 1) {
						PFNPCParser.importNPC(eventInfo, function(){
							//instead of just calling recalculate set recalc button and call checkforupdate
							//so users sees something is happening.
							setAttrs({recalc1:1},PFConst.silentParams,function(){
								checkForUpdate();
							});
						});
					}
				});
			}
		}));

	};
	registerEventHandlers();
	console.log(PFLog.l + '       ,## /##                    ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '      /#/ /  ##                   ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '     / / /    ##                  ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '      | ##___#/                   ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '      | ##       athfinder        ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '   #  | ##    sheet version       ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '    ### /           ' + ("0000" + PFConst.version.toFixed(2)).slice(-5) + '         ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '                                  ' + PFLog.r, PFLog.bg);
	console.log(PFLog.l + '   PFSheet module loaded          ' + PFLog.r, PFLog.bg);
	PFLog.modulecount++;
	if (PFLog.modulecount === 34) {
		console.log(PFLog.l + '   All ' + PFLog.modulecount + ' Modules Loaded          ' + PFLog.r, PFLog.bg);
	} else {
		console.log(PFLog.l + '   ONLY ' + PFLog.modulecount + ' Modules Loaded!        ' + PFLog.r, 'background: linear-gradient(to right,yellow,white,white,yellow); color:black;text-shadow: 0 0 8px white;');
	}
	return {
		recalculateCore: recalculateCore,
		checkForUpdate: checkForUpdate,
		expandAll: expandAll
	};
}());
