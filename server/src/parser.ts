
import {
	Diagnostic,
	DiagnosticSeverity,
	integer
} from 'vscode-languageserver/node';

import { encodeTokenType, encodeTokenModifiers } from './semanticTokens.js'
const commandsData = require('../data/command_list.json').commands;

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { resolveTxt } from 'dns';

const commandSeparators = ["\r\n", "//"];

const signCommand = new Set(["+", "-", "=", "@", ";", "{", "}", "(", ")", "[", "]", "\"", ":", ".", ",", "*", "/", "%", "<", ">", "!", "|", "&", "#", "\\"]);

const operators = new Set(["+", "-", "*", "/", "%", "<", ">", "<=", ">=", "==", "!=", "||", "&&", "(", ")", "!"])

const blankChar = new Set([" ", "\n", "\t", "\r"]);

const bracketsOpAndCl = getBracketsOpAndCl();

const units = new Set(["m", "t", "f"]);

const namedRotations = new Set(["front", "rear", "left", "right", "top", "bottom"]);

const temperatures = new Set(["cold", "warm"]);

const typesWalls = new Set(["wireframe","plain"]);

const sides = new Set(["front", "rear", "frontflipped", "rearflipped"])

const fArguments = new Set(["y", "n"]);

const endCommand = "(endCommand)";

const isLinked = "(isLinked)";

const elseElif = "[=el(if/se)]";

const typeVars = getTypeVars();

let dicElseElif : any= null;

let selectionNotEmpty = false;

type variableInfos = {
	type: string;
	indexStart: number;
	indexEnd: number | null;
}

type commandSplit = {
    subCommand: string;
    indexStart: number;
    indexEnd: number;
}[]

var listNameVar = new Map<string, variableInfos[]>();

const typeStructs = getTypeStruct();

var listNameStruct = new Map<string, variableInfos[]>();

/**
 * Test is the structure can be created and record the name of the structure.
 * @param type the type of structure
 * @param commandSplit The array of subCommands.
 * @param iStartStruct the starting index in the commandSplit of the name
 * @param textDocument the TextDocument
 * @param localName a prefix to add to the name to get the global name (i.e. site/building/room/rack/...)
 * @returns iEnd the index of the end of the name in the commandSplit and diagnostic, a diagnostic if something was not expected
 */
function createStruc(type : string, commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument, localName : string|null){
	let nameStruct = getNameStruct(commandSplit, iStartStruct);
	let diagnostic = null;
	if (nameStruct.name == null)
		return {iEnd : null, diagnostic : diagnosticNameStructSyntaxe(commandSplit[iStartStruct].indexStart, commandSplit[nameStruct.iEndStruct].indexEnd, textDocument)};
	if (localName == null)
		localName = "";''
	let name = localName + nameStruct.name;
	if (!strucHasCoherentParent(type, name))
		diagnostic = diagnosticStructNoParentFound(name, commandSplit[iStartStruct].indexStart, textDocument);
	if (!listNameStruct.has(name)){
		listNameStruct.set(name, [createMapInstance(type, commandSplit[iStartStruct].indexStart)]);
		return {iEnd : nameStruct.iEndStruct, diagnostic : diagnostic};
	}
	else{
		if (!lastInstance(listNameStruct, name).indexEnd)
			return {iEnd : null, diagnostic : diagnosticStructNameAlreadyUsed(name, commandSplit[iStartStruct].indexStart, textDocument)};

		listNameStruct.get(name)?.push(createMapInstance(type, commandSplit[iStartStruct].indexStart));
		return {iEnd : nameStruct.iEndStruct, diagnostic : diagnostic};
	}
}

/**
 * Get the name of the structure (i.e. concatenate the blocks to have the name nameSite/nameBuilding/... in one string)
 * @param commandSplit The array of subCommands.
 * @param iStartStruct the starting index in commandSplit of the name to find
 * @returns name : the name found if found and iEndStruct : the ending index of the name
 */
function getNameStruct(commandSplit : commandSplit, iStartStruct : number){
	let name = "";
	let slashBefore = true;
	let varBefore = false;
	let iEndStruct = iStartStruct;
	while (iEndStruct < commandSplit.length && (commandSplit[iEndStruct].subCommand == "/" || isNameStructOrAttributeSyntaxeCorrect(commandSplit[iEndStruct].subCommand) || isVar(commandSplit, iEndStruct))){
		if (iEndStruct > iStartStruct && !subCommandIsLinked(commandSplit, iEndStruct)){
			if (!slashBefore)
				return {name : name, iEndStruct : iEndStruct - 1};
			if (iEndStruct == iStartStruct)
				iEndStruct ++;
			return {name : null, iEndStruct : iEndStruct - 1};
		}
		if (slashBefore && commandSplit[iEndStruct].subCommand == "/")
			return {name : null, iEndStruct : iEndStruct};
		if (commandSplit[iEndStruct].subCommand == "/")
			slashBefore = true
		else
			slashBefore = false
		let isV = isVar(commandSplit, iEndStruct)
		if (isV != null){
			if (!varBefore)
				name += "[var]";
			iEndStruct = isV + 1;
			varBefore = true;
		}
		else{
			name += commandSplit[iEndStruct].subCommand;
			iEndStruct ++;
			varBefore = false;
		}
	}
	if (!slashBefore)
		return {name : name, iEndStruct : iEndStruct - 1};
	if (iEndStruct == iStartStruct)
		iEndStruct ++;
	return {name : null, iEndStruct : iEndStruct - 1};
}

/**
 * Tests if the name is syntactically correct for a structure
 * @param name The name of the structure
 * @returns boolean : true if it is syntactically correct, false otherwise
 */
function isNameStructOrAttributeSyntaxeCorrect(name : string){
	let codeChar = name.charCodeAt(0);
	if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0)))|| name.charAt(0) == "_"))
		return false;
	for (let iChar = 0; iChar < name.length; iChar ++){
		codeChar = name.charCodeAt(iChar);
		if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0))) || (("0".charCodeAt(0) <= codeChar) && (codeChar <= "9".charCodeAt(0))) || name.charAt(iChar) == "_"))
			return false;
	}
	return true;
}

/**
 * Tests if the name of the structure have an existing parent
 * @param type the type of the structure
 * @param name the (complete) name of the structure
 * @returns boolean : true if the parent exist, false otherwise
 */
function strucHasCoherentParent(type : string, name : string){
	let nameParent = getNameStructParent(name);
	if (typeStructs.get(type).get("parents").length == 0 && nameParent == "")
		return true;
	if (typeStructs.get(type).get("parents").length == 0 && nameParent != "")
		return false;
	if (typeStructs.get(type).get("parents").length != 0 && nameParent == "")
		return false;
	if (!listNameStruct.has(nameParent))
		return false;
	if (typeStructs.get(type).get("parents")[0] == "any")
		return true;
	for (const typeParent of typeStructs.get(type).get("parents")){
		if (typeStructs.get(typeParent).get("exist")(nameParent))
			return true;
	}
	return false;
}

/**
 * Extracts the name of the theoretical parent of a structure named name.
 * @param name the name of the structure.
 * @returns the theoretical name of the parent.
 */
function getNameStructParent(name : string){
	let indexEnd = name.length - 1;
	while (indexEnd > 0 && name.charAt(indexEnd) != "/")
		indexEnd --;
	return name.substring(0, indexEnd);
}


/**
 * Test if the variable can be created and record the name of the variable.
 * @param type the type of the variable
 * @param name the name of the variable
 * @param indexStartVar the index in the whole document of the start of the name of the variable
 * @param textDocument the textDocument
 * @returns null if all is good and a diagnostic if something was not expected
 */
function createVar(type : string, name : string, indexStartVar : number, textDocument : TextDocument){
	if (!isNameVarSyntaxeCorrect(name))
		return diagnosticNameVarSyntaxe(name, indexStartVar, textDocument);
	if (!listNameVar.has(name)){
		listNameVar.set(name,[createMapInstance(type, indexStartVar)]);
	}
	else{
		if (lastInstance(listNameVar, name).indexEnd)
			listNameVar.get(name)?.push(createMapInstance(type, indexStartVar));
		else if (lastInstance(listNameVar, name).type != type){
			delVar(name, indexStartVar, textDocument);
			listNameVar.get(name)?.push(createMapInstance(type, indexStartVar))
		}
	}
	return null;
}

/**
 * Test if the name is syntaxicaly correct for a variable
 * @param name the name of the variable
 * @returns boolean : true if the name is good, false otherwise
 */
function isNameVarSyntaxeCorrect(name : string){
	if (name.length ==0)
		return false;
	const codeChar = name.charCodeAt(0);
	if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0))) || name.charAt(0) == "_"))
		return false;
	for (let iChar = 1; iChar < name.length; iChar ++){
		const codeChar = name.charCodeAt(iChar);
		if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0))) || (("0".charCodeAt(0) <= codeChar) && (codeChar <= "9".charCodeAt(0))) || name.charAt(iChar) == "_"))
			return false;
	}
	return true;
}

/**
 * Close the last instance of the variable named name if possible, and return a diagnostic if not possible
 * @param name the name of the variable
 * @param indexEndVar the starting index in the whole document of the name
 * @param textDocument the textDocument
 * @returns null if all is good and a diagnostic if not
 */
function delVar(name : string, indexEndVar : number, textDocument : TextDocument){
	if (listNameVar.has(name)){
		if (!lastInstance(listNameVar, name).indexEnd){
			lastInstance(listNameVar, name).indexEnd = indexEndVar;
			return null;
		}
		else{
			return diagnosticVarAlreadyDeleted(name, indexEndVar, textDocument);
		}
	}
	else {
		return diagnosticNameNotCreated(name, indexEndVar, indexEndVar + name.length, textDocument);
	}
}

/**
 * Test if the variable named name exist (i.e. it's last instance is not closed)
 * @param name the name of the variable
 * @returns boolean : true if the variable exist, false otherwise
 */
function existVar(name : string){
	return listNameVar.has(name) && !lastInstance(listNameVar, name).indexEnd;
}

/**
 * Test if the variable named name exist and it's type is type (i.e. it's last instance is not closed and it's of type type)
 * @param type the type
 * @param name the name of the variable
 * @returns boolean : true if the variable named name exist and it's type is type, else false
 */
function existVarType(type : string, name : string){
	return existVar(name) && lastInstance(listNameVar, name).type == type;
}

/**
 * Create the infos of an instance for a variable
 * @param type the type of the variable
 * @param indexStart the index in the whole document of the creation of the instance
 * @returns variableInfos : the infos for an instance
 */
function createMapInstance(type : string, indexStart : number){
	let descr: variableInfos = {
		type: type,
		indexStart: indexStart,
		indexEnd: null,
	}
	return descr;
}

