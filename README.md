# Wordle Birthday Surprise

A lightweight Wordle-style game that reveals a personalized birthday page when the player wins.

## Quick start

1. Open `index.html` in a browser (no build needed).
2. To personalize, edit the `CONFIG` object in `script.js`:
   - `friendName`, `birthdayMessage`
   - `galleryImages` (add files under `assets/`)
   - `videoEmbedHtml` (optional YouTube/Vimeo iframe)
   - `solutionWord` (set a custom 5-letter word, or leave `null` for daily random)

You can also override via URL, for easy sharing:

- `?name=Alex` sets the display name
- `?msg=You%20are%20the%20best!` custom message
- `?word=CAKES` forces the solution

Example:

```
index.html?name=Alex&msg=Have%20an%20amazing%20day!&word=CAKES
```

## Deploy

- GitHub Pages: push and enable Pages on the repo.
- Netlify/Vercel: drag-and-drop the folder, or deploy as a static site.

## Notes

- The word list is intentionally small; update `WORDS` in `script.js` if you want more.
- The layout is responsive and works well on mobile.


