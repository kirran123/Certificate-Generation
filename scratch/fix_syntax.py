import os

file_path = r'c:\Users\kishore ST\Desktop\certificate\frontend\src\pages\TemplateDesigner.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The extra </div> is at line 711 (index 710)
# Let's double check the content there
target_line = lines[710].strip()
if target_line == '</div>':
    print(f"Removing extra tag at line 711: {lines[710].strip()}")
    del lines[710]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
else:
    print(f"ERROR: Expected </div> at line 711, but found: {target_line}")
