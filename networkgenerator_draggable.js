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
var NAnodeColour = "#FFF0F2";
var nodeHighlightColour = "#63A6F2";
var force;
var resizeTimer;
var dragging = false;

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
	var w = $("#svg").parent().width();
    var h = $("#svg").parent().height();
    if (w != svgW || h != svgH) {
        //$("#svg").attr("width", w);
        //var newheight = w / aspect;
    	$("#svg").attr("height", h);
    	$("#svg").attr("width", w);
    	$("#svg").attr("viewbox", "0 0 " + w + " " + h);
        svgH = h;
        svgW = w;
        
        if (nodes != null && edges != null) {
        	force.size([w, h]);
        }
        //updateHeightRegions();
        /*if (nodes != null && edges != null) {
        	force = d3.layout.force()
    				.nodes(d3.values(nodes))
    				.links(edges)
    				.size([w, h])
    				.linkDistance(80)
    				.charge(-400)
    				.gravity(0.3)
    				.on("tick", tick)
    				.start();
    	}*/
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
    		success: function(result) { addSessionOptions(result);},
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
		width: 800
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
	var year
	var season
	
	if (session === "ALL") {
		year = "ALL";
		season = "ALL";
	} else {
		year = session.substring(0, 4);
		season = session.substring(4, 5);
	}
	var maxcode = form.maxcode.value;
	
	if (deptString.length > 0) {
		$("#formheader").click();
		$.ajax({
			data: {departments : deptString, campus : selectedCampus, year : year, season : season, maxcode : maxcode},
			traditional: true,
			url: "NetworkGenerator.py",
			success: function(result) { console.log(result); drawNetwork(result);	$("body").removeClass("loading");},
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
	if (force != null) {
		force.stop();
	}
	$("#graphics").empty();
	$("#freeze").attr("checked", false);
	
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
	
	var gravity_scale = d3.scale.sqrt()
						.domain([1, 1000])
						.range([0.05, 1]);
	var grav = gravity_scale(nodes.length);
	
	force = d3.layout.force()
    				.nodes(d3.values(nodes))
    				.links(edges)
    				.size([w, h])
    				.linkDistance(80)
    				.charge(-400)
    				.gravity(grav)
    				.on("tick", tick)
    				.start();
    	
    var node_scale = d3.scale.sqrt()
    					.domain([0, d3.max(nodes, function(d) { return parseInt(d.classSize); })])
                     	.range([2, 30]);
                     	            	
    var node_drag = d3.behavior.drag()
        .on("dragstart", dragstart)
        .on("drag", dragmove)
        .on("dragend", dragend);

    function dragstart(d, i) {
    	dragging = true;
        force.stop() // stops the force auto positioning before you start dragging
    }

    function dragmove(d, i) {
        d.px += d3.event.dx;
        d.py += d3.event.dy;
        d.x += d3.event.dx;
        d.y += d3.event.dy; 
        tick(force); // this is the key to make it work together with updating both px,py,x,y on d !
    }

    function dragend(d, i) {
        d.fixed = true; // of course set the node to fixed so the force doesn't include the node in its auto positioning stuff
    	dragging = false;
        if (!$("#freeze").is(':checked')) {
        	force.resume();
        }
    }
    				
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
    				.attr("id", function(d) {
					return d.id;
				})
				.attr("r", function(d) {
    					if (d.logic != null) {
    						d.radius = 5;
    					} else {
    						d.radius = node_scale(d.classSize);
    					}
    					return d.radius;
    				})
    				.attr("fill", function(d) {
					if (d.title == "NA") {
						return NAnodeColour;
					} else if (d.logic == null) {
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
    				.on("click", clickNode)
    				.call(node_drag);

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
    $("#networktools").attr("visibility", "visible");
}

function freezeNetwork(checkbox) {
	var isChecked = checkbox.checked;

	for (var i = 0; i< nodes.length; i++) {
		nodes[i].fixed = isChecked;
	}
	
	if (isChecked) {
		force.stop();
	} else {
		force.resume();
	}
}

function removeNode(node) {
	var e_indices = [];	

	// Look for edges that point to or from this node
	for (var i=0; i<edges.length; i++) {
		var e = edges[i];
		if (e.target == node || e.source == node) {
			e_indices.push(i);
		}	
	}

	for (var j=0; j<e_indices.length; j++) {
		edges.splice(e_indices[j], 1);
	}
	node_index =$.inArray(node, nodes);
	nodes.splice(node_index, 1);
	//var allcircles = d3.selectAll("circle").data(nodes);
	//var alledges = d3.selectAll("path").data(edges);
	//var alllabels = d3.selectAll("text")

	//alllabels.exit().remove();	
	//alledges.exit().remove();	
	//allcircles.exit().remove();	
}

// Trace the paths back from a node, highlighting or unhighlighting all depending on state of first node
function traceBack(node_el, node, highlight) {
	var this_id = node.id;
	if (node.logic == null) {
		if (highlight) {
			d3.select(node_el).attr("fill", nodeHighlightColour);
		} else {
			if (node.title == "NA") {
				d3.select(node_el).attr("fill", NAnodeColour);
			} else {
				d3.select(node_el).attr("fill", nodeColour);
			}
		}
	}
	// Look for edges that point to this node
	for (var i=0; i<edges.length; i++) {
		var e = edges[i];
		if (e.target.id == this_id) {
			
			// Recursively trace back from that node
			var next_el = document.getElementById(e.source.id);
			traceBack(next_el, e.source, highlight);
		}	
	}
}

// Trace the paths forward from a node
function traceForward(node_el, node, highlight) {
	var this_id = node.id;
	if (node.logic == null) {
		if (highlight) {
			d3.select(node_el).attr("fill", nodeHighlightColour);
		} else {
			if (node.title == "NA") {
				d3.select(node_el).attr("fill", NAnodeColour);
			} else {
				d3.select(node_el).attr("fill", nodeColour);
			}
		}
	}
	// Look for edges that point from this node
	for (var i=0; i<edges.length; i++) {
		var e = edges[i];
		if (e.source.id == this_id) {
			
			// Recursively trace back from that node
			var next_el = document.getElementById(e.target.id);
			traceForward(next_el, e.target, highlight);
		}	
	}
}

// Listener called when a node is clicked
function clickNode(node) {
	if (node.logic != null) {
	    return;
	}
	displayCourseInfo(node);

	var highlight_val = $('input[name=highlight]:radio:checked').val();
	
	switch (highlight_val) {
		case "course":
			toggleHighlight(this, node);
			break;
		case "pathto":
			if (isNodeHighlighted(this)) {
				traceBack(this, node, false);
			} else {
				traceBack(this, node, true);
			}
			break;
		case "pathfrom":
			if (isNodeHighlighted(this)) {
				traceForward(this, node, false);
			} else {
				traceForward(this, node, true);
			}
			break;
		case "delete":
			removeNode(node);
			break;	
		default: // a.k.a "off"
			break;
	}
}

function isNodeHighlighted(node_el) {

	var currColour = d3.select(node_el).attr("fill");
	if (currColour == nodeHighlightColour) {
		return true;
	} else {
		return false;
	}
}

// Highlight or unhighlight the node depending on its current colour
function toggleHighlight(node_el, node) {

	var currColour = d3.select(node_el).attr("fill");
	var newColour = null;

	if (currColour == nodeColour || currColour == NAnodeColour) {
		newColour = nodeHighlightColour;
	} else {
		if (node.title == "NA") {
	  	     newColour = NAnodeColour;
		} else {
	  	     newColour = nodeColour;
		}
	}
	d3.select(node_el).attr("fill", newColour);
}

// Display the course information in the sidebar
function displayCourseInfo(node) {

	$("#courseName").text(node.name);
	
	if (node.classSize != null && node.title != "NA") {
		$("#courseSize").text("Total number of seats: " + node.classSize);
		$("#courseSize").css("display", "block");
	} else {
		$("#courseSize").text("");
		$("#courseSize").css("display", "none");
	}
	if (node.session != null) {
		$("#courseSessions").text("Sessions: " + node.session.replace(",", ", "));
		$("#courseSessions").css("display", "block");
	} else {
		$("#courseSessions").text("");
		$("#courseSessions").css("display", "none");
	}
	if (node.title != null && node.title != "NA") {
		$("#courseTitle").text(node.title);
		$("#courseTitle").css("display", "block");
	} else {
		$("#courseTitle").text("");
		$("#courseTitle").css("display", "none");
	}
	
	$("#courseDescr").text(node.descr);
        
    var prereqstring = "";
    if ('prereqs' in node) {
	    $("#prereqTitle").css("display", "block")
	    prereqstring = node.prereqs
    } else {
	    $("#prereqTitle").css("display", "none")
	}

    if ('prereqnote' in node) {
	    prereqstring += " " + node.prereqnote
    }

    $("#coursePrereqs").text(prereqstring)
    if ('coreqs' in node) {
	    $("#coreqTitle").css("display", "block")
	    $("#courseCoreqs").text(node.coreqs);
    } else {
	    $("#coreqTitle").css("display", "none")
	    $("#courseCoreqs").text("");
	}

}

function tick(e) {

	//console.log(force.alpha());
	/*if (force.alpha() <0.05) {
		force.stop();
	}*/
	var h = svgH;
		    
	if (!dragging) {
		var q = d3.geom.quadtree(nodes),
  		i = 0,
  		n = nodes.length;

  		while (++i < n) {
			q.visit(collide(nodes[i], e.alpha));
  		}
	}	
	
  			
  	path.attr("d", function(d) {
  	
  		if (!$.isNumeric(d.target.x)) {
  			console.log(d.source.name + " to " + d.target.name + " target.x: " + d.target.x);
  		}
  		if (!$.isNumeric(d.source.x)) {
  			console.log(d.source.name + " source.x: " + d.source.x);
  		}
  
  		// Total difference in x and y from source to target
  		diffX = d.target.x - d.source.x;
  		diffY = d.target.y - d.source.y;
  				
  		// Length of path from center of source node to center of target node
  		pathLength = Math.sqrt((diffX * diffX) + (diffY * diffY));
  		
  		if (!$.isNumeric(diffX)) {
  			console.log(d.target.name + " diffX: " + diffX);
  		}
  		if (!$.isNumeric(diffY)) {
  			console.log(d.target.name + " diffY: " + diffY);
  		}
  		if (!$.isNumeric(pathLength)) {
  			console.log(d.target.name + " pathLength: " + pathLength);
  		}
  				
  		// x and y distances from center to outside edge of target node
  		if (pathLength > 0) {
  			offsetX = (diffX * d.target.radius) / pathLength;
  			offsetY = (diffY * d.target.radius) / pathLength;
  		} else {
  			offsetX = 0;
  			offsetY = 0;
  		}
  				
  		if (!dragging) {		
  			if (d.target.y < d.source.y) {
  				var avgY = (d.target.y + d.source.y)/2;
  			
  				if (!d.target.fixed && !d.source.fixed) {
  					d.target.y = avgY;
  					d.source.y = avgY;
  				}
  			} 
  		}
  		
		return "M" + d.source.x + "," + d.source.y + "L" + (d.target.x - offsetX) + "," + (d.target.y - offsetY);
		//return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
  	});
  			
  	// Keep circles within bounds of screen
  	var r = 6;
  	
  	/*circle.attr("cx", function(d) {
  		if (d.fixed) {
  			return d.x;
  		} else {
  			return d.x = Math.max(r + d.radius, Math.min(w - r, d.x)); 
  		}})
			.attr("cy", function(d) {
  		if (d.fixed) {
  			return d.y;
  		} else {
  			return d.y = Math.max(d.radius, Math.min(h - d.radius, d.y));
  		}});*/
  			
  	circle.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) {
  				return d.y;
  			});
  			
  	text.attr("transform", function(d) {
		return "translate(" + d.x + "," + d.y + ")";
  		});
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
    			if (quad.point.fixed && node.fixed) {
    				return false;
    			}
    		
      			var x = node.x - quad.point.x,
          			y = node.y - quad.point.y,
          			
          			// Distance between the two nodes' centers
          			l = Math.sqrt(x * x + y * y);
          			
          			// Minimum required distance between the two nodes' centers
          			var final = node.radius + quad.point.radius + 5;
          			if (alpha > 0) {
          				r = final - (200*alpha);
          			} else {
          				r = final;
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
	svgH = $("#svg").parent().height();
	svgW = $("#svg").parent().width();

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
			$("#bigbox").animate({top: 115 + "px"}, {duration:200, queue:false, complete:checkResize});
		} else {
			$('#arrow').attr("src", "expand_arrow.png");
			$("#bigbox").animate({top: 420 + "px"}, {duration:200, queue:false, complete:checkResize});
		}
		return false;
	});

	// Scroll to zoom in the SVG
	$('#svgbox').mousewheel(function(event, delta, deltaX, deltaY) {
		zoom(1 + (deltaY/300));
	});

});
