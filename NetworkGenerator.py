#!/usr/bin/env python

import re
from optparse import OptionParser
from os import sys
from os import path
import json
import cgi
import cgitb
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET

course_exp = r"[A-Z]{2,4} \d{2,3}"
one_of = r"[Oo]ne of ((?:[A-Z]{2,4} \d{2,3}, )+)(?:or )?([A-Z]{2,4} \d{2,3})"
all_of = r"[Aa]ll of ((?:[A-Z]{2,4} \d{2,3}, )+)(?:and )?([A-Z]{2,4} \d{2,3})"
and_course = r"((?:[A-Z]{2,4} \d{2,3}, )+)(?:and )([A-Z]{2,4} \d{2,3})"
and_exp = r"([A-Za-z0-9,.\- ]+)and([A-Za-z0-9,.\- ]+)"
#either = r"[Ee]ither \(a\)((?: [A-Za-z0-9,]+)+) or \(b\)((?: [A-Za-z0-9,]+)+)"
#either_3 = r"[Ee]ither \(a\)((?: [A-Za-z0-9,]+)+) or \(b\)((?: [A-Za-z0-9,]+)+) or \(c\)((?: [A-Za-z0-9,]+)+)"
either = r"[Ee]ither \(a\)((?: [A-Za-z0-9,]+)+) or \(b\)((?: [A-Za-z0-9,]+)+) or \(c\)((?: [A-Za-z0-9,]+)+)|[Ee]ither \(a\)((?: [A-Za-z0-9,]+)+) or \(b\)((?: [A-Za-z0-9,]+)+)"
brackets_end = r"\([A-Za-z0-9,.\- ]+\)$"
either_and_either = r"([Ee]ither .*);\s+and\s+([Ee]ither .*)"
either_or_either = r"([Ee]ither .*);\s+or\s+([Ee]ither .*)"

print "Content-type: application/json\n\n"
cgitb.enable(format="text")

logfile = open('logfile.txt', 'w')
#currentTime = datetime.now()
#logfile.write("Started CourseNetworkCrawlWeb.py at " + str(currentTime.second) + " " + str(currentTime.microsecond) + "\n")

# Get data from AJAX call
fs = cgi.FieldStorage()
if "departments" in fs.keys() and "campus" in fs.keys() and "year" in fs.keys() and "season" in fs.keys() and "maxcode" in fs.keys():
    deptString = fs["departments"].value
    campus = fs["campus"].value
    year = fs["year"].value
    season = fs["season"].value
    max_code = fs["maxcode"].value
else:
    sys.exit(0)

departments = [x for x in deptString.split(",")]

#departments = ["MATH"]
#campus = "UBC"
#year = "2013"
#season = "S"
#max_code = "499"

node_counter = 0
nodes = {}
edges = []
xmlfile = None

if year == "ALL":
    xmlfile = "ALL_" + campus + "_courses.xml"
else:
    xmlfile = year + season + "_" + campus + "_courses.xml"

tree = ET.parse(xmlfile)
root = tree.getroot()
allDepts = root.findall('dept')

# Create a new OR node
def create_or_node():
    global node_counter
    i = node_counter
    nodes[i] = "OR"
    node_counter += 1
    return i

# Create a new AND node
def create_and_node():
    global node_counter
    i = node_counter
    nodes[i] = "AND"
    node_counter += 1
    return i

# Add an edge
def add_edge(source_id, target_id, isCoreq):
    if isCoreq:
        edges.append((source_id, target_id, "coreq"))
    else:
        edges.append((source_id, target_id, "prereq"))

# If course node doesn't already exist, create it (whether the course is offered at UBC or not). Return id of node.
def create_course_node(course):
    
    for key, val in nodes.items():
        if val == course:
            return key
        
    global node_counter
    i = node_counter
    nodes[i] = course
    node_counter += 1
    return i

def clean_list(tuple_list):
    stripped = tuple_list[0][0].strip().strip(",")
    components = stripped.split(",")
    newlist = [c.strip() for c in components]
    newlist.append(tuple_list[0][1])
    return newlist

def clean_and_list(tuple_list):
    tuple = tuple_list[0]
    newlist = [c.strip() for c in tuple]
    return newlist

# Recursively take apart the prereqs string, creating nodes and edges as needed
def dissect_prereqs(target_id, prereqs, isCoreq):
    
    either_matches = re.findall(either, prereqs)
    allof_matches = re.findall(all_of, prereqs)
    oneof_matches = re.findall(one_of, prereqs)
    and_matches = re.findall(and_exp, prereqs)
    course_matches = re.findall(course_exp, prereqs)

    if either_matches:
        # Create an OR node and recurse with two components

        logfile.write(nodes[target_id] + " " + str(either_matches) + "\n")
        
        if len(either_matches) > 1:
            # Multiple "either"s... things are getting crazy:

            either_and_matches = re.findall(either_and_either, prereqs)
            logfile.write("Either_and_matches: " + nodes[target_id] + " " + str(either_and_matches) + "\n")
            
            if either_and_matches:
                and_id = create_and_node()
                for prereq in either_and_matches[0]:
                    logfile.write(prereq + "\n")
                    dissect_prereqs(and_id, prereq, isCoreq)
                add_edge(and_id, target_id, isCoreq)

            either_or_matches = re.findall(either_or_either, prereqs)
            if either_or_matches:
                or_id = create_or_node()
                for prereq in either_or_matches[0]:
                    dissect_prereqs(or_id, prereq, isCoreq)
                add_edge(or_id, target_id, isCoreq)
            
        else:
            or_id = create_or_node()
            add_edge(or_id, target_id, isCoreq)
            for t in either_matches[0]:
                if len(t) > 0:
                    dissect_prereqs(or_id, t, isCoreq)
            
    elif allof_matches:
        allof_list = clean_list(allof_matches)
        # Create an AND node and recurse over its components
        and_id = create_and_node()
        for prereq in allof_list:
            dissect_prereqs(and_id, prereq, isCoreq)
        add_edge(and_id, target_id, isCoreq)
        
    elif oneof_matches and not "and one of " in prereqs:
        oneof_list = clean_list(oneof_matches)
        # Create an OR node and recurse over its components
        or_id = create_or_node()
        for prereq in oneof_list:
            dissect_prereqs(or_id, prereq, isCoreq)
        add_edge(or_id, target_id, isCoreq)
        
    elif and_matches:
        and_list = clean_and_list(and_matches)
        # Create an AND node and recurse over its components
        and_id = create_and_node()
        for prereq in and_list:
            dissect_prereqs(and_id, prereq, isCoreq)
        add_edge(and_id, target_id, isCoreq)
        
    elif course_matches:
        # Create a course node (but only if the course exists)
        for prereq in course_matches:
            prereq_id = create_course_node(prereq)
            add_edge(prereq_id, target_id, isCoreq)

