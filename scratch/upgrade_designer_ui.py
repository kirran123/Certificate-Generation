import os
import re

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\TemplateDesigner.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Imports
content = content.replace(
    '  PenTool,\n  Loader2,\n} from "lucide-react";',
    '  PenTool,\n  Loader2,\n  Type,\n  Bold,\n  Baseline,\n} from "lucide-react";'
)

# 2. Update the Field rendering on Canvas to support styles
# Targeting the style object inside the fields.map loop
old_canvas_style = """                      fontSize: `${f.fontSize}px`,
                      color: `rgb(${f.color.r},${f.color.g},${f.color.b})`,
                      lineHeight: 1,
                    }"""

new_canvas_style = """                      fontSize: `${f.fontSize}px`,
                      color: `rgb(${f.color.r},${f.color.g},${f.color.b})`,
                      fontWeight: f.fontWeight || 'normal',
                      textTransform: f.textTransform || 'none',
                      fontFamily: f.fontFamily === 'serif' ? 'serif' : (f.fontFamily === 'mono' ? 'monospace' : 'sans-serif'),
                      lineHeight: 1,
                    }"""

content = content.replace(old_canvas_style, new_canvas_style)

# 3. Update the Property Panel (the sidebar element properties)
# We will inject the new controls before the 'Remove Box' button
new_controls = """                    {/* Typography Selector */}
                    <div className="space-y-3 pt-2">
                       <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Typography</span>
                       <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: 'sans', label: 'Sans', font: 'font-sans' },
                            { id: 'serif', label: 'Serif', font: 'font-serif' },
                            { id: 'mono', label: 'Mono', font: 'font-mono' }
                          ].map(fnt => (
                            <button
                              key={fnt.id}
                              onClick={() => {
                                const newFields = [...fields];
                                const idx = newFields.findIndex(f => f.id === selectedFieldId);
                                newFields[idx].fontFamily = fnt.id;
                                setFields(newFields);
                              }}
                              className={`py-1.5 rounded-lg border text-[10px] transition-all ${fields.find(f => f.id === selectedFieldId).fontFamily === fnt.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}
                            >
                               {fnt.label}
                            </button>
                          ))}
                       </div>
                       
                       <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              const newFields = [...fields];
                              const idx = newFields.findIndex(f => f.id === selectedFieldId);
                              newFields[idx].fontWeight = newFields[idx].fontWeight === 'bold' ? 'normal' : 'bold';
                              setFields(newFields);
                            }}
                            className={`p-2 rounded-lg border flex-1 flex items-center justify-center space-x-2 transition-all ${fields.find(f => f.id === selectedFieldId).fontWeight === 'bold' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}
                          >
                             <Bold className="w-3 h-3" />
                             <span className="text-[10px] font-bold">BOLD</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              const newFields = [...fields];
                              const idx = newFields.findIndex(f => f.id === selectedFieldId);
                              newFields[idx].textTransform = newFields[idx].textTransform === 'uppercase' ? 'none' : 'uppercase';
                              setFields(newFields);
                            }}
                            className={`p-2 rounded-lg border flex-1 flex items-center justify-center space-x-2 transition-all ${fields.find(f => f.id === selectedFieldId).textTransform === 'uppercase' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}
                          >
                             <Baseline className="w-3 h-3" />
                             <span className="text-[10px] font-bold">ALL CAPS</span>
                          </button>
                       </div>
                    </div>

                    <div className="space-y-2 pt-2">
                       <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Brand Colors</span>
                       <div className="grid grid-cols-6 gap-2">
                          {['#FFFFFF', '#000000', '#4F46E5', '#10B981', '#F59E0B', '#EF4444'].map(hex => (
                            <button
                              key={hex}
                              onClick={() => {
                                const newFields = [...fields];
                                const idx = newFields.findIndex(f => f.id === selectedFieldId);
                                const r = parseInt(hex.slice(1,3), 16);
                                const g = parseInt(hex.slice(3,5), 16);
                                const b = parseInt(hex.slice(5,7), 16);
                                newFields[idx].color = { r, g, b };
                                setFields(newFields);
                              }}
                              className="w-full aspect-square rounded-full border border-zinc-700 active:scale-90 transition-transform"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                       </div>
                    </div>

                    <button"""

content = content.replace("                    <button", new_controls)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("TemplateDesigner.jsx updated with styling controls.")
