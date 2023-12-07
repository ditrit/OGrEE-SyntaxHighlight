
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

const commandSeparators = ["\n", "//"];
// TOO : add config file
const commandList = ["+tenant:[+name]@[=color]"];

const signCommand = new Set(["+", "-", "=", "@", ";", "{", "}", "(", ")", "\""]);

const blankChar = new Set([" ", "\\", "\n", "\t", "\"", "\r"]);

const commandsTest = getCommandsTest();

const typeVars = getTypeVars();

var listNameVar = new Map<string, any>();

const typeStruct = getTypeStruct();

var listNameStruc = new Map<string, any>();

var variableNames: string[] = [];

function createStruc(type : string, name : string, indexStartStruct : number, textDocument : TextDocument){
	if (!isNameStructSyntaxeCorrect(type, name))
		return diagnosticNameStructSyntaxe(name, indexStartStruct, textDocument);
	if (!strucHasCoherentParent(type, name))
		return diagnosticStructNoParent(name, indexStartStruct, textDocument);
	
	if (!listNameStruc.has(name)){
		typeStruct.get(type).get("structs").set(name, [createMapIndexStart(indexStartStruct)]);
		listNameStruc.set(name, new Set<string>([type]));
		return null;
	}
	else{
		
		for (const typeStr of listNameStruc.get(name).keys())
			for (const instanceStruct of typeStruct.get(typeStr).get("structs").get(name))
				if (!instanceStruct.has("indexEndStruct"))
					return diagnosticStructNameAlreadyUsed(name, indexStartStruct, textDocument);
		
		if (typeStruct.get(type).get("structs").has(name))
			typeStruct.get(type).get("structs").get(name).push(createMapIndexStart(indexStartStruct));
		else{
			typeStruct.get(type).get("structs").set(name, [createMapIndexStart(indexStartStruct)]);
			listNameStruc.get(name).add(type);
		}
		return null;
	}
}

function isNameStructSyntaxeCorrect(type : string, name : string){
	let slashBefore = false;
	for (let iChar = 0; iChar < name.length; iChar ++){
		const codeChar = name.charCodeAt(iChar);
		if (!((("a".charCodeAt(0) <= codeChar) && (codeChar <= "z".charCodeAt(0))) || (("A".charCodeAt(0) <= codeChar) && (codeChar <= "Z".charCodeAt(0))) || (("0".charCodeAt(0) <= codeChar) && (codeChar <= "9".charCodeAt(0))) || name.charAt(iChar) == "/"))
			return false;
		if (name.charAt(iChar) == "/")
			if (slashBefore)
				return false;
			else
				slashBefore = true;
		else
			slashBefore = false;
		
		iChar ++;
	}
	return true;
}

function strucHasCoherentParent(type : string, name : string){
	let nameParent = getNameStructParent(name);
	if (typeStruct.get(type).get("parents").length == 0 && nameParent == "")
		return true;
	if (typeStruct.get(type).get("parents").length == 0 && nameParent != "")
		return false;
	if (typeStruct.get(type).get("parents").length != 0 && nameParent == "")
		return false;
	for (const typeParent of typeStruct.get(type).get("parents")){
		if (listNameStruc.get(nameParent).has(typeParent))
			for (const instanceParent of typeStruct.get(typeParent).get("structs").get(nameParent))
				if (!instanceParent.has("indexEndStruct"))
					return true;
	}
	return false;
}

function getNameStructParent(name : string){
	let indexEnd = name.length - 1;
	while (indexEnd > 0 && name.charAt(indexEnd) != "/")
		indexEnd --;
	return name.substring(0, indexEnd);
}