def get_course_element(coursename):
    dept = coursename.split()[0].strip()
    coursecode = coursename.split()[1].strip()
    courseElement = None
    
    for deptElement in allDepts:
        if deptElement.get('name') == dept:
            courses = deptElement.findall('course')
            for c in courses:
                if c.get('key') == coursecode:
                    courseElement = c
                    break
            break
    return courseElement

# Collapse any AND or OR nodes that only have one child
def collapse_single_child_logic_nodes():
    
    for key, value in nodes.items():
        if not (value == "OR" or value == "AND"):
            continue

        # Get all edges pointing into it
        incomingedges = [e for e in edges if e[1] == key]
        if len(incomingedges) > 1:
            continue

        # Get edge to parent
        parentedge = None
        for edge in edges:
            if edge[0] == key:
                parentedge = edge
                break

        # Reroute child node to parent and delete OR/AND node
        if parentedge:
            if len(incomingedges) == 1:
                edges.remove(incomingedges[0])
                edges.append((incomingedges[0][0], parentedge[1], parentedge[2]))
            edges.remove(parentedge)
            del nodes[key]
        else:
            print "ERROR: OR or AND node with no parent!"

course_descr_fname = None
#course_descr_fname = 'course_descriptions.txt'

#currentTime = datetime.now()
#logfile.write("About to start getCourseAndPrereqMap at " + str(currentTime.second) + " " + str(currentTime.microsecond) + "\n")

# Get every requested department from the big xml tree
for dept in allDepts:
    deptname = dept.get('name')

    if deptname in departments:

        # For every course in the department, create a node
        for course in dept.findall('course'):
            coursename = deptname + " " + course.get('key')
            numerical_code = re.sub(r"[A-Z]", "", course.get('key'))
            if int(numerical_code) < int(max_code):
                node_id = create_course_node(coursename)
            
                prereqs = course.get('prereqs')
                coreqs = course.get('coreqs')

                if prereqs:
                    dissect_prereqs(node_id, prereqs, False)
                if coreqs:
                    dissect_prereqs(node_id, coreqs, True)

collapse_single_child_logic_nodes()

#currentTime = datetime.now()
#logfile.write("About to reformat network at " + str(currentTime.second) + " " + str(currentTime.microsecond) + "\n")

# Write nodes to array of dictionaries
nodesObj = []
for id, name in nodes.items():
    nodeDict = {}
    nodeDict["id"] = id
    
    if name == "OR" or name == "AND":
        nodeDict["logic"] = name
    else:
        dept = name.split()[0].strip()
        coursekey = name.split()[1].strip()
        nodeDict["name"] = name
        
	courseElement = get_course_element(name)

        if courseElement == None:
	    nodeDict["title"] = "NA"
            nodeDict["descr"] = "Not offered at UBC in the selected session(s)." 
	    nodeDict["classSize"] = 100
	else:
            nodeDict["classSize"] = courseElement.get("size")
       	    nodeDict["title"] = courseElement.get("title")
            nodeDict["descr"] = courseElement.get("descr")
            nodeDict["session"] = courseElement.get("session")
            prereqs = courseElement.get("prereqs")
            coreqs = courseElement.get("coreqs")
            prereqnote = courseElement.get("prereqnote")
            if prereqs:
                nodeDict["prereqs"] = prereqs
            if coreqs:
                nodeDict["coreqs"] = coreqs
            if prereqnote:
                nodeDict["prereqnote"] = prereqnote
        
            course_year = int(name.split()[1][0])
            if course_year < 1:
                course_year = 1
            if course_year > 4:
                course_year = 4
            nodeDict["year"] = course_year
        
    nodesObj.append(nodeDict)

edgesObj = []
for edge in edges:
    edgeDict = {}
    edgeDict["source"] = edge[0]
    edgeDict["target"] = edge[1]
    edgeDict["type"] = edge[2]
    edgesObj.append(edgeDict)

output = {"nodes": nodesObj, "edges": edgesObj}

#print nodesObj, "\n\n"
#print edgesObj

logfile.write(str(nodesObj) + "\n\n" + str(edgesObj))

#currentTime = datetime.now()
#logfile.write("Finished CourseNetworkCrawlWeb.py at " + str(currentTime.second) + " " + str(currentTime.microsecond) + "\n")

print json.dumps(output)
