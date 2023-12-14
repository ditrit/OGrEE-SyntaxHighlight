
import {
	Diagnostic,
	DiagnosticSeverity,
	integer
} from 'vscode-languageserver/node';

import { encodeTokenType, encodeTokenModifiers } from './semanticTokens.js'

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { ALL } from 'dns';
import { addAbortSignal } from 'stream';
import { text } from 'stream/consumers';

const commandSeparators = ["\r\n", "//"];

const signCommand = new Set(["+", "-", "=", "@", ";", "{", "}", "(", ")", "\"", ":", "."]);

const blankChar = new Set([" ", "\\", "\n", "\t", "\r"]);

let isLinked : number = 42;

const commandsTest = getCommandsTest();

const typeVars = getTypeVars();

type variableInfos = {
	type: string;
	indexStart: number;
	indexEnd: number | null;
}

var listNameVar = new Map<string, variableInfos[]>();

const typeStructs = getTypeStruct();

var listNameStruct = new Map<string, variableInfos[]>();

/**
 * Test is the structure can be created and record the name of the structure.
 * @param type the type of structure
 * @param name the name of the structure
 * @param indexStartStruct the starting index in the whole document of the name
 * @param textDocument the TextDocument
 * @returns A diagnostic if it's not possible to create the structure, and null if not.
 */
function createStruc(type : string, name : string, indexStartStruct : number, textDocument : TextDocument){
	if (!isNameStructSyntaxeCorrect(name))
		return diagnosticNameStructSyntaxe(name, indexStartStruct, textDocument);
	if (!strucHasCoherentParent(type, name))
		return diagnosticStructNoParent(name, indexStartStruct, textDocument);
	
	if (!listNameStruct.has(name)){
		listNameStruct.set(name, [createMapInstance(type, indexStartStruct)]);
		return null;
	}
	else{
		if (!lastInstance(listNameStruct, name).indexEnd)
			return diagnosticStructNameAlreadyUsed(name, indexStartStruct, textDocument);

		listNameStruct.get(name)?.push(createMapInstance(type, indexStartStruct));
		return null;
	}
}

/**
 * Tests if the name is syntactically correct for a structure
 * @param name The name of the structure
 * @returns boolean : true if it is syntactically correct, false otherwise
 */
function isNameStructSyntaxeCorrect(name : string){
	let slashBefore = true;
	for (let iChar = 0; iChar < name.length; iChar ++){
		const codeChar = name.charCodeAt(iChar);
		if (name.charAt(iChar) == "/")
			if (slashBefore)
				return false;
			else
				slashBefore = true;
		else
			if (slashBefore){
				if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0)))|| name.charAt(iChar) == "_"))
					return false;
				slashBefore = false;
			}
			else
				if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0))) || (("0".charCodeAt(0) <= codeChar) && (codeChar <= "9".charCodeAt(0))) || name.charAt(iChar) == "/" || name.charAt(iChar) == "_"))
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


//To Do
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
		return diagnosticNameNotCreated(name, indexEndVar, textDocument);
	}
}

function existVar(name : string){
	return listNameVar.has(name) && !lastInstance(listNameVar, name).indexEnd;
}

function existVarType(type : string, name : string){
	return existVar(name) && lastInstance(listNameVar, name).type == type;
}

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
		return diagnosticNameNotCreated(name, indexEndStruct, textDocument);
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

function lastInstance(listName : Map<string, any>, name : string){
	return listName.get(name)[listName.get(name).length - 1];
}


/**
 * Tests if the structure name of type type exist (i.e. is created and not deleted).
 * @param type the type of the structure.
 * @param name the name of the structure.
 * @returns boolean : true if the name exist with the type type, false otherwise.
 */
function existStrucType(type : string, name : string){
	return existStruct(name) && lastInstance(listNameStruct, name).type == type;
}

function existStruct(name : string){
	return listNameStruct.has(name) && !lastInstance(listNameStruct, name).indexEnd;
}