/**
 * Delete, if possible, the structure named name with a type type, and set the index of deleting "indexEndStruct" to indexEndStruct.
 * @param type the type of the structure
 * @param name the name of the structure
 * @param indexEndStruct the index in the document of the deleting of the structure
 * @param textDocument the TextDocument
 * @returns A diagnostic if he can't be deleted, null otherwise
 */
function delStruc(name : string, indexEndStruct : number, textDocument : TextDocument){
	if (listNameStruct.has(name))
		if (!lastInstance(listNameStruct, name).indexEnd){
			lastInstance(listNameStruct, name).indexEnd = indexEndStruct;
			delStrucSons(name, indexEndStruct);
			return null;
		}
		else{
			return diagnosticStructAlreadyDeleted(name, indexEndStruct, textDocument);
		}
	else
		return diagnosticNameNotCreated(name, indexEndStruct, indexEndStruct + name.length, textDocument);
}

/**
 * Delete all the sons of the structure named nameParent, and set the index of deleting "indexEndStruct" to indexEndStruct.
 * @param nameParent the name of the parent
 * @param indexEndStruct the index in the document of the deleting of the structure
 */
function delStrucSons(nameParent : string, indexEndStruct : number){
	for (const name of listNameStruct.keys())
		if (name.length > nameParent.length && name.substring(0,nameParent.length) == nameParent)
			if (!lastInstance(listNameStruct, name).indexEnd)
				lastInstance(listNameStruct, name).indexEnd = indexEndStruct;
	return;
}

/**
 * Get the last instance of the variable/structure named name
 * @param listName the list of variable/structure (listNameVar or listNameStruct)
 * @param name the name of the variable/structure
 * @returns the last instance of the variable/structure named name
 */
function lastInstance(listName : Map<string, any>, name : string){
	return listName.get(name)[listName.get(name).length - 1];
}


/**
 * Tests if the structure name of type type exist and is of type type (i.e. it's last instance is not closed and is of type type).
 * @param type the type of the structure.
 * @param name the name of the structure.
 * @returns boolean : true if the name exist with the type type, false otherwise.
 */
function existStrucType(type : string, name : string){
	return existStruct(name) && lastInstance(listNameStruct, name).type == type;
}

/**
 * Tests if the structure name of type type exist(i.e. it's last instance is not closed).
 * @param name the name of the structure.
 * @returns boolean : true if the name exist with the type type, false otherwise.
 */
function existStruct(name : string){
	return listNameStruct.has(name) && !lastInstance(listNameStruct, name).indexEnd;
}

/**
 * Reads command_list.json to get the commands
 * @returns some imbricated dictionnary to describe the commands
 */
function getCommands(){
	let result = {
		";" : true,
		"(endCommand)" : true
	};
	
	for (let command of commandsData){
		let treeParcours : any = result;
		if (command.parser){
			for (let iSubCommand = 0; iSubCommand < command.parser.length; iSubCommand ++){
				let subCommand = command.parser[iSubCommand];
				if (typeof subCommand == "object"){
					if (subCommand.hasOwnProperty(isLinked)){
						treeParcours[isLinked] = subCommand[isLinked];
					}
					subCommand = subCommand.value;
				}
				if (!treeParcours[subCommand]){
					treeParcours[subCommand] = {};
				}
				if (iSubCommand == command.parser.length - 1){
					treeParcours[subCommand][";"] = true;
					treeParcours[subCommand]["(endCommand)"] = true;
				}
				else{
					treeParcours = treeParcours[subCommand];
				}
			}
		}
	}
	//console.log("Command list", result)
	return result;
}

const commandList = getCommands();

//Example to understand the structure of commandList
// let commands = {
// 	"+": {
// 		"site": {
// 			":": {
// 				"[+site]" : {
// 					";" : true,
// 					"(endCommand)" : true},
// 			},
// 		},
// 		"si": {
// 			":": {
// 				"[+site]" : {
// 					";" : true,
// 					"(endCommand)" : true},
// 			},
// 		},
// 		"building": {
// 			":": {
// 				"[+building]" : {
// 					";" : true,
// 					"(endCommand)" : true},
// 			},
// 		},
// 	},
// 	"-": {
// 		"[-struct]" : {
// 			";" : true,
// 			"(endCommand)" : true},
// 	},
// 	"[=struct]": {
// 		":": {
// 			"[=property]" : {
// 				"=" : {
// 					"[=string]" : {
// 						";" : true,
// 						"(endCommand)" : true},
// 				},
// 			},
// 		},
// 	},
// 	".": {
// 		"var": {
// 			":": {
// 				"[+var]" : {
// 					";" : true,
// 					"(endCommand)" : true},
// 				"(isLinked)": true
// 			},
// 			"(isLinked)": true
// 		},
// 		"(isLinked)": true
// 	},
// 	"print" : {
// 		"[=string]" : {
// 			";" : true,
// 			"(endCommand)" : true
// 		},
// 	},
// 	"(endCommand)" : true,
// };


//Implementation of typeStruct to test the parser
function getTypeStruct(){
	let types = new Map<string, any>();
	let site = new Map<string, any>();
	site.set("parents", []);
	site.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("site", commandSplit, iStartStruct, textDocument, ""));
	site.set("exist", (name : string) => existStrucType("site", name));
	types.set("site", site);
	let building = new Map<string, any>();
	building.set("parents", ["site"]);
	building.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("building", commandSplit, iStartStruct, textDocument, ""))
	building.set("exist", (name : string) => existStrucType("building", name));
	types.set("building", building);
	let room = new Map<string, any>();
	room.set("parents", ["building"]);
	room.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("room", commandSplit, iStartStruct, textDocument, ""))
	room.set("exist", (name : string) => existStrucType("room", name));
	types.set("room", room);
	let rack = new Map<string, any>();
	rack.set("parents", ["room"]);
	rack.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("rack", commandSplit, iStartStruct, textDocument, ""))
	rack.set("exist", (name : string) => existStrucType("rack", name));
	types.set("rack", rack);
	let device = new Map<string, any>();
	device.set("parents", ["rack"]);
	device.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("device", commandSplit, iStartStruct, textDocument, ""))
	device.set("exist", (name : string) => existStrucType("device", name));
	types.set("device", device);
	let corridor = new Map<string, any>();
	corridor.set("parents", ["room"]);
	corridor.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("corridor", commandSplit, iStartStruct, textDocument, ""))
	corridor.set("exist", (name : string) => existStrucType("corridor", name));
	types.set("corridor", corridor);
	let orphanDevice = new Map<string, any>();
	orphanDevice.set("parents", ["any"]);
	orphanDevice.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("orphan device", commandSplit, iStartStruct, textDocument, ""))
	orphanDevice.set("exist", (name : string) => existStrucType("orphan device", name));
	types.set("orphan device", orphanDevice);
	let group = new Map<string, any>();
	group.set("parents", ["room", "rack"]);
	group.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("group", commandSplit, iStartStruct, textDocument, ""))
	group.set("exist", (name : string) => existStrucType("group", name));
	types.set("group", group);
	let pillar = new Map<string, any>();
	pillar.set("parents", ["room"]);
	pillar.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("pillar", commandSplit, iStartStruct, textDocument, getNameStruct(commandSplit, 0).name + "/") )
	pillar.set("exist", (name : string) => existStrucType("pillar", name));
	types.set("pillar", pillar);
	let separator = new Map<string, any>();
	separator.set("parents", ["room"]);
	separator.set("create", (commandSplit : commandSplit, iStartStruct : number, textDocument : TextDocument) => createStruc("separator", commandSplit, iStartStruct, textDocument, getNameStruct(commandSplit, 0).name + "/") )
	separator.set("exist", (name : string) => existStrucType("separator", name));
	types.set("separator", separator);
	return types;
}

//Implementation of typeVars
function getTypeVars(){
	let types = new Map<string, any>();
	let string = new Map<string, any>();
	string.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("string", name, indexStartVar, textDocument));
	string.set("exist", (name : string) => existVarType("string", name));
	string.set("isType", isString);
	types.set("string", string);
	let integer = new Map<string, any>();
	integer.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("integer", name, indexStartVar, textDocument));
	integer.set("exist", (name : string) => existVarType("integer", name));
	integer.set("isType", isInteger);
	types.set("integer", integer);
	let float = new Map<string, any>();
	float.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("float", name, indexStartVar, textDocument));
	float.set("exist", (name : string) => existVarType("float", name))
	float.set("isType", isFloat);
	types.set("float", float);
	let number = new Map<string, any>();
	number.set("isType", isNumber);
	types.set("number", number);
	let array = new Map<string, any>();
	array.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("array", name, indexStartVar, textDocument));
	array.set("exist", (name : string) => existVarType("array", name));
	array.set("isType", isArray);
	types.set("array", array);
	let boolean = new Map<string, any>();
	boolean.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("boolean", name, indexStartVar, textDocument));
	boolean.set("exist", (name : string) => existVarType("boolean", name));
	boolean.set("isType", isBoolean);
	types.set("boolean", boolean);
	let color = new Map<string, any>();
	color.set("isType", isColor);
	types.set("color", color);
	let alias = new Map<string, any>();
	alias.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("alias", name, indexStartVar, textDocument));
	alias.set("exist", (name : string) => existVarType("alias", name));
	alias.set("isType", isAlias);
	types.set("alias", alias);
	let path = new Map<string, any>();
	path.set("isType", isPath);
	types.set("path", path);
	let unit = new Map<string, any>();
	unit.set("isType", isUnit);
	types.set("unit", unit);
	let rotation = new Map<string, any>();
	rotation.set("isType", isRotation);
	types.set("rotation", rotation);
	let template = new Map<string, any>();
	template.set("isType", isTemplate);
	types.set("template", template);
	let axisOrientation = new Map<string, any>();
	axisOrientation.set("isType", isAxisOrientation);
	types.set("axisOrientation", axisOrientation);
	let temperature = new Map<string, any>();
	temperature.set("isType", isTemperature);
	types.set("temperature", temperature);
	let typeWall = new Map<string, any>();
	typeWall.set("isType", isTypeWall);
	types.set("typeWall", typeWall);
	let side = new Map<string, any>();
	side.set("isType", isSide);
	types.set("side", side);
	let fArgument = new Map<string, any>();
	fArgument.set("isType", isFArgument);
	types.set("fArgument", fArgument);
	types.set("var order", ["boolean", "array", "float", "integer", "string"])
	return types;
}

/**
 * Create a Map with the corresponding closed bracket for [ ( and {
 * @returns A Map
 */
function getBracketsOpAndCl(){
	let brackets = new Map<string, any>();
	brackets.set("[", "]");
	brackets.set("(", ")");
	brackets.set("{", "}");
	return brackets;
}

/**
 * Test if the subCommand at index iSubCommand is just after the subCommand at index iSubCommand - 1 (i.e. no blank char between them)
 * @param commandSplit The array of subCommands.
 * @param iSubCommand the index of the second subCommand
 * @returns boolean
 */
