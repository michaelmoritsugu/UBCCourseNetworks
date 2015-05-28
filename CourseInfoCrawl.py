#!/usr/bin/env python

# This script reads information about all the departments and courses in each campus and session.
# For each campus and session, it writes all this information to an xml file.

import urllib2
import xml.etree.ElementTree as ET
import os
import re
import xml.parsers.expat as expat
import datetime

#The url that you are using can provide data in html or xml format. The parameters that can be passed to the course schedule are laid out below. Note that the req parameter is the overriding parameter, any extra parameters passed that aren't necessary for the specified request type will be discarded. If a required parameter is missing for a given request type, the entire request will be dicarded and an empty set returned:
 
# sessyr=[year i.e 2012]
# sesscd=[W or S for winter and summer respectively]
# req=[0-5] where 0-5 signifies (passing in the corresponding values from dept, course and section below):
# 0 = Show all subject areas.
# 1 = Show a single specific subject area.
# 2 = Show all courses for a department.
# 3 = Show a single specific course.
# 4 = Show all sections for a course.
# 5 = Show a single specific section.
# dept=[department code i.e CHEM]
# course=[course number i.e. 232]
# section=[section number i.e. 208 or 92X]
# campuscd=[admin campus i.e. UBC or UBCO] if not specified, default to UBC
# output=[0-3] where 0-3 signifies:
# 0 = Summary html output.
# 1 = Detailed html output.
# 2 = Summary xml output.
# 3 = Detailed xml output.

baseURL ="https://courses.students.ubc.ca/cs/servlets/SRVCourseSchedule?"
valid_sessions = []
campuses = ["UBC", "UBCO"]
max_attempts = 10
max_course_code = 499
compile_file = False

def getResponse(url):
    try:
        req = urllib2.Request(url)
        response = urllib2.urlopen(req)
        return response
    
    except URLError as e:
        if hasattr(e, 'reason'):
            print 'We failed to reach a server.'
            print 'Reason: ', e.reason
        elif hasattr(e, 'code'):
            print 'The server couldn\'t fulfill the request.'
            print 'Error code: ', e.code
        return None

# Get the "next" year code for a UBC session, e.g. if given 2013 S, return 2013
def getNextYear(year, season):
    if season == 'W':
        return year + 1
    else:
        return year

# Get the "previous" year code for a UBC session, e.g. if given 2013 S, return 2012
def getPrevYear(year, season):
    if season == 'W':
        return year
    else:
        return year - 1


def sessionExists(year, season):

    finalURL = baseURL + "&sessyr=" + str(year) + "&sesscd=" + season + "&req=0&output=3"

    try:
        req = urllib2.Request(finalURL)
        response = urllib2.urlopen(req)
    except URLError as e:
        if hasattr(e, 'reason'):
            print 'We failed to reach a server.'
            print 'Reason: ', e.reason
        elif hasattr(e, 'code'):
            print 'The server couldn\'t fulfill the request.'
            print 'Error code: ', e.code

    try:
        tree = ET.parse(response)
        root = tree.getroot()
        return True
    except (expat.ExpatError, ET.ParseError) as e:
        return False

def getValidSessions():
    now = datetime.datetime.now()
    potential_sessions = []

    if 4 <= now.month <= 7:
        currseason = 'S'
        oppseason = 'W'
    else:
        currseason = 'W'
        oppseason = 'S'

    # Current session is always valid
    valid_sessions.append(str(now.year) + currseason)

    # Add two previous sesssions and two future sessions to the list of ones to try
    prevYear = getPrevYear(now.year, currseason)
    nextYear = getNextYear(now.year, currseason)
    potential_sessions.append(str(getPrevYear(prevYear, oppseason)) + currseason)
    potential_sessions.append(str(prevYear) + oppseason)
    potential_sessions.append(str(nextYear) + oppseason)
    potential_sessions.append(str(getNextYear(nextYear, oppseason)) + currseason)

    # Test potential sessions to see if they exist on the SSC
    for session in potential_sessions:
        if sessionExists(session[:4], session[4:5]):
            valid_sessions.append(session)