//Implementation of the function +site:[name]@[color]
function getCommandsTest(){
	let c0 = new Map<any, any>();
	let c1 = new Map<any, any>();
	let c2 = new Map<any, any>();
	let c3 = new Map<any, any>();
	let c4 = new Map<any, any>();
	let c2bis = new Map<any, any>();
	let c3bis = new Map<any, any>();
	let c10 = new Map<any, any>();
	let c100 = new Map<any, any>();
	let c101 = new Map<any, any>();
	let c102 = new Map<any, any>();
	let c103 = new Map<any, any>();
	let c200 = new Map<any, any>();
	let c201 = new Map<any, any>();
	let c202 = new Map<any, any>();
	c4.set(";", c0);
	c4.set(null, true);
	c4.set(isLinked, false);
	c3.set("[+site]", c4); //We put a + because it create a variable of type site with this name : it create the name
	c3.set(isLinked, false);
	c2.set(":", c3);
	c2.set(isLinked, false);
	c1.set("site", c2);
	c1.set("si", c2);
	c3bis.set("[+building]", c4)
	c3bis.set(isLinked, false);
	c2bis.set(":", c3bis);
	c2bis.set(isLinked, false);
	c1.set("building", c2bis)
	c1.set(isLinked, false);
	c0.set("+", c1);
	c10.set("[-struct]", c4);
	c10.set(isLinked, false);
	c0.set("-", c10);
	c103.set("[=string]", c4);
	c102.set("=", c103);
	c102.set(isLinked, false);
	c101.set("[property]", c102);
	c101.set(isLinked, false);
	c100.set(":", c101);
	c100.set(isLinked, false);
	c0.set("[=struct]", c100);
	c202.set("[+string]", c4);
	c202.set(isLinked, false);
	c201.set(":", c202);
	c201.set(isLinked, true);
	c200.set("var", c201);
	c200.set(isLinked, true);
	c0.set(".", c200);
	c0.set(null, true);
	c0.set(isLinked, false);//Used to know is this block need to be just after the previous one. false for not needed, true for needed
	return c0;
}

//Implementation of typeStruct to test the parser
function getTypeStruct(){
	let types = new Map<string, any>();
	let site = new Map<string, any>();
	site.set("parents", []);
	site.set("create", (name : string, indexStartStruct : number, textDocument : TextDocument) => createStruc("site", name, indexStartStruct, textDocument));
	site.set("exist", (name : string) => existStrucType("site", name));
	types.set("site", site);
	let building = new Map<string, any>();
	building.set("parents", ["site"]);
	building.set("create", (name : string, indexStartStruct : number, textDocument : TextDocument) => createStruc("building", name, indexStartStruct, textDocument))
	building.set("exist", (name : string) => existStrucType("building", name));
	types.set("building", building);
	return types;
}

//Implementation of typeVars
function getTypeVars(){
	let types = new Map<string, any>();
	let string = new Map<string, any>();
	string.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("string", name, indexStartVar, textDocument))
	string.set("exist", (name : string) => existVarType("string", name));
	string.set("isType", isString);
	types.set("string", string);
	let number = new Map<string, any>();
	number.set("create", (name : string, indexStartVar : number, textDocument : TextDocument) => createVar("string", name, indexStartVar, textDocument));
	number.set("exist", (name : string) => existVarType("string", name));
	types.set("number", number);
	return types;
}

function isPathCmd(commandSplit : any, iStartVar : number){
	if (iStartVar + 3 < commandSplit.length)
		return commandSplit[iStartVar].subCommand == "$" && commandSplit[iStartVar + 1].subCommand == "(" && commandSplit[iStartVar + 2].subCommand == "pwd" && commandSplit[iStartVar + 3].subCommand == ")";
}

function isString(commandSplit : any, iStartVar : number, textDocument : TextDocument){
	if (commandSplit[iStartVar].subCommand.charAt(0) == "\""){
		let iEndVar = iStartVar + 1;
		while (iEndVar < commandSplit.length && commandSplit[iEndVar].subCommand.charAt(0) != "\""){
			if (commandSplit[iEndVar].subCommand.charAt(0) == "$")
				if (!(isPathCmd(commandSplit, iEndVar) || existVar(commandSplit[iEndVar].subCommand.substring(1))))
					return {iEndVar : null, diagnostic : diagnosticNameNotCreated(commandSplit[iEndVar].subCommand.substring(1), commandSplit[iEndVar].indexStart, textDocument)}
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
			iEndVar ++;
		}
		iEndVar --;
		return {iEndVar : iEndVar, diagnostic : null};
	}
}

export function getVariables(){
	return [];
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
			if (cursorPosition >= variableInfo.indexStart && ((variableInfo.indexEnd && cursorPosition <= variableInfo.indexEnd) || !variableInfo.indexEnd)) {
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
 * 
 * @param textDocument The text document to parse.
 * @returns An array of diagnostics.
 */
export function parseDocument(textDocument: TextDocument) {
	listNameVar = new Map<string, any>();
	listNameStruct = new Map<string, any>();
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
		while (isNewLineSeparator(endSeparator) && nextCommandTrim != "" && nextCommandTrim.charAt(nextCommandTrim.length - 1) == "\\" ){
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
				//diagnostics.push(parseComment(currentIndex, nextCommandIndex, textDocument));
				tokens.push(addSemanticToken(textDocument, currentIndex - 2, nextCommandIndex, "comment", [], true))
			} else {
				parseCommand(currentIndex, nextCommandIndex, nextCommand, diagnostics, textDocument, tokens);
				/*if (!commandFound) {
					diagnostics.push(parseUnrecognizedCommand(currentIndex, nextCommandIndex, nextCommand, textDocument));
					tokens.push(addSemanticToken(textDocument, currentIndex - 2, nextCommandIndex, "unknown", [], true))
				}*/
			}
		}

		currentIndex = nextCommandIndex+endSeparator.length;
	}
	return [diagnostics, tokens];
}

