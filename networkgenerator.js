/*
AUTHOR: Frances Russell
DATE: May 8, 2013

This file controls the content of the UBC Network Generator webpage.  It calls a python script that
retrieves course information from the UBC SSC, and displays this information as a network using a
data visualization library.
*/

var svgH = 0;
var svgW = 0;
var h1, h2, h3;
var aspect;
var nodes, edges, circle, text, path;
var nodeColour = "#FAC0C8";
var nodeHighlightColour = "#FFE991";
var force;
var resizeTimer;

function updateBigBoxSize() {
    var top_margin = $("#formbox").height() + $("#pageheading").height() + 50;
   	$('#bigbox').css("top", top_margin + "px");
}

// Update minimum width of window based on size of checkbox table
function updateMinWidth() {
	var minwidth = Math.max($("#cbtable").width() + 65, $("#button").position().left + 210);
	$("body").css("min-width", minwidth);
}

// Scale the contents of the SVG when it's resized
function checkResize(){
	clearTimeout(resizeTimer);
    resizeTimer = setTimeout(doneResizing, 100);
}

function doneResizing() {
	console.log("Resized!");
	var w = $("#svg").parent().width();
    var h = $("#svg").parent().height();
    if (w != svgW || h != svgH) {
    	// TODO: Make graphics recenter when window resized
        /*$("#svg").attr("width", w);
        var newheight = w / aspect;*/
    	$("#svg").attr("height", h);
    	$("#svg").attr("width", w);
    	$("#svg").attr("viewbox", "0 0 " + w + " " + h);
        svgH = h;
        svgW = w;
        updateHeightRegions();
        if (nodes != null && edges != null) {
        	force = d3.layout.force()
    				.nodes(d3.values(nodes))
    				.links(edges)
    				.size([w, h])
    				.linkDistance(80)
    				.charge(-400)
    				.gravity(0.3)
    				.on("tick", tick)
    				.start();
    	}
    }
}

function pan(dx, dy) {      
  transMatrix[4] += dx;
  transMatrix[5] += dy;
             
  newMatrix = "matrix(" +  transMatrix.join(' ') + ")";
  networkMatrix.setAttributeNS(null, "transform", newMatrix);
}

function zoom(scale) {
  // Scale x and y coordinates by scaling factor
  for (var i=0; i<transMatrix.length; i++) {
    transMatrix[i] *= scale;
  }
 
  // Translate coordinates to keep network centered
  transMatrix[4] += (1-scale)*svgW/2;
  transMatrix[5] += (1-scale)*svgH/2;
                 
  newMatrix = "matrix(" +  transMatrix.join(' ') + ")";
  networkMatrix.setAttributeNS(null, "transform", newMatrix);
}

// Get a list of valid sessions
function getSessions() {
	$.ajax({
    		url: "GetValidSessions.py",
    		success: function(result) { console.log("Got valid sessions!"); addSessionOptions(result);},
    		error: function(request, error) { console.log("Error 1"); console.log(request); }
    	});
}

// Get all UBC departments and display them as checkboxes
function getDepartments(campus, year, season) {
	// If no arguments supplied, use "UBC" and current session as default
	if (arguments.length == 0) {
		campus = "UBC";
		var today = new Date();
		year = today.getFullYear();
		var month = today.getMonth();
		if ( 4 <= month <= 7 ) {
			season = "S";
		} else {
			season = "W";
		}
		currSession = year + season;
	}

	$.ajax({
		data: {campus : campus, year : year, season : season},
    		url: "GetAllDepts.py",
    		success: function(result) {
    			console.log("Got UBC departments!");
    			createCheckBoxes(result, 11);
    			updateBigBoxSize();
    			updateMinWidth();},
    		error: function(request, error) {
    			console.log("Error 2");
    			console.log(request);
    			updateBigBoxSize();
    			updateMinWidth(); }
    	});
}

// Add all the given sessions to the drop down menu
function addSessionOptions(sessions) {
	var optionBox = $('#session');

	for (var i = 0; i<sessions.length; i++) {
		$('<option />', { value: sessions[i], text: sessions[i] }).appendTo(optionBox);
	}
}

