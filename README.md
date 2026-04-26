# Obsidian Auto Fold Headings

An Obsidian community plugin that automatically folds (collapses) specific markdown headings when you open a file, based on a customizable regular expression.

If you have specific sections in your notes that you always want collapsed by default (like an `## Archive`, `### Completed Tasks`), this plugin will automatically fold them for you while preserving any manual folds you've already made.

## Features

- **Automated Folding:** Instantly folds headings that match your custom pattern smoothly upon opening/switching to a note.
- **Customizable Regex:** Define exactly which headings to fold using regular expressions.
- **Non-Destructive:** Harmonizes with Obsidian's native folding—it won't overwrite or expand the headings you have manually collapsed.

## Usage

1. Install and enable the plugin in your Obsidian settings.
2. Go to **Settings -> Obsidian Auto Folder**.
3. Configure your settings:
   - **Heading regex**: Enter a Regular Expression to define which headings to fold.
   - **Fold delay (ms)**: Sets the delay before the plugin applies the folds. This ensures Obsidian has enough time to restore your previously saved manual folds before the plugin runs. You may increase this if your saved folds get overwritten.

### Regex Examples

- **`^Archive$`**  
  Folds only headings named exactly "Archive".
- **`completed|done`**  
  Folds headings containing the words "completed" or "done".
- **`/history/i`**  
  You can also use slash notation with flags. This folds any heading containing "history", ignoring case.

## License

This project is licensed under the MIT License.