# Get a list of all UBC departments
def getAllDepartments(year, season, campus):
    departments = None

    finalURL = baseURL + "campuscd=" + campus + "&sessyr=" + year + "&sesscd=" + season + "&req=0&output=3"
    attempts = 0

    while not departments and attempts <= max_attempts: 
        try:
            req = urllib2.Request(finalURL)
            response = urllib2.urlopen(req)
        except URLError as e:
            if hasattr(e, 'reason'):
                print 'We failed to reach a server.'
                print 'Reason: ', e.reason
            elif hasattr(e, 'code'):
                print 'The server couldn\'t fulfill the request.'
                print 'Error code: ', e.code
        
        tree = ET.parse(response)
        root = tree.getroot()
        departments = [x.get('key') for x in root.findall('dept') if not x.get('key').startswith('HX')]

        if attempts == max_attempts:
            return False
        attempts += 1

    return departments

# Add the department element, already formatted from the SSC, to the root of the tree
def getDeptElement(deptsElement, dept, year, season, campus):

    finalURL = baseURL + "campuscd=" + campus + "&sessyr=" + year + "&sesscd=" + season + "&req=2&dept=" + dept + "&output=3"
    attempts = 0
    success = False

    try:
        req = urllib2.Request(finalURL)
        response = urllib2.urlopen(req)
    except URLError as e:
        if hasattr(e, 'reason'):
            print 'We failed to reach a server.'
            print 'Reason: ', e.reason
        elif hasattr(e, 'code'):
            print 'The server couldn\'t fulfill the request.'
            print 'Error code: ', e.code

    s = response.read()
    s_decoded = s.decode("ISO-8859-1").encode("UTF-8")

    deptElement = ET.Element('dept')
    deptElement.attrib['name'] = dept

    try:
        root = ET.fromstring(s_decoded)
    except:
        print "Could not get department " + dept + ": invalid xml"
        return deptElement

    #root.tag = 'dept'
    #root.attrib['name'] = dept
    #return root

    if root:
        for course in root.findall('course'):
            courseElement = ET.SubElement(deptElement, 'course')
            prereqs = course.get('prereqs')
            coreqs = course.get('coreqs')
            prereqnote = course.get('prereqnote')
            descr = course.get('descr')
            courseElement.attrib['key'] = course.get('key')
            if prereqs:
                courseElement.attrib['prereqs'] = prereqs
            if coreqs:
                courseElement.attrib['coreqs'] = coreqs
            if prereqnote:
                courseElement.attrib['prereqnote'] = prereqnote
                
            courseElement.attrib['title'] = course.get('title')
            if descr:
                courseElement.attrib['descr'] = course.get('descr')

            # Get course size
            size = getCourseSize(dept, course.get('key'), year, season, campus)
            if size:
                courseElement.attrib['size'] = str(size)
                
            if compile_file:
                description = clean(course.get('descr'))
                f_descr.write(description + '\n')
                #print ET.tostring(courseElement)

    return deptElement

def getSectionSizeFromHTML(text):
    remaining_match = re.search(r"Total Seats Remaining:</td><td align=left><strong>(\d+)</strong>", text)
    registered_match = re.search(r"Currently Registered:</td><td align=left><strong>(\d+)</strong>", text)

    if remaining_match and registered_match:
        return int(remaining_match.group(1)) + int(registered_match.group(1))
    else:
        return None

# Get total number of seats in a course over a year
def getCourseSize(dept, course_number, year, season, campus):
    finalURL = baseURL + "campuscd=" + campus + "&sessyr=" + year + "&sesscd=" + season + "&req=4&dept=" + dept + "&course=" + course_number + "&output=3"
    sections = []
    
    response = getResponse(finalURL)
    if not response:
        return None

    s = response.read()
    s_decoded = s.decode("ISO-8859-1").encode("UTF-8")

    try:
        root = ET.fromstring(s_decoded)
    except:
        print "Couldn't get course size for " + dept + " " + course_number + ": invalid xml"
        return None

    activities = [s.get('activity') for s in root.findall('section')]
    if len(activities) == 0:
        return None

    # Filter sections depending on activity (waiting list vs laboratory vs lecture)
    if not 'Lecture' in activities:
        if ('Laboratory' in activities and not 'Tutorial' in activities) or ('Tutorial' in activities and not 'Laboratory' in activities):
            sections = [s.get('key') for s in root.findall('section') if not s.get('activity') == 'Waiting List']

        elif 'Laboratory' in activities and 'Tutorial' in activities:
            sections.extend([s.get('key') for s in root.findall('section') if s.get('activity') == 'Tutorial'])

        else:
            sections.extend([s.get('key') for s in root.findall('section') if not s.get('activity') == 'Waiting List'])

    else:
        sections = [s.get('key') for s in root.findall('section') if s.get('activity') == 'Lecture' and not s.get('key') == '000']

    # Look up the number of seats for each section
    class_size = 0
        
    for section in sections:
        sectionURL = baseURL + "campuscd=" + campus + "&sessyr=" + year + "&sesscd=" + season + "&req=5&dept=" + dept + "&course=" + course_number + "&section=" + section + "&output=1"
        sectResponse = getResponse(sectionURL)
        if not sectResponse:
            return None

        text = sectResponse.read()
        sect_size = getSectionSizeFromHTML(text)

        if sect_size:
            class_size += sect_size
        else:
            pass

        #print dept + " " + str(course_number) + ": " + str(class_size)
    return class_size

