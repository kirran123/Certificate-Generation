import os
import re

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\UserDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Reconstruct the batch rendering block to be perfectly balanced
start_line = -1
for i, line in enumerate(lines):
    if '.map((batchId) => {' in line and 'groupedBatches' in lines[i-1]:
        start_line = i
        break

if start_line == -1:
    for i, line in enumerate(lines):
        if 'groupedBatches' in line and '.map' in line:
            start_line = i
            break

if start_line != -1:
    print(f"Found map at line {start_line}")
    return_line = -1
    for i in range(start_line, len(lines)):
        if 'return (' in lines[i]:
            return_line = i
            break
    
    if return_line != -1:
        end_map_line = -1
        # Search for the end of the map. Look for the } from the mapping function and the ) from the return.
        # It's usually followed by the next section or the end of the JSX block.
        for i in range(return_line, len(lines)):
            if '                  })' in lines[i] or '                })' in lines[i]:
                end_map_line = i
                break
        
        if end_map_line != -1:
            print(f"Found end map at line {end_map_line}")
            
            new_block = [
                '                    return (\n',
                '                      <div key={batchId} className={`bg-zinc-900 border transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl relative ${expandedBatch === batchId ? "border-indigo-500/50" : "border-zinc-800 hover:border-zinc-700"}`}>\n',
                '                         <div \n',
                '                           onClick={() => setExpandedBatch(expandedBatch === batchId ? null : batchId)}\n',
                '                           className="px-8 py-6 bg-zinc-800/30 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"\n',
                '                         >\n',
                '                            <div className="flex items-center space-x-4">\n',
                '                               <div className={`p-2 rounded-lg transition-colors ${expandedBatch === batchId ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"}`}>\n',
                '                                  <Calendar className="w-5 h-5" />\n',
                '                               </div>\n',
                '                                <div>\n',
                '                                   <h3 className="text-lg font-bold text-white tracking-tight leading-tight">{batchId}</h3>\n',
                '                                   <div className="flex items-center space-x-2 mt-0.5">\n',
                '                                      <Clock className="w-3 h-3 text-zinc-500" />\n',
                '                                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">\n',
                '                                         {formatBatchTime(certs[0]?.createdAt)}\n',
                '                                      </span>\n',
                '                                      <span className="text-zinc-700">•</span>\n',
                '                                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">\n',
                '                                         {certs[0]?.templateId?.name || "Standard Template"}\n',
                '                                      </span>\n',
                '                                   </div>\n',
                '                                </div>\n',
                '                            </div>\n',
                '                            <div className="flex items-center space-x-6">\n',
                '                              <div className="flex items-center space-x-4 text-xs font-semibold">\n',
                '                                 <span className="text-emerald-400 flex items-center space-x-1.5">\n',
                '                                    <CheckCircle className="w-3.5 h-3.5" /> <span>{sent} Sent</span>\n',
                '                                 </span>\n',
                '                                 {failed > 0 && (\n',
                '                                   <span className="text-red-400 flex items-center space-x-1.5">\n',
                '                                      <div className="w-2 h-2 rounded-full bg-red-500 pulse" /> <span>{failed} Failed</span>\n',
                '                                   </span>\n',
                '                                 )}\n',
                '                                 {pending > 0 && (\n',
                '                                   <span className="text-zinc-500 flex items-center space-x-1.5">\n',
                '                                      <div className="w-2 h-2 rounded-full bg-zinc-700" /> <span>{pending} Pending</span>\n',
                '                                   </span>\n',
                '                                 )}\n',
                '                              </div>\n',
                '\n',
                '                              <div className="flex items-center space-x-2">\n',
                '                                <div className="flex space-x-2 mr-4 border-r border-zinc-800 pr-4">\n',
                '                                  <button \n',
                '                                    onClick={(e) => { e.stopPropagation(); setSelectedBatchId(batchId); setShowMappingModal(true); }}\n',
                '                                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 border border-zinc-700 transition-all"\n',
                '                                  >\n',
                '                                     <FileUp className="w-4 h-4" />\n',
                '                                     <span>Link Emails</span>\n',
                '                                  </button>\n',
                '\n',
                '                                  <button \n',
                '                                    onClick={(e) => { e.stopPropagation(); handleSendBatchEmails(certs); }}\n',
                '                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-30 active:scale-95"\n',
                '                                    disabled={(pending === 0 && failed === 0) || certs.every(c => !c.email)}\n',
                '                                  >\n',
                '                                     <Mail className="w-4 h-4" />\n',
                '                                     <span>Send Emails</span>\n',
                '                                  </button>\n',
                '                                </div>\n',
                '                                {expandedBatch === batchId ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}\n',
                '                              </div>\n',
                '                            </div>\n',
                '                         </div>\n',
                '                         \n',
                '                         {expandedBatch === batchId && (\n',
                '                            <div className="animate-in slide-in-from-top-2 duration-300">\n',
                '                               <div className="px-8 py-3 bg-zinc-900/50 border-b border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">\n',
                '                                  <div className="flex items-center space-x-3 w-full md:w-auto">\n',
                '                                    <div className="relative w-full md:w-64" onClick={(e) => e.stopPropagation()}>\n',
                '                                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />\n',
                '                                       <input\n',
                '                                          type="text"\n',
                '                                          placeholder="Search records..."\n',
                '                                          className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-lg py-1.5 pl-9 pr-4 text-xs text-zinc-300 focus:border-indigo-500/50 outline-none"\n',
                '                                          value={certSearch}\n',
                '                                          onChange={(e) => setCertSearch(e.target.value)}\n',
                '                                       />\n',
                '                                    </div>\n',
                '                                    \n',
                '                                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 shrink-0">\n',
                '                                       {["all", "ready", "sent"].map(status => (\n',
                '                                         <button \n',
                '                                           key={status}\n',
                '                                           onClick={(e) => { e.stopPropagation(); setLocalStatusFilter(status); }}\n',
                '                                           className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${localStatusFilter === status ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}\n',
                '                                         >\n',
                '                                           {status === "ready" ? "Ready to Send" : (status === "all" ? "All Records" : "Sent Recipients")}\n',
                '                                         </button>\n',
                '                                       ))}\n',
                '                                    </div>\n',
                '                                  </div>\n',
                '\n',
                '                                  <div className="flex items-center space-x-3 w-full md:w-auto">\n',
                '                                     <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 shrink-0">\n',
                '                                       <button \n',
                '                                         onClick={(e) => { e.stopPropagation(); setLocalSortOrder(localSortOrder === "asc" ? "desc" : "asc"); }}\n',
                '                                         className={`px-4 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all bg-zinc-800 text-white shadow-sm border border-zinc-700 hover:border-indigo-500/50`}\n',
                '                                       >\n',
                '                                         Order: {localSortOrder === "asc" ? "A to Z \u2191" : "Z to A \u2193"}\n',
                '                                       </button>\n',
                '                                     </div>\n',
                '                                     <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest whitespace-nowrap">\n',
                '                                        {filteredCerts.length} / {certs.length}\n',
                '                                     </p>\n',
                '                                  </div>\n',
                '                               </div>\n',
                '\n',
                '                               <div className="overflow-x-auto">\n',
                '                                 <table className="w-full text-left table-auto">\n',
                '                                   <thead>\n',
                '                                     <tr className="text-zinc-500 text-[10px] uppercase tracking-widest border-b border-zinc-800/50 bg-zinc-900/50">\n',
                '                                       <th \n',
                '                                          className="px-8 py-4 font-bold cursor-pointer hover:text-white transition-colors"\n',
                '                                          onClick={(e) => { e.stopPropagation(); setLocalSortOrder(localSortOrder === "asc" ? "desc" : "asc"); }}\n',
                '                                        >\n',
                '                                          <div className="flex items-center space-x-1">\n',
                '                                            <span>Recipient</span>\n',
                '                                            {localSortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}\n',
                '                                          </div>\n',
                '                                        </th>\n',
                '                                       <th className="px-8 py-4 font-bold">Identity</th>\n',
                '                                       <th className="px-8 py-4 font-bold">Status</th>\n',
                '                                       <th className="px-8 py-4 font-bold text-right">Actions</th>\n',
                '                                     </tr>\n',
                '                                   </thead>\n',
                '                                   <tbody className="divide-y divide-zinc-800/30">\n',
                '                                     {filteredCerts.map((cert) => (\n',
                '                                       <tr key={cert._id} className="hover:bg-zinc-800/10 transition-colors group">\n',
                '                                         <td className="px-8 py-4">\n',
                '                                           <div className="text-zinc-100 text-sm font-bold">{cert.name}</div>\n',
                '                                           <div className="text-zinc-500 text-xs">{cert.email || "(No email linked)"}</div>\n',
                '                                         </td>\n',
                '                                         <td className="px-8 py-4">\n',
                '                                            <div className="text-zinc-600 font-mono text-[10px] bg-zinc-800/50 w-fit px-2 py-0.5 rounded italic">\n',
                '                                               ID: {cert.certificateId}\n',
                '                                            </div>\n',
                '                                         </td>\n',
                '                                         <td className="px-8 py-4">\n',
                '                                            {cert.status === "Sent" ? (\n',
                '                                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-black tracking-widest">Sent</span>\n',
                '                                            ) : cert.email ? (\n',
                '                                              <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase font-black tracking-widest">Ready to Send</span>\n',
                '                                            ) : (\n',
                '                                              <span className="text-[9px] bg-zinc-800 text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded uppercase font-black tracking-widest">Missing Email</span>\n',
                '                                            )}\n',
                '                                         </td>\n',
                '                                         <td className="px-8 py-4 text-right">\n',
                '                                            <div className="flex justify-end space-x-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">\n',
                '                                               <a href={`${window.location.origin.replace("5173", "5000")}${cert.pdfUrl}`} target="_blank" rel="noreferrer" className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Download PDF">\n',
                '                                                  <Download className="w-4 h-4" />\n',
                '                                               </a>\n',
                '                                               <button onClick={(e) => { e.stopPropagation(); handleSendEmail(cert.certificateId); }} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-400 transition-colors" title="Resend Email">\n',
                '                                                  <Mail className="w-4 h-4" />\n',
                '                                               </button>\n',
                '                                            </div>\n',
                '                                         </td>\n',
                '                                       </tr>\n',
                '                                     ))}\n',
                '                                   </tbody>\n',
                '                                 </table>\n',
                '                               </div>\n',
                '                            </div>\n',
                '                          )}\n',
                '                       </div>\n',
                '                     );\n',
                '                  })\n'
            ]
            
            final_lines = lines[:return_line] + new_block + lines[end_map_line+1:]
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(final_lines)
            print("UserDashboard.jsx successfully rebuilt and balanced.")
