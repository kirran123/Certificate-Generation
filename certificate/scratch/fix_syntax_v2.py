import os

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\TemplateDesigner.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 711 (index 710) is currently '       )}'
# It needs to be '       ))}'
print(f"Current line 711: '{lines[710]}'")
if lines[710].strip() == ')}':
    lines[710] = lines[710].replace(')}', '))}')
    print("Fixed line 711 to ))}")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
else:
    print(f"ERROR: Expected ')}' at line 711, but found: '{lines[710].strip()}'")