// Create checkboxes in the form for all the given departments
function createCheckBoxes(departments, maxRows) {
	var table = $('#cbtable');
	var allRows = $('#cbtable tr');
	var numCols = table.find('tr')[0].cells.length;
	
	// Delete all existing checkboxes except "Select All"
	for (var i = allRows.length - 1; i>0; i--) {
		document.getElementById("cbtable").deleteRow(i);
	}
	for (var k = numCols - 1; k > 0; k--) {
		allRows[0].deleteCell(k);
	}
	
	var row;
	var cell;

	for (var j=1; j<departments.length; j++) {
	
		// Select or create the appropriate row
		if (j < maxRows) {
			row = document.getElementById("cbtable").insertRow(j);
		} else {
			row = document.getElementById("cbtable").rows[j % maxRows];
		}
		// Add a new table cell
		cell = row.insertCell(-1);
		
		$('<input />', { type: 'checkbox', name: 'dept', value: departments[j] }).appendTo(cell);
		$('<label />', { 'for': departments[j], text: departments[j]}).appendTo(cell);
	}
}

// Select or de-select all checkboxes according to 'Select All'
function toggle(source) {
  		checkboxes = document.getElementsByName('dept');
  		for(var i=0, n=checkboxes.length;i<n;i++) {
    		checkboxes[i].checked = source.checked;
  		}
}

$(function() {
	$("#helpDialog").dialog({
		autoOpen: false,
		modal: false,
		width: 500
		});
		
	//$( document ).tooltip();
	}
);

function openHelp() {
	$("#helpDialog").dialog('open');
}

// Process the submitted form
function processForm(e) {
	$("body").addClass("loading");
	if (e.preventDefault) e.preventDefault();
	var form = document.getElementById("form");
	
	var deptString = "";
	for (var i=0; i<form.dept.length; i++) {
		if (form.dept[i].checked) {
		    if (deptString.length > 0) {
				deptString += ",";
			}
			deptString += form.dept[i].value;
		}
	}
	var selectedCampus = form.campus[form.campus.selectedIndex].value;
	var session = form.session[form.session.selectedIndex].value;
	var year = session.substring(0, 4);
	var season = session.substring(4, 5);
	var maxcode = form.maxcode.value;
	
	if (deptString.length > 0) {
		$("#formheader").click();
		$.ajax({
			data: {departments : deptString, campus : selectedCampus, year : year, season : season, maxcode : maxcode},
			traditional: true,
			url: "NetworkGenerator.py",
			success: function(result) { console.log("Success!"); console.log(result); drawNetwork(result);	$("body").removeClass("loading");},
			error: function(request, error) { console.log("Error"); console.log(request); $("body").removeClass("loading"); alert("Error: Could not draw network. The SSC data may have been improperly formatted."); }
		});
	} else {
		$("body").removeClass("loading");
		alert("Please select a department");
	}
	// You must return false to prevent the default form behavior
	return false;
}

function updateHeightRegions() {
	// Regions for different year nodes (i.e. first-year, second-year...)
	h1 = svgH / 4;
	h2 = svgH / 2;
	h3 = h1 + h2;
}

