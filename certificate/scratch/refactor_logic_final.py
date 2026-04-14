import os
import re

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\UserDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Refactored filtering and search logic for the internal batch view
logic_refactor = """                      const filteredCerts = certs
                        .filter(c => {
                           const matchesSearch = c.name?.toLowerCase().includes(certSearch.toLowerCase()) || 
                                                 c.email?.toLowerCase().includes(certSearch.toLowerCase()) ||
                                                 c.certificateId?.toLowerCase().includes(certSearch.toLowerCase());
                           
                           let matchesStatus = true;
                           if (localStatusFilter === 'sent') matchesStatus = c.status === 'Sent';
                           else if (localStatusFilter === 'ready') matchesStatus = (c.status === 'Pending' || c.status === 'Failed');
                           
                           return matchesSearch && matchesStatus;
                        })
                        .sort((a,b) => {
                           const valA = (a.name || '').toString().toLowerCase();
                           const valB = (b.name || '').toString().toLowerCase();
                           if (localSortOrder === 'asc') return valA.localeCompare(valB);
                           return valB.localeCompare(valA);
                        });"""

# Simple replacement for the block
pattern = r"const filteredCerts = certs[\s\S]*?\.sort\(\(a,b\) => \{[\s\S]*?if \(certSort\.dir === 'asc'\) return valA\.localeCompare\(valB\);[\s\S]*?return valB\.localeCompare\(valA\);[\s\S]*?\}\);"
content = re.sub(pattern, logic_refactor, content)

# Remove the batch-hiding logic
content = content.replace("if (filteredCerts.length === 0 && statusFilter !== 'all') return null;", "// Local batch filtering keeps batch visible")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("UserDashboard.jsx logic refactored successfully.")