function diagnosticNameStructSyntaxe(name : string, indexStartStruct : number, textDocument : TextDocument){
	let diagnostic : Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartStruct),
			end: textDocument.positionAt(indexStartStruct + name.length)
		},
		message: `The name "` + name + `" isn't valid. You can only use letters, numbers and /.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

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

function createVar(type : string, name : string, indexStartVar : number, textDocument : TextDocument){
	if (!listNameVar.has(name)){
		typeVars.get(type).get("vars").set(name, [createMapIndexStart(indexStartVar)]);
		listNameVar.set(name, new Set<string>([type]));
		return null;
	}
	else
	{
		for (const typeVarExist of listNameVar.get(name)){
			for (const instanceVar of typeVars.get(typeVarExist).get("vars").get(name)){
				if (!instanceVar.has("indexEndVar")){
					return diagnosticVarAlreadyCreatedType(type, name, indexStartVar, textDocument);
				}
			}
		}
		if (!typeVars.get(type).get("vars").has(name)){
			typeVars.get(type).get("vars").set(name, [createMapIndexStart(indexStartVar)]);
			listNameVar.get(name).set(type);
		}
		else{
			typeVars.get(type).get("vars").get(name).push(createMapIndexStart(indexStartVar));
		}
		return null;
	}
}

function createMapIndexStart(indexStartVar : number){
	let descr = new Map<string, any>();
	descr.set("indexStartVar", indexStartVar);
	return descr;
}

function diagnosticVarAlreadyCreatedType(type : string, name : string,  indexStartVar : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartVar),
			end: textDocument.positionAt(indexStartVar + name.length)
		},
		message: `The name "` + name + `" is already used with a type ` + type + ` so it can't be used for creating a new object.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

function diagnosticVarAlreadyCreated(name : string,  indexStartVar : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartVar),
			end: textDocument.positionAt(indexStartVar + name.length)
		},
		message: `The name "` + name + `" is already used so it can't be used for creating a new object.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

function delStruc(type : string, name : string, indexEndStruct : number, textDocument : TextDocument){
	if (typeStruct.get(type).get("structs").has(name))
		if (!typeStruct.get(type).get("structs").get(name)[typeStruct.get(type).get("structs").get(name).length - 1].has("indexEndStruct")){
			typeStruct.get(type).get("structs").get(name)[typeStruct.get(type).get("structs").get(name).length - 1].set("indexEndStruct", indexEndStruct)
			return null;
		}
		else{
			return diagnosticStructAlreadyDeleted(name, indexEndStruct, textDocument);
		}
	else
		return diagnosticNameNotCreated(name, indexEndStruct, textDocument);
}

function diagnosticNameNotCreated(name : string,  indexStartVar : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartVar),
			end: textDocument.positionAt(indexStartVar + name.length)
		},
		message: `The name "` + name + `" hasn't been declared before.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

function diagnosticStructAlreadyDeleted(name : string,  indexStartVar : number, textDocument : TextDocument){
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(indexStartVar),
			end: textDocument.positionAt(indexStartVar + name.length)
		},
		message: `The struct "` + name + `" is already deleted.`,
		source: 'Ogree_parser'
	};
	return diagnostic;
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
	let c4bis = new Map<any, any>();
	let c10 = new Map<any, any>();
	let c11 = new Map<any, any>();
	c4.set(null, true);
	c3.set("[+site]", c4); //We put a + because it create a variable of type site with this name : it create the name
	c2.set(":", c3);
	c1.set("site:", c3);
	c1.set("site", c2);
	/*c4bis.set(null, true);
	c3bis.set("[+building]", c4bis)
	c2bis.set(":", c3bis);
	c1.set("building", c2bis)
	c1.set("building:", c3bis)*/
	c0.set("+", c1);
	c11.set(null, true);
	c10.set("[-name]", c11);
	c0.set("-", c10);
	return c0;
}

function getTypeStruct(){
	let types = new Map<string, any>();
	let site = new Map<string, any>();
	site.set("structs", new Map<string, any>());
	site.set("parents", []);
	site.set("create", (name : string, indexStartStruct : number, textDocument : TextDocument) => createStruc("site", name, indexStartStruct, textDocument));
	//site.set("exist", (name : string) => existStruc("site", name));
	site.set("del", (name : string, indexEndStruct : number, textDocument : TextDocument) => delStruc("site", name, indexEndStruct, textDocument));
	types.set("site", site);
	/*let building = new Map<string, any>();
	building.set("structs", new Map<string, any>());
	building.set("parents", ["site"]);
	building.set("create", (name : string, indexStartStruct : number, textDocument : TextDocument) => createStruc("building", name, indexStartStruct, textDocument))
	//building.set("exist", (name : string) => existStruc("building", name));
	building.set("del", (name : string, indexEndStruct : number, textDocument : TextDocument) => delStruc("building", name, indexEndStruct, textDocument));
	types.set("building", building);*/
	return types;
}