function subCommandIsLinked(commandSplit : commandSplit, iSubCommand : number){
	return commandSplit[iSubCommand - 1].indexEnd == commandSplit[iSubCommand].indexStart
}

/**
 * Test if at the index iStartVar in the commandSplit it's a variable that exist and return the index of end of the call of the variable
 * @param commandSplit The array of subCommands.
 * @param iStartVar the index of the beginning of the use of the variable (i.e. with the $).
 * @returns integer|null : null if it's not a call to a variable, an integer if it's a call to a variable that represent the index of end in the commandSplit of the call to the variable.
 */
function isVar(commandSplit : commandSplit, iStartVar : number){
	if (existVar(commandSplit[iStartVar].subCommand.substring(1)))
		return iStartVar;
	if (iStartVar + 3 >= commandSplit.length)
		return null;
	for (let i =1; i <= 3; i ++)
	if (!subCommandIsLinked(commandSplit, iStartVar + i))
		return null;
	if (commandSplit[iStartVar + 1].subCommand == "{" && existVar(commandSplit[iStartVar + 2].subCommand) && commandSplit[iStartVar + 3].subCommand == "}")
		return iStartVar + 3;
	return null;
}

/**
 * Test if at the index iStartVar in the commandSplit it's a variable of type type that exist and return the index of end of the call of the variable
 * @param commandSplit The array of subCommands.
 * @param iStartVar the index of the beginning of the use of the variable (i.e. with the $).
 * @param type the type of the variable
 * @returns integer|null : null if it's not a call to a variable of type type, an integer if it's a call to a variable of type type that represent the index of end in the commandSplit of the call to the variable.
 */
function isVarType(commandSplit : commandSplit, iStartVar : number, type : string){
	if (commandSplit[iStartVar].subCommand.charAt(0) != "$")
		return null;
	if (existVarType(type, commandSplit[iStartVar].subCommand.substring(1)))
		return iStartVar;
	if (iStartVar + 3 >= commandSplit.length)
		return null;
	for (let i =1; i <= 3; i ++)
	if (!subCommandIsLinked(commandSplit, iStartVar + i))
		return null;
	if (commandSplit[iStartVar + 1].subCommand == "{" && existVarType(commandSplit[iStartVar + 2].subCommand, type) && commandSplit[iStartVar + 3].subCommand == "}")
		return iStartVar + 3;
	return null;
}

/**
 * Try if it's the command $(pwd)
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @returns true if it's the command and false otherwise
 */
function isPathCmd(commandSplit : commandSplit, iStartVar : number){
	if (iStartVar + 3 < commandSplit.length)
		return commandSplit[iStartVar].subCommand == "$" && commandSplit[iStartVar + 1].subCommand == "(" && commandSplit[iStartVar + 2].subCommand == "pwd" && commandSplit[iStartVar + 3].subCommand == ")";
}

