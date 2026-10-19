"""Render og.png, the 1200x630 share card. Needs Pillow and DejaVu Sans Mono."""
from PIL import Image, ImageDraw, ImageFont

F = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
img = Image.new("RGB", (1200, 630), "#0d1117")
d = ImageDraw.Draw(img)
d.rectangle([60, 60, 1140, 570], fill="#161b22", outline="#30363d", width=2)
d.text((110, 100), "lzgolf", font=ImageFont.truetype(FB, 96), fill="#3fb950")
d.text((112, 215), "a daily byte-golf puzzle", font=ImageFont.truetype(F, 34), fill="#8b949e")
f = ImageFont.truetype(F, 40)
d.text((112, 320), "target   abababababababab", font=f, fill="#e6edf3")
d.text((112, 390), "program  8{ab}", font=f, fill="#3fb950")
d.text((112, 460), "score    5 chars  (par)", font=f, fill="#d29922")
img.save("og.png", optimize=True)