function getTypeVars(){
	return new Map<string, any>();
}

export function getVariables() {
	return variableNames;
}

/**
 * Parses a text document and returns an array of diagnostics.
 * 
 * @param textDocument The text document to parse.
 * @param settings The settings to use for parsing.
 * @returns An array of diagnostics.
 */
export function parseDocument(textDocument: TextDocument) {
	listNameVar = new Map<string, any>();
	listNameStruc = new Map<string, any>();
	variableNames = [];
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
		while (endSeparator == "\n" && nextCommandTrim != "" && nextCommandTrim.charAt(nextCommandTrim.length - 1) == "\\" ){
			nextPart = getNextPart(nextCommandIndex + endSeparator.length, text, commandSeparators);
			nextCommand += text.substring(nextCommandIndex, nextPart.index);
			nextCommandTrim = nextCommand.trimEnd();
			nextCommandIndex = nextPart.index;
			endSeparator = nextPart.separator;
		}

		//Place currentIndex to the beginning of the command, i.e. without taking into account whiteSpaces before the beginning of the command
		if (startSeparator == "\n") {
			const commandLength = nextCommand.length;
			nextCommand = nextCommand.trimStart();
			currentIndex += commandLength - nextCommand.length;
		}
		
		if (nextCommand != "") {
			if (startSeparator == "//") {
				//diagnostics.push(parseComment(currentIndex, nextCommandIndex, textDocument));
				tokens.push(addSemanticToken(textDocument, currentIndex - 2, nextCommandIndex, "comment", [], true))
			} else {
				const commandFound = parseCommand2(currentIndex, nextCommandIndex, nextCommand, text, diagnostics, textDocument);
				if (!commandFound) {
					diagnostics.push(parseUnrecognizedCommand(currentIndex, nextCommandIndex, nextCommand, textDocument));
					tokens.push(addSemanticToken(textDocument, currentIndex - 2, nextCommandIndex, "unknown", [], true))
				}
			}
		}

		currentIndex = nextCommandIndex+endSeparator.length;
	}
	return [diagnostics, tokens];
}