// Given the nodes/edges object, draw the course network using the D3 library
function drawNetwork(data) {
	$("#graphics").empty();
	
	w = svgW;
	h = svgH;
	aspect = w / h;
	updateHeightRegions();
				
	nodes = data.nodes;
	edges = [];
	data.edges.forEach(function(e) { 
    		var sourceNode = data.nodes.filter(function(n) { return n.id === e.source; })[0],
        		targetNode = data.nodes.filter(function(n) { return n.id === e.target; })[0];

    		// Add the edge to the array
   			 edges.push({source: sourceNode, target: targetNode, type: e.type});
	});
	
	force = d3.layout.force()
    				.nodes(d3.values(nodes))
    				.links(edges)
    				.size([w, h])
    				.linkDistance(80)
    				.charge(-400)
    				.gravity(0.3)
    				.on("tick", tick)
    				.start();
    	
    var node_scale = d3.scale.sqrt()
    					.domain([0, d3.max(nodes, function(d) { return d.classSize; })])
                     	.range([2, 20]);
    				
	$("#svg").attr("viewBox", "0 0 " + w + " " + h)
			.attr("preserveAspectRatio", "XMidYMid")
			.attr("width", w)
			.attr("height", h);
    	
    	// Add the arrows
	d3.select("#svgdefs").selectAll("marker")
    		.data(["prereq", "coreq"])
  			.enter().append("svg:marker")
    		.attr("id", String)
    		.attr("viewBox", "0 -5 10 10")
    		.attr("refX", 10)
    		.attr("markerWidth", 6)
    		.attr("markerHeight", 6)
    		.attr("orient", "auto")
    		.append("svg:path")
    		.attr("d", "M0,-5L10,0L0,5");
    	
    	path = d3.select('#graphics').append("g").selectAll("path")
    				.data(force.links())
  					.enter().append("svg:path")
    				.attr("class", function(d) { return "link " + d.type; })
    				.attr("marker-end", function(d) { return "url(#" + d.type + ")"; });
    				
    	circle = d3.select('#graphics').append("g").selectAll("circle")
    					.data(force.nodes())
 						.enter().append("svg:circle")
    					.attr("r", function(d) {
    						if (d.logic != null) {
    							d.radius = 5;
    						} else {
    							d.radius = node_scale(d.classSize);
    						}
    						return d.radius;
    					})
    					.attr("fill", function(d) {
    						if (d.logic == null) {
    							return nodeColour;
    						} else if (d.logic == "OR") {
    							return "#CCC";
    						} else {
    							return "black";
    						}
    					})
    					.attr("stroke", function(d) {
    						if (d.logic == null) {
    							return "black";
    						} else {
    							return "black";
    						}
    					})
    					.on("click", highlight)
   						.call(force.drag);

	text = d3.select('#graphics').append("g").selectAll("g")
    				.data(force.nodes())
  					.enter().append("svg:g");

	// A copy of the text with a thick white stroke for legibility.
	text.append("svg:text")
    		.attr("x", -22)
    		.attr("y", ".31em")
    		.attr("class", "shadow")
    		.text(function(d) { return d.name; });

	text.append("svg:text")
    		.attr("x", -22)
    		.attr("y", ".31em")
    		.text(function(d) { return d.name; });
    		
    networkMatrix = document.getElementById("graphics");
    $("#navigator").attr("visibility", "visible");
  	
  	//console.log("test");
  	/*console.log(force.alpha());
  	var k = 0;
  	while ((force.alpha() >0.005) && (k < 150)) {
  		console.log("test2");
  		force.tick();
  		console.log(force.alpha());
  		//k +=1;
  	}
  	console.log("Stopping")
  	force.stop();*/
}

function highlight(node) {

	if (node.logic != null) {
		console.log("logic node");
		return;
	}	
	
	$("#courseName").text(node.name);
	if (node.classSize != null) {
		$("#courseSize").text("Total number of seats: " + node.classSize);
		$("#courseSize").css("display", "inline");
	} else {
		$("#courseSize").text("");
		$("#courseSize").css("display", "none");
	}
	$("#courseTitle").text(node.title);
	$("#courseDescr").text(node.descr);
        var prereqstring = "";
        if ('prereqs' in node) {
	    $("#prereqTitle").css("display", "inline")
	    prereqstring = node.prereqs
        } else {
	    $("#prereqTitle").css("display", "none")
	}

        if ('prereqnote' in node) {
	    prereqstring += " " + node.prereqnote
        }

        $("#coursePrereqs").text(prereqstring)
        if ('coreqs' in node) {
	    $("#coreqTitle").css("display", "inline")
	    $("#courseCoreqs").text(node.coreqs);
        } else {
	    $("#coreqTitle").css("display", "none")
	    $("#courseCoreqs").text("");
	}
	
	// Highlight the node (or de-highlight if already highlighted)
	var currColour = d3.select(this).attr("fill");
	if (currColour == nodeColour) {
  		d3.select(this).attr("fill", nodeHighlightColour);
	} else {
		d3.select(this).attr("fill", nodeColour);
	}
}