/**
 * Test if the expression is a string and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a string, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isString(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand != "eval"){
		return isStringWOEval(commandSplit, iStartVar, textDocument)
	}
	let resEval = getEvalType(commandSplit, iStartVar + 1, textDocument);
	if (resEval.type != null){
		return {iEndVar : resEval.iEnd, diagnostic : null};
	}
	return {iEndVar : null, diagnostic : resEval.diagnostic}
}

/**
 * Test if the expression is a string and return the index of end of the expression found without considering expression commencing by eval
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a string, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isStringWOEval(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "\""){
		let iEndVar = iStartVar + 1;
		while (iEndVar < commandSplit.length && commandSplit[iEndVar].subCommand.charAt(0) != "\""){
			if (commandSplit[iEndVar].subCommand.charAt(0) == "$"){
				if (iEndVar + 4 < commandSplit.length && commandSplit[iEndVar + 1].subCommand == "(" && commandSplit[iEndVar + 2].subCommand == "("){
					let iBracket1 = getIBracket(commandSplit, iEndVar + 1);
					let iBracket2 = getIBracket(commandSplit, iEndVar + 2);
					if (iBracket1 == null)
						if (iBracket2 == null)
							return {iEndVar : null, diagnotic : diagnosticMissingCharacters(commandSplit[iEndVar + 1].indexStart, commandSplit[iEndVar + 2].indexEnd, textDocument, "))")};
						else
							return {iEndVar : null, diagnotic : diagnosticMissingCharacters(commandSplit[iEndVar + 1].indexStart, commandSplit[iBracket2].indexEnd, textDocument, ")")};
					iBracket2 = Number(iBracket2);
					if (iBracket2 + 1 != iBracket1)
						return {iEndVar : null, diagnotic : diagnosticUnexpectedCharacters(commandSplit[Number(iBracket2) + 1].indexStart, commandSplit[iBracket1 - 1].indexEnd, textDocument)};
					if (iBracket2 == iEndVar + 3)
						return {iEndVar : null, diagnotic : diagnosticMissingCharacters(commandSplit[iEndVar + 1].indexStart, commandSplit[iBracket1].indexEnd, textDocument, "expression")};
					let resEval = getEvalType(commandSplit.slice(0, iBracket2), iEndVar + 3, textDocument);
					if (resEval.type == null)
						return resEval;
					if (resEval.iEnd + 1 != iBracket2)
						return {iEndVar : null, diagnotic : diagnosticUnexpectedCharacters(commandSplit[resEval.iEnd + 1].indexStart, commandSplit[iBracket1 - 2].indexEnd, textDocument)};
					iEndVar ++;
				}
				else{
					return {iEndVar : null, diagnostic : diagnosticUnexpectedCharactersExpected(commandSplit[iEndVar].indexStart, commandSplit[iEndVar].indexStart + 1, textDocument, "variables must be in $(()) when inside a quoted string. $(())")}
				}
			}
			iEndVar ++;
		}
		if (iEndVar < commandSplit.length)
			return {iEndVar : iEndVar, diagnostic : null};
		else
			return {iEndVar : null, diagnostic : diagnosticQuotedStringUnfinished(commandSplit[iStartVar].indexStart, commandSplit[iEndVar - 1].indexEnd, textDocument)}
	}
	else{
		let iEndVar = iStartVar;
		while (iEndVar < commandSplit.length && commandSplit[iEndVar].subCommand != "@" && commandSplit[iEndVar].subCommand != ";"){
			if (commandSplit[iEndVar].subCommand.charAt(0) == "$"){
				if (iEndVar + 4 < commandSplit.length && commandSplit[iEndVar + 1].subCommand == "(" && commandSplit[iEndVar + 2].subCommand == "("){
					let iBracket1 = getIBracket(commandSplit, iEndVar + 1);
					let iBracket2 = getIBracket(commandSplit, iEndVar + 2);
					if (iBracket1 == null)
						if (iBracket2 == null)
							return {iEndVar : null, diagnotic : diagnosticMissingCharacters(commandSplit[iEndVar + 1].indexStart, commandSplit[iEndVar + 2].indexEnd, textDocument, "))")};
						else
							return {iEndVar : null, diagnotic : diagnosticMissingCharacters(commandSplit[iEndVar + 1].indexStart, commandSplit[iBracket2].indexEnd, textDocument, ")")};
					iBracket2 = Number(iBracket2);
					if (iBracket2 + 1 != iBracket1)
						return {iEndVar : null, diagnotic : diagnosticUnexpectedCharacters(commandSplit[Number(iBracket2) + 1].indexStart, commandSplit[iBracket1 - 1].indexEnd, textDocument)};
					if (iBracket2 == iEndVar + 3)
						return {iEndVar : null, diagnotic : diagnosticMissingCharacters(commandSplit[iEndVar + 1].indexStart, commandSplit[iBracket1].indexEnd, textDocument, "expression")};
					let resEval = getEvalType(commandSplit.slice(0, iBracket2), iEndVar + 3, textDocument);
					if (resEval.type == null)
						return resEval;
					if (resEval.iEnd + 1 != iBracket2)
						return {iEndVar : null, diagnotic : diagnosticUnexpectedCharacters(commandSplit[resEval.iEnd + 1].indexStart, commandSplit[iBracket1 - 2].indexEnd, textDocument)};
					iEndVar = iBracket1;
				}
				else {
					let isV = isVar(commandSplit, iEndVar);
					if (isV != null){
						iEndVar = isV;
					}
					else if (isPathCmd(commandSplit, iEndVar)){
						iEndVar += 3;
					}
					else
						return {iEndVar : null, diagnostic : diagnosticNameNotCreated(commandSplit[iEndVar].subCommand.substring(1), commandSplit[iEndVar].indexStart + 1, commandSplit[iEndVar].indexEnd, textDocument)}
				}
			}
			iEndVar ++;
		}
		iEndVar --;
		return {iEndVar : iEndVar, diagnostic : null};
	}
}

/**
 * Test if the expression is an integer and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not an integer, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isInteger(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand != "eval"){
		return isIntegerWOEval(commandSplit, iStartVar, textDocument)
	}
	let resEval = getEvalType(commandSplit, iStartVar + 1, textDocument);
	if (resEval.type != null){
		if (resEval.type == "integer"){
			return {iEndVar : resEval.iEnd, diagnostic : null};
		}
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexEnd, commandSplit[resEval.iEnd].indexEnd, textDocument, "integer")}
	}
	return {iEndVar : null, diagnostic : resEval.diagnostic}
}

/**
 * Test if the expression is an integer and return the index of end of the expression found without considering expression commencing by eval
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not an integer, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isIntegerWOEval(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "$"){
		const isVT = isVarType(commandSplit, iStartVar, "integer");
		if (isVT == null)
			return {iEndVar : null, diagnostic : diagnosticNameNotCreated(commandSplit[iStartVar].subCommand.substring(1), commandSplit[iStartVar].indexStart + 1, commandSplit[iStartVar].indexEnd, textDocument)}
		else
			return {iEndVar : isVT, diagnostic : null};
	}
	else {
		return isIntegerWOVar(commandSplit, iStartVar, textDocument, "integer");
	}
}

/**
 * Test if the expression is an integer and return the index of end of the expression found without considering expression commencing by eval and without considering variables
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not an integer, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isIntegerWOVar(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument, type : string){
	let iEndVar = iStartVar;
	if (commandSplit[iStartVar].subCommand == "-"){
		iEndVar ++;
		if (iEndVar >= commandSplit.length)
			return {iEndVar : null, diagnostic : diagnosticMissingCharacters(commandSplit[iStartVar].indexEnd - 1, commandSplit[iStartVar].indexEnd + 1, textDocument, "integer")};
	}
	let iChar = 0;
	while (iChar < commandSplit[iEndVar].subCommand.length && commandSplit[iEndVar].subCommand.charCodeAt(iChar) >= "0".charCodeAt(0) && commandSplit[iEndVar].subCommand.charCodeAt(iChar) <= "9".charCodeAt(0)){
		iChar ++;
	}
	if (iChar < commandSplit[iEndVar].subCommand.length)
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iEndVar].indexEnd, textDocument, type)};
	return {iEndVar : iEndVar, diagnostic : null};
}

/**
 * Test if the expression is a float and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a float, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isFloat(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand != "eval"){
		return isFloatWOEval(commandSplit, iStartVar, textDocument)
	}
	let resEval = getEvalType(commandSplit, iStartVar + 1, textDocument);
	if (resEval.type != null){
		if (resEval.type == "float"){
			return {iEndVar : resEval.iEnd, diagnostic : null};
		}
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexEnd, commandSplit[resEval.iEnd].indexEnd, textDocument, "float")}
	}
	return {iEndVar : null, diagnostic : resEval.diagnostic}
}

/**
 * Test if the expression is a float and return the index of end of the expression found without considering expression commencing by eval
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a float, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isFloatWOEval(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "$"){
		const isVT = isVarType(commandSplit, iStartVar, "float");
		if (isVT == null)
			return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "float")}
		else
			return {iEndVar : isVT, diagnostic : null};
	}
	let iEndVar = iStartVar;
	if (commandSplit[iStartVar].subCommand == "-"){
		iEndVar ++;
		if (iEndVar >= commandSplit.length)
			return {iEndVar : null, diagnostic : diagnosticMissingCharacters(commandSplit[iStartVar].indexEnd - 1, commandSplit[iStartVar].indexEnd + 1, textDocument, "integer")};
	}
	if (iEndVar + 2 >= commandSplit.length)
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "float")};
	const isNum1 = isIntegerWOVar(commandSplit, iEndVar, textDocument, "float");
	if (isNum1.iEndVar == null)
		return isNum1;
	if (commandSplit[iEndVar + 1].subCommand != ".")
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iEndVar + 1].indexEnd, textDocument, "float")};
	const isNum2 = isIntegerWOVar(commandSplit, iEndVar + 2, textDocument, "float");
	if (isNum2.iEndVar == null)
		return isNum2;
	for (let i = 1; i <= 2; i ++){
		if (!subCommandIsLinked(commandSplit, iEndVar + i))
			return {iEndVar : null, diagnostic : diagnosticUnexpectedSpace(commandSplit[iEndVar + i - 1].indexEnd, commandSplit[iEndVar + i].indexStart, textDocument)};
	}
	return {iEndVar : iEndVar + 2, diagnostic : null};
	
}

/**
 * Test if the expression is a number and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a number, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isNumber(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand != "eval"){
		return isNumberWOEval(commandSplit, iStartVar, textDocument)
	}
	let resEval = getEvalType(commandSplit, iStartVar + 1, textDocument);
	if (resEval.type != null){
		if (resEval.type == "integer" || resEval.type == "float"){
			return {iEndVar : resEval.iEnd, diagnostic : null};
		}
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexEnd, commandSplit[resEval.iEnd].indexEnd, textDocument, "number")}
	}
	return {iEndVar : null, diagnostic : resEval.diagnostic}
}

/**
 * Test if the expression is a number and return the index of end of the expression found without considering expression commencing by eval
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a number, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isNumberWOEval(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	let isFlo : any = isFloatWOEval(commandSplit, iStartVar, textDocument);
	if (isFlo.iEndVar != null){
		isFlo.type = "float";
		return isFlo;
	}
	else{
		let isInt : any = isIntegerWOEval(commandSplit, iStartVar, textDocument);
		if (isInt.iEndVar != null){
			isInt.type = "integer";
			return isInt;
		}
		else{
			return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "number")}
		}
	}
}

/**
 * Test if the expression is an array and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not an array, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isArray(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand != "eval"){
		return isArrayEval(commandSplit, iStartVar, textDocument, false);
	}
	return isArrayEval(commandSplit, iStartVar + 1, textDocument, true);
}

/**
 * Test if the expression is an array and return the index of end. Eval the elements of the array if doEval, do not eval otherwise
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @param doEval boolean : true if we need to eval the elements of the array, false otherwise
 * @returns iEndVar : null if not an array, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isArrayEval(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument, doEval : boolean){
	if (iStartVar >= commandSplit.length)
		return {iEndVar : null, len : 0, diagnostic : diagnosticMissingCharacters(commandSplit[commandSplit.length - 1].indexEnd, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "array expression")}
	if (commandSplit[iStartVar].subCommand.charAt(0) == "$"){
		const isVT = isVarType(commandSplit, iStartVar, "array");
		if (isVT == null)
			return {iEndVar : null, len : 0, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "array")}
		else
			return {iEndVar : isVT, len : -1, diagnostic : null};
	}
	if (commandSplit[iStartVar].subCommand != "[")
		return {iEndVar : null, len : 0, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "array")};
	let iEndVar = iStartVar + 1;
	let mustBeNumber = true;
	let iBracket = getIBracket(commandSplit, iStartVar);
	let lenArr = 0
	if (iBracket == null)
		return {iEndVar : null, len : 0, diagnostic : diagnosticMissingCharacters(commandSplit[iStartVar].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "]")}
	let commandSplitArray = commandSplit.slice(0, iBracket)
	while (iEndVar < commandSplitArray.length){
		if (mustBeNumber){
			mustBeNumber = false
			if (doEval){
				let resEval = getEvalType(commandSplitArray, iEndVar, textDocument);
				if (resEval.type == null){
					return {iEndVar : null, len : 0, diagnostic : resEval.diagnostic};
				}
				if (resEval.type != "float" && resEval.type != "integer"){
					return {iEndVar : null, len : 0, diagnostic : diagnosticArrayElements(commandSplit[iEndVar].indexStart, commandSplit[resEval.iEnd].indexEnd, textDocument)};
				}
				iEndVar = resEval.iEnd;
			}
			else{
				let isNum = isNumberWOEval(commandSplit, iEndVar, textDocument);
				if (isNum.iEndVar != null)
					iEndVar = isNum.iEndVar;
				else{
					return {iEndVar : null, len : 0, diagnostic : diagnosticArrayElements(commandSplit[iEndVar].indexStart, commandSplit[iEndVar].indexEnd, textDocument)};
				}
			}
			lenArr ++;
		}
		else{
			if (commandSplit[iEndVar].subCommand != ","){
				return {iEndVar : null, len : 0, diagnostic : diagnosticUnexpectedCharactersExpected(commandSplit[iEndVar].indexStart, commandSplit[iEndVar].indexEnd, textDocument, ",")};
			}
			mustBeNumber = true;
		}
		iEndVar ++;
	}
	if (mustBeNumber)
		return {iEndVar : null, len : 0, diagnostic : diagnosticMissingCharacters(commandSplit[commandSplit.length - 1].indexEnd, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "[number]")};
	else
		return {iEndVar : iEndVar, len : lenArr, diagnostic : null};
	
}

/**
 * Test if the expression is an array with a length in lensVector and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @param lensVector an array with the lenghts possibles for the array.
 * @returns iEndVar : null if not an array, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isArrayWLength(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument, lensVector : number[]){
	let dicLenVec = new Set<number>(lensVector);
	let isVec = isArrayEval(commandSplit, iStartVar, textDocument, true);
	if (isVec.iEndVar != null){
		if (dicLenVec.has(isVec.len))
			return {iEndVar : isVec.iEndVar, diagnostic : null};
		else
			return {iEndVar : null, diagnostic : diagnosticLenArray(commandSplit[iStartVar].indexStart, commandSplit[isVec.iEndVar].indexEnd, textDocument, lensVector.filter((value : number) => (value > 0)))};
	}
	else
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "array")};
}

/**
 * Test if the expression is a boolean and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a boolean, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isBoolean(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand != "eval"){
		return isBooleanWOEval(commandSplit, iStartVar, textDocument)
	}
	let resEval = getEvalType(commandSplit, iStartVar + 1, textDocument);
	if (resEval.type != null){
		if (resEval.type == "boolean"){
			return {iEndVar : resEval.iEnd, diagnostic : null};
		}
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexEnd, commandSplit[resEval.iEnd].indexEnd, textDocument, "boolean")}
	}
	return {iEndVar : null, diagnostic : resEval.diagnostic}
}

/**
 * Test if the expression is a boolean and return the index of end of the expression found without considering expression commencing by eval
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a boolean, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isBooleanWOEval(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "$"){
		const isVT = isVarType(commandSplit, iStartVar, "boolean");
		if (isVT == null)
			return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "boolean")}
		else
			return {iEndVar : isVT, diagnostic : null};
	}
	if (commandSplit[iStartVar].subCommand == "false" || commandSplit[iStartVar].subCommand == "true")
		return {iEndVar : iStartVar, diagnostic : null};
	else
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "boolean")}
}

/**
 * Test if the expression is a color and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a color, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isColor(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "$"){
		let isString = isVarType(commandSplit, iStartVar, "string")
		if (isString != null)
			return {iEndVar : isString, diagnostic : null}
		let isInt = isVarType(commandSplit, iStartVar, "integer")
		if (isInt != null)
			return {iEndVar : isInt, diagnostic : null}
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar + 3].indexEnd, textDocument, "Variable of type integer or string")};
	}
	else if (commandSplit[iStartVar].subCommand.length != 6)
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "color")}
	for (let iChar = 0; iChar < commandSplit[iStartVar].subCommand.length; iChar ++){
		let charCode = commandSplit[iStartVar].subCommand.toLowerCase().charCodeAt(iChar);
		if (!((charCode >= "0".charCodeAt(0) && charCode <= "9".charCodeAt(0)) || (charCode >= "a".charCodeAt(0) && charCode <= "f".charCodeAt(0)))){
			return {iEndVar : null, diagnostic : diagnosticUnexpectedCharactersExpected(commandSplit[iStartVar].indexStart + iChar, commandSplit[iStartVar].indexStart + iChar, textDocument, "0-9 or A-F character expected")};
		}
	}
	return {iEndVar : iStartVar, diagnostic : null};
}

/**
 * Test if the expression is an alias and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not an alias, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isAlias(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	let isAl = existVarType("alias", commandSplit[iStartVar].subCommand);
	if (!isAl)
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "Name of an alias")};
	return {iEndVar : iStartVar, diagnostic : null};
}

/**
 * Test if the expression is a path and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a path, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isPath(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "$"){
		let isVarString = isVarType(commandSplit, iStartVar, "string");
		if (isVarString != null)
			return {iEndVar : isVarString, diagnostic : null};
		return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "string")}
	}
	let namePath;
	let iStartVar2 = iStartVar
	let quotedString = false;
	if (commandSplit[iStartVar].subCommand == "\""){
		iStartVar2 ++;
		quotedString = true;
	}

	let slash = false;
	let iEndVar = iStartVar2;
	while (iEndVar < commandSplit.length && (commandSplit[iEndVar].subCommand == "/" || isNameStructOrAttributeSyntaxeCorrect(commandSplit[iEndVar].subCommand) || commandSplit[iEndVar].subCommand == ":" || commandSplit[iEndVar].subCommand == ".")){
		if (slash && commandSplit[iEndVar].subCommand == "/")
			return {iEndVar : null, diagnostic : diagnosticNameStructSyntaxe(commandSplit[iStartVar].indexStart, commandSplit[iEndVar].indexEnd, textDocument)};
		if (slash){
			if (!subCommandIsLinked(commandSplit, iEndVar))
				return {iEndVar : null, diagnostic : diagnosticUnexpectedSpace(commandSplit[iEndVar - 1].indexEnd, commandSplit[iEndVar].indexStart, textDocument)}
		}
		if (commandSplit[iEndVar].subCommand == "/")
			slash = true;
		else
			slash = false;
		
		iEndVar ++;
	}
	if (slash)
		return {iEndVar : null, diagnostic : diagnosticMissingCharacters(commandSplit[iEndVar].indexEnd - 1, commandSplit[iEndVar].indexEnd + 1, textDocument, "characters after /")}
	if (quotedString){
		if (iEndVar >= commandSplit.length || commandSplit[iEndVar].subCommand != "\"")
			return {iEndVar : null, diagnostic : diagnosticQuotedStringUnfinished(commandSplit[iStartVar].indexStart, commandSplit[iEndVar - 1].indexEnd, textDocument)}
		else
			iEndVar ++;
	}
	if (iEndVar == iStartVar)
		iEndVar ++;
	return {iEndVar : iEndVar - 1, diagnostic : null};
}

/**
 * Test if the subscommands in commandSplit starting by the index iStartVar correspond to a variable of type speType or one of the expression in exprs.
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @param speType The type possible to match if it's a variable
 * @param exprs the expressions possibles
 * @param nameType the name of the type which correspond to the test
 * @returns iEndVar : null if not corresponding, and the index of end of the expresion otherwise. diagnostic : a potential diagnostic
 */
