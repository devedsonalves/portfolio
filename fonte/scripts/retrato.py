"""Trata o retrato (fundo cinza de estúdio) para o preto quente da página e exporta em WebP.

Entrada: fonte/fotos/edson.png    Saída: public/img/retrato-<largura>.webp e retrato-vertical-<largura>.webp
O fundo cinza cai no preto por uma máscara de luz (o que é claro e pouco saturado escurece) e uma vinheta
em volta do rosto; o rosto e a camiseta ficam. uso, da raiz: python fonte/scripts/retrato.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

RAIZ = os.getcwd()
SAIDA = os.path.join(RAIZ, 'public', 'img')
PRETO = np.array([12, 12, 13], float) / 255.0

img = Image.open(os.path.join(RAIZ, 'fonte', 'fotos', 'edson.png')).convert('RGB')
W, H = img.size
a = np.asarray(img, float) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
sat = a.max(-1) - a.min(-1)

# pele: quente (r > b) e saturada; o fundo cinza: pouca saturação e luz média
pele = np.clip((sat - 0.07) * 14, 0, 1) * np.clip((r - b) * 10, 0, 1)
pele = np.asarray(Image.fromarray((pele * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), float) / 255
# vinheta em volta da cabeça e dos ombros
y, x = np.mgrid[0:H, 0:W]
cx, cy = W * 0.505, H * 0.48
d = np.sqrt(((x - cx) / (W * 0.30)) ** 2 + ((y - cy) / (H * 0.62)) ** 2)
vin = np.clip(1.25 - d * 0.75, 0, 1) ** 1.6
# o fundo (claro e cinza) escurece; a pele e o preto da camiseta não mudam
fundo = np.clip((lum - 0.12) * 4, 0, 1) * (1 - pele)
esc = 1 - fundo * 0.86
a = a * esc[..., None]
# luz quente, menos exposição e a vinheta
a = a * np.array([1.02, 0.99, 0.95])
a = np.clip(a * 0.92, 0, 1) ** 1.12
a = a * (0.15 + 0.85 * vin)[..., None]
a = PRETO + a * (1 - PRETO)
out = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))


def exportar(im, nome, larguras, q=84):
    for w in larguras:
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save(os.path.join(SAIDA, f'{nome}-{w}.webp'), quality=q, method=6)
        print(nome, w, h)


# 3:2, o rosto um pouco à esquerda do centro (a foto ocupa a direita da seção, esfumada à esquerda)
cw = round(H * 1.5)
x0 = int(np.clip(W * 0.505 - cw * 0.42, 0, W - cw))
exportar(out.crop((x0, 0, x0 + cw, H)), 'retrato', [1000, 1400])
# celular: 6:7, o rosto no centro
vw = round(H * 6 / 7)
x0 = int(W * 0.505 - vw / 2)
exportar(out.crop((x0, 0, x0 + vw, H)), 'retrato-vertical', [800])
out.save(os.path.join(RAIZ, 'fonte', 'fotos', 'edson-tratada.jpg'), quality=90)
