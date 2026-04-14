import os
import re

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\UserDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Recipient Header
old_recipient = '<th className="px-8 py-4 font-bold">Recipient</th>'
new_recipient = """<th 
                                         className="px-8 py-4 font-bold cursor-pointer hover:text-white transition-colors"
                                         onClick={(e) => { e.stopPropagation(); setCertSort({ key: 'name', dir: certSort.dir === 'asc' ? 'desc' : 'asc' }); }}
                                       >
                                         <div className="flex items-center space-x-1">
                                           <span>Recipient</span>
                                           {certSort.key === 'name' && (certSort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                         </div>
                                       </th>"""

# 2. Update Status Header
old_status = '<th className="px-8 py-4 font-bold">Email Status</th>'
new_status = """<th 
                                         className="px-8 py-4 font-bold cursor-pointer hover:text-white transition-colors"
                                         onClick={(e) => { e.stopPropagation(); setCertSort({ key: 'status', dir: certSort.dir === 'asc' ? 'desc' : 'asc' }); }}
                                       >
                                         <div className="flex items-center space-x-1">
                                           <span>Email Status</span>
                                           {certSort.key === 'status' && (certSort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                         </div>
                                       </th>"""

# 3. Update hardcoded URL
old_url = 'href={`http://localhost:5000${cert.pdfUrl}`}'
new_url = "href={`${window.location.origin.replace('5173', '5000')}${cert.pdfUrl}`}"

# Apply changes
modified_content = content.replace(old_recipient, new_recipient)
modified_content = modified_content.replace(old_status, new_status)
modified_content = modified_content.replace(old_url, new_url)

if modified_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(modified_content)
    print("Dashboard UI and URLs updated successfully.")
else:
    print("No changes were made. Target strings not found.")