function tick(e) {
	var h = svgH;
		    
	//if (e.alpha < 0.05) {
		var q = d3.geom.quadtree(nodes),
  		i = 0,
  		n = nodes.length;

  		while (++i < n) {
			q.visit(collide(nodes[i], e.alpha));
  		}
	//}	
	
  			
  	path.attr("d", function(d) {
  		// Total difference in x and y from source to target
  		diffX = d.target.x - d.source.x;
  		diffY = d.target.y - d.source.y;
  				
  		// Length of path from center of source node to center of target node
  		pathLength = Math.sqrt((diffX * diffX) + (diffY * diffY));
  				
  		// x and y distances from center to outside edge of target node
  		offsetX = (diffX * d.target.radius) / pathLength;
  		offsetY = (diffY * d.target.radius) / pathLength;
  				
  		if (d.target.y < d.source.y) {
  			var avgY = (d.target.y + d.source.y)/2;
  			d.target.y = avgY;
  			d.source.y = avgY;
  		}
  			
		return "M" + d.source.x + "," + d.source.y + "L" + (d.target.x - offsetX) + "," + (d.target.y - offsetY);
  	});
  			
  	// Keep circles within bounds of screen
  	var r = 6;
  	circle.attr("cx", function(d) { return d.x = Math.max(r + d.radius, Math.min(w - r, d.x)); })
			.attr("cy", function(d) {
  				// Calculate height bounds based on d.year
  				/*var margin = d.radius + 5;
  				var bottom, top;
  				if (d.year == null) {
  					bottom = margin;
  					top = h - margin;
  				} else if (d.year == 1) {
  					bottom = margin;
  					top = h1;
  				} else if (d.year == 2) {
  					bottom = h1;
  					top = h2;
  				} else if (d.year == 3) {
  					bottom = h2;
  					top = h3;
  				} else {
  					bottom = h3;
  					top = h - margin;
  				}
  				// If node is lower/higher than its region, adjust accordingly
  				if (d.y < bottom) {
  					d.y += 1;
  				} else if (d.y > top) {
  					d.y -= 1;
  				}*/
  				//console.log(d.radius + " " + h);
  				return d.y = Math.max(d.radius, Math.min(h - d.radius, d.y));
  			});
  			
  			text.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
  			});

	
		// Push sources up and targets down to form a weak tree.
    	/*	var k = 10 * e.alpha;
    		edges.forEach(function(d, i) {
      			d.source.y -= k;
      			d.target.y += k;
    		});
  		*/
	}


// Prevent overlapping of nodes
function collide(node, alpha) {
        var r = node.radius + 16,
      	nx1 = node.x - r,
      	nx2 = node.x + r,
      	ny1 = node.y - r,
      	ny2 = node.y + r;
  		return function(quad, x1, y1, x2, y2) {
  			// Check if there's a node that might be colliding with this node
    		if (quad.point && (quad.point !== node)) {
      			var x = node.x - quad.point.x,
          			y = node.y - quad.point.y,
          			
          			// Distance between the two nodes' centers
          			l = Math.sqrt(x * x + y * y);
          			
          			// Minimum required distance between the two nodes' centers
          			if (alpha > 0) {
          				r = node.radius + quad.point.radius - (alpha*100);
          			} else {
          				r = node.radius + quad.point.radius;
          			}
      			
      			// Check if they're too close together
      			if (l < r) {
        			l = (l - r) / l * .5;
        			node.x -= x *= l;
        			node.y -= y *= l;
        			quad.point.x += x;
        			quad.point.y += y;
      			}
    		}
    		return x1 > nx2
        		|| x2 < nx1
        		|| y1 > ny2
        		|| y2 < ny1;
  		};
}


$(document).ready( function() {

	//create svg in body	
	var w_width = $(window).width();
	var descr_box_width = 300;
	console.log(document.getElementById("svgbox"));
	console.log(document.getElementById("svg"));
	svgH = $("#svg").parent().height();
	svgW = $("#svg").parent().width();
	console.log("height = " + svgH);
	console.log("width = " + svgW);

	// Do these things as soon as page is ready:
    getSessions();
    getDepartments();
    $("#alldepts").click(function () {
    	toggle(this);
    });
    
    // If they change the campus, change the list of departments accordingly
    $("#campus").change(function() { 
    	var campus = form.campus[form.campus.selectedIndex].value;
    	var session = form.session[form.session.selectedIndex].value;
    	var year = session.substring(0, 4);
    	var season = session.substring(4, 5);
    	getDepartments(campus, year, season)
    });
 
	$(window).resize(checkResize);

	$("#form").submit(function(){
		processForm($("#form"));
		return false;
    });
    
    // Expand and collapse the parameters
   	$('#formheader').click(function(){
		$('#parameters').slideToggle(200, 'swing', {queue:false});
		$(this).toggleClass('slideSign2');
	
		if ($('#arrow').attr("src") == "expand_arrow.png") {
			$('#arrow').attr("src", "expand_arrow_up.png");
			$("#bigbox").animate({top: 135 + "px"}, {duration:200, queue:false, complete:checkResize});
		} else {
			$('#arrow').attr("src", "expand_arrow.png");
			$("#bigbox").animate({top: 427 + "px"}, {duration:200, queue:false, complete:checkResize});
		}
		return false;
	});
});