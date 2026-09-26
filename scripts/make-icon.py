from PIL import Image, ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parent.parent
im=Image.new('RGBA',(256,256),(0,0,0,0))
d=ImageDraw.Draw(im)
d.rounded_rectangle((8,8,248,248),radius=60,fill='#37664d')
d.ellipse((66,53,175,196),fill='#e8efdc')
d.polygon([(91,180),(125,129),(169,79),(200,57),(181,141),(154,177)],fill='#aac19e')
d.line([(79,204),(166,86)],fill='#37664d',width=9)
d.line([(121,145),(91,105)],fill='#37664d',width=7)
(root/'assets').mkdir(exist_ok=True)
im.save(root/'assets'/'icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
im.save(root/'electron'/'icon.png')
