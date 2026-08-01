Drop your college photos in THIS folder.

How it works
------------
1. Copy your image files here, e.g.:
     campus.jpg
     hostel-2001.jpg
     farewell.png

2. Open  src/data/gallery.js  and list the filenames you added, e.g.:
     export const galleryImages = [
       { src: '/gallery/campus.jpg',       caption: 'Main campus' },
       { src: '/gallery/hostel-2001.jpg',  caption: 'Hostel days' },
       { src: '/gallery/farewell.png',     caption: 'Farewell 2001' },
     ];

3. Save. The gallery on the landing page updates automatically.

Tips
----
- Keep each image under ~1 MB so the page loads fast. Resize large photos first.
- Landscape (wide) photos look best in the grid.
- Supported: .jpg .jpeg .png .webp .gif
- The "/gallery/..." path is relative to this public folder — don't include "public".
