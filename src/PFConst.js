/* Pathfinder SHEET constants */
export const version = 1.15;
/***************************************Lists of Fields ************************************************************/
//add any new repeating sections here. This is the word after "repeating_"
export const repeatingSections = ["weapon", "ability", "class-ability", "feat", "racial-trait", "trait", "item", "npc-spell-like-abilities", "mythic-ability", "mythic-feat", "buff", "spells"];
//repeating sections that have used and used|max and max-calculation fields
export const repeatingMaxUseSections = ["class-ability", "feat", "racial-trait", "trait", "mythic-ability", "mythic-feat", "ability"];

//attribute of a dropdown mapped to attribute to write evaluated number to.
//all simple dropdowns that do not need to call any other function when evaluating besides setDropdownValue and findAbilityInString
export const dropdowns = {
  "HP-ability": "HP-ability-mod",
  "init-ability": "init-ability-mod",
  "Fort-ability": "Fort-ability-mod",
  "Ref-ability": "Ref-ability-mod",
  "Will-ability": "Will-ability-mod",
  "melee-ability": "melee-ability-mod",
  "melee2-ability": "melee2-ability-mod",
  "ranged-ability": "ranged-ability-mod",
  "ranged2-ability": "ranged2-ability-mod",
  "CMB-ability": "CMB-ability-mod",
  "CMB2-ability": "CMB2-ability-mod"
};
//attribute of a macro, mapped to attribute to write evaluation to
//all simple macros that do not need to call other functions besides evaluateAndSetNumber
export const equationMacros = {
  "init-misc": "init-misc-mod",
  "HP-formula-macro-text": "HP-formula-mod",
  "Max-Skill-Ranks-Misc": "Max-Skill-Ranks-mod",
  "SR-macro-text": "SR",
  "spellclass-0-SP_misc": "spellclass-0-SP-mod",
  "spellclass-1-SP_misc": "spellclass-1-SP-mod",
  "spellclass-2-SP_misc": "spellclass-2-SP-mod"
};
//the 3 spell classes at top of spells page
export const spellClassIndexes = ["0", "1", "2"];
export const silentParams  = {silent:true};
export const minusreg  = /\-|\u2013|\u2014|\u2212|\u02d7/;
export const critreg  = /(\d+)[\-|\u2013|\u2014|\u2212|\u02d7]20\/[x\u00d7](\d+)/;
diceDiereg : /(\d+)d(\d+)\s*([\+|\-|\u2013|\u2014|\u2212|\u02d7]{0,1})\s*(\d*)/