function addSemanticToken(textDocument : TextDocument, startIndex : integer, endIndex : integer, tokenType : string, tokenModifiers : string[], genericToken = false){
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

function parseCommand2(currentIndex: number, endCommandIndex: number, command: string, text: string, diagnostics: Diagnostic[], textDocument: TextDocument): boolean {
	let commandSplit = splitCommand(currentIndex, command);
	let iSubCommand = 0;
	let isCommand = true;
	let curDicCommand = commandsTest; //List of commands (It is imbricated dictionnary, see the function getCommandsTest to get an example)
	while (isCommand && iSubCommand < commandSplit.length){
		if (curDicCommand.has(commandSplit[iSubCommand].subCommand)){
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
						if (subCommand != null && subCommand.charAt(0) == "[")
							typesVariablesPossible.push(subCommand);
					
					if (typesVariablesPossible.length > 0){
						const typeCorrespondant = parseVariable2(typesVariablesPossible, iSubCommand, commandSplit, diagnostics, textDocument);
						if (typeCorrespondant != null){
							curDicCommand = curDicCommand.get(typeCorrespondant);
						} else
							return true;
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
		return true;

	if (!curDicCommand.get(null))
		if (Array.from(curDicCommand.keys()).length == 1)
			diagnostics.push(diagnosticUnexpectedCharactersExpected(commandSplit[iSubCommand - 1].indexEnd, commandSplit[iSubCommand - 1].indexEnd, textDocument, Array.from(curDicCommand.keys())[0]));
		else
			diagnostics.push(diagnosticUnexpectedCharacters(commandSplit[iSubCommand - 1].indexEnd, commandSplit[iSubCommand - 1].indexEnd, textDocument));
	
	return true;
}

function splitCommand(currentIndex: number, command : string) {
	let commandSplit = [];
	let indexStart = 0;
	while (indexStart < command.length){
		if (blankChar.has(command.charAt(indexStart)))
			indexStart += 1
		else {
			let indexEnd = indexStart + 1;
			if (!signCommand.has(command.charAt(indexStart))){
				while (indexEnd < command.length && !signCommand.has(command.charAt(indexEnd)) && (command.charAt(indexEnd) != "$") && (!blankChar.has(command.charAt(indexEnd))) && (command.charAt(indexEnd-1) != ":"))
					indexEnd ++;

			}
			commandSplit.push({subCommand:command.substring(indexStart, indexEnd), indexStart : currentIndex + indexStart, indexEnd : currentIndex + indexEnd})
			indexStart = indexEnd;
		}
	}
	return commandSplit;
}

function parseVariable2(typesVariablesPossible : string[], iStartVar : number, commandSplit : any, diagnostics : Diagnostic[], textDocument : TextDocument){
	let diagnostic;
	for (const actionType of typesVariablesPossible){
		if (actionType.substring(1,3) == "+="){

		}
		else if (actionType.charAt(1) == "+"){
			let type = actionType.substring(2, actionType.length - 1);
			diagnostic = typeStruct.get(type).get("create")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			if (diagnostic == null)
				return actionType;
		}
		else if (actionType.charAt(1) == "="){
			return actionType;
		}
		else if (actionType.charAt(1) == "-"){
			if (listNameStruc.has(commandSplit[iStartVar].subCommand)){
				for (const instanceStruct of listNameStruc.get(commandSplit[iStartVar].subCommand)){
					diagnostic = typeStruct.get(instanceStruct).get("del")(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument)
					if (diagnostic == null)
						return actionType;
					}
			}
			else if (listNameVar.has(commandSplit[iStartVar].subCommand)){

			}
			else{
				diagnostic = diagnosticNameNotCreated(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument);
			}
		}
	}
	if (typesVariablesPossible.length == 1)
		diagnostics.push(diagnostic);
	else
		diagnostics.push(diagnosticVarAlreadyCreated(commandSplit[iStartVar].subCommand, commandSplit[iStartVar].indexStart, textDocument))
	return null;
}

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
 * Parses a command from a given text and returns whether a command was found or not.
 * @param currentIndex The current index in the text.
 * @param nextCommandIndex The index of the next command in the text.
 * @param nextCommand The next command to parse.
 * @param text The text to parse.
 * @param diagnostics An array of diagnostics to add any errors or warnings found during parsing.
 * @param textDocument The text document to parse.
 * @returns Whether a command was found or not.
 */
function parseCommand(currentIndex: number, nextCommandIndex: number, nextCommand: string, text: string, diagnostics: Diagnostic[], textDocument: TextDocument): boolean {
	console.log("command", text)
	console.log("nextCommand", nextCommand)
	for (let command of commandList) {
		if (nextCommand.indexOf(command.substring(0,command.indexOf("["))) == 0) {
			diagnostics.push(parseFoundCommand(currentIndex, nextCommandIndex, textDocument));
			let commandSubEndSeparator = "]";
			let commandSubStartSeparator = "]";
			let currentSubCommandIndex = 0;
			let foundVariable = false;

			while (currentSubCommandIndex < command.length && !foundVariable) {
				commandSubStartSeparator = commandSubEndSeparator;
				let nextSubCommandIndex = getNextPart(currentSubCommandIndex, command, ["[", "]"]).index;
				commandSubEndSeparator = getNextPart(currentSubCommandIndex, command, ["[", "]"]).separator;

				if (commandSubEndSeparator == "]") {
					const variableEndDelimiterIndex = getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).index;
					const variableEndDelimiter = command.substring(nextSubCommandIndex+commandSubEndSeparator.length, variableEndDelimiterIndex);
					const variableEndPosition = text.indexOf(variableEndDelimiter, currentIndex);
					const varType = command.substring(currentSubCommandIndex, currentSubCommandIndex+1)

					if (variableEndDelimiter == "") {
						diagnostics.push(parseVariable(varType, currentIndex, nextCommandIndex, text, textDocument));
						foundVariable = true;
						break;
					}

					diagnostics.push(parseVariable(varType, currentIndex, variableEndPosition, text, textDocument));
					currentIndex = variableEndPosition + (variableEndDelimiterIndex - nextSubCommandIndex)-1;
					currentSubCommandIndex = variableEndDelimiterIndex + getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).separator.length;
					continue;
				}
				if (commandSubEndSeparator == "[") {
					currentIndex += nextSubCommandIndex - currentSubCommandIndex;
				}                        
				currentSubCommandIndex = nextSubCommandIndex+commandSubEndSeparator.length;
			}

			if (!foundVariable) {
				diagnostics.push(parseNoVariableFound(currentIndex, nextCommandIndex, command, textDocument));
			}

			return true;
		}
	}
	return false;
}

/**
 * Parses a found command and returns a diagnostic object.
 * @param currentIndex The index of the current command.
 * @param nextCommandIndex The index of the next command.
 * @param textDocument The text document to parse.
 * @returns A diagnostic object.
 */
function parseFoundCommand(currentIndex: number, nextCommandIndex: number, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: "command found",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a variable based on its type and returns a Diagnostic object.
 * @param varType The type of the variable (+, =, or -).
 * @param currentIndex The index of the current position in the text document.
 * @param nextCommandIndex The index of the next command in the text document.
 * @param variable The name of the variable to be parsed.
 * @param textDocument The TextDocument object representing the text document being parsed.
 * @returns A Diagnostic object representing the result of the parsing operation.
 */
function parseVariable(varType: any, currentIndex: number, nextCommandIndex: number, variable: string, textDocument: TextDocument): Diagnostic {
	console.log("varType: " + varType);
	console.log("variable", variable)
	if (varType == "+") {
		variableNames.push(variable);
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(currentIndex),
				end: textDocument.positionAt(nextCommandIndex)
			},
			message: "var stored",
			source: 'Ogree_parser'
		};
	}
	if (varType == "=") {
		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == variable) {
				return {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(currentIndex),
						end: textDocument.positionAt(nextCommandIndex)
					},
					message: "var exist",
					source: 'Ogree_parser'
				};
			}
		}
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(currentIndex),
				end: textDocument.positionAt(nextCommandIndex)
			},
			message: variable + " is not defined",
			source: 'Ogree_parser'
		};
	}
	if (varType == "-") {
		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == variable) {
				variableNames.splice(i, 1);
				return {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(currentIndex),
						end: textDocument.positionAt(nextCommandIndex)
					},
					message: "var removed",
					source: 'Ogree_parser'
				};
			}
		}
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(currentIndex),
				end: textDocument.positionAt(nextCommandIndex)
			},
			message: variable + " is not defined",
			source: 'Ogree_parser'
		};
	}
	return {
		severity: DiagnosticSeverity.Warning,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: variable + "Parser error",
		source: 'Ogree_parser'
	};
}

