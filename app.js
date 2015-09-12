function initControls() {
	var input = document.getElementById('input');
	var filter = document.getElementById('filter');
	filter.addEventListener("click", function(){
		redraw(input.value);
	});
}

function redraw(fltr) {
	var g = new Graph();
	modules.forEach(function(module){
		var rootNode = module["module"];
		if (fltr && rootNode.toLowerCase().indexOf(fltr) === -1){
			return
		}
		var deps = module["deps"];
		g.addNode(rootNode);
		deps.forEach(function(depModule){
			g.addEdge(rootNode, depModule, { directed : true });
		});
	});

	var layouter = new Graph.Layout.Spring(g);
	layouter.layout();


	var renderer = new Graph.Renderer.Raphael('canvas', g,  screen.width - 80, screen.height - 150);
	renderer.draw();	
}

initControls();
redraw();
