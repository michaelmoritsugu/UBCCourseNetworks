#!/usr/bin/env python

# Return a list of valid UBC sessions

import os
import re
import json

print "Content-type: application/json\n\n"

logfile = open('logfile.txt', 'w')
logfile.write("hello")

valid_sessions = []

filename = r"([0-9]{4}[WS])_UBC_courses.xml"

files = [f for f in os.listdir('.') if os.path.isfile(f)]

logfile.write('\n'.join(files))

for file in files:
    m = re.match(filename, file)
    if m:
        valid_sessions.append(m.group(1))

print json.dumps(valid_sessions)