function isNewLineSeparator(separator : string){
	return separator == "\n" || separator == "\r\n";
}

function addSemanticToken(textDocument : TextDocument, startIndex : integer, endIndex : integer, tokenType : string, tokenModifiers : string[], genericToken = false){
	console.log("Semantic token recieved : " + startIndex + " " + endIndex + " " + tokenType + " " + tokenModifiers + " " + genericToken)
	return {line : textDocument.positionAt(startIndex).line, char : textDocument.positionAt(startIndex).character, length : endIndex - startIndex, tokenType : encodeTokenType(tokenType, genericToken), tokenModifiers : encodeTokenModifiers([])}
}

/**
 * Parses a comment and returns a diagnostic object.
 * @param currentIndex The index of the current character.
 * @param nextCommandIndex The index of the next command.
 * @param textDocument The text document to parse.
 * @returns A diagnostic object.
 */
function parseComment(currentIndex: number, nextCommandIndex: number, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: {
			start: textDocument.positionAt(currentIndex-2),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: `this is a comment`,
		source: 'Ogree_parser'
	};
	return diagnostic;
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
function parseCommand(currentIndex: number, endCommandIndex: number, command: string, diagnostics: Diagnostic[], textDocument: TextDocument, tokens : any[]): boolean {
	let commandSplit = splitCommand(currentIndex, command);
	let iSubCommand = 0;
	let isCommand = true;
	let thereIsAPlusOrMinus = false;
	let curDicCommand = commandsTest; //List of commands (It is imbricated dictionnary, see the function getCommandsTest to get an example)
	while (isCommand && iSubCommand < commandSplit.length){
		if (curDicCommand.get(isLinked)){
			if (commandSplit[iSubCommand - 1].indexEnd != commandSplit[iSubCommand].indexStart){
				diagnostics.push(diagnosticUnexpectedSpace(commandSplit[iSubCommand - 1].indexEnd, commandSplit[iSubCommand].indexStart, textDocument));
				return false;
			}
		}
		if (curDicCommand.has(commandSplit[iSubCommand].subCommand)){
			if (commandSplit[iSubCommand].subCommand == "+" || commandSplit[iSubCommand].subCommand == "-"){
				thereIsAPlusOrMinus = true;}
			if (commandSplit[iSubCommand].subCommand==":" && thereIsAPlusOrMinus){
				tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand-1].indexStart, commandSplit[iSubCommand-1].indexEnd, commandSplit[iSubCommand - 1].subCommand, []));
				thereIsAPlusOrMinus = false;
			}
			curDicCommand = curDicCommand.get(commandSplit[iSubCommand].subCommand)
		}
		else{
			let typesVariablesPossible = [];
			let arrayKeys = Array.from(curDicCommand.keys())
			if (arrayKeys.length == 0){
				diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand].indexStart, commandSplit[commandSplit.length - 1].indexEnd, textDocument))
			}
			else{
				if (arrayKeys != null){
					for (const subCommand of arrayKeys)
						if (subCommand != null && subCommand != isLinked && subCommand.charAt(0) == "[")
							typesVariablesPossible.push(subCommand);
					
					if (typesVariablesPossible.length > 0){
						const vari = parseVariable(typesVariablesPossible, iSubCommand, commandSplit, diagnostics, textDocument);
						if (vari != null){
							let variableType = vari.actionType.match(/\[[+-=]?(\w+)\]/)![1];
							tokens.push(addSemanticToken(textDocument, commandSplit[iSubCommand].indexStart, commandSplit[iSubCommand].indexEnd, variableType, []))
							curDicCommand = curDicCommand.get(vari.actionType);
							iSubCommand = vari.iEndVar;
						} else
							return false;
					}
					else{
						isCommand = false
						if (arrayKeys.length == 1)
							diagnostics.push(diagnosticUnexpectedCharactersExpected(commandSplit[iSubCommand].indexStart, commandSplit[iSubCommand].indexEnd, textDocument, arrayKeys[0]));
						else
							diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand].indexStart, commandSplit[iSubCommand].indexEnd, textDocument));
					}
				}
			}
		}
		
		iSubCommand ++;
	}
	
	if (!isCommand)
		return false;

	if (!curDicCommand.get(null)){
		if (Array.from(curDicCommand.keys()).length == 2)
			diagnostics.push(diagnosticUnexpectedCharactersExpected(commandSplit[iSubCommand - 1].indexEnd, commandSplit[iSubCommand - 1].indexEnd, textDocument, Array.from(curDicCommand.keys())[0]));
		else
			if (iSubCommand > 0)
				diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand - 1].indexEnd, commandSplit[iSubCommand - 1].indexEnd, textDocument));
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
function splitCommand(currentIndex: number, command : string) {
	let commandSplit = [];
	let indexStart = 0;
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
function parseVariable(typesVariablesPossible : string[], iStartVar : number, commandSplit : any, diagnostics : Diagnostic[], textDocument : TextDocument){
	let diagnostic;
	for (const actionType of typesVariablesPossible){
		if (actionType == "[property]"){
			if (isNameProperty(commandSplit[iStartVar].subCommand))
				return {actionType : actionType, iEndVar : iStartVar};
			diagnostic = diagnosticNamePropertySyntaxe(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
		}
		else if (actionType.charAt(1) == "+"){
			let type = actionType.substring(2, actionType.length - 1);
			if (typeStructs.has(type))
				diagnostic = typeStructs.get(type).get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			else if (typeVars.has(type))
				diagnostic = typeVars.get(type).get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			else
				throw new Error("Unrecognized actionType " + actionType);
			if (diagnostic == null){
				//token.push...
				return {actionType : actionType, iEndVar : iStartVar};
			}
		}
		else if (actionType.charAt(1) == "="){
			let type = actionType.substring(2, actionType.length - 1);
			if (type == "struct"){
				if (listNameStruct.has(commandSplit[iStartVar].subCommand))
					if (existStruct(commandSplit[iStartVar].subCommand)){
						//token.push...
						return {actionType : actionType, iEndVar : iStartVar};
					}
					else
						diagnostic = diagnosticStructAlreadyDeleted(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
				else
					diagnostic = diagnosticNameNotCreated(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			}
			else if (typeVars.has(type)){
				let isType = typeVars.get(type).get("isType")(commandSplit, iStartVar, textDocument);
				if (isType.iEndVar != null){
					//token.push...
					return {actionType : actionType, iEndVar : isType.iEndVar};
				}
				else
					diagnostic = isType.diagnostic;
			}
			else
				diagnostic = diagnosticUnexpectedCharacters(commandSplit[iStartVar].indexStart, commandSplit[iStartVar].indexEnd, textDocument);
			/*
			else if (type == "var"){
				for (const type of typeVars.keys()){
					if (type != "string"){

					}
				}
				const vari = typeVars.get("string").get("isType")(commandSplit, iStartVar);
				if (vari != null){
					
				}
			}*/
		}
		else if (actionType.charAt(1) == "-"){
			let type = actionType.substring(2, actionType.length - 1);
			if (type == "struct"){
				diagnostic = delStruc(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
				if (diagnostic == null){
					//token.push...
					return {actionType : actionType, iEndVar : iStartVar};
				}
			}
			else{
				throw new Error("Unrecognized actionType"  + actionType)
			}
		}
	}
	if (typesVariablesPossible.length == 1)
		diagnostics.push(diagnostic);
	else
		diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument))
	return null;
}


/**
 * Tests if the name name is valid to be a property of a structure.
 * @param name the name of the property.
 * @returns boolean : true is the name is valid, false otherwise.
 */
function isNameProperty(name : string){
	for (let iChar = 0; iChar < name.length; iChar ++){
		const codeChar = name.charCodeAt(iChar);
		if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0)))|| name.charAt(iChar) == "_"))
			return false;
	}
	return true;
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
function diagnosticNameStructSyntaxe(name : string, indexStartStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The name "` + name + `" isn't valid. You can only use letters, numbers, / and _.`,
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
function diagnosticStructNoParent(name : string, indexStartStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The name "` + name + `" isn't valid, Because he doesn't have a parent.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

function diagnosticNameVarSyntaxe(name : string, indexStartStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The name "` + name + `" isn't valid. You can only use letters, numbers and _.`,
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
 * Create a diagnostic to say that the name is not created
 * @param name the name
 * @param indexStart the index of the beginning of the name in the whole document
 * @param textDocument the TextDocument
 * @returns the diagnostic
 */
function diagnosticNameNotCreated(name : string,  indexStart : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStart),
			end: textDocument.positionAt(indexStart + name.length)
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
 * Create a diagnostic to say that the property doesn't have a good syntaxe.
 * @param name the name of the property.
 * @param indexStartProperty the index of the beggining in the whole document of the name.
 * @param textDocument the TextDocument.
 * @returns the diagnostic
 */
function diagnosticNamePropertySyntaxe(name : string, indexStartProperty : number, textDocument : TextDocument){
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

function diagnosticUnrecognizedExpression(indexStart: number, indexEnd: number,textDocument:TextDocument, typeExpected :string){
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