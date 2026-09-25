import os
import glob
import re

def replace_colors(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
        
    original_content = content
    
    # Replace blue and orange with red
    content = re.sub(r'bg-blue-([1-9]00)', r'bg-red-\1', content)
    content = re.sub(r'text-blue-([1-9]00)', r'text-red-\1', content)
    content = re.sub(r'border-blue-([1-9]00)', r'border-red-\1', content)
    content = re.sub(r'ring-blue-([1-9]00)', r'ring-red-\1', content)
    content = re.sub(r'shadow-blue-([1-9]00)', r'shadow-red-\1', content)
    
    content = re.sub(r'bg-orange-([1-9]00)', r'bg-red-\1', content)
    content = re.sub(r'text-orange-([1-9]00)', r'text-red-\1', content)
    content = re.sub(r'border-orange-([1-9]00)', r'border-red-\1', content)
    content = re.sub(r'ring-orange-([1-9]00)', r'ring-red-\1', content)
    content = re.sub(r'shadow-orange-([1-9]00)', r'shadow-red-\1', content)

    # Special handling for blue-50 and orange-50 (light backgrounds)
    content = re.sub(r'bg-blue-50', r'bg-red-50', content)
    content = re.sub(r'bg-orange-50', r'bg-red-50', content)

    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"Updated colors in {file_path}")

ts_files = glob.glob('src/**/*.tsx', recursive=True)
for file in ts_files:
    replace_colors(file)
