import os
import re

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\UserDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add local states
state_insertion = """  const [expandedReceivedBatch, setExpandedReceivedBatch] = useState(null);
  const [localStatusFilter, setLocalStatusFilter] = useState('all');
  const [localSortOrder, setLocalSortOrder] = useState('asc');"""

content = content.replace("  const [expandedReceivedBatch, setExpandedReceivedBatch] = useState(null);", state_insertion)

# 2. Hide global status filter on Managed tab
content = content.replace(
    "{activeTab === 'managed' && (",
    "{activeTab === 'managed' && false && (" # Temporarily hiding the global status filter container for managed tab
)

# 3. Update the internal batch control UI
# We need to find the internal bar we added previously and replace it with the new logic
# Target the block between the internal filter controls comment and the internal sort controls
new_internal_ui = """                                   {/* Internal Filter Controls */}
                                   <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 shrink-0">
                                      {['all', 'ready', 'sent'].map(status => (
                                        <button 
                                          key={status}
                                          onClick={(e) => { e.stopPropagation(); setLocalStatusFilter(status); }}
                                          className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${localStatusFilter === status ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                          {status === 'ready' ? 'Ready to Send' : status}
                                        </button>
                                      ))}
                                   </div>
                                 </div>

                                 <div className="flex items-center space-x-3 w-full md:w-auto">
                                    {/* Internal Sort Controls */}
                                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 shrink-0">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setLocalSortOrder(localSortOrder === 'asc' ? 'desc' : 'asc'); }}
                                        className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all bg-zinc-800 text-white shadow-sm hover:text-indigo-400`}
                                      >
                                        Sort: {localSortOrder === 'asc' ? 'A-Z ↑' : 'Z-A ↓'}
                                      </button>
                                    </div>"""

# 4. Update the logic for filteredCerts to use local controls
logic_refactor = """    const certs = generatedCerts.filter(c => c.batchId === batchId);
    
    // Apply LOCAL Filter
    let filteredCerts = certs;
    if (localStatusFilter === 'sent') {
      filteredCerts = certs.filter(c => c.status === 'Sent');
    } else if (localStatusFilter === 'ready') {
      filteredCerts = certs.filter(c => c.status === 'Pending' || c.status === 'Failed');
    }

    // Apply LOCAL Search
    if (certSearch) {
      filteredCerts = filteredCerts.filter(c => 
        c.name.toLowerCase().includes(certSearch.toLowerCase()) || 
        c.certificateId.toLowerCase().includes(certSearch.toLowerCase())
      );
    }

    // Apply LOCAL Sort
    filteredCerts.sort((a,b) => {
      if (localSortOrder === 'asc') return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });"""

# This logic refactor needs to replace the lines matching the original filtering logic inside the map
# I'll use a regex to find the block inside the .map((batchId) => { ... })
content = re.sub(
    r"const certs = generatedCerts\.filter\(c => c\.batchId === batchId\);[\s\S]*?const filteredCerts = certs[\s\S]*?if \(certSearch\) \{[\s\S]*?\}[\s\S]*?const sortedCerts = \[...filteredCerts\]\.sort[\s\S]*?\}\);",
    logic_refactor,
    content
)

# Replace the UI bar as well
# I'll look for the comment anchors I added previously
content = re.sub(
    r"\{/\* Internal Filter Controls \*/\}[\s\S]*?\{/\* Internal Sort Controls \*/\}[\s\S]*?Sort: \{certSort\.key === 'status' && \(certSort\.dir === 'asc' \? '↑' : '↓'\)\}[\s\S]*?</button>[\s\S]*?</div>",
    new_internal_ui,
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("UserDashboard.jsx refactored successfully.")