def crawl(year, season, campus):
    departments = getAllDepartments(year, season, campus)
    allDepts = ET.Element('depts')
    
    for dept in departments:
        print dept
        deptElement = getDeptElement(allDepts, dept, year, season, campus)
        
        allDepts.append(deptElement)
        if deptElement == None:
            print "ERROR: " + str(dept)

    with open(str(year) + season + "_" + campus + "_courses.xml", 'w') as f:
        tree = ET.ElementTree(allDepts)
        tree.write(f)

# Compile all the XML files for different sessions into one (for a given campus)
def combineAllSessions(campus):
    print "Creating combined XML file for all sessions at " + campus
    
    filename = r"([0-9]{4}[WS])_" + campus + "_courses.xml"
    files = [f for f in os.listdir('.') if os.path.isfile(f)]
    roots = []
    sessions = []
    lastroot = None
    lastsession = None
    lasttree = None

    for file in files:
        m = re.match(filename, file)
        if not m:
            continue
        
        session = m.group(1)
        tree = ET.parse(file)
        if (not lastsession) or (int(session[:4]) > int(lastsession[:4])) or (int(session[:4]) == int(lastsession[:4]) and session[4:5] == "W" and lastsession[4:5] == "S"):
            if lastsession:
                sessions.append(lastsession)
                roots.append(lastroot)
            lastsession = session
            lastroot = tree.getroot()
            lasttree = tree
        else:    
            roots.append(tree.getroot())
            sessions.append(session)

    if not lastroot:
        print "ERROR: Couldn't find root of last session"
        sys.exit(0)

    lastdepts = lastroot.findall('dept')
    lastdeptnames = [d.get('name') for d in lastdepts]
    print "... Latest session: " + lastsession
    print "... Previous sessions: " + ", ".join(sessions)

    # For every course in lastroot, add the session as a child
    for dept in lastroot.findall('dept'):
        for course in dept.findall('course'):
            course.set('session', lastsession)

    # For every root in roots, check if a course is in the lastroot.
    # If it is, sum the class sizes. If it isn't, add it!
    for i,r in enumerate(roots):
        for dept in r.findall('dept'):
            lastdept = None
            if not dept.get('name') in lastdeptnames:
                # Add department
                lastroot.append(dept)
                continue
            else:
                lastdept = next(x for x in lastdepts if x.get('name') == dept.get('name'))
            
            for course in dept.findall('course'):
                lastcourse = next((c for c in lastdept.findall('course') if c.get('key') == course.get('key')), None)
                if lastcourse != None:
                    # Course exists in lastroot
                    if course.get('size') != None and lastcourse.get('size') != None:
                        lastcourse.set('size', str(int(course.get('size')) + int(lastcourse.get('size'))))
                    elif course.get('size') != None:
                        lastcourse.set('size', course.get('size'))
                            
                else:
                    # Course doesn't exist in lastroot; add it
                    lastdept.append(course)
                    lastcourse = course

                if lastcourse.get('session') == None:
                    lastcourse.set('session', sessions[i])
                else:
                    lastcourse.set('session', lastcourse.get('session') + "," + sessions[i])

    outputfile = "ALL_" + campus + "_courses.xml"
    lasttree.write(outputfile)
    print "Wrote compiled course info to " + outputfile

getValidSessions()

for campus in campuses:
    for session in valid_sessions:
        print "Getting information for " + campus + " " + session
        crawl(session[:4], session[4:5], campus)

    combineAllSessions(campus)
