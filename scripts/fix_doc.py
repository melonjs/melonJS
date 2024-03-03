import os
import re

# fix badly formatted hyperlinks in the documentation (see https://github.com/melonjs/melonJS/issues/1216)

def replace_urls(directory):
    old_url_pattern = r'https://github.com/melonjs/melonJS/blob/master//Users/obiot/Documents/GitHub/melonJS/src/(.*?)(?=["\'>])'
    new_url_base = 'https://github.com/melonjs/melonJS/blob/master/src/'

    # Compile the regular expression for performance
    url_pattern = re.compile(old_url_pattern)

    # Replacement function that prints out the match before replacing it
    def replacement_function(match):
        old_url = match.group(0)
        new_url = new_url_base + match.group(1)
        # print(f"Replacing: {old_url} with: {new_url}")
        return new_url

    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    file_contents = f.read()

                # Use the replacement function to replace all occurrences of the old URL
                new_contents = url_pattern.sub(replacement_function, file_contents)

                if new_contents != file_contents:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_contents)
            except Exception as e:
                print(f"An error occurred with file: {file_path}, Error: {e}")

# Specify the directory to process
directory = 'docs/docs'
replace_urls(directory)