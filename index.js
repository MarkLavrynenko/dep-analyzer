var esprima = require("esprima");
var _ = require("underscore");
var fs = require("fs");
var file = require("file");
var path = require("path");
var jade = require("jade");

var http = require("http");
var serveStatic = require("serve-static");
var finalHandler = require("finalhandler");

function print(){
	console.log.apply(console.log, arguments)
}

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
}

function noop(){

}
var visitors = {
	"Program" : programVisitor,
	"ExpressionStatement": expressionVisitor,
	"CallExpression": callVisitor,
	"FunctionExpression" : functionVisitor,
	"BlockStatement" : blockVisitor,
	"MemberExpression": memberVisitor,
	"Literal" : noop,
	"AssignmentExpression": assigmentVisitor,
	"VariableDeclaration" : variableDeclarationVisitor,
	"VariableDeclarator": variableDeclaratorVisitor
}

function programVisitor(node){
	node['body'].forEach(function(childNode){
		dfs(childNode);
	});
}

function expressionVisitor(node) {
	dfs(node['expression']);
}

function callVisitor(node) {
	var callee = node["callee"];
	var args = node['arguments'];
	dfs(callee);	
	if (callee['module_declaration'] === true && args.length === 2) { // module creation
		var moduleName = null, dependences = null;
		if (args[0]['type'] === "Literal") {
			moduleName = args[0].value;
		} else {
			print("Module name is not string literal ", moduleName);
			return;
		}
		if (args[1]['type'] === "ArrayExpression") {
			dependences = extractModuleNamesFromArray(args[1]);
		} else {
			print("Second parameter to 'angular.module' is not array");
			return;
		}
		dfs.registerModule(moduleName, dependences);
	}	
}

function functionVisitor(node) {
	dfs(node['body']);
}

function blockVisitor(node) {
	// TODO: let's try this
	programVisitor(node);
}

function memberVisitor(node) {	
	var obj_type = node['object']['type'];
	if (obj_type === "Identifier") {
		if (node['object']['name'] === 'angular' && node['property']['name'] === 'module') {
			node['module_declaration'] = true;
		}
	} else if (obj_type === "CallExpression") {
		dfs(node['object']);
	}
}

function assigmentVisitor(node) {
	dfs(node["right"]);
}

function variableDeclarationVisitor(node) {
	node["declarations"].forEach(function(declaration){
		dfs(declaration);
	});	
}

function extractModuleNamesFromArray(node) {
	return _.pluck(node['elements'], 'value');
}

function variableDeclaratorVisitor(node) {
	dfs(node["init"]);
}

function dfs(root) {
	if (!root) {
		// WTF is here??????
		return;
	}
	var node_type = root['type'];
	if (!node_type) {
		print("Unknown type " + node_type)
		return 
	}
	var visitor = visitors[node_type];
	if (!visitor) {
		print("No visitor found for node type " + node_type)
		return
	}
	visitor(root);
}

function parseFile(filePath, registerModule) {
	var text = fs.readFileSync(filePath, "utf-8");
	print("read file " + filePath)
	var ast = esprima.parse(text);
	dfs(ast, registerModule);
}

function processProjectDirectory(projectRoot) {
	var modules = [];
	function registerModule(name, dependences) {
		modules.push({
			module : name,
			deps : dependences
		});
	}
	dfs.registerModule = registerModule;
	var callingRoot = path.dirname(require.main.filename);
	var projectRootAbs = path.join(callingRoot, projectRoot);
	file.walkSync(projectRootAbs, function(dirPath, dirs, files) {
		files.forEach(function(file){
			if (file.endsWith(".js")) {
				parseFile(path.join(dirPath, file), registerModule);
			}
		})
	});
	return modules;
	}

function renderResults(modules) {
	var text = fs.readFileSync("graph.jade.html");
	var template = jade.compile(text, { pretty : true });
	var results = template({
		modules : JSON.stringify(modules)
	});
	fs.writeFile("graph.html", results, function(err){
		if (err) {
			print("Failed to write html");
		}
	})
}

function serveResults() {
	var serve = serveStatic('./')
	var server = http.createServer(function(req, res){
		var done = finalHandler(req, res);
		print(done.toString());
		serve(req, res, done);
	});
	server.listen(2000);
	print("View results at http://localhost:2000/graph")
}

function analyzeProject(projectRoot) {
	var modules = processProjectDirectory(projectRoot);
	renderResults(modules);
	serveResults();
}

exports.analyzeProject = analyzeProject;