/**
 * Parses an unrecognized command and returns a diagnostic object.
 * @param currentIndex The index of the current command.
 * @param nextCommandIndex The index of the next command.
 * @param nextCommand The next command to be parsed.
 * @param textDocument The text document being parsed.
 * @returns A diagnostic object representing the unrecognized command error.
 */
function parseUnrecognizedCommand(currentIndex: number, nextCommandIndex: number, nextCommand: string, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: "unrocognized command: " + nextCommand,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a command and returns a diagnostic if no variable is found.
 * @param currentIndex The starting index of the command.
 * @param nextCommandIndex The ending index of the command.
 * @param command The command to parse.
 * @param textDocument The text document to parse the command from.
 * @returns A diagnostic object indicating that no variable was found in the command.
 */
function parseNoVariableFound(currentIndex: number, nextCommandIndex: number, command: string, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: "no variable found in command: " + command,
		source: 'Ogree_parser'
	};
	return diagnostic;
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
	

/*
	for (const delimiter of delimitersList) {
		nextCommandIndexPotential = text.indexOf(delimiter, currentIndex);
		if (nextCommandIndexPotential != -1 && nextCommandIndexPotential < nextCommandIndex) {
			nextCommandIndex = nextCommandIndexPotential;
			endSeparator = delimiter;
		}
	}

	return { index: nextCommandIndex, separator: endSeparator };*/
}