function isTypeOrExpr(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument, speType : string[], exprs : Set<string>, nameType : string){
	if (exprs.has(commandSplit[iStartVar].subCommand))
		return {iEndVar : iStartVar, diagnostic : null};
	for (let type of speType){
		let isType = isVarType(commandSplit, iStartVar, type);
		if (isType != null)
			return {iEndVar : isString, diagnostic : null};
	}
	return {iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, nameType)};
}

/**
 * Test if the expression is a unit and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a unit, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isUnit(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	return isTypeOrExpr(commandSplit, iStartVar, textDocument, ["string"], units, "unit");
}

/**
 * Test if the expression is a rotation and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a rotation, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isRotation(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	if (namedRotations.has(commandSplit[iStartVar].subCommand))
		return {iEndVar : iStartVar, diagnostic : null};
	let isString = isVarType(commandSplit, iStartVar, "string");
	if (isString != null)
		return {iEndVar : isString, diagnostic : null};
	return isArrayWLength(commandSplit, iStartVar, textDocument, [-1, 3]);
}

/**
 * Test if the expression is a template and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a template, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isTemplate(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	return isPath(commandSplit, iStartVar, textDocument);
}

/**
 * Test if the expression is an axisOrientation and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not an axisOrientation, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isAxisOrientation(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	let isString = isVarType(commandSplit, iStartVar, "string");
	if (isString != null)
		return {iEndVar : isString, diagnostic : null};
	if (iStartVar + 1 >= commandSplit.length)
		return {iEndVar : null, diagnostic : diagnosticUnrecognisedExpression(commandSplit[iStartVar].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument)};
	if (iStartVar + 3 >= commandSplit.length){
		if ((commandSplit[iStartVar].subCommand == "+" || commandSplit[iStartVar].subCommand == "-") && (commandSplit[iStartVar + 1].subCommand == "x" || commandSplit[iStartVar + 1].subCommand == "y"))
			return {iEndVar : iStartVar + 1, diagnostic : null};
		return {iEndVar : null, diagnsotic : diagnosticUnrecognisedExpression(commandSplit[iStartVar].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument)};
	}
	if ((commandSplit[iStartVar].subCommand == "+" || commandSplit[iStartVar].subCommand == "-") && commandSplit[iStartVar + 1].subCommand == "x" && (commandSplit[iStartVar + 2].subCommand == "+" || commandSplit[iStartVar + 2].subCommand == "-")&& commandSplit[iStartVar + 3].subCommand == "y")
		return {iEndVar : iStartVar + 3, diagnostic : null}
	return {iEndVar : null, diagnsotic : diagnosticUnrecognisedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar + 3].indexEnd, textDocument)};
}

/**
 * Test if the expression is a temperature and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a temperature, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isTemperature(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	return isTypeOrExpr(commandSplit, iStartVar, textDocument, ["string"], temperatures, "temperature")
}

/**
 * Test if the expression is a typeWall and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a typeWall, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isTypeWall(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	return isTypeOrExpr(commandSplit, iStartVar, textDocument, ["string"], typesWalls, "typeWall")
}

/**
 * Test if the expression is a side and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a side, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isSide(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	return isTypeOrExpr(commandSplit, iStartVar, textDocument, ["string"], sides, "side")
}

/**
 * Test if the expression is a fArgument and return the index of end of the expression found
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns iEndVar : null if not a fArgument, the index of end otherwise, diagnostic : a diagnostic if needed
 */
function isFArgument(commandSplit : commandSplit, iStartVar : number, textDocument : TextDocument){
	return isTypeOrExpr(commandSplit, iStartVar, textDocument, ["string"], fArguments, "FArgument")
}

/**
 * Get the type of the expression after an eval
 * @param commandSplit The array of subCommands.
 * @param iStartVar The index of begginning.
 * @param textDocument The textDocument.
 * @returns type : the type found or null if no type found, iEnd : the index in the commandSplit of the end of the expression found, diagnostic : a diagnostic if needed
 */
function getEvalType(commandSplit : commandSplit, iStart : number, textDocument : TextDocument){
	if (iStart >= commandSplit.length)
		return {type : "string", iEnd : iStart - 1, diagnostic : null};
	
	let stringEval = "";
	let iEnd = iStart;
	while (iEnd < commandSplit.length && commandSplit[iEnd].subCommand != "@" && commandSplit[iEnd].subCommand != ";" && commandSplit[iEnd].subCommand != ","){
		if (commandSplit[iEnd].subCommand == "eval"){
			return {type : null, iEnd : null, diagnostic : diagnosticEvalInEval(commandSplit[iEnd].indexStart, commandSplit[iEnd].indexEnd, textDocument)};
		}
		let match = matchSubCommands(commandSplit, iEnd, operators);
		if (match != null){
			stringEval += match;
			iEnd = iEnd + match.length - 1;
		}
		else if (commandSplit[iEnd].subCommand == "\\"){
			stringEval += "/";
		}
		else {
			let isNum = isNumberWOEval(commandSplit, iEnd, textDocument);
			if (isNum.iEndVar != null){
				if (isNum.type == "float"){
					stringEval += "0.13";
				}
				else{
					stringEval += "5";
				}
				iEnd = isNum.iEndVar
			}
			else{
				let isBool = isBooleanWOEval(commandSplit, iEnd, textDocument);
				if (isBool.iEndVar != null){
					stringEval += "true";
					iEnd = isBool.iEndVar;
				}
				else{
					let isVarArr = isVarType(commandSplit, iEnd, "array");
					if (isVarArr != null){
						if (isVarArr + 2 < commandSplit.length && commandSplit[isVarArr + 1].subCommand == "[" ){
							let iBracket = getIBracket(commandSplit, isVarArr + 1);
							if (iBracket == null)
								return {type : null, iEnd : null, diagnostic : diagnosticMissingCharacters(commandSplit[isVarArr + 1].indexEnd, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "]")};
							if (iBracket == isVarArr + 2)
								return {type : null, iEnd : null, diagnostic : diagnosticMissingCharacters(commandSplit[iBracket - 1].indexStart, commandSplit[iBracket].indexEnd, textDocument, "[integer]")};
							let resEval : any = getEvalType(commandSplit.slice(0, iBracket), isVarArr + 2, textDocument);
							if (resEval.type == null)
								return resEval;
							if (resEval.type != "integer")
								return {type : null, iEnd : null, diagnostic : diagnosticIndexArray(commandSplit[isVarArr + 2].indexStart, commandSplit[resEval.iEnd].indexEnd, textDocument)};
							if (resEval.iEnd + 1 != iBracket)
								return {type : null, iEnd : null, diagnostic : diagnosticUnexpectedCharacters(commandSplit[resEval.iEnd + 1].indexStart, commandSplit[iBracket - 1].indexEnd, textDocument)};
							iEnd = iBracket;
							stringEval += 3
						}
						else
							return {type : null, iEnd : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iEnd].indexStart, commandSplit[isVarArr].indexEnd, textDocument, "array recognized, but expression of type number/boolean/operator")};
					}
					else{
						return {type : null, iEnd : null, diagnostic : diagnosticUnexpectedCharacters(commandSplit[iEnd].indexStart, commandSplit[iEnd].indexEnd, textDocument)};
					}
				}
			}
		}
		stringEval += " "
		iEnd ++;
	}
	try{
		let resEval = eval(stringEval);
		if (typeof resEval == "number"){
			if (resEval - Math.round(resEval) == 0)
				return {type : "integer", iEnd : iEnd - 1, diagnostic : null};
			else
				return {type : "float", iEnd : iEnd - 1, diagnostic : null};
		}
		else if (typeof resEval == "boolean"){
			return {type : "boolean", iEnd : iEnd - 1, diagnostic : null};
		}
		return {type : null, iEnd : null,  diagnostic : diagnosticUnrecognisedExpression(commandSplit[iStart].indexStart, commandSplit[iEnd - 1].indexEnd, textDocument)};
	}
	catch{
		return {type : null, iEnd : null, diagnostic : diagnosticUnrecognisedExpression(commandSplit[iStart].indexStart, commandSplit[iEnd - 1].indexEnd, textDocument)};
	}
}

/**
 * Try if the commandSplit starting at iStart match with one of the patterns in patterns. Work only with patterns using characters in signCommand (i.e. +, -, #, @, ., //, etc)
 * @param commandSplit The array of subCommands.
 * @param iStart The index of begginning.
 * @param patterns A set with the patterns to match
 * @returns null if there is no match, the string in patterns matching otherwise.
 */
function matchSubCommands(commandSplit : commandSplit, iStart : number, patterns : Set<string>){
	let patternsLenghts = new Set<integer>();
	for (const pattern of patterns.keys()){
		patternsLenghts.add(pattern.length)
	}
	for (const length of patternsLenghts.keys()){
		if (iStart + length - 1 < commandSplit.length){
			let areLinked = true;
			for (let iSub = 1; iSub < length; iSub ++){
				if (!subCommandIsLinked(commandSplit, iStart + iSub))
					areLinked = false;
			}
			if (areLinked){
				let stringConcatenate = "";
				for (let iSub = 0; iSub < length; iSub ++){
					stringConcatenate += commandSplit[iStart + iSub].subCommand;
				}
				if (patterns.has(stringConcatenate))
					return stringConcatenate;
			}
		}
	}
	return null;
}

