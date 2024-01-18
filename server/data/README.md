# Adding or modifying a command in command_list.json

To add a command, you need to add the command with the others commands and write it with the good specifications.  
For any question, you can contact me at nathan.rabier@imt-atlantique.org  

Example of command.

```bash
{
	"keyword": "+building",
	"matchKeyword" : ["building","bd"],
	"quickText": "Create a Building without template",
	"documentation": "Building must be child of a Site.\n [pos] is a Vector2 [x,y] (m,m)\n [rotation] is the rotation of the building around its lower left corner, in degree\n [size] is a Vector3 [width,length,height] (m,m,m)\n [template] is the name (slug) of the building template",
	"insertText": "building:${1:name}@${2:pos}@${3:rotation}@[${4:width}, ${5:length}, ${0:height}]",
	"detail": "+building:[name]@[pos]@[rotation]@[width,length,height]",
	"parser": ["+", "building", ":","[+building]", "@", "[=array,2]", "@", "[=number]", "@", "[=array,3]"]
}
```

To add a command, you need 7 items :

## keyword

It's a keyword for the command.

## matchKeyword

It's a list of differents keyword for the autocompletion that can match to activate the proposition of autocompletion with this command. The list can be empty.

## quickText

It's the text that appears for the command when the propositons of autocompletion are displayed.

## documentation

It's a more precise documentation that appear in the autocompletion when you ask for more details.

## insertText

It's the text to insert when you use the autotcompletion. There are some specifics syntaxe to say that a part have to be completed by the user. In this example, we use ${1:name} to display "name" and say that the user need to complete this part. The numbers are used to know the order of selection for the user, from 1 to above, and 0 for the last index.  
An second way is to write ${1|option1,option2,option3|} to propose a list with the differents option to the user when he will complete this part.  
  
Here is an example with the two way  
```bash
"insertText": ${1:struct}:localCS=${2|true,false|}
```

## detail

It's a text that appear above the documentation during the display of the possibles autocompletions. We choose to put a pseudo-code version of the command, with the variables/typed expressions needed writted [typeExpected], and with [|option1, option2|] when there are differents possibles options.

## parser

This line is the only one used by the parser to know if a command exist and is well writted. To fill this line, you need to decompose your command in differents pieces, as the parser will do to understand the command. You need to separate all specials characters with the other and separate two groups of characters if there is a blank character between them. You can't separate a regular string (i.e. with letters) when there is no blank characters. For the list of all special characters that split a command, see [List of specials characters splitting a command](#list-of-specials-characters-splitting-a-command)   
For example, to add
```bash
-user all (!test)
```
You will write
```bash
"parser": ["-", "user", "all", "(", "!", "test", ")"]
```
However, you can't write
```bash
"parser": ["-", "user all", "(!", "te", "st", ")"]
```
Because the parser will not be able to find "user all" and "(!", and will not work if you write "test", but only if you write "te st", with at least one space between e and s.

For now, for the parser, if you write
```bash
- user   all  (    ! test)
```
it will be recognised. However, if you need to force some parts to be stick together, it is possible.  
For instance, if we want that "user" must be just after "-", we can write
```bash
"parser": ["-", {"value": "user", "(isLinked)": true}, "all", "(", "!", "test", ")"]
```
On the contrary, if you want at least one space between "-" and "user", you can write
```bash
"parser": ["-", {"value": "user", "(isLinked)": false}, "all", "(", "!", "test", ")"]
```
To implement a condition on the type of an expression or to says to the parser that a structure or a variable is created/deleted, you need to put [(firstSymbol)type]. The first symbol is used to know what the parser have to do.
+ "+" is for creating something of the type typed after and remember the name linked to this in the parser.
+ "=" is for indicate the type of the expression
+ "-" is for delete a name of the good type previously created.
For the type, it indicate the type of the expression or the type of the name of the variable/structure created. Go to [List of all the types](#list-of-all-the-types)  
  
When several commands are possible for the parser to match with, it will first try to match what the user wrote with "fixed" values, i.e. not something between bracket. If it doesn't match the command writen with one of theses commands, it will try to match with the actionsTypes (i.e. a type plus the brackets and the symbols to make the difference with only the type in [(symbol)type]). When he found an actionType that match with what it is writed, he stop the search there. So when adding new commands, pay attention to the case that the parser doesn't explore all the possibles way for now.  
  
Two or three things are not implemented, like the command printf and format, and using variables in the name of structures is only partially covered.


## List of specials characters splitting a command
"+", "-", "=", "@", ";", "{", "}", "(", ")", "[", "]", "\"", ":", ".", ",", "*", "/", "%", "<", ">", "!", "|", "&", "#", "\\"

## List of all the types

### structures type
Possibles types after + or - in [+/-type] for structures.
+ site
+ building
+ room
+ rack
+ device
+ corridor
+ orphanDevice
+ group
+ pillar
+ separator
+ struct : only with -, can be any type of structure

### variables type
Possibles types after + in [+type] for variables.
+ string
+ integer
+ float
+ array
+ boolean
+ alias
+ var : Special : correspond to name=value in the OGrEE-CLI command, and create a variable named name of type the type of the expression (used for .var:name=value, which is written for the parser : "parser" : [".", {"value" : "var", "(isLinked)" : true}, {"value" : ":", "(isLinked)" : true}, "[+var]"])

### expressions type
possibles types after "=" in [=type]
+ struct : any type of structure
+ site
+ building
+ room
+ rack
+ device
+ corridor
+ orphanDevice
+ group
+ pillar
+ separator
+ string : any variable can be used in a string
+ integer
+ float
+ number : integer or float
+ array : It's possible to add a condition on the lenght [=array,2,3] => array of lenght 2 or 3.
+ boolean
+ color : a hexadecimal code or a variable of type string or integer.
+ alias
+ path : a path (for example for a file on your computer or for a slot in a device) or a variable of type string
+ unit : m, t, f or a variable of type string
+ rotation : front, rear, left, right, top, bottom, an array of length 3 or a variable of type string or array
+ template : like path
+ axisOrientation : any combination of [+/-]x[+/-]y or a variable of type string
+ temperature : cold or warm or a variable of type string
+ typeWall : wireframe or plain or a variable of type string
+ side : front, rear, frontflipped, rearflipped or a variable of type string
+ fArgument : y, n or a variable of type string
+ attribute : an attribute for a structure
+ cmds : {command1; command2; ...} used for while, for, if, elif, else
+ condition : like boolean, but evaluate the expression without the word eval at the begginning. Used for while, if, elif.
+ el(if/se) : do not use, special to have any elif as we want.
+ structs,group : do not use, special, used for +group:[name]@{[c1,c2,...,cN]} for the last part, {[c1,c2,...,cN]}.
+ structs,selection : special, used for ={structs} to select several structures in the same time. Record that the selection is not empty after that.