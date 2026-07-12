import os

env_path = r'c:\Users\kishore ST\Desktop\certificate\backend\.env'
with open(env_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('SMTP_PASS='):
        # Correcting the typo: f p l j  n d x f  j k h r  r q r f
        new_lines.append('SMTP_PASS=fpljndxfjkhrrqrf\n')
        print("Updated SMTP_PASS to correct 16-character version.")
    else:
        new_lines.append(line)

with open(env_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