/**
 * Return the index of the closed bracket corresponding to the oppened one in commandSPlit[iStart]. Bracket can be "(", "[" or "[".
 * @param commandSplit The array of subCommands.
 * @param iStart The index of begginning.
 * @returns The index of the closing bracket corresponding. null if no clossing bracket corresponding or not an oppened in commandSPlit[iStart].
 */
function getIBracket(commandSplit : commandSplit, iStart : number){
	let typeBracket = commandSplit[iStart].subCommand
	if (!bracketsOpAndCl.has(typeBracket)){
		throw new Error("Unexpected Character as bracket");
	}
	let iEnd = iStart;
	let profondeur = 0;
	let inQuotedString = false; //Used to know if we are in a quotedString or not
	do{
		if (commandSplit[iEnd].subCommand == "\"")
			inQuotedString = !inQuotedString;
		else if (commandSplit[iEnd].subCommand == typeBracket && !inQuotedString)
			profondeur ++;
		else if (commandSplit[iEnd].subCommand == bracketsOpAndCl.get(typeBracket) && !inQuotedString)
			profondeur --;
		iEnd ++;
	}while(iEnd < commandSplit.length && profondeur > 0);
	if (profondeur <= 0)
		return iEnd - 1;
	return null;
}

/**
 * Return the index of the next apparition in commandSplit of the string string (must be only in one subCommand)
 * @param commandSplit The array of subCommands.
 * @param iStart The index of begginning.
 * @param string the string to find
 * @returns the index in commandSplit of the first apparition of the string string, and null if it not appear.
 */
function getNextApparition(commandSplit : commandSplit, iStart : number, string : string){
	let iEnd = iStart;
	while (iEnd < commandSplit.length && commandSplit[iEnd].subCommand != string)
		iEnd ++;
	if (iEnd >= commandSplit.length)
		return null;
	return iEnd;
}

/**
 * @param cursorPosition 
 * @return [string[], string[]] Lists of existing variables and structures at this position
 */
export function getExistingVariables(cursorPosition: number): [string[], string[]] {
	let variables: string[] = [];
	for (let [key, variableInfos] of listNameVar) {
		let key_exists = false;
		for (let variableInfo of variableInfos) {
			if (cursorPosition >= (variableInfo.indexStart + key.length) && ((variableInfo.indexEnd && cursorPosition <= variableInfo.indexEnd) || !variableInfo.indexEnd)) {
				key_exists = true;
				break;
			}
		}

		if (key_exists) {
			variables.push(key);
		}
	}

	let structures: string[] = [];
	for (let [key, variableInfos] of listNameStruct) {
		let key_exists = false;
		for (let variableInfo of variableInfos) {
			if (cursorPosition >= variableInfo.indexStart && ((variableInfo.indexEnd && cursorPosition <= variableInfo.indexEnd) || !variableInfo.indexEnd)) {
				key_exists = true;
				break;
			}
		}

		if (key_exists) {
			structures.push(key);
		}
	}

	return [variables, structures];
}



/**
 * Parses a text document and returns an array of diagnostics.
 * @param textDocument The text document to parse.
 * @returns An array of diagnostics.
 */
export function parseDocument(textDocument: TextDocument) {
	listNameVar = new Map<string, any>();
	listNameStruct = new Map<string, any>();
	selectionNotEmpty = false;
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	const tokens : any = [];
	let currentIndex = 0;
	let endSeparator = "\n";
	let startSeparator = "\n";
	let nextCommandIndex = 0;

	while (currentIndex < text.length) {
		startSeparator = endSeparator;
		let nextPart = getNextPart(currentIndex, text, commandSeparators);
		nextCommandIndex = nextPart.index;
		endSeparator = nextPart.separator;
		let nextCommand = text.substring(currentIndex, nextCommandIndex);
		let nextCommandTrim = nextCommand.trimEnd()
		// While the command line finishe by \, add the line after as it must be read as a single line.
		while (isNewLineSeparator(endSeparator) && nextCommandTrim != "" && nextCommandTrim.charAt(nextCommandTrim.length - 1) == "\\"){
			nextCommand = nextCommandTrim.substring(0, nextCommandTrim.length - 1) + createBlankString(nextCommand.length - nextCommandTrim.length + 1);
			nextPart = getNextPart(nextCommandIndex + endSeparator.length, text, commandSeparators);
			nextCommand += text.substring(nextCommandIndex, nextPart.index);
			nextCommandTrim = nextCommand.trimEnd();
			nextCommandIndex = nextPart.index;
			endSeparator = nextPart.separator;
		}

		//Place currentIndex to the beginning of the command, i.e. without taking into account whiteSpaces before the beginning of the command
		if (isNewLineSeparator(startSeparator)) {
			const commandLength = nextCommand.length;
			nextCommand = nextCommand.trimStart();
			currentIndex += commandLength - nextCommand.length;
		}
		
		if (nextCommand != "") {
			if (startSeparator == "//") {
				tokens.push(addSemanticToken(textDocument, currentIndex - 2, nextCommandIndex, "comment", [], true))
			} else {
				parseCommand(splitCommand(currentIndex, nextCommand), diagnostics, textDocument, tokens);
			}
		}

		currentIndex = nextCommandIndex+endSeparator.length;
	}
	return [diagnostics, tokens];
}

/**
 * Test if the separator is a new line separator
 * @param separator the separator
 * @returns boolean : true if it's a new line separator
 */
function isNewLineSeparator(separator : string){
	return separator == "\n" || separator == "\r\n";
}

/**
 * Create a string with blank characters of length len
 * @param len the length
 * @returns the string
 */
function createBlankString(len : number){
	let string = "";
	for (;string.length < len; string += " ");
	return string;
}

/**
 * Add a semantic token for the command Highlight.
 * @param textDocument The textDocument.
 * @param startIndex the starting index in the whole document of the expression to highlight
 * @param endIndex the ending index in the whole document of the expression to highlight
 * @param tokenType the type of the expression
 * @param tokenModifiers Some modifiers if needed (not implemented yet)
 * @param genericToken boolean
 * @returns a structure to be add to tokens
 */
function addSemanticToken(textDocument : TextDocument, startIndex : integer, endIndex : integer, tokenType : string, tokenModifiers : string[], genericToken = false){
	//console.log("Semantic token recieved : " + startIndex + " " + endIndex + " " + tokenType + " " + tokenModifiers + " " + genericToken)
	return {line : textDocument.positionAt(startIndex).line, char : textDocument.positionAt(startIndex).character, length : endIndex - startIndex, tokenType : encodeTokenType(tokenType, genericToken), tokenModifiers : encodeTokenModifiers([])}
}

/**
 * Parse a command
 * @param currentIndex the index in the document of the command
 * @param endCommandIndex the index of the end of the command in the document
 * @param command the command itself
 * @param diagnostics The list of all the diagnostics
 * @param textDocument the TextDocument
 * @returns boolean : true if the command is recognized, false otherwise
 */
function parseCommand(commandSplit : commandSplit, diagnostics: Diagnostic[], textDocument: TextDocument, tokens : any[]): boolean {
	let iSubCommand = 0;
	let thereIsAPlusOrMinus = false;
	let curDicCommand : any = commandList; //List of commands (It is imbricated dictionnary, see the function getCommandsTest to get an example)
	while (iSubCommand < commandSplit.length){
		if (curDicCommand.hasOwnProperty(isLinked)){
			if (curDicCommand[isLinked] && !subCommandIsLinked(commandSplit, iSubCommand)){
				diagnostics.push(diagnosticUnexpectedSpace(commandSplit[iSubCommand - 1].indexEnd, commandSplit[iSubCommand].indexStart, textDocument));
			}
			else if (!curDicCommand[isLinked] && subCommandIsLinked(commandSplit, iSubCommand)){
				diagnostics.push(diagnosticExpectedSpace(commandSplit[iSubCommand - 1].indexEnd - 1, commandSplit[iSubCommand].indexStart + 1, textDocument))
			}
		}
		if (curDicCommand?.[elseElif]){
			if (dicElseElif == null){
				dicElseElif = curDicCommand;
			}
			else{
				curDicCommand = dicElseElif;
			}
			curDicCommand = curDicCommand[elseElif];
		}
		if (commandSplit[iSubCommand].subCommand in curDicCommand){
			if (commandSplit[iSubCommand].subCommand == ";"){
				curDicCommand = commandList;
			}
			else {
				curDicCommand = curDicCommand[commandSplit[iSubCommand].subCommand]
			}
			//For the coloration
			if (commandSplit[iSubCommand].subCommand == "+" || commandSplit[iSubCommand].subCommand == "-"){
				thereIsAPlusOrMinus = true;
			}
			if (commandSplit[iSubCommand].subCommand == ":" && thereIsAPlusOrMinus){
				tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand-1].indexStart, commandSplit[iSubCommand-1].indexEnd, commandSplit[iSubCommand - 1].subCommand, []));
				thereIsAPlusOrMinus = false;
			}
		}
		else{
			let typesVariablesPossible = [];
			if (Object.keys(curDicCommand).length == 0){
				diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument))
			}
			else
				{
				typesVariablesPossible = Object.keys(curDicCommand).filter((key : any) => Object.keys(key).length > 0 && key.charAt(0) == "[")
				//console.log(typesVariablesPossible)
				//for (const subCommand of arrayKeys)
				//	if (subCommand != null && subCommand != isLinked && subCommand.charAt(0) == "[")
				//		typesVariablesPossible.push(subCommand);
				if (typesVariablesPossible.length > 0){
					const vari = parseVariable(typesVariablesPossible, iSubCommand, commandSplit, textDocument, diagnostics, tokens);
					if (vari.actionType != null){
						if (vari.diagnostic != null)
							diagnostics.push(vari.diagnostic);
						let iComma = vari.actionType.indexOf(",");
						let variableType;
						if (iComma > 0)
							variableType = vari.actionType.substring(2, iComma);
						else
							variableType = vari.actionType.substring(2, vari.actionType.length - 1);
						if (vari.actionType == "[+var]")
							tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand + 1].indexEnd, commandSplit[vari.iEndVar].indexEnd, lastInstance(listNameVar, commandSplit[iSubCommand].subCommand).type, []))
						else if (vari.actionType == "[=struct]"){
							let nameStruct = getNameStruct(commandSplit, iSubCommand).name
							if (nameStruct == "_")
							tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand].indexStart, commandSplit[vari.iEndVar].indexEnd, variableType, []));
							else
								tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand].indexStart, commandSplit[vari.iEndVar].indexEnd, lastInstance(listNameStruct, String(getNameStruct(commandSplit, iSubCommand).name)).type, []));
						}
						else
							tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand].indexStart, commandSplit[vari.iEndVar].indexEnd, variableType, []));
						curDicCommand = curDicCommand[vari.actionType];
						iSubCommand = vari.iEndVar;
					} else{
						let cmds = Object.keys(curDicCommand).filter((key : any) => Object.keys(key).length > 0 && key.charAt(0) != "[" && key != isLinked && key != endCommand)
						if (cmds.length <=0)
							diagnostics.push(vari.diagnostic);
						else
							diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand].indexStart, commandSplit[iSubCommand].indexEnd, textDocument));
						return false;
					}
				}
				else{
					const lstCommand = Object.keys(curDicCommand).filter((key : any) => Object.keys(key).length > 0 && key != isLinked && key != endCommand);
					if (lstCommand.length == 1)
						diagnostics.push(diagnosticUnexpectedCharactersExpected(commandSplit[iSubCommand].indexStart, commandSplit[iSubCommand].indexEnd, textDocument, lstCommand[0]));
					else
						diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand].indexStart, commandSplit[iSubCommand].indexEnd, textDocument));
					return false;
				}
				
			}
		}
		iSubCommand ++;
	}
	if (curDicCommand?.[elseElif])
		curDicCommand = curDicCommand[elseElif];

	if (!curDicCommand?.[endCommand]){
		const lstCommand = Object.keys(curDicCommand).filter((key : any) => Object.keys(key).length > 0 && key != isLinked && key != endCommand);
		if (lstCommand.length == 1){
			diagnostics.push(diagnosticUnexpectedCharactersExpected(commandSplit[iSubCommand - 1].indexEnd - 1, commandSplit[iSubCommand - 1].indexEnd + 1, textDocument, lstCommand[0]));
		}
		else
			if (iSubCommand > 0)
				diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand - 1].indexEnd - 1, commandSplit[iSubCommand - 1].indexEnd + 1, textDocument));
		return false;
	}
	return true;
}

