import os
import re

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\UserDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The specific broken boundary
broken_boundary = """                                 </div>
{expandedBatch === batchId && ("""

fixed_boundary = """                                  {expandedBatch === batchId ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
                                </div>
                              </div>
                            </div>
                            
                            {expandedBatch === batchId && ("""

if broken_boundary in content:
    content = content.replace(broken_boundary, fixed_boundary)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("UserDashboard.jsx boundary fixed.")
else:
    # Try a more flexible regex if exact match fails
    pattern = r"</div>\s*\{expandedBatch === batchId && \("
    content = re.sub(pattern, fixed_boundary, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("UserDashboard.jsx boundary fixed via regex.")
