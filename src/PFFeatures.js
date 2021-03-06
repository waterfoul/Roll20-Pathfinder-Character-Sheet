'use strict';
import _ from 'underscore';
import {PFLog, PFConsole} from './PFLog';
import TAS from 'exports-loader?TAS!TheAaronSheet';
import * as SWUtils from './SWUtils';
import PFConst from './PFConst';
import * as PFUtils  from './PFUtils';
import * as PFMacros from './PFMacros';
import * as PFMenus from './PFMenus';

var featureLists = ["class-ability", "feat", "racial-trait", "trait", "mythic-ability", "mythic-feat",'npc-spell-like-abilities'],
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
events = {
	commandMacroFields:["name","used","used_max","showinmenu"]
};

/** resetTopCommandMacro sets orig_ability_header_macro  (macro to plug into pf_block, read by PFAbility.resetCommandMacro)
*@param {function} callback call when done	
*/
function resetTopCommandMacro (callback){
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
}
/** resets the chat menu macro for all repeating lists in abilities tab
*@param {function} callback call when done
*/
export function resetCommandMacro (callback){
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
}
/** recalculateRepeatingMaxUsed - Parses the macro text "...max-calculation" in the repeating items
* (such as class-abilities, feats, traits, racial-traits)
* and sets the used|max value.
* Loops through all rows in the given repeating section.
* @param {string} section= the name of the section after the word "repeating_"
* @param {function} callback when done
* @param {boolean} silently if T then call setAttrs with {silent:true}
*/
function recalculateRepeatingMaxUsed (section, callback, silently) {
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
}
function setNewDefaults (callback,section){
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
}
function migrateRepeatingMacros (callback){
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
}
export function migrate (callback, oldversion){
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
}
export function recalculate (callback, silently, oldversion) {
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
}

function registerEventHandlers () {
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
	
}
registerEventHandlers();
PFConsole.log(PFLog.l + '   PFFeatures module loaded       ' );
PFLog.modulecount++;

