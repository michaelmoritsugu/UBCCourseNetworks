#!/usr/bin/env python

# Get all UBC departments
print "Content-type: application/json\n\n"

import json
import cgi
import xml.etree.ElementTree as ET

logfile = open('logfile.txt', 'w')
fs = cgi.FieldStorage()

if "campus" in fs.keys() and "year" in fs.keys() and "season" in fs.keys():
    campus = fs["campus"].value
    year = fs["year"].value
    season = fs["season"].value

# Read XML file for campus/year/season to get list of departments

tree = ET.parse(year + season + "_" + campus + "_courses.xml")
root = tree.getroot()
departments = []
for d in root:
    departments.append(d.get('name'))

print json.dumps(departments)