/**
 * Split the command in differents subcommand, removing all the blank characters and splitting according to differents sign, in signCommand
 * @param currentIndex The index of the begginning of the command in the whole document.
 * @param command The command to split.
 * @returns An array, with dictionnary containing the subCommand, the index of the beginning and the index of ending in the whole document of the subcommand.
 */
function splitCommand(currentIndex: number, command : string) : commandSplit{
	let commandSplit = [];
	let indexStart = 0;
	let inEval = false;
	while (indexStart < command.length){
		if (blankChar.has(command.charAt(indexStart)))
			indexStart += 1
		else {
			let indexEnd = indexStart + 1;
			if (!signCommand.has(command.charAt(indexStart))){
				while (indexEnd < command.length && !signCommand.has(command.charAt(indexEnd)) && (command.charAt(indexEnd) != "$") && (!blankChar.has(command.charAt(indexEnd))))
					indexEnd ++;

			}
			commandSplit.push({subCommand:command.substring(indexStart, indexEnd), indexStart : currentIndex + indexStart, indexEnd : currentIndex + indexEnd})
			indexStart = indexEnd;
		}
	}
	return commandSplit;
}


/**
 * Parse a subCommand when it's a variable or a structure.
 * @param typesVariablesPossible The differents actionTypes possibles to match.
 * @param iStartVar The index of the subCommand in the array of subCommands.
 * @param commandSplit The array of subCommands.
 * @param diagnostics The list of diagnostics.
 * @param textDocument The TextDocument.
 * @returns The first actionType for which it match with the subCommand, and null if no one actionType match with the subCommand.
 */
function parseVariable(typesVariablesPossible : string[], iStartVar : number, commandSplit : commandSplit, textDocument : TextDocument, diagnostics : Diagnostic[], tokens : any){
	let diagnostic;
	for (const actionType of typesVariablesPossible){
		if (actionType.charAt(1) == "+"){
			let iComma = actionType.indexOf(",");
			let type;
			if (iComma == -1)
				type = actionType.substring(2, actionType.length - 1);
			else
				type = actionType.substring(2, iComma);
			if (type == "var"){
				if (iStartVar + 2 >= commandSplit.length){
					if (iStartVar + 1 >= commandSplit.length)
						diagnostic = diagnosticUnexpectedCharactersExpected(commandSplit[commandSplit.length - 1].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "A value is")
					else{
						diagnostic = typeVars.get("string").get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
						if (diagnostic == null)
							return {actionType : actionType, iEndVar : iStartVar + 1, diagnostic : null};
					}
				}
				else if (commandSplit[iStartVar + 1].subCommand != "=")
					diagnostic = diagnosticUnexpectedCharactersExpected(commandSplit[iStartVar + 1].indexStart, commandSplit[iStartVar + 1].indexEnd, textDocument, "=");
				else{
					//console.log(commandSplit);
					if (commandSplit[iStartVar + 2].subCommand == "["){
						const isArr = typeVars.get("array").get("isType")(commandSplit, iStartVar + 2, textDocument)
						if (isArr.iEndVar != null)
							diagnostic = typeVars.get("array").get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
						else
							diagnostic = isArr.diagnostic;
						if (diagnostic == null)
							return {actionType : actionType, iEndVar : isArr.iEndVar, diagnostic : null};
					}
					else {
						let vari : any= parseVariable(["[=var]"], iStartVar + 2, commandSplit, textDocument, diagnostics, tokens);
						if (vari.iEndVar == null)
							return vari;
						diagnostic = typeVars.get(vari.type).get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
						//console.log(listNameVar);
						if (diagnostic == null){
							return {actionType : actionType, iEndVar : vari.iEndVar, diagnostic : null};
						}
					}
				}
			}
			else if (typeStructs.has(type)){
				let resCreate = typeStructs.get(type).get("create")(commandSplit, iStartVar, textDocument);
				if (resCreate.iEnd != null)
					return {actionType : actionType, iEndVar : resCreate.iEnd, diagnostic : resCreate.diagnostic};
				diagnostic = resCreate.diagnostic;
			}
			else if (typeVars.has(type))
				diagnostic = typeVars.get(type).get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			else
				throw new Error("Unrecognized actionType " + actionType);
			if (diagnostic == null){
				return {actionType : actionType, iEndVar : iStartVar, diagnostic : null};
			}
		}
		else if (actionType.charAt(1) == "="){
			let iComma = actionType.indexOf(",");
			let type;
			if (iComma == -1)
				type = actionType.substring(2, actionType.length - 1);
			else
				type = actionType.substring(2, iComma);
			if (type == "attribute"){
				if (isNameStructOrAttributeSyntaxeCorrect(commandSplit[iStartVar].subCommand))
					return {actionType : actionType, iEndVar : iStartVar, diagnostic : null};
				diagnostic = diagnosticNameAttributeSyntaxe(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			}
			else if (type == "cmds"){
				if (commandSplit[iStartVar].subCommand != "{")
					diagnostic = diagnosticMissingCharacters(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexStart, textDocument, "{");
				else {
					let iBracket = getIBracket(commandSplit, iStartVar);
					if (iBracket == null)
						return {actionType : null, iEndVar : null, diagnostic : diagnosticMissingCharacters(commandSplit[commandSplit.length - 1].indexEnd, commandSplit[commandSplit.length - 1].indexEnd, textDocument, "}")};
					if (iBracket == iStartVar + 1)
						return {actionType : null, iEndVar : null, diagnostic : diagnosticMissingCharacters(commandSplit[iStartVar].indexEnd, commandSplit[iBracket].indexStart, textDocument, "commands")};
					parseCommand(commandSplit.slice(iStartVar + 1, iBracket), diagnostics ,textDocument, tokens);
					return {actionType : actionType, iEndVar : iBracket};
				}
			}
			else if (type == "condition"){
				let iBracket = getNextApparition(commandSplit, iStartVar, "{");
				if (iBracket == null)
					iBracket = commandSplit.length;
				let resEval = getEvalType(commandSplit.slice(0, iBracket), iStartVar, textDocument);
				if (resEval.type != null){
					if (resEval.type == "boolean")
						return {actionType : actionType, iEndVar : resEval.iEnd, diagnostic : null};
					else
						return {actionType : actionType, iEndVar : resEval.iEnd, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[resEval.iEnd].indexEnd, textDocument, "[boolean condition]")}
				}
				return {actionType : null, iEndVar : null, diagnostic : resEval.diagnostic};
			}
			else if (type == "struct"){
				let nameStruct = getNameStruct(commandSplit, iStartVar);
				if (nameStruct.name == null)
					diagnostic = diagnosticNameStructSyntaxe(commandSplit[iStartVar].indexStart, commandSplit[nameStruct.iEndStruct].indexEnd, textDocument);
				else if (nameStruct.name == "_" && selectionNotEmpty)
					return {actionType : actionType, iEndVar : nameStruct.iEndStruct, diagnostic : null};
				else if (listNameStruct.has(nameStruct.name))
					if (existStruct(nameStruct.name)){
						return {actionType : actionType, iEndVar : nameStruct.iEndStruct, diagnostic : null};
					}
					else
						return {actionType : actionType, iEndVar : nameStruct.iEndStruct, diagnostic : diagnosticStructAlreadyDeleted(nameStruct.name, commandSplit[iStartVar].indexStart, textDocument)};
				else
					if (nameStruct.iEndStruct > iStartVar)
						return {actionType : actionType, iEndVar : nameStruct.iEndStruct, diagnostic : diagnosticNameNotCreated(nameStruct.name, commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexStart, textDocument)};
					else
						diagnostic = diagnosticNameNotCreated(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument);
			}
			else if (type == "structs"){
				if (commandSplit[iStartVar].subCommand == "{"){
					let iBracket = (getIBracket(commandSplit, iStartVar));
					if (iBracket != null){
						let needName = true;
						let iEndVar = iStartVar + 1
						let parentName = "";
						if (actionType.substring(iComma + 1, actionType.length - 1) == "group"){
							parentName = getNameStructParent(String(getNameStruct(commandSplit, 3).name));
						}
						while (iEndVar < iBracket){
							if (needName){
								let isName = getNameStruct(commandSplit, iEndVar);
								if (isName.name == null)
									return {actionType : null, iEndVar : null, diagnostic : diagnosticUnexpectedCharactersExpected(commandSplit[iEndVar].indexStart, commandSplit[isName.iEndStruct].indexEnd, textDocument, "structure")}
								if (actionType.substring(iComma + 1, actionType.length - 1) == "group"){
									let completeName = parentName + "/" + isName.name;
									if (existStruct(completeName)){
										let type = lastInstance(listNameStruct,completeName).type;
										if (!strucHasCoherentParent(type, completeName))
											diagnostics.push(diagnosticStructNoParentFound(isName.name, commandSplit[iEndVar].indexStart, textDocument))
									}
									else{
										return {actionType : null, iEndVar : null, diagnostic : diagnosticNameNotCreated(isName.name, commandSplit[iEndVar].indexStart, commandSplit[isName.iEndStruct].indexStart, textDocument)};
									}
								}
								iEndVar = isName.iEndStruct;
							}
							else{
								if (commandSplit[iEndVar].subCommand != ",")
									return {actionType : null, iEndVar : null, diagnostic : diagnosticUnexpectedCharactersExpected(commandSplit[iEndVar].indexStart, commandSplit[iEndVar].indexEnd, textDocument, ",")}
							}
							needName = !needName;
							iEndVar ++;
						}
						if (actionType.substring(iComma + 1, actionType.length - 1) == "selection")
							selectionNotEmpty = true;
						if (needName)
							return {actionType : actionType, iEndVar : iEndVar, diagnostic : diagnosticMissingCharacters(commandSplit[iEndVar - 1].indexEnd, commandSplit[iEndVar].indexStart, textDocument, "structure name")}
						return {actionType : actionType, iEndVar : iEndVar, diagnostic : null};
					}
				}
			}
			else if (type == "var"){
				for (const typeVar of typeVars.get("var order")){
					let isType = typeVars.get(typeVar).get("isType")(commandSplit, iStartVar, textDocument);
					if (isType.iEndVar != null){
						return {actionType : actionType, iEndVar : isType.iEndVar, type : typeVar, diagnostic : null};
					}
				}
				diagnostic = diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "any type");
			}
			else if (type == "array"){
				let lensVector = [-1]
				let iProperty = iComma + 1
				let iComma2 = actionType.indexOf(",", iProperty);
				while(iComma2 != -1){
					lensVector.push(Number(actionType.substring(iProperty, iComma2)))
					iProperty = iComma2 + 1;
					iComma2 = actionType.indexOf(",", iProperty);
				}
				lensVector.push(Number(actionType.substring(iProperty, actionType.length - 1)));
				let isArrWLen = isArrayWLength(commandSplit, iStartVar, textDocument, lensVector)
				
				if (isArrWLen.iEndVar != null){
					return {actionType : actionType, iEndVar : isArrWLen.iEndVar, diagnostic : isArrWLen.diagnostic};
				}
				else
					diagnostic = diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, "array");
			}
			else if (typeVars.has(type)){
				let isType = typeVars.get(type).get("isType")(commandSplit, iStartVar, textDocument);
				if (isType.iEndVar != null){
					return {actionType : actionType, iEndVar : isType.iEndVar, diagnostic : null};
				}
				else
					diagnostic = isType.diagnostic;
			}
			else if (typeStructs.has(type)){
				let name = getNameStruct(commandSplit, iStartVar);
				if (name != null){
					if (typeStructs.get(type).get("exist")(name.name)){
						return {actionType : actionType, iEndVar : name.iEndStruct, diagnostic : null};
					}
					else
						diagnostic = diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[name.iEndStruct].indexEnd, textDocument, type);
				}
				else
					diagnostic = diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument, type);
			}
			else
				diagnostic = diagnosticUnexpectedCharacters(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument);
		}
		else if (actionType.charAt(1) == "-"){
			let type = actionType.substring(2, actionType.length - 1);
			if (type == "struct"){
				let isName = getNameStruct(commandSplit, iStartVar);
				if (isName.name == null)
					return {actionType : null, iEndVar : null, diagnostic : diagnosticUnexpectedExpression(commandSplit[iStartVar].indexStart, commandSplit[isName.iEndStruct].indexEnd, textDocument, "structure (except pillar and separators)")}
				diagnostic = delStruc(isName.name, commandSplit[iStartVar].indexStart, textDocument);
				if (diagnostic == null){
					return {actionType : actionType, iEndVar : isName.iEndStruct, diagnostic : null};
				}
			}
			else if (type == "separator" || type == "pillar"){
				diagnostic = delStruc(getNameStruct(commandSplit, 0).name + "/" + commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
				if (diagnostic == null){
					return {actionType : actionType, iEndVar : iStartVar, diagnostic : null};
				}
			}
			else{
				throw new Error("Unrecognized actionType"  + actionType)
			}
		}
	}
	if (typesVariablesPossible.length == 1)
		return {actionType : null, iEndVar : null, diagnostic : diagnostic};
	else
		return {actionType : null, iEndVar : null, diagnostic : diagnosticUnexpectedCharacters(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument)};
}




/**
 * Returns the index and separator of the next delimiter in the given text, starting from the given index.
 * @param currentIndex The index to start searching from.
 * @param text The text to search for delimiters in.
 * @param delimitersList The list of delimiters to search for.
 * @returns An object containing the index and separator of the next delimiter.
 */
function getNextPart(currentIndex: any, text: string, delimitersList: any) {
	//let nextCommandIndexPotential = 0;
	//let nextCommandIndex = text.length;
	//let endSeparator = "";
	
	let delimiterSet = new Set<String>();
	let delimiterLenghts = new Set<integer>();
	for (const delimiter of delimitersList){
		delimiterSet.add(delimiter);
		delimiterLenghts.add(delimiter.length)
	}

	for (let index = currentIndex; index < text.length; index ++) {
		for (const lengthDelimiter of delimiterLenghts.values()) {
			if (index + lengthDelimiter < text.length && delimiterSet.has(text.substring(index, index + lengthDelimiter))){
				return {index:index, separator:text.substring(index, index + lengthDelimiter)};
			}
		}
	}
	return {index:text.length, separator:""};
}



/**
 * Create a diagnostic to say that the name of the structure have an invalid syntaxe
 * @param name the name of the structure
 * @param indexStartStruct the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticNameStructSyntaxe(indexStartStruct : number, indexEndStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexEndStruct)
		},
		message: `This is not a valid name. You can only use letters, numbers, / and _.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the name of the structure doesn't have an existing parent.
 * @param name the name of the structure
 * @param indexStartStruct the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticStructNoParentFound(name : string, indexStartStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Warning,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The name "` + name + `" may be not valid : No valid parent found.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the name of the structure is already used
 * @param name the name of the structure
 * @param indexStartStruct the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticStructNameAlreadyUsed(name : string, indexStartStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The name "` + name + `" is already used.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the name of the variable is not correct.
 * @param name the name of the variable
 * @param indexStartVar the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticNameVarSyntaxe(name : string, indexStartVar : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartVar),
			end: textDocument.positionAt(indexStartVar + name.length)
		},
		message: `The name "` + name + `" isn't valid. You can only use letters, numbers and _.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the name is not created
 * @param name the name
 * @param indexStart the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticNameNotCreated(name : string,  indexStart : number, indexEnd : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: `The name "` + name + `" hasn't been declared before.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the name of the structure is already deleted
 * @param name the name of the structure
 * @param indexStartStruct the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticStructAlreadyDeleted(name : string,  indexStartStruct : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The struct "` + name + `" is already deleted.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the name of the variable is already deleted
 * @param name the name of the structure
 * @param indexStartStruct the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticVarAlreadyDeleted(name : string,  indexStartVar : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartVar),
			end: textDocument.positionAt(indexStartVar + name.length)
		},
		message: `The variable "` + name + `" is already deleted.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the attribute doesn't have a good syntaxe.
 * @param name the name of the attribute.
 * @param indexStartProperty the index of the beggining in the whole document of the name.
 * @param textDocument the TextDocument.
 * @returns the diagnostic
 */
function diagnosticNameAttributeSyntaxe(name : string, indexStartProperty : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartProperty),
			end: textDocument.positionAt(indexStartProperty + name.length)
		},
		message: `The name "` + name + `" isn't valid. You can only use letters, numbers and /.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that some spaces are unexpected.
 * @param indexStart the start of the blanks characters in the document.
 * @param indexEnd the end of the blanks characteres in the document.
 * @param textDocument the TextDocument.
 * @returns the diagnostic
 */
function diagnosticUnexpectedSpace(indexStart : number, indexEnd : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: `Theses spaces are unexpected`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that a space is expected.
 * @param indexStart the starting index in the document.
 * @param indexEnd the ending index in the document.
 * @param textDocument the TextDocument.
 * @returns the diagnostic
 */
function diagnosticExpectedSpace(indexStart : number, indexEnd : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: `A space is missing`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the characters betweens indexStart and indexEnd are unexpected, and that stringExpected was expected.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @param stringExpected the string expected.
 * @returns the diagnostic.
 */
function diagnosticUnexpectedCharactersExpected(indexStart: number, indexEnd: number,textDocument:TextDocument, stringExpected :string){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Unexpected Characters : " + stringExpected + " expected",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the characters betweens indexStart and indexEnd are unexpected.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @returns the diagnostic.
 */
function diagnosticUnexpectedCharacters(indexStart: number, indexEnd: number,textDocument:TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Unexpected Characters",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that an expression of type typeExpected was expected.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @param typeExpected the type expected
 * @returns the diagnostic.
 */
function diagnosticUnexpectedExpression(indexStart: number, indexEnd: number,textDocument:TextDocument, typeExpected :string){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Unexpected expression : expression of type " + typeExpected + " expected",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the expression is unrecognized.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @returns the diagnostic.
 */
function diagnosticUnrecognisedExpression(indexStart: number, indexEnd: number,textDocument:TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Unrecognised expression",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnosticto say that a quoted String is not closed.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @returns the diagnostic.
 */
function diagnosticQuotedStringUnfinished(indexStart: number, indexEnd: number,textDocument:TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "A \" is openned, but it's never closed ",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the elements of the array should be numbers.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @returns the diagnostic.
 */
function diagnosticArrayElements(indexStart : number, indexEnd : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Array elements should be a number",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the indexs of an array should be integers.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @returns the diagnostic.
 */
function diagnosticIndexArray(indexStart : number, indexEnd : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Array index should be an integer",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that some characters are missing.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @param stringExpected the string expected
 * @returns the diagnostic.
 */
function diagnosticMissingCharacters(indexStart: number, indexEnd: number,textDocument:TextDocument, stringExpected :string){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Missing " + stringExpected,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say we can't put an eval in an eval.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @returns the diagnostic.
 */
function diagnosticEvalInEval(indexStart: number, indexEnd: number,textDocument:TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "You can't put an eval in an eval",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Create a diagnostic to say that the len of the array didn't correspond to a possible length.
 * @param indexStart the starting index of the unexpected characters.
 * @param indexEnd the ending index of the unexpected characters.
 * @param textDocument the TextDocument.
 * @param lensArray the lengths possibles.
 * @returns the diagnostic.
 */
function diagnosticLenArray(indexStart: number, indexEnd: number,textDocument:TextDocument, lensArray : number[]){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexEnd)
		},
		message: "Wrong length for this argument. Lenghts expected : " + lensArray,
		source: 'Ogree_parser'
	};
	return diagnostic;
